"use client";

import { useEffect, useState } from 'react';
import { nanoid } from 'nanoid';

/**
 * MCP Auto-configurator component
 * 
 * Listens for MCP configuration from iframe auth and automatically
 * configures the MCP server when auth is received from dashboard.
 * 
 * This is a standalone component that doesn't use contexts to avoid SSR issues.
 */
export function McpAutoConfigurator() {
  const [mounted, setMounted] = useState(false);
  
  // Only run on client-side after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    
    // Check if we're in an iframe
    let isInIframe = false;
    try {
      isInIframe = window.self !== window.top;
    } catch (e) {
      isInIframe = true;
    }
    
    if (!isInIframe) return;

    const handleMcpConfig = async (config: any) => {
      try {
        console.log('[McpAutoConfigurator] ========== STARTING MCP CONFIG ==========');
        console.log('[McpAutoConfigurator] Received config:', JSON.stringify(config, null, 2));
        console.log('[McpAutoConfigurator] Config server_name:', config.server_name);
        console.log('[McpAutoConfigurator] Config server_url:', config.server_url);
        console.log('[McpAutoConfigurator] Config token (first 20 chars):', config.token?.substring(0, 20));
        
        // Import contexts dynamically to avoid SSR issues
        const { useMCP } = await import('@/lib/context/mcp-context');
        
        const serverId = nanoid();
        console.log('[McpAutoConfigurator] Generated server ID:', serverId);
        
        // Create MCP server configuration
        const newServer = {
          id: serverId,
          name: config.server_name,
          url: config.server_url,
          type: config.server_type,
          authType: config.auth_type,
          headers: [
            {
              key: 'Authorization',
              value: `Bearer ${config.token}`
            }
          ],
          description: 'Auto-configured EcoSemantic MCP server from dashboard',
          status: 'disconnected' as const
        };
        
        console.log('[McpAutoConfigurator] New server object:', JSON.stringify(newServer, null, 2));
        console.log('[McpAutoConfigurator] Authorization header:', newServer.headers[0].value.substring(0, 30) + '...');
        
        // Get current MCP servers from localStorage
        const STORAGE_KEY = 'mcp-servers';
        const storedServers = localStorage.getItem(STORAGE_KEY);
        console.log('[McpAutoConfigurator] Current localStorage value:', storedServers);
        const mcpServers = storedServers ? JSON.parse(storedServers) : [];
        console.log('[McpAutoConfigurator] Parsed servers count:', mcpServers.length);
        
        // Check if server already exists (by URL)
        const existingServer = mcpServers.find((s: any) => s.url === config.server_url);
        
        if (existingServer) {
          console.log('[McpAutoConfigurator] ===== UPDATING EXISTING SERVER =====');
          console.log('[McpAutoConfigurator] Existing server ID:', existingServer.id);
          console.log('[McpAutoConfigurator] Old token (first 20):', existingServer.headers?.[0]?.value?.substring(0, 20));
          console.log('[McpAutoConfigurator] New token (first 20):', config.token?.substring(0, 20));
          
          // Update existing server with new token
          const updatedServers = mcpServers.map((s: any) => 
            s.id === existingServer.id 
              ? { ...s, headers: newServer.headers }
              : s
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedServers));
          console.log('[McpAutoConfigurator] Updated servers saved to localStorage');
          
          // Select and trigger connection via custom event
          localStorage.setItem('selected-mcp-servers', JSON.stringify([existingServer.id]));
          console.log('[McpAutoConfigurator] Selected server ID:', existingServer.id);
          
          // Dispatch event to reload servers from localStorage
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'mcp-servers',
            newValue: JSON.stringify(updatedServers),
            url: window.location.href
          }));
          
          // Wait a bit for React state to update before starting server
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mcp-config-updated', { 
              detail: { serverId: existingServer.id, action: 'start' } 
            }));
            console.log('[McpAutoConfigurator] Dispatched mcp-config-updated event for existing server');
          }, 300);
        } else {
          console.log('[McpAutoConfigurator] ===== ADDING NEW SERVER =====');
          // Add new server
          const updatedServers = [...mcpServers, newServer];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedServers));
          console.log('[McpAutoConfigurator] New server added to localStorage, total servers:', updatedServers.length);
          
          localStorage.setItem('selected-mcp-servers', JSON.stringify([serverId]));
          console.log('[McpAutoConfigurator] Selected new server ID:', serverId);
          
          // Dispatch event to reload servers from localStorage
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'mcp-servers',
            newValue: JSON.stringify(updatedServers),
            url: window.location.href
          }));
          
          // Wait a bit for React state to update before starting server
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mcp-config-updated', { 
              detail: { serverId, action: 'start' } 
            }));
            console.log('[McpAutoConfigurator] Dispatched mcp-config-updated event for new server');
          }, 300);
        }
        
        console.log('[McpAutoConfigurator] ========== MCP CONFIG COMPLETE ==========');
      } catch (error) {
        console.error('[McpAutoConfigurator] Error configuring MCP server:', error);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:8090';
      const allowedOrigins = [
        dashboardUrl,
        'http://localhost:8090',
        'https://www.ecosemantic.com',
        'https://ecosemantic.com'
      ];
      
      if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
        return;
      }

      // Listen for AUTH messages with MCP config
      if (event.data?.type === 'AUTH' && event.data?.mcpConfig) {
        console.log('[McpAutoConfigurator] Received MCP config from auth message');
        handleMcpConfig(event.data.mcpConfig);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [mounted]);

  // Don't render anything
  return null;
}
