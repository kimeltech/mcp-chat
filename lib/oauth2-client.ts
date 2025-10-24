/**
 * OAuth2 Client for MCP Server Authentication
 * 
 * Implements OAuth 2.1 Authorization Code Flow with PKCE
 * Supports Dynamic Client Registration (RFC 7591)
 * Follows MCP specification for OAuth integration
 */

export interface OAuth2Config {
  serverUrl: string;
  scopes?: string[];
}

export interface OAuth2Metadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
  token_endpoint_auth_methods_supported: string[];
}

export interface OAuth2ClientRegistration {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at?: number;
}

export interface OAuth2Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  // Extended fields for internal tracking
  client_id?: string;
  issued_at?: number;
}

export interface PKCEChallenge {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * MCP OAuth2 Client
 * 
 * Handles the complete OAuth2 flow for MCP server authentication:
 * 1. Discovery of OAuth metadata
 * 2. Dynamic client registration
 * 3. Authorization with PKCE
 * 4. Token exchange
 * 5. Token refresh
 */
export class MCPOAuth2Client {
  private config: OAuth2Config;
  private tokens?: OAuth2Tokens;
  private clientId?: string;
  private clientSecret?: string;
  private codeVerifier?: string;

  constructor(config: OAuth2Config) {
    this.config = config;
  }

  /**
   * Step 1: Discover OAuth metadata from MCP server
   * 
   * MCP servers expose OAuth configuration at:
   * /.well-known/oauth-authorization-server
   * 
   * @returns OAuth2 server metadata
   * @throws Error if discovery fails or server doesn't support OAuth
   */
  async discoverMetadata(): Promise<OAuth2Metadata> {
    const metadataUrl = new URL(
      '/.well-known/oauth-authorization-server',
      this.config.serverUrl
    );

    const response = await fetch(metadataUrl.toString());
    
    if (!response.ok) {
      throw new Error(
        `OAuth metadata discovery failed: ${response.status} ${response.statusText}`
      );
    }

    const metadata = await response.json();

    // Validate required fields
    const requiredFields = [
      'authorization_endpoint',
      'token_endpoint',
      'registration_endpoint',
    ];

    for (const field of requiredFields) {
      if (!metadata[field]) {
        throw new Error(`OAuth metadata missing required field: ${field}`);
      }
    }

    return metadata;
  }

