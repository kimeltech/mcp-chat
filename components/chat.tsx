"use client";

import { defaultModel, type modelID } from "@/ai/providers";
import { Message, useChat } from "@ai-sdk/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Textarea } from "./textarea";
import { ProjectOverview } from "./project-overview";
import { Messages } from "./messages";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { getUserId } from "@/lib/user-id";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { convertToUIMessages } from "@/lib/chat-utils";
import { type Message as DBMessage } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { useMCP } from "@/lib/context/mcp-context";
import { isInIframe } from "@/lib/iframe-auth";

// Type for chat data from DB
interface ChatData {
  id: string;
  messages: DBMessage[];
  createdAt: string;
  updatedAt: string;
}

export default function Chat() {
  const router = useRouter();
  const params = useParams();
  const chatId = params?.id as string | undefined;
  const queryClient = useQueryClient();
  
  const [selectedModel, setSelectedModel] = useLocalStorage<modelID>("selectedModel", defaultModel);
  const [userId, setUserId] = useState<string>('');
  const [generatedChatId, setGeneratedChatId] = useState<string>('');
  const [isEmbedded, setIsEmbedded] = useState<boolean | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Get MCP server data from context
  const { mcpServersForApi } = useMCP();
  
  // Detect if running in iframe - do this first before other effects
  useEffect(() => {
    setMounted(true);
    const embedded = isInIframe();
    console.log('[Chat] Iframe detection: isEmbedded =', embedded);
    setIsEmbedded(embedded);
    
    // Listen for fullscreen mode messages from parent dashboard
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FULLSCREEN_MODE') {
        console.log('[Chat] Fullscreen mode:', event.data.isFullscreen);
        setIsFullscreen(event.data.isFullscreen);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // Initialize userId
  useEffect(() => {
    setUserId(getUserId());
  }, []);
  
  // Generate a chat ID if needed
  useEffect(() => {
    if (!chatId) {
      setGeneratedChatId(nanoid());
    }
  }, [chatId]);
  
  // Use React Query to fetch chat history
  const { data: chatData, isLoading: isLoadingChat, error } = useQuery({
    queryKey: ['chat', chatId, userId] as const,
    queryFn: async ({ queryKey }) => {
      const [_, chatId, userId] = queryKey;
      if (!chatId || !userId) return null;
      
      const response = await fetch(`/api/chats/${chatId}`, {
        headers: {
          'x-user-id': userId
        }
      });
      
      if (!response.ok) {
        // For 404, return empty chat data instead of throwing
        if (response.status === 404) {
          return { id: chatId, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        }
        throw new Error('Failed to load chat');
      }
      
      return response.json() as Promise<ChatData>;
    },
    enabled: !!chatId && !!userId,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false
  });
  
  // Handle query errors
  useEffect(() => {
    if (error) {
      console.error('Error loading chat history:', error);
      toast.error('Failed to load chat history');
    }
  }, [error]);
  
  // Prepare initial messages from query data
  const initialMessages = useMemo(() => {
    if (!chatData || !chatData.messages || chatData.messages.length === 0) {
      return [];
    }
    
    // Convert DB messages to UI format, then ensure it matches the Message type from @ai-sdk/react
    const uiMessages = convertToUIMessages(chatData.messages);
    return uiMessages.map(msg => ({
      id: msg.id,
      role: msg.role as Message['role'], // Ensure role is properly typed
      content: msg.content,
      parts: msg.parts,
    } as Message));
  }, [chatData]);
  
  const { messages, input, handleInputChange, handleSubmit, status, stop } =
    useChat({
      id: chatId || generatedChatId,
      initialMessages,
      maxSteps: 20,
      body: {
        selectedModel,
        mcpServers: mcpServersForApi,
        chatId: chatId || generatedChatId,
        userId,
        apiKey: typeof window !== 'undefined' ? localStorage.getItem('OPENROUTER_API_KEY') || undefined : undefined,
      },
      headers: {
        // Add authorization header for token tracking
        'Authorization': typeof window !== 'undefined' 
          ? `Bearer ${localStorage.getItem('ecosemantic-auth-token') || ''}`
          : '',
      },
      experimental_throttle: 100,
      onFinish: () => {
        if (userId) {
          queryClient.invalidateQueries({ queryKey: ['chats', userId] });
        }
      },
      onError: (error) => {
        toast.error(
          error.message.length > 0
            ? error.message
            : "An error occured, please try again later.",
          { position: "top-center", richColors: true },
        );
      },
    });
    
  // Custom submit handler
  const handleFormSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!chatId && generatedChatId && input.trim()) {
      // If this is a new conversation, redirect to the chat page with the generated ID
      const effectiveChatId = generatedChatId;
      
      // Submit the form
      handleSubmit(e);
      
      // Redirect to the chat page with the generated ID
      router.push(`/chat/${effectiveChatId}`);
    } else {
      // Normal submission for existing chats
      handleSubmit(e);
    }
  }, [chatId, generatedChatId, input, handleSubmit, router]);

  const isLoading = status === "streaming" || status === "submitted" || isLoadingChat;

  // Don't render layout until we know if embedded (prevents wrong layout flash)
  if (!mounted || isEmbedded === null) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Determine if we should use compact mode:
  // - Compact when embedded AND not fullscreen
  // - Normal when standalone OR when embedded+fullscreen
  const shouldBeCompact = isEmbedded && !isFullscreen;

  // Use different height and layout strategy based on mode
  const containerClasses = shouldBeCompact 
    ? "h-full flex flex-col w-full max-w-[430px] sm:max-w-3xl mx-auto px-2 py-1"
    : isEmbedded && isFullscreen
      ? "w-full max-w-[430px] sm:max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3"
      : "h-dvh flex flex-col justify-center w-full max-w-[430px] sm:max-w-3xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3";

  return (
    <div className={containerClasses}>
      {messages.length === 0 && !isLoadingChat ? (
        shouldBeCompact ? (
          // Embedded compact layout: minimal ProjectOverview, textarea at bottom
          <>
            <div className="flex-1 flex items-center justify-center overflow-y-auto min-h-0">
              <div className="max-w-xl w-full">
                <ProjectOverview compact={true} />
              </div>
            </div>
            <form
              onSubmit={handleFormSubmit}
              className="mt-1 w-full mx-auto flex-shrink-0"
            >
              <Textarea
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                handleInputChange={handleInputChange}
                input={input}
                isLoading={isLoading}
                status={status}
                stop={stop}
                compact={true}
              />
            </form>
          </>
        ) : (
          // Normal layout: full ProjectOverview, centered vertically
          <div className="max-w-xl mx-auto w-full">
            <ProjectOverview />
            <form
              onSubmit={handleFormSubmit}
              className="mt-3 sm:mt-4 w-full mx-auto"
            >
              <Textarea
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                handleInputChange={handleInputChange}
                input={input}
                isLoading={isLoading}
                status={status}
                stop={stop}
              />
            </form>
          </div>
        )
      ) : (
        <>
          <div className="flex-1 overflow-y-auto min-h-0 pb-2">
            <Messages messages={messages} isLoading={isLoading} status={status} />
          </div>
          <form
            onSubmit={handleFormSubmit}
            className="mt-2 w-full mx-auto"
          >
            <Textarea
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              handleInputChange={handleInputChange}
              input={input}
              isLoading={isLoading}
              status={status}
              stop={stop}
            />
          </form>
        </>
      )}
    </div>
  );
}
