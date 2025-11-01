"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { 
  isInIframe, 
  sendToParent, 
  getAuthToken, 
  setAuthToken, 
  setUserInfo,
  clearAuthToken,
  getUserInfo,
  type UserInfo,
  type AuthMessage
} from '@/lib/iframe-auth';
import { updateUserId } from '@/lib/user-id';

interface IframeAuthContextType {
  isEmbedded: boolean;
  isAuthenticated: boolean;
  userInfo: UserInfo | null;
  authToken: string | null;
}

const IframeAuthContext = createContext<IframeAuthContextType | undefined>(undefined);

export function IframeAuthProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfoState] = useState<UserInfo | null>(null);
  const [authToken, setAuthTokenState] = useState<string | null>(null);

  // Initialize state after mount to avoid hydration issues
  useEffect(() => {
    setMounted(true);
    
    // Check if we're in an iframe
    const embedded = isInIframe();
    setIsEmbedded(embedded);
    
    // Load existing auth from localStorage
    const existingToken = getAuthToken();
    const existingUserInfo = getUserInfo();
    
    if (existingToken && existingUserInfo) {
      setAuthTokenState(existingToken);
      setUserInfoState(existingUserInfo);
      setIsAuthenticated(true);
      console.log('[IframeAuth] Restored existing auth from storage');
    }
    
    // If embedded, announce we're ready to receive auth
    if (embedded) {
      console.log('[IframeAuth] Running in iframe, sending READY message');
      sendToParent({ type: 'READY' });
    }
  }, []);

  // Set up message listener for iframe auth
  useEffect(() => {
    if (!mounted || !isEmbedded) return;

    const handleMessage = (event: MessageEvent) => {
      // Verify origin - allow localhost for development
      const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:8090';
      const allowedOrigins = [
        dashboardUrl,
        'http://localhost:8090',
        'https://www.ecosemantic.com',
        'https://ecosemantic.com'
      ];
      
      if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
        console.warn('[IframeAuth] Message from unexpected origin:', event.origin);
        return;
      }

      const data = event.data;

      if (data?.type === 'AUTH') {
        const authMessage = data as AuthMessage;
        
        console.log('[IframeAuth] Received AUTH message from dashboard');
        
        // Validate auth data
        if (!authMessage.token || !authMessage.userId) {
          console.error('[IframeAuth] Invalid auth data received');
          sendToParent({ 
            type: 'AUTH_ERROR', 
            error: 'Invalid authentication data' 
          });
          return;
        }

        try {
          // Store the auth token
          setAuthToken(authMessage.token);
          setAuthTokenState(authMessage.token);
          
          // Store user info
          const userInfo: UserInfo = {
            uuid: authMessage.userId,
            name: authMessage.userName,
            email: authMessage.userEmail
          };
          setUserInfo(userInfo);
          setUserInfoState(userInfo);
          
          // Update the user ID used by the chat system
          // This ensures chat history is associated with the authenticated user
          updateUserId(authMessage.userId);
          
          setIsAuthenticated(true);
          
          console.log('[IframeAuth] Authentication successful for user:', authMessage.userId);
          
          // Note: MCP server configuration is handled by McpAutoConfigurator component
          // The mcpConfig is passed through the AUTH message and will be picked up there
          
          // Acknowledge receipt
          sendToParent({ type: 'AUTH_RECEIVED' });
          
        } catch (error) {
          console.error('[IframeAuth] Error processing auth:', error);
          clearAuthToken();
          setIsAuthenticated(false);
          sendToParent({ 
            type: 'AUTH_ERROR', 
            error: 'Failed to process authentication' 
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [mounted, isEmbedded]);

  // Avoid hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <IframeAuthContext.Provider
      value={{
        isEmbedded,
        isAuthenticated,
        userInfo,
        authToken
      }}
    >
      {children}
    </IframeAuthContext.Provider>
  );
}

export function useIframeAuth() {
  const context = useContext(IframeAuthContext);
  if (context === undefined) {
    throw new Error('useIframeAuth must be used within IframeAuthProvider');
  }
  return context;
}
