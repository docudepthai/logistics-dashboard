import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/** Route with search count for learning */
export interface FrequentRoute {
  origin: string;
  destination?: string;  // undefined means "anywhere from origin"
  count: number;
  lastSearched: string;  // ISO timestamp
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
  // Pagination support
  lastOffset?: number;
  lastTotalCount?: number;
  lastShownCount?: number;
  // Foul language warning
  swearWarned?: boolean;

  // === LEARNING FIELDS ===
  /** Most frequently searched routes (top 10) */
  frequentRoutes?: FrequentRoute[];
  /** Total number of searches by this user */
  totalSearches?: number;
  /** Preferred vehicle type based on search history */
  preferredVehicle?: string;
  /** First interaction timestamp */
  firstSeen?: string;
  /** Flag to indicate we suggested a vehicle filter and await confirmation */
  pendingVehicleSuggestion?: boolean;
  /** Pending nearby search suggestion with original search params */
  pendingNearbySuggestion?: {
    origin?: string;
    destination?: string;
    neighboringOrigins?: string[];
    neighboringDestinations?: string[];
  };
}

export interface Conversation {
  userId: string;
  messages: Message[];
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
}

/** Pending notification for empty search results */
export interface PendingNotification {
  pk: string;           // PENDING_ROUTE#{origin}
  sk: string;           // {destination|ANY}#{userId}#{timestamp}
  userId: string;
  origin: string;
  destination?: string; // undefined = any destination from origin
  createdAt: string;
  ttl: number;          // Unix timestamp for DynamoDB TTL (3 hours from creation)
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

    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.tableName = options.tableName || process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
    this.maxMessages = options.maxMessages || 200; // Keep last 200 messages
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

  // === PENDING NOTIFICATION METHODS ===

  /**
   * Create a pending notification when user searches but finds no results.
   * Will be notified if a matching job appears within 3 hours.
   */
  async createPendingNotification(
    userId: string,
    origin: string,
    destination?: string
  ): Promise<void> {
    const now = new Date();
    const timestamp = now.getTime();
    const threeHoursLater = timestamp + (3 * 60 * 60 * 1000); // 3 hours in ms

    const dest = destination || 'ANY';

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `PENDING_ROUTE#${origin}`,
          sk: `${dest}#${userId}#${timestamp}`,
          userId,
          origin,
          destination: destination || null,
          createdAt: now.toISOString(),
          ttl: Math.floor(threeHoursLater / 1000), // DynamoDB TTL in seconds
        },
      })
    );

    console.log(`[PendingNotification] Created for ${userId}: ${origin} → ${dest}`);
  }

  /**
   * Get all pending notifications that match a job's route.
   * Called by processor when a new job is inserted.
   */
  async getPendingNotificationsByRoute(
    origin: string,
    destination?: string
  ): Promise<PendingNotification[]> {
    const results: PendingNotification[] = [];

    // Query 1: Exact route match (origin → destination)
    if (destination) {
      const exactMatch = await this.client.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
          ExpressionAttributeValues: {
            ':pk': `PENDING_ROUTE#${origin}`,
            ':skPrefix': `${destination}#`,
          },
        })
      );
      if (exactMatch.Items) {
        results.push(...(exactMatch.Items as PendingNotification[]));
      }
    }

    // Query 2: Any destination from origin (origin → ANY)
    const anyMatch = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `PENDING_ROUTE#${origin}`,
          ':skPrefix': 'ANY#',
        },
      })
    );
    if (anyMatch.Items) {
      results.push(...(anyMatch.Items as PendingNotification[]));
    }

    return results;
  }

  /**
   * Delete a pending notification after sending the notification.
   */
  async deletePendingNotification(pk: string, sk: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { pk, sk },
      })
    );
  }
}
