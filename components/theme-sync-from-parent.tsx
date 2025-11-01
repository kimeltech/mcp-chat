"use client";

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { isInIframe } from '@/lib/iframe-auth';

/**
 * Component to sync theme from parent dashboard when embedded in iframe
 * Listens for THEME_CHANGE messages and applies them
 */
export function ThemeSyncFromParent() {
  const { setTheme } = useTheme();

  useEffect(() => {
    // Only run if we're in an iframe
    if (!isInIframe()) return;

    console.log('[ThemeSync] Initializing theme sync from parent dashboard');

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

      // Handle theme change messages
      if (event.data?.type === 'THEME_CHANGE' && event.data?.theme) {
        const newTheme = event.data.theme;
        console.log('[ThemeSync] Received theme change from parent:', newTheme);
        setTheme(newTheme);
      }

      // Handle initial theme from AUTH message
      if (event.data?.type === 'AUTH' && event.data?.theme) {
        const initialTheme = event.data.theme;
        console.log('[ThemeSync] Received initial theme from AUTH:', initialTheme);
        setTheme(initialTheme);
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setTheme]);

  // This component doesn't render anything
  return null;
}
