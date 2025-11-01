"use client";

import { createContext, useContext, useRef, useEffect } from "react";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { OAuth2Tokens } from "@/lib/oauth2-client";

export interface KeyValuePair {
  key: string;
  value: string;
}

export type ServerStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error";

// Define storage keys as constants
const STORAGE_KEYS = {
  MCP_SERVERS: "mcp-servers",
  SELECTED_MCP_SERVERS: "selected-mcp-servers",
} as const;

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  type: "sse" | "http";
  command?: string;
  args?: string[];
  env?: KeyValuePair[];
  headers?: KeyValuePair[];
  description?: string;
  status?: ServerStatus;
  errorMessage?: string;
  tools?: MCPTool[];
  // OAuth2 fields
  authType?: 'bearer' | 'oauth2';
  oauth2Tokens?: OAuth2Tokens;
}

export interface MCPServerApi {
  type: "sse" | "http";
  url: string;
  headers?: KeyValuePair[];
  authType?: 'bearer' | 'oauth2';
  oauth2Tokens?: OAuth2Tokens;
}

interface MCPContextType {
  mcpServers: MCPServer[];
  setMcpServers: (servers: MCPServer[]) => void;
  selectedMcpServers: string[];
  setSelectedMcpServers: (serverIds: string[]) => void;
  mcpServersForApi: MCPServerApi[];
  startServer: (serverId: string) => Promise<boolean>;
  stopServer: (serverId: string) => Promise<boolean>;
  updateServerStatus: (
    serverId: string,
    status: ServerStatus,
    errorMessage?: string
  ) => void;
  getActiveServersForApi: () => MCPServerApi[];
}

const MCPContext = createContext<MCPContextType | undefined>(undefined);

