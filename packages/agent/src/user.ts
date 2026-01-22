import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

export type MembershipStatus = 'free_trial' | 'expired' | 'premium';

export interface User {
  phoneNumber: string;
  firstContactAt: string;
  freeTierExpiresAt: string;
  membershipStatus: MembershipStatus;
  welcomeMessageSent: boolean;
  createdAt: string;
  updatedAt: string;
  // Future payment fields
  paidUntil?: string;
  paymentId?: string;
}

export class UserStore {
  private client: DynamoDBDocumentClient;
  private tableName: string;
  private freeTierDays: number;

  constructor(options: {
    tableName?: string;
    region?: string;
    freeTierDays?: number;
  } = {}) {
    const dynamoClient = new DynamoDBClient({
      region: options.region || process.env.AWS_REGION || 'eu-central-1',
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = options.tableName || process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
    this.freeTierDays = options.freeTierDays || 7;
    // TODO: For testing, override to 1 minute. Change back to days for production!
    // this.freeTierDays = 7;
  }

  /**
   * Get user by phone number. Returns null if not found.
   */
  async getUser(phoneNumber: string): Promise<User | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'PROFILE',
        },
      })
    );

    if (!result.Item) {
      return null;
    }

    return {
      phoneNumber: result.Item.phoneNumber,
      firstContactAt: result.Item.firstContactAt,
      freeTierExpiresAt: result.Item.freeTierExpiresAt,
      membershipStatus: result.Item.membershipStatus,
      welcomeMessageSent: result.Item.welcomeMessageSent,
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
      paidUntil: result.Item.paidUntil,
      paymentId: result.Item.paymentId,
    };
  }

  /**
   * Create a new user with free trial.
   */
  async createUser(phoneNumber: string): Promise<User> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.freeTierDays * 24 * 60 * 60 * 1000); // 7 days trial

    const user: User = {
      phoneNumber,
      firstContactAt: now.toISOString(),
      freeTierExpiresAt: expiresAt.toISOString(),
      membershipStatus: 'free_trial',
      welcomeMessageSent: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${phoneNumber}`,
          sk: 'PROFILE',
          ...user,
        },
        // Only create if doesn't exist (atomic)
        ConditionExpression: 'attribute_not_exists(pk)',
      })
    );

    return user;
  }

  /**
   * Get existing user or create new one with free trial.
   * Returns the user and whether they are new.
   */
  async getOrCreateUser(phoneNumber: string): Promise<{ user: User; isNewUser: boolean }> {
    let user = await this.getUser(phoneNumber);

    if (user) {
      // Check if free tier has expired and update status
      const now = new Date();
      if (user.membershipStatus === 'free_trial' && new Date(user.freeTierExpiresAt) < now) {
        user = await this.updateMembershipStatus(phoneNumber, 'expired');
      }
      return { user, isNewUser: false };
    }

    try {
      user = await this.createUser(phoneNumber);
      return { user, isNewUser: true };
    } catch (error: unknown) {
      // Race condition - another request created the user
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ConditionalCheckFailedException') {
        user = await this.getUser(phoneNumber);
        return { user: user!, isNewUser: false };
      }
      throw error;
    }
  }

  /**
   * Mark welcome message as sent for a user.
   * Uses conditional update to prevent race conditions (only updates if not already sent).
   * Returns true if update succeeded (welcome not yet sent), false if already sent.
   */
  async markWelcomeMessageSent(phoneNumber: string): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${phoneNumber}`,
            sk: 'PROFILE',
          },
          UpdateExpression: 'SET welcomeMessageSent = :sent, updatedAt = :now',
          ConditionExpression: 'attribute_not_exists(welcomeMessageSent) OR welcomeMessageSent = :false',
          ExpressionAttributeValues: {
            ':sent': true,
            ':false': false,
            ':now': new Date().toISOString(),
          },
        })
      );
      return true; // Successfully marked - welcome should be sent
    } catch (error: unknown) {
      // ConditionalCheckFailedException means welcome was already sent
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ConditionalCheckFailedException') {
        return false; // Already sent by another request
      }
      throw error; // Re-throw other errors
    }
  }

  /**
   * Update membership status.
   */
  async updateMembershipStatus(phoneNumber: string, status: MembershipStatus): Promise<User> {
    const now = new Date().toISOString();

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'PROFILE',
        },
        UpdateExpression: 'SET membershipStatus = :status, updatedAt = :now',
        ExpressionAttributeValues: {
          ':status': status,
          ':now': now,
        },
      })
    );

    const user = await this.getUser(phoneNumber);
    return user!;
  }

  /**
   * Activate premium membership after payment.
   */
  async activatePremium(phoneNumber: string, paidUntil: string, paymentId: string): Promise<User> {
    const now = new Date().toISOString();

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'PROFILE',
        },
        UpdateExpression: 'SET membershipStatus = :status, paidUntil = :paidUntil, paymentId = :paymentId, updatedAt = :now',
        ExpressionAttributeValues: {
          ':status': 'premium',
          ':paidUntil': paidUntil,
          ':paymentId': paymentId,
          ':now': now,
        },
      })
    );

    const user = await this.getUser(phoneNumber);
    return user!;
  }

  /**
   * Check if user can view phone numbers (free trial active or premium).
   */
  isFreeTierActive(user: User): boolean {
    // Premium users always have access
    if (user.membershipStatus === 'premium') {
      // Check if premium has expired
      if (user.paidUntil && new Date(user.paidUntil) < new Date()) {
        return false;
      }
      return true;
    }

    // Expired users don't have access
    if (user.membershipStatus === 'expired') {
      return false;
    }

    // Free trial users - check expiration
    return new Date(user.freeTierExpiresAt) > new Date();
  }
}
