import { openrouter, openRouterModels, type modelID } from "@/ai/providers";
import { smoothStream, streamText, type UIMessage } from "ai";
import { appendResponseMessages } from 'ai';
import { saveChat, saveMessages, convertToDBMessages } from '@/lib/chat-store';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { chats } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { initializeMCPClients, type MCPServerConfig } from '@/lib/mcp-client';

// import { checkBotId } from "botid/server";

export async function POST(req: Request) {
  const {
    messages,
    chatId,
    selectedModel,
    userId,
    mcpServers = [],
  }: {
    messages: UIMessage[];
    chatId?: string;
    selectedModel: modelID;
    userId: string;
    mcpServers?: MCPServerConfig[];
  } = await req.json();

  // Disabled botid check for now
  // const { isBot, isGoodBot } = await checkBotId();

  // if (isBot && !isGoodBot) {
  //   return new Response(
  //     JSON.stringify({ error: "Bot is not allowed to access this endpoint" }),
  //     { status: 401, headers: { "Content-Type": "application/json" } }
  //   );
  // }

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "User ID is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const id = chatId || nanoid();

  // Check if chat already exists for the given ID
  // If not, create it now
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
    // No ID provided, definitely new
    isNewChat = true;
  }

  // If it's a new chat, save it immediately
  if (isNewChat && messages.length > 0) {
    try {
      // Save the chat immediately with a default title
      // Title will be generated after the first response
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

  // Initialize MCP clients using the already running persistent HTTP/SSE servers
  const { tools, cleanup } = await initializeMCPClients(mcpServers, req.signal);

  console.log("messages", messages);
  console.log("parts", messages.map(m => m.parts.map(p => p)));

  // Track if the response has completed
  let responseCompleted = false;

  // System prompt for all models
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
- If you don't know the answer, use the tools to find the answer or say you don't know.`;

  // Use OpenRouter model directly
  const selectedLanguageModel = openrouter(openRouterModels[selectedModel]);

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
    async onFinish({ response }) {
      responseCompleted = true;
      const allMessages = appendResponseMessages({
        messages,
        responseMessages: response.messages,
      });

      // Generate title using the same model if it's a new chat
      let title: string | undefined;
      if (isNewChat && allMessages.length >= 2) {
        try {
          const userMessage = allMessages.find(m => m.role === 'user');
          if (userMessage) {
            // Helper to extract text from message parts
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
              // Use the same model to generate title
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

      // Clean up resources - now this just closes the client connections
      // not the actual servers which persist in the MCP context
      await cleanup();
    }
  });

  // Ensure cleanup happens if the request is terminated early
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
  // Add chat ID to response headers so client can know which chat was created
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
      }
      console.error(error);
      return "An error occurred.";
    },
  });
}