/**
 * Conversation domain — waiting-room chat with the AI companion.
 * Future: Bedrock InvokeModel + DynamoDB conversation history.
 */

export type ConversationRole = "user" | "assistant";

export interface ConversationMessage {
  id: string;
  role: ConversationRole;
  content: string;
  createdAt: string;
  meta?: {
    provider?: string;
    model?: string;
  };
}

export interface SendMessageRequest {
  message: string;
  history?: Array<{ role: ConversationRole; content: string }>;
  userId?: string;
}

export interface SendMessageResponse {
  reply: ConversationMessage;
}
