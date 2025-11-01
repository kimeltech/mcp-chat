/**
 * Iframe authentication utilities for embedded chat
 * Handles secure token exchange between parent dashboard and iframe
 */

const AUTH_TOKEN_KEY = 'ecosemantic-auth-token';
const USER_INFO_KEY = 'ecosemantic-user-info';

export interface UserInfo {
  uuid: string;
  name: string;
  email: string;
}

export interface McpConfig {
  server_url: string;
  token: string;
  server_name: string;
  server_type: 'sse' | 'http';
  auth_type: 'bearer' | 'oauth2';
}

export interface AuthMessage {
  type: 'AUTH';
  token: string;
  userId: string;
  userName: string;
  userEmail: string;
  mcpConfig?: McpConfig | null;
}

export interface ReadyMessage {
  type: 'READY';
}

export interface AuthReceivedMessage {
  type: 'AUTH_RECEIVED';
}

export interface AuthErrorMessage {
  type: 'AUTH_ERROR';
  error: string;
}

export type IframeMessage = AuthMessage | ReadyMessage | AuthReceivedMessage | AuthErrorMessage;

/**
 * Check if the app is running in an iframe
 */
export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    // If accessing window.top throws, we're definitely in an iframe
    return true;
  }
}

/**
 * Get the stored auth token
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Store the auth token
 */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Clear the auth token
 */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
}

/**
 * Get stored user info
 */
export function getUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_INFO_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Store user info
 */
export function setUserInfo(info: UserInfo): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(info));
}

/**
 * Send a message to the parent window (if in iframe)
 */
export function sendToParent(message: IframeMessage): void {
  if (typeof window === 'undefined' || !window.parent) return;
  
  // Get the dashboard URL from environment
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:8090';
  
  try {
    window.parent.postMessage(message, dashboardUrl);
  } catch (error) {
    console.error('[iframe-auth] Error sending message to parent:', error);
  }
}
