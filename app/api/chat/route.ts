import { openrouter, openRouterModels, type modelID } from "@/ai/providers";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { smoothStream, streamText, type UIMessage } from "ai";
import { appendResponseMessages } from 'ai';
import { saveChat, saveMessages, convertToDBMessages } from '@/lib/chat-store';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { initializeMCPClients, type MCPServerConfig } from '@/lib/mcp-client';

// Central API URL for token tracking
const CENTRAL_API_URL = process.env.CENTRAL_API_URL || 'http://central-api:8880';

export async function POST(req: Request) {
  const {
    messages,
    chatId,
    selectedModel,
    userId,
    mcpServers = [],
    apiKey,
  }: {
    messages: UIMessage[];
    chatId?: string;
    selectedModel: modelID;
    userId: string;
    mcpServers?: MCPServerConfig[];
    apiKey?: string;
  } = await req.json();

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "User ID is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Get auth token from request headers
  const authToken = req.headers.get('authorization');
  if (!authToken) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // STEP 1: Check token limit before processing
  try {
    // Estimate input tokens (rough: ~4 characters per token)
    const messagesText = JSON.stringify(messages);
    const estimatedInputTokens = Math.ceil(messagesText.length / 4);

    console.log(`[Token Check] Estimated input tokens: ${estimatedInputTokens}`);

    const checkResponse = await fetch(
      `${CENTRAL_API_URL}/api/v1/mcp-chat/check-limit?estimated_input_tokens=${estimatedInputTokens}`,
      {
        headers: {
          'Authorization': authToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!checkResponse.ok) {
      if (checkResponse.status === 429) {
        const limitData = await checkResponse.json();
        return new Response(
          JSON.stringify({ 
            error: "Token limit exceeded",
            message: limitData.error_message || "You have reached your token limit.",
            remaining: limitData.remaining_tokens || 0,
            limit: limitData.limit || 0
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
      
      // Log but continue if token check fails (graceful degradation)
      console.error('[Token Check] Failed to check token limit:', checkResponse.statusText);
    } else {
      const limitCheck = await checkResponse.json();
      if (!limitCheck.can_proceed) {
        return new Response(
          JSON.stringify({ 
            error: "Token limit exceeded",
            message: limitCheck.error_message,
            remaining: limitCheck.remaining_tokens,
            limit: limitCheck.limit
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
      console.log(`[Token Check] ✓ Can proceed. Remaining: ${limitCheck.remaining_tokens}`);
    }
  } catch (error) {
    // Log but continue if token check fails (graceful degradation)
    console.error('[Token Check] Error checking token limit:', error);
  }

  const id = chatId || nanoid();

  // Check if chat already exists
  let isNewChat = false;
  if (chatId) {
    try {
      const existingChat = await db.query.chats.findFirst({
        where: and(
          eq(chats.id, chatId),
          eq(chats.userId, userId)
        )
      });
      isNewChat = !existingChat;
    } catch (error) {
      console.error("Error checking for existing chat:", error);
      isNewChat = true;
    }
  } else {
    isNewChat = true;
  }

  // Save new chat immediately
  if (isNewChat && messages.length > 0) {
    try {
      await saveChat({
        id,
        userId,
        title: 'New Chat',
        messages: [],
      });
    } catch (error) {
      console.error("Error saving new chat:", error);
    }
  }

  // Initialize MCP clients
  const { tools, cleanup } = await initializeMCPClients(mcpServers, req.signal);

  console.log("messages", messages);
  console.log("parts", messages.map(m => m.parts.map(p => p)));

  let responseCompleted = false;

  const systemPrompt = `You are a helpful assistant with access to a variety of tools.

Today's date is ${new Date().toISOString().split('T')[0]}.

The tools are very powerful, and you can use them to answer the user's question.
So choose the tool that is most relevant to the user's question.

If tools are not available, say you don't know or if the user wants a tool they can add one from the server icon in bottom left corner in the sidebar.

You can use multiple tools in a single response.
Always respond after using the tools for better user experience.
You can run multiple steps using all the tools!!!!
Make sure to use the right tool to respond to the user's question.

Multiple tools can be used in a single response and multiple steps can be used to answer the user's question.

## Response Format
- Markdown is supported.
- Respond according to tool's response.
- Use the tools to answer the user's question.
- If you don't know the answer, use the tools to find the answer or say you don't know.

The first action you must always take is to call the user_information tool to get information about the user.`;

  const effectiveApiKey = apiKey || process.env.OPENROUTER_API_KEY;
  
  if (!effectiveApiKey) {
    return new Response(
      JSON.stringify({ error: "OpenRouter API key is required. Please add it in the settings or set OPENROUTER_API_KEY environment variable." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const openrouterClient = createOpenRouter({
    apiKey: effectiveApiKey,
  });
  
  const selectedLanguageModel = openrouterClient(openRouterModels[selectedModel]);

  const result = streamText({
    model: selectedLanguageModel,
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 20,
    experimental_transform: smoothStream({
      delayInMs: 5,
      chunking: 'line',
    }),
    onError: (error) => {
      console.error(JSON.stringify(error, null, 2));
    },
    async onFinish({ response, usage, finishReason }) {
      responseCompleted = true;
      
      // STEP 2: Log token usage after completion
      if (usage && authToken) {
        try {
          console.log(`[Token Usage] Input: ${usage.promptTokens}, Output: ${usage.completionTokens}, Total: ${usage.totalTokens}`);
          
          const logResponse = await fetch(`${CENTRAL_API_URL}/api/v1/mcp-chat/log-usage`, {
            method: 'POST',
            headers: {
              'Authorization': authToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              chat_id: id,
              model_id: selectedModel,
              input_tokens: usage.promptTokens,
              output_tokens: usage.completionTokens,
              session_type: 'mcp_chat'
            })
          });

          if (!logResponse.ok) {
            console.error('[Token Usage] Failed to log token usage:', logResponse.statusText);
          } else {
            console.log('[Token Usage] ✓ Usage logged successfully');
          }
        } catch (error) {
          console.error('[Token Usage] Error logging token usage:', error);
          // Don't fail the request if logging fails
        }
      }
      
      const allMessages = appendResponseMessages({
        messages,
        responseMessages: response.messages,
      });

      // Generate title for new chats
      let title: string | undefined;
      if (isNewChat && allMessages.length >= 2) {
        try {
          const userMessage = allMessages.find(m => m.role === 'user');
          if (userMessage) {
            const getMessageText = (msg: any): string => {
              if (msg.parts && Array.isArray(msg.parts)) {
                return msg.parts
                  .filter((p: any) => p.type === 'text' && p.text)
                  .map((p: any) => p.text)
                  .join('\n');
              }
              if (typeof msg.content === 'string') return msg.content;
              return '';
            };

            const messageText = getMessageText(userMessage);
            if (messageText.trim()) {
              const { generateObject } = await import('ai');
              const { z } = await import('zod');
              
              const { object: titleObject } = await generateObject({
                model: selectedLanguageModel,
                schema: z.object({
                  title: z.string().describe("A short, descriptive title for the conversation"),
                }),
                prompt: `Generate a concise title (max 6 words) for a conversation that starts with: "${messageText.slice(0, 200)}"`,
              });

              title = titleObject.title || 'New Chat';
            }
          }
        } catch (error) {
          console.error('Error generating title:', error);
        }
      }

      await saveChat({
        id,
        userId,
        messages: allMessages,
        title,
      });

      const dbMessages = convertToDBMessages(allMessages, id);
      await saveMessages({ messages: dbMessages });

      await cleanup();
    }
  });

  req.signal.addEventListener('abort', async () => {
    if (!responseCompleted) {
      console.log("Request aborted, cleaning up resources");
      try {
        await cleanup();
      } catch (error) {
        console.error("Error during cleanup on abort:", error);
      }
    }
  });

  result.consumeStream()
  
  return result.toDataStreamResponse({
    sendReasoning: true,
    headers: {
      'X-Chat-ID': id
    },
    getErrorMessage: (error) => {
      if (error instanceof Error) {
        if (error.message.includes("Rate limit")) {
          return "Rate limit exceeded. Please try again later.";
        }
        if (error.message.includes("Token limit")) {
          return "You have reached your token limit. Please upgrade your plan.";
        }
      }
      console.error(error);
      return "An error occurred.";
    },
  });
}
