import { db } from "./db";
import { chats, messages, type Chat, type Message, MessageRole, type MessagePart } from "./db/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { convertToDBMessages, convertToUIMessages, getTextContent, type DBMessage, type UIMessage } from "./chat-utils";

// Re-export types and utilities for backward compatibility
export { convertToDBMessages, convertToUIMessages, getTextContent };
export type { DBMessage, UIMessage };

type AIMessage = {
  role: string;
  content: string | any[];
  id?: string;
  parts?: MessagePart[];
};

type SaveChatParams = {
  id?: string;
  userId: string;
  messages?: any[];
  title?: string;
};

type ChatWithMessages = Chat & {
  messages: Message[];
};

export async function saveMessages({
  messages: dbMessages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    if (dbMessages.length > 0) {
      const chatId = dbMessages[0].chatId;

      await db
        .delete(messages)
        .where(eq(messages.chatId, chatId));

      return await db.insert(messages).values(dbMessages);
    }
    return null;
  } catch (error) {
    console.error('Failed to save messages in database', error);
    throw error;
  }
}

export async function saveChat({ id, userId, messages: aiMessages, title }: SaveChatParams) {
  const chatId = id || nanoid();
  let chatTitle = title;

  if (aiMessages && aiMessages.length > 0) {
    const hasEnoughMessages = aiMessages.length >= 2 &&
      aiMessages.some(m => m.role === 'user') &&
      aiMessages.some(m => m.role === 'assistant');

    if (!chatTitle || chatTitle === 'New Chat' || chatTitle === undefined) {
      if (hasEnoughMessages) {
        // Try to extract title from first user message as fallback
        const firstUserMessage = aiMessages.find(m => m.role === 'user');
        if (firstUserMessage) {
          if (firstUserMessage.parts && Array.isArray(firstUserMessage.parts)) {
            const textParts = firstUserMessage.parts.filter((p: MessagePart) => p.type === 'text' && p.text);
            if (textParts.length > 0) {
              chatTitle = textParts[0].text?.slice(0, 50) || 'New Chat';
              if ((textParts[0].text?.length || 0) > 50) {
                chatTitle += '...';
              }
            } else {
              chatTitle = 'New Chat';
            }
          } else if (typeof firstUserMessage.content === 'string') {
            chatTitle = firstUserMessage.content.slice(0, 50);
            if (firstUserMessage.content.length > 50) {
              chatTitle += '...';
            }
          } else {
            chatTitle = 'New Chat';
          }
        } else {
          chatTitle = 'New Chat';
        }
      } else {
        const firstUserMessage = aiMessages.find(m => m.role === 'user');
        if (firstUserMessage) {
          if (firstUserMessage.parts && Array.isArray(firstUserMessage.parts)) {
            const textParts = firstUserMessage.parts.filter((p: MessagePart) => p.type === 'text' && p.text);
            if (textParts.length > 0) {
              chatTitle = textParts[0].text?.slice(0, 50) || 'New Chat';
              if ((textParts[0].text?.length || 0) > 50) {
                chatTitle += '...';
              }
            } else {
              chatTitle = 'New Chat';
            }
          } else if (typeof firstUserMessage.content === 'string') {
            chatTitle = firstUserMessage.content.slice(0, 50);
            if (firstUserMessage.content.length > 50) {
              chatTitle += '...';
            }
          } else {
            chatTitle = 'New Chat';
          }
        } else {
          chatTitle = 'New Chat';
        }
      }
    }
  } else {
    chatTitle = chatTitle || 'New Chat';
  }

  const existingChat = await db.query.chats.findFirst({
    where: and(
      eq(chats.id, chatId),
      eq(chats.userId, userId)
    ),
  });

  if (existingChat) {
    await db
      .update(chats)
      .set({
        title: chatTitle,
        updatedAt: new Date()
      })
      .where(and(
        eq(chats.id, chatId),
        eq(chats.userId, userId)
      ));
  } else {
    await db.insert(chats).values({
      id: chatId,
      userId,
      title: chatTitle,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  return { id: chatId };
}

export async function getChats(userId: string) {
  return await db.query.chats.findMany({
    where: eq(chats.userId, userId),
    orderBy: [desc(chats.updatedAt)]
  });
}

export async function getChatById(id: string, userId: string): Promise<ChatWithMessages | null> {
  const chat = await db.query.chats.findFirst({
    where: and(
      eq(chats.id, id),
      eq(chats.userId, userId)
    ),
  });

  if (!chat) return null;

  const chatMessages = await db.query.messages.findMany({
    where: eq(messages.chatId, id),
    orderBy: [messages.createdAt]
  });

  return {
    ...chat,
    messages: chatMessages
  };
}

export async function deleteChat(id: string, userId: string) {
  await db.delete(chats).where(
    and(
      eq(chats.id, id),
      eq(chats.userId, userId)
    )
  );
}
