"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { ChatSidebar } from '@/components/chat-sidebar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Menu } from 'lucide-react';
import { isInIframe } from '@/lib/iframe-auth';

interface LayoutWrapperProps {
  children: ReactNode;
}

export function LayoutWrapper({ children }: LayoutWrapperProps) {
  const [isEmbedded, setIsEmbedded] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsEmbedded(isInIframe());
    
    // Listen for fullscreen mode messages from parent dashboard
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FULLSCREEN_MODE') {
        console.log('[LayoutWrapper] Fullscreen mode:', event.data.isFullscreen);
        setIsFullscreen(event.data.isFullscreen);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Don't render until we know if we're embedded (prevents hydration mismatch)
  if (!mounted) {
    return (
      <div className="flex h-full w-full">
        <main className="flex-1 flex flex-col">
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-pulse">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  // Embedded mode WITH fullscreen: show sidebar and normal layout
  if (isEmbedded && isFullscreen) {
    return (
      <div className="flex h-full w-full">
        <ChatSidebar />
        <main className="flex-1 flex flex-col relative">
          <div className="absolute top-4 left-4 z-50">
            <SidebarTrigger>
              <button className="flex items-center justify-center h-8 w-8 bg-muted hover:bg-accent rounded-md transition-colors">
                <Menu className="h-4 w-4" />
              </button>
            </SidebarTrigger>
          </div>
          <div className="flex-1 flex justify-center items-center">{children}</div>
        </main>
      </div>
    );
  }

  // Embedded mode WITHOUT fullscreen: minimal layout, no sidebar
  if (isEmbedded) {
    // Embedded mode: no sidebar, full height layout
    return (
      <div className="flex h-full w-full">
        <main className="flex-1 flex flex-col">
          <div className="flex-1 flex justify-center h-full overflow-hidden">{children}</div>
        </main>
      </div>
    );
  }

  // Standalone mode: normal layout with sidebar
  return (
    <div className="flex h-dvh w-full">
      <ChatSidebar />
      <main className="flex-1 flex flex-col relative">
        <div className="absolute top-4 left-4 z-50">
          <SidebarTrigger>
            <button className="flex items-center justify-center h-8 w-8 bg-muted hover:bg-accent rounded-md transition-colors">
              <Menu className="h-4 w-4" />
            </button>
          </SidebarTrigger>
        </div>
        <div className="flex-1 flex justify-center">{children}</div>
      </main>
    </div>
  );
}
