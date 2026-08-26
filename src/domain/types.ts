export interface ChatMessage {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string; // ISO timestamp
}

export interface Alert {
  id: string;
  messageId: string;
  reason: string;
  createdAt: string;
}
