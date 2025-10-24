import { experimental_createMCPClient as createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { OAuth2Tokens, MCPOAuth2Client, ensureValidAccessToken } from './oauth2-client';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MCPServerConfig {
  url: string;
  type: 'sse' | 'http';
  authType: 'bearer' | 'oauth2';
  // For bearer token authentication
  headers?: KeyValuePair[];
  // For OAuth2 authentication
  oauth2Tokens?: OAuth2Tokens;
}

export interface MCPClientManager {
  tools: Record<string, any>;
  clients: any[];
  cleanup: () => Promise<void>;
}

/**
 * Initialize MCP clients for API calls
 * This uses the already running persistent HTTP or SSE servers
 * Supports both bearer token and OAuth2 authentication
 */
export async function initializeMCPClients(
  mcpServers: MCPServerConfig[] = [],
  abortSignal?: AbortSignal
): Promise<MCPClientManager> {
  // Initialize tools
  let tools = {};
  const mcpClients: any[] = [];

  // Process each MCP server configuration
  for (const mcpServer of mcpServers) {
    try {
      let headers: Record<string, string> = {};

      // Handle authentication based on authType
      if (mcpServer.authType === 'oauth2') {
        // OAuth2 authentication
        if (!mcpServer.oauth2Tokens) {
          console.error(`OAuth2 configured but no tokens available for ${mcpServer.url}`);
          continue;
        }

        // Create OAuth2 client and check token validity
        const oauth2Client = new MCPOAuth2Client({
          serverUrl: mcpServer.url,
        });

        // Restore tokens
        oauth2Client.setTokens(
          mcpServer.oauth2Tokens,
          mcpServer.oauth2Tokens.client_id || ''
        );

        // Get valid access token (will refresh if needed)
        try {
          const accessToken = await ensureValidAccessToken(oauth2Client);
          headers['Authorization'] = `Bearer ${accessToken}`;

          // Update tokens if refreshed
          const updatedTokens = oauth2Client.getTokens();
          if (updatedTokens && updatedTokens !== mcpServer.oauth2Tokens) {
            // Tokens were refreshed - update stored configuration
            mcpServer.oauth2Tokens = updatedTokens;
            // Note: Caller should persist updated tokens to storage
            console.log(`Access token refreshed for ${mcpServer.url}`);
          }
        } catch (error) {
          console.error(`Failed to get valid OAuth2 token for ${mcpServer.url}:`, error);
          continue;
        }
      } else {
        // Bearer token authentication (traditional headers)
        headers = mcpServer.headers?.reduce((acc, header) => {
          if (header.key) acc[header.key] = header.value || '';
          return acc;
        }, {} as Record<string, string>) || {};
      }

      const transport = mcpServer.type === 'sse'
        ? {
          type: 'sse' as const,
          url: mcpServer.url,
          headers,
        }
        : new StreamableHTTPClientTransport(new URL(mcpServer.url), {
          requestInit: {
            headers,
          },
        });

      const mcpClient = await createMCPClient({ transport });
      mcpClients.push(mcpClient);

      const mcptools = await mcpClient.tools();

      console.log(`MCP tools from ${mcpServer.url}:`, Object.keys(mcptools));

      // Add MCP tools to tools object
      tools = { ...tools, ...mcptools };
    } catch (error) {
      console.error("Failed to initialize MCP client:", error);
      // Continue with other servers instead of failing the entire request
    }
  }

  // Register cleanup for all clients if an abort signal is provided
  if (abortSignal && mcpClients.length > 0) {
    abortSignal.addEventListener('abort', async () => {
      await cleanupMCPClients(mcpClients);
    });
  }

  return {
    tools,
    clients: mcpClients,
    cleanup: async () => await cleanupMCPClients(mcpClients)
  };
}

/**
 * Clean up MCP clients
 */
async function cleanupMCPClients(clients: any[]): Promise<void> {
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.disconnect?.();
      } catch (error) {
        console.error("Error during MCP client cleanup:", error);
      }
    })
  );
} 