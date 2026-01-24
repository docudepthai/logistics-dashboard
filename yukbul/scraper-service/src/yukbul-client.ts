/**
 * YukBul API client
 * Fetches load offers from YukBul's Supabase API
 * Handles automatic token refresh (tokens expire after 1 hour)
 */

import axios, { type AxiosInstance } from 'axios';
import type { YukbulApiResponse, YukbulListing } from './types.js';

const BASE_URL = 'https://znmzbteetuwadvrqxyal.supabase.co/rest/v1/rpc';
const AUTH_URL = 'https://znmzbteetuwadvrqxyal.supabase.co/auth/v1/token';
const USER_AGENT = 'Yukal/105 CFNetwork/3860.300.31 Darwin/25.2.0';

// Token refresh buffer - refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
}

export class YukbulClient {
  private client: AxiosInstance;
  private apiKey: string;
  private currentAccessToken: string;
  private currentRefreshToken: string;
  private tokenExpiresAt: number = 0;
  private requestCount = 0;
  private refreshCount = 0;
  private lastCursor: { created_at: string | null; id: number | null } = {
    created_at: null,
    id: null,
  };

  constructor(apiKey: string, initialAccessToken: string, refreshToken: string) {
    this.apiKey = apiKey;
    this.currentAccessToken = initialAccessToken;
    this.currentRefreshToken = refreshToken;
    // Assume the initial token is fresh - set expiry to 1 hour from now
    this.tokenExpiresAt = Date.now() + 60 * 60 * 1000;

    this.client = this.createClient(initialAccessToken);
  }

  /**
   * Create axios client with current access token
   */
  private createClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        Host: 'znmzbteetuwadvrqxyal.supabase.co',
        Connection: 'keep-alive',
        Accept: '*/*',
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json',
        apikey: this.apiKey,
        Authorization: `Bearer ${accessToken}`,
        'content-profile': 'public',
        'x-client-info': 'supabase-js-react-native/2.78.0',
      },
    });
  }

  /**
   * Check if token needs refresh and refresh if necessary
   */
  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    const timeUntilExpiry = this.tokenExpiresAt - now;

    if (timeUntilExpiry <= TOKEN_REFRESH_BUFFER_MS) {
      console.log(`[YukBul] Token expires in ${Math.round(timeUntilExpiry / 1000)}s, refreshing...`);
      await this.refreshAccessToken();
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    this.refreshCount++;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] YukBul token refresh #${this.refreshCount}...`);

    try {
      const response = await axios.post<TokenResponse>(
        `${AUTH_URL}?grant_type=refresh_token`,
        { refresh_token: this.currentRefreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            apikey: this.apiKey,
          },
          timeout: 30000,
        }
      );

      const { access_token, refresh_token, expires_at } = response.data;

      // Update tokens
      this.currentAccessToken = access_token;
      this.currentRefreshToken = refresh_token; // Refresh token rotates!
      this.tokenExpiresAt = expires_at * 1000; // Convert to milliseconds

      // Recreate client with new token
      this.client = this.createClient(access_token);

      console.log(
        `[${timestamp}] Token refreshed successfully. New token expires at: ${new Date(this.tokenExpiresAt).toISOString()}`
      );
      console.log(`[${timestamp}] New refresh token: ${refresh_token.substring(0, 8)}...`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error_description || error.message;
        console.error(`[YukBul] Token refresh failed: HTTP ${status} - ${message}`);

        if (status === 400 || status === 401) {
          throw new Error('YUKBUL_REFRESH_TOKEN_INVALID');
        }
      }
      throw error;
    }
  }

  /**
   * Fetch load offers from YukBul
   * @param size Number of offers to fetch (1-100)
   */
  async getListings(size = 100): Promise<YukbulListing[]> {
    // Ensure token is valid before making request
    await this.ensureValidToken();

    this.requestCount++;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] YukBul request #${this.requestCount}: fetching ${size} listings...`);

    try {
      const response = await this.client.post<YukbulApiResponse>('/listings_search_v1', {
        p_vehicle_types: [],
        p_trailer_types: [],
        p_cargo_types: [],
        p_origins: [],
        p_destinations: [],
        p_cursor_created_at: null,
        p_cursor_id: null,
        p_limit: size,
      });

      const items = response.data.items || [];

      // Update cursor for pagination (if needed later)
      if (items.length > 0) {
        const lastItem = items[items.length - 1];
        this.lastCursor = {
          created_at: lastItem.created_at,
          id: lastItem.id,
        };
      }

      console.log(`[${timestamp}] Received ${items.length} listings from YukBul`);

      return items;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401) {
          console.error('[YukBul] Token expired or invalid - attempting refresh...');
          // Try refreshing token and retry once
          await this.refreshAccessToken();
          return this.getListings(size);
        } else if (status === 429) {
          console.error('[YukBul] Rate limited - reduce request frequency');
          throw new Error('YUKBUL_RATE_LIMITED');
        } else if (status === 403) {
          console.error('[YukBul] Access forbidden - account might be banned');
          throw new Error('YUKBUL_ACCESS_DENIED');
        }

        console.error(`[YukBul] HTTP ${status}: ${error.message}`);
      } else {
        console.error('[YukBul] Request failed:', error);
      }

      throw error;
    }
  }

  /**
   * Get current refresh token (for logging/monitoring)
   */
  getCurrentRefreshToken(): string {
    return this.currentRefreshToken;
  }

  /**
   * Get API usage statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      tokenRefreshes: this.refreshCount,
      tokenExpiresIn: Math.max(0, Math.round((this.tokenExpiresAt - Date.now()) / 1000)) + 's',
      riskLevel: this.requestCount > 100 ? 'HIGH' : this.requestCount > 50 ? 'MEDIUM' : 'LOW',
    };
  }
}
