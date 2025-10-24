'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MCPOAuth2Client } from '@/lib/oauth2-client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Status = 'processing' | 'success' | 'error';

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('processing');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState('Completing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code and state from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors
        if (errorParam) {
          throw new Error(
            errorDescription || `Authorization failed: ${errorParam}`
          );
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        setMessage('Validating authorization code...');

        // Retrieve stored client configuration
        const configStr = sessionStorage.getItem('oauth2_client_config');
        if (!configStr) {
          throw new Error('OAuth2 configuration not found - session may have expired');
        }

        const config = JSON.parse(configStr);

        // Create OAuth2 client
        const oauth2Client = new MCPOAuth2Client({
          serverUrl: config.serverUrl,
          scopes: config.scopes,
        });

        setMessage('Exchanging code for access token...');

        // Exchange authorization code for tokens
        const tokens = await oauth2Client.handleCallback(code, state);

        setMessage('Saving authentication...');

        // Store server configuration with tokens in localStorage
        const servers = JSON.parse(localStorage.getItem('mcp-servers') || '[]');
        
        // Add new server with OAuth2 tokens and a unique ID
        servers.push({
          id: crypto.randomUUID(), // ✅ Generate unique ID
          name: config.serverName,
          url: config.serverUrl,
          type: config.serverType || 'http',
          authType: 'oauth2',
          oauth2Tokens: tokens,
        });

        localStorage.setItem('mcp-servers', JSON.stringify(servers));

        // Clean up session storage
        sessionStorage.removeItem('oauth2_client_config');

        setStatus('success');
        setMessage('Authentication successful! Redirecting to chat...');

        // Redirect back to chat after short delay
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        setStatus('error');
        setMessage('Authentication failed');

        // Clean up on error
        sessionStorage.removeItem('oauth2_client_config');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && 'Authenticating'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </CardTitle>
          <CardDescription className="text-center">{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4">
          {status === 'processing' && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-sm text-muted-foreground text-center">
                Your MCP server connection has been configured with OAuth2 authentication.
              </p>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="h-12 w-12 text-destructive" />
              <div className="space-y-2 w-full">
                <p className="text-sm text-destructive text-center font-medium">
                  {error}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Please try connecting again from the MCP server settings.
                </p>
              </div>
              <Button 
                onClick={() => router.push('/')} 
                className="w-full"
              >
                Return to Chat
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