  /**
   * Step 2: Dynamic Client Registration (DCR)
   * 
   * Automatically registers this MCP client with the OAuth server.
   * This follows RFC 7591 for dynamic client registration.
   * 
   * @param metadata OAuth2 metadata from discovery
   * @returns Client registration details
   * @throws Error if registration fails
   */
  async registerClient(
    metadata: OAuth2Metadata
  ): Promise<OAuth2ClientRegistration> {
    const redirectUri = `${window.location.origin}/oauth/callback`;

    const registrationRequest = {
      client_name: 'MCP Chat Client',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // Public client (no client secret)
      scope: this.config.scopes?.join(' ') || 'lca:read lca:write',
    };

    const response = await fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registrationRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Client registration failed: ${response.status} - ${
          errorData.error_description || errorData.error || response.statusText
        }`
      );
    }

    const registration = await response.json();

    // Store client credentials
    this.clientId = registration.client_id;
    this.clientSecret = registration.client_secret; // May be undefined for public clients

    return registration;
  }

  /**
   * Step 3: Generate PKCE challenge and initiate authorization
   * 
   * Implements PKCE (RFC 7636) with S256 challenge method.
   * This prevents authorization code interception attacks.
   * 
   * @param metadata OAuth2 metadata from discovery
   * @throws Error if PKCE generation fails
   */
  async initiateAuthorization(metadata: OAuth2Metadata): Promise<void> {
    if (!this.clientId) {
      throw new Error('Client must be registered before authorization');
    }

    // Verify PKCE support
    if (
      !metadata.code_challenge_methods_supported?.includes('S256') &&
      !metadata.code_challenge_methods_supported?.includes('plain')
    ) {
      throw new Error('Server does not support PKCE (required by OAuth 2.1)');
    }

    // Generate PKCE challenge
    const { codeVerifier, codeChallenge } = await this.generatePKCE();
    this.codeVerifier = codeVerifier;

    // Generate and store state for CSRF protection
    const state = this.generateState();
    
    // Store in sessionStorage (cleared after callback)
    sessionStorage.setItem('oauth_state', state);
    sessionStorage.setItem('oauth_code_verifier', codeVerifier);
    sessionStorage.setItem('oauth_client_id', this.clientId);

    // Build authorization URL
    const authUrl = new URL(metadata.authorization_endpoint);
    const params = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: `${window.location.origin}/oauth/callback`,
      scope: this.config.scopes?.join(' ') || 'lca:read lca:write',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      // RFC 8707 - Resource Indicators
      resource: this.config.serverUrl,
    };

    // Append parameters to URL
    Object.entries(params).forEach(([key, value]) => {
      authUrl.searchParams.append(key, value);
    });

    console.log('Redirecting to authorization endpoint:', authUrl.toString());

    // Redirect to authorization server
    window.location.href = authUrl.toString();
  }

  /**
   * Step 4: Handle OAuth callback and exchange code for tokens
   * 
   * Validates state parameter, exchanges authorization code for tokens
   * using PKCE code verifier.
   * 
   * @param code Authorization code from callback
   * @param state State parameter from callback
   * @returns OAuth2 tokens (access_token, refresh_token, etc.)
   * @throws Error if state mismatch or token exchange fails
   */
  async handleCallback(code: string, state: string): Promise<OAuth2Tokens> {
    // Validate state parameter (CSRF protection)
    const storedState = sessionStorage.getItem('oauth_state');
    if (!storedState) {
      throw new Error('OAuth state not found - session may have expired');
    }

    if (state !== storedState) {
      throw new Error('State parameter mismatch - possible CSRF attack');
    }

    // Retrieve stored PKCE verifier
    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found');
    }

    // Retrieve client ID
    const clientId = sessionStorage.getItem('oauth_client_id');
    if (!clientId) {
      throw new Error('Client ID not found');
    }

    this.clientId = clientId;

    // Discover metadata (to get token endpoint)
    const metadata = await this.discoverMetadata();

    // Exchange authorization code for tokens
    const tokenRequest = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: `${window.location.origin}/oauth/callback`,
      client_id: this.clientId,
      code_verifier: codeVerifier,
    };

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token exchange failed: ${response.status} - ${
          errorData.error_description || errorData.error || response.statusText
        }`
      );
    }

    this.tokens = await response.json();

    // Add tracking fields
    if (this.tokens) {
      this.tokens.client_id = this.clientId;
      this.tokens.issued_at = Date.now();
    }

    // Clean up session storage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_client_id');

    console.log('Token exchange successful');

    if (!this.tokens) {
      throw new Error('Token exchange succeeded but no tokens received');
    }

