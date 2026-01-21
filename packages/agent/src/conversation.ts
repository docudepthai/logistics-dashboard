import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ConversationContext {
  lastOrigin?: string;
  lastDestination?: string;
  lastVehicleType?: string;
  lastBodyType?: string;
  lastIsRefrigerated?: boolean;
  lastCargoType?: string;
  lastJobIds?: string[];
  lastSearchFilters?: Record<string, unknown>;
}

export interface Conversation {
  userId: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
}

export class ConversationStore {
  private client: DynamoDBDocumentClient;
  private tableName: string;
  private maxMessages: number;

  constructor(options: {
    tableName?: string;
    region?: string;
    maxMessages?: number;
  } = {}) {
    const dynamoClient = new DynamoDBClient({
      region: options.region || process.env.AWS_REGION || 'eu-central-1',
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = options.tableName || process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
    this.maxMessages = options.maxMessages || 50; // Keep last 50 messages
  }

  async getConversation(userId: string): Promise<Conversation | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${userId}`,
          sk: 'CONVERSATION',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return {
      userId,
      messages: result.Item.messages || [],
      context: result.Item.context || {},
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
    };
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    // Trim messages to max limit
    const trimmedMessages = conversation.messages.slice(-this.maxMessages);

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${conversation.userId}`,
          sk: 'CONVERSATION',
          messages: trimmedMessages,
          context: conversation.context,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
      })
    );
  }

  async addMessage(
    userId: string,
    message: Omit<Message, 'timestamp'>,
    contextUpdate?: Partial<ConversationContext>
  ): Promise<Conversation> {
    const now = new Date().toISOString();

    // Get existing conversation or create new
    let conversation = await this.getConversation(userId);

    if (!conversation) {
      conversation = {
        userId,
        messages: [],
        context: {},
        createdAt: now,
        updatedAt: now,
      };
    }

    // Add new message
    conversation.messages.push({
      ...message,
      timestamp: now,
    });

    // Update context if provided
    if (contextUpdate) {
      conversation.context = {
        ...conversation.context,
        ...contextUpdate,
      };
    }

    conversation.updatedAt = now;

    // Save
    await this.saveConversation(conversation);

    return conversation;
  }

  async clearConversation(userId: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${userId}`,
          sk: 'CONVERSATION',
        },
      })
    );
  }

  getMessagesForPrompt(conversation: Conversation | null): Message[] {
    if (!conversation) {
      return [];
    }

    // Return messages in format suitable for OpenAI
    return conversation.messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));
  }
}
