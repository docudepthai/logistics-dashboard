/**
 * YukBul API client
 * Fetches load offers from YukBul's Supabase API
 */

import axios, { type AxiosInstance } from 'axios';
import type { YukbulApiResponse, YukbulListing } from './types.js';

const BASE_URL = 'https://znmzbteetuwadvrqxyal.supabase.co/rest/v1/rpc';
const USER_AGENT = 'Yukal/105 CFNetwork/3860.300.31 Darwin/25.2.0';

export class YukbulClient {
  private client: AxiosInstance;
  private requestCount = 0;
  private lastCursor: { created_at: string | null; id: number | null } = {
    created_at: null,
    id: null,
  };

  constructor(
    private apiKey: string,
    private authToken: string
  ) {
    this.client = axios.create({
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
        apikey: apiKey,
        Authorization: `Bearer ${authToken}`,
        'content-profile': 'public',
        'x-client-info': 'supabase-js-react-native/2.78.0',
      },
    });
  }

  /**
   * Fetch load offers from YukBul
   * @param size Number of offers to fetch (1-100)
   */
  async getListings(size = 100): Promise<YukbulListing[]> {
    this.requestCount++;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] YukBul request #${this.requestCount}: fetching ${size} listings...`);

    try {
      const response = await this.client.post<YukbulApiResponse>(
        '/listings_search_v1',
        {
          p_vehicle_types: [],
          p_trailer_types: [],
          p_cargo_types: [],
          p_origins: [],
          p_destinations: [],
          p_cursor_created_at: null,
          p_cursor_id: null,
          p_limit: size,
        }
      );

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
          console.error('[YukBul] Token expired or invalid - need new token');
          throw new Error('YUKBUL_TOKEN_EXPIRED');
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
   * Get API usage statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      riskLevel:
        this.requestCount > 100 ? 'HIGH' : this.requestCount > 50 ? 'MEDIUM' : 'LOW',
    };
  }
}