    return this.tokens;
  }

  /**
   * Step 5: Refresh access token using refresh token
   * 
   * OAuth 2.1 requires refresh token rotation - the old refresh token
   * is invalidated and a new one is issued.
   * 
   * @returns New OAuth2 tokens
   * @throws Error if refresh fails or no refresh token available
   */
  async refreshAccessToken(): Promise<OAuth2Tokens> {
    if (!this.tokens?.refresh_token) {
      throw new Error('No refresh token available - re-authentication required');
    }

    if (!this.clientId) {
      throw new Error('Client ID not available');
    }

    // Discover metadata (to get token endpoint)
    const metadata = await this.discoverMetadata();

    // Request new tokens using refresh token
    const refreshRequest = {
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refresh_token,
      client_id: this.clientId,
    };

    const response = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(refreshRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Token refresh failed: ${response.status} - ${
          errorData.error_description || errorData.error || response.statusText
        }`
      );
    }

    this.tokens = await response.json();

    // Add tracking fields
    if (this.tokens) {
      this.tokens.client_id = this.clientId;
      this.tokens.issued_at = Date.now();
    }

    console.log('Token refresh successful');

    if (!this.tokens) {
      throw new Error('Token refresh succeeded but no tokens received');
    }

    return this.tokens;
  }

  /**
   * Revoke access or refresh token
   * 
   * @param token Token to revoke (access_token or refresh_token)
   * @param tokenTypeHint Hint about token type ('access_token' or 'refresh_token')
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token'
  ): Promise<void> {
    const metadata = await this.discoverMetadata();

    if (!metadata.revocation_endpoint) {
      console.warn('Server does not support token revocation');
      return;
    }

    const revokeRequest: Record<string, string> = {
      token: token,
      client_id: this.clientId!,
    };

    if (tokenTypeHint) {
      revokeRequest.token_type_hint = tokenTypeHint;
    }

    const response = await fetch(metadata.revocation_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(revokeRequest),
    });

    // RFC 7009: Revocation endpoint returns 200 even for invalid tokens
    if (!response.ok) {
      console.error('Token revocation failed:', response.status, response.statusText);
    }
  }

  /**
   * Get current access token
   * 
   * @returns Current access token or undefined if not authenticated
   */
  getAccessToken(): string | undefined {
    return this.tokens?.access_token;
  }

  /**
   * Get current tokens
   * 
   * @returns Current OAuth2 tokens or undefined if not authenticated
   */
  getTokens(): OAuth2Tokens | undefined {
    return this.tokens;
  }

  /**
   * Check if tokens are available
   * 
   * @returns True if authenticated with tokens
   */
  isAuthenticated(): boolean {
    return !!this.tokens?.access_token;
  }

  /**
   * Check if access token is expired or about to expire
   * 
   * @param bufferSeconds Buffer time in seconds before considering token expired (default: 300 = 5 minutes)
   * @returns True if token is expired or will expire within buffer time
   */
  isTokenExpired(bufferSeconds: number = 300): boolean {
    if (!this.tokens?.issued_at || !this.tokens?.expires_in) {
      return true;
    }

    const expiresAt = this.tokens.issued_at + this.tokens.expires_in * 1000;
    const now = Date.now();
    const bufferTime = bufferSeconds * 1000;

    return now >= expiresAt - bufferTime;
  }

  /**
   * Set tokens (for restoring from storage)
   * 
   * @param tokens OAuth2 tokens to restore
   * @param clientId Client ID associated with tokens
   */
  setTokens(tokens: OAuth2Tokens, clientId: string): void {
    this.tokens = tokens;
    this.clientId = clientId;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Generate PKCE challenge pair
   * 
   * Uses SHA-256 hashing (S256 method) as required by OAuth 2.1
   * 
   * @returns Code verifier and challenge pair
   * @private
   */
  private async generatePKCE(): Promise<PKCEChallenge> {
    // Generate cryptographically secure random code verifier
    const codeVerifier = this.generateRandomString(128);

    // Create SHA-256 hash of code verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Base64-URL encode the hash
    const codeChallenge = this.base64UrlEncode(hashBuffer);

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate cryptographically secure random state parameter
   * 
   * Used for CSRF protection in OAuth flow
   * 
   * @returns Random state string
   * @private
   */
  private generateState(): string {
    return this.generateRandomString(32);
  }

  /**
   * Generate cryptographically secure random string
   * 
   * @param length Length of random string in bytes
   * @returns Hex-encoded random string
   * @private
   */
  private generateRandomString(length: number): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  }

  /**
   * Base64-URL encode a buffer
   * 
   * Converts ArrayBuffer to base64url format (RFC 4648 Section 5)
   * Used for PKCE code_challenge encoding
   * 
   * @param buffer ArrayBuffer to encode
   * @returns Base64-URL encoded string (no padding)
   * @private
   */
  private base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => (binary += String.fromCharCode(byte)));

    return btoa(binary)
      .replace(/\+/g, '-')  // Replace + with -
      .replace(/\//g, '_')  // Replace / with _
      .replace(/=/g, '');   // Remove padding
  }
}

/**
 * Helper function to ensure valid access token
 * 
 * Automatically refreshes token if expired or about to expire.
 * This should be called before making MCP requests.
 * 
 * @param serverConfig MCP server configuration
 * @param oauth2Client OAuth2 client instance
 * @returns Valid access token string
 * @throws Error if token refresh fails
 */
export async function ensureValidAccessToken(
  oauth2Client: MCPOAuth2Client
): Promise<string> {
  if (!oauth2Client.isAuthenticated()) {
    throw new Error('Not authenticated - OAuth2 flow required');
  }

  // Check if token needs refresh (with 5 minute buffer)
  if (oauth2Client.isTokenExpired(300)) {
    console.log('Access token expired or expiring soon, refreshing...');
    const newTokens = await oauth2Client.refreshAccessToken();
    return newTokens.access_token;
  }

  const accessToken = oauth2Client.getAccessToken();
  if (!accessToken) {
    throw new Error('No access token available');
  }

  return accessToken;
}
