/**
 * Token Store - Persists Yukbul tokens to DynamoDB
 * Survives service restarts on Railway
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'turkish-logistics-conversations';
const TOKEN_KEY = 'YUKBUL_TOKENS';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  updatedAt: string;
}

export class TokenStore {
  private docClient: DynamoDBDocumentClient;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-central-1',
    });
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  /**
   * Load tokens from DynamoDB
   * Returns null if no tokens stored
   */
  async loadTokens(): Promise<StoredTokens | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: TOKEN_KEY,
          sk: 'CURRENT',
        },
      }));

      if (!result.Item) {
        console.log('[TokenStore] No stored tokens found');
        return null;
      }

      console.log(`[TokenStore] Loaded tokens from DynamoDB (updated: ${result.Item.updatedAt})`);
      return {
        accessToken: result.Item.accessToken,
        refreshToken: result.Item.refreshToken,
        expiresAt: result.Item.expiresAt,
        updatedAt: result.Item.updatedAt,
      };
    } catch (error) {
      console.error('[TokenStore] Failed to load tokens:', error);
      return null;
    }
  }

  /**
   * Save tokens to DynamoDB
   */
  async saveTokens(tokens: Omit<StoredTokens, 'updatedAt'>): Promise<void> {
    try {
      const item = {
        pk: TOKEN_KEY,
        sk: 'CURRENT',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        updatedAt: new Date().toISOString(),
      };

      await this.docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      }));

      console.log(`[TokenStore] Saved tokens to DynamoDB (refresh: ${tokens.refreshToken.substring(0, 8)}...)`);
    } catch (error) {
      console.error('[TokenStore] Failed to save tokens:', error);
      throw error;
    }
  }
}