// Helper function to check server health and get tools
async function checkServerHealth(
  url: string,
  headers?: KeyValuePair[]
): Promise<{ ready: boolean; tools?: MCPTool[]; error?: string }> {
  try {
    const response = await fetch('/api/mcp-health', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, headers }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error checking server health for ${url}:`, error);
    return {
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export function MCPProvider({ children }: { children: React.ReactNode }) {
  const [mcpServers, setMcpServers] = useLocalStorage<MCPServer[]>(
    STORAGE_KEYS.MCP_SERVERS,
    []
  );

  const [selectedMcpServers, setSelectedMcpServers] = useLocalStorage<string[]>(
    STORAGE_KEYS.SELECTED_MCP_SERVERS,
    []
  );

  // Create a ref to track active servers and avoid unnecessary re-renders
  const activeServersRef = useRef<Record<string, boolean>>({});

  // Helper to get a server by ID
  const getServerById = (serverId: string): MCPServer | undefined => {
    return mcpServers.find((server) => server.id === serverId);
  };

  // Update server status
  const updateServerStatus = (
    serverId: string,
    status: ServerStatus,
    errorMessage?: string
  ) => {
    setMcpServers((currentServers) =>
      currentServers.map((server) =>
        server.id === serverId
          ? { ...server, status, errorMessage: errorMessage || undefined }
          : server
      )
    );
  };

  // Update server with tools
  const updateServerWithTools = (
    serverId: string,
    tools: MCPTool[],
    status: ServerStatus = "connected"
  ) => {
    setMcpServers((currentServers) =>
      currentServers.map((server) =>
        server.id === serverId
          ? { ...server, tools, status, errorMessage: undefined }
          : server
      )
    );
  };

  // Get active servers formatted for API usage
  const getActiveServersForApi = (): MCPServerApi[] => {
    return selectedMcpServers
      .map((id) => getServerById(id))
      .filter(
        (server): server is MCPServer =>
          !!server && server.status === "connected"
      )
      .map((server) => ({
        type: server.type,
        url: server.url,
        headers: server.headers,
        authType: server.authType || 'bearer',
        oauth2Tokens: server.oauth2Tokens,
      }));
  };

  // Start a server using MCP SDK
  const startServer = async (serverId: string): Promise<boolean> => {
    const server = getServerById(serverId);
    if (!server) {
      console.error(`[startServer] Server not found for ID: ${serverId}`);
      return false;
    }

    console.log(
      `[startServer] Starting server: ${server.name} (${server.type})`
    );

    // Mark server as connecting
    updateServerStatus(serverId, "connecting");

    try {
      console.log(
        `[startServer] Checking ${server.type} server at: ${server.url}`
      );

      if (!server.url) {
        console.error(
          `[startServer] No URL provided for ${server.type} server`
        );
        updateServerStatus(serverId, "error", "No URL provided");
        return false;
      }

      // Prepare headers based on auth type
      let headers: KeyValuePair[] | undefined = server.headers;
      
      if (server.authType === 'oauth2' && server.oauth2Tokens?.access_token) {
        // For OAuth2, create Authorization header with access token
        headers = [{
          key: 'Authorization',
          value: `Bearer ${server.oauth2Tokens.access_token}`
        }];
        console.log('[startServer] Using OAuth2 authentication');
      }

      console.log('[startServer] Server config:', { url: server.url, headers: headers });
      const healthResult = await checkServerHealth(server.url, headers);
      console.log('[startServer] Health check result:', healthResult);
      
      if (healthResult.ready && healthResult.tools) {
        updateServerWithTools(serverId, healthResult.tools, "connected");
        activeServersRef.current[serverId] = true;
        return true;
      } else {
        updateServerStatus(
          serverId,
          "error",
          healthResult.error || "Could not connect to server"
        );
        return false;
      }
    } catch (error) {
      console.error(`[startServer] Error starting server:`, error);
      updateServerStatus(
        serverId,
        "error",
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  };

  // Stop a server
  const stopServer = async (serverId: string): Promise<boolean> => {
    const server = getServerById(serverId);
    if (!server) return false;

    try {
      // Mark as not active
      delete activeServersRef.current[serverId];

      // Update server status and clear tools
      setMcpServers((currentServers) =>
        currentServers.map((s) =>
          s.id === serverId
            ? { ...s, status: "disconnected", tools: undefined, errorMessage: undefined }
            : s
        )
      );
      return true;
    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error);
      return false;
    }
  };

  // Calculate mcpServersForApi based on current state
  const mcpServersForApi = getActiveServersForApi();
  
  // Listen for MCP configuration updates from McpAutoConfigurator
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleMcpConfigUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { serverId, action } = customEvent.detail;
      console.log('[MCPProvider] Received mcp-config-updated event:', { serverId, action });
      
      if (action === 'start' && serverId) {
        // Wait for state to sync from storage event
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Re-read from localStorage to ensure we have latest data
        const storedServers = localStorage.getItem(STORAGE_KEYS.MCP_SERVERS);
        const servers = storedServers ? JSON.parse(storedServers) : [];
        const serverExists = servers.find((s: MCPServer) => s.id === serverId);
        
        console.log('[MCPProvider] Server exists in localStorage:', !!serverExists);
        console.log('[MCPProvider] Current mcpServers state:', mcpServers.length);
        
        if (serverExists) {
          // Trigger server start
          console.log('[MCPProvider] Starting server:', serverId);
          await startServer(serverId);
        } else {
          console.error('[MCPProvider] Server not found:', serverId);
        }
      }
    };
    
    window.addEventListener('mcp-config-updated', handleMcpConfigUpdate);
    
    return () => {
      window.removeEventListener('mcp-config-updated', handleMcpConfigUpdate);
    };
  }, [startServer, mcpServers]);

  return (
    <MCPContext.Provider
      value={{
        mcpServers,
        setMcpServers,
        selectedMcpServers,
        setSelectedMcpServers,
        mcpServersForApi,
        startServer,
        stopServer,
        updateServerStatus,
        getActiveServersForApi,
      }}
    >
      {children}
    </MCPContext.Provider>
  );
}

export function useMCP() {
  const context = useContext(MCPContext);
  if (context === undefined) {
    throw new Error("useMCP must be used within a MCPProvider");
  }
  return context;
}
