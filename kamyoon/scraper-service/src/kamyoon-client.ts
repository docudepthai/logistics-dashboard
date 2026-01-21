/**
 * Kamyoon API client
 * Fetches WhatsApp load offers from Kamyoon's API
 */

import axios, { type AxiosInstance } from 'axios';
import type { KamyoonApiResponse, KamyoonLoadOffer } from './types.js';

const BASE_URL = 'https://api.kamyoon.com.tr/api';
const USER_AGENT = 'EgeYurtMuavin/268 CFNetwork/3860.300.31 Darwin/25.2.0';

export class KamyoonClient {
  private client: AxiosInstance;
  private requestCount = 0;

  constructor(private token: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: {
        Host: 'api.kamyoon.com.tr',
        Connection: 'keep-alive',
        Accept: 'application/json, text/plain, */*',
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        Authorization: `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
  }

  /**
   * Fetch WhatsApp load offers from Kamyoon
   * @param size Number of offers to fetch (1-500, recommended 15-50)
   */
  async getLoadOffers(size = 30): Promise<KamyoonLoadOffer[]> {
    this.requestCount++;
    const timestamp = new Date().toISOString();

    console.log(`[${timestamp}] Kamyoon request #${this.requestCount}: fetching ${size} offers...`);

    try {
      const response = await this.client.get<KamyoonApiResponse>(
        '/WhatsAppSelenium/GetWhatsAppLoadOffers',
        {
          params: { Size: size },
        }
      );

      // Handle both response formats
      const offers = response.data.$values || [];

      console.log(`[${timestamp}] Received ${offers.length} offers from Kamyoon`);

      return offers;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401) {
          console.error('[Kamyoon] Token expired or invalid - need new token');
          throw new Error('KAMYOON_TOKEN_EXPIRED');
        } else if (status === 429) {
          console.error('[Kamyoon] Rate limited - reduce request frequency');
          throw new Error('KAMYOON_RATE_LIMITED');
        } else if (status === 403) {
          console.error('[Kamyoon] Access forbidden - account might be banned');
          throw new Error('KAMYOON_ACCESS_DENIED');
        }

        console.error(`[Kamyoon] HTTP ${status}: ${error.message}`);
      } else {
        console.error('[Kamyoon] Request failed:', error);
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
