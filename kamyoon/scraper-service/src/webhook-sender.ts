/**
 * Webhook sender to AWS Lambda
 * Sends transformed Kamyoon data to the Turkish Logistics webhook
 */

import axios from 'axios';
import type { EvolutionWebhookPayload } from './types.js';

export interface WebhookSenderConfig {
  webhookUrl: string;
  apiKey: string;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  error?: string;
}

export class WebhookSender {
  private config: WebhookSenderConfig;
  private sentCount = 0;
  private errorCount = 0;

  constructor(config: WebhookSenderConfig) {
    this.config = config;
  }

  /**
   * Send a single payload to the webhook
   */
  async send(payload: EvolutionWebhookPayload): Promise<SendResult> {
    const messageId = payload.data.key.id;

    try {
      const response = await axios.post(this.config.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
        },
        timeout: 30000,
      });

      this.sentCount++;

      if (response.status === 200) {
        return { success: true, messageId };
      }

      return {
        success: false,
        messageId,
        error: `Unexpected status: ${response.status}`,
      };
    } catch (error) {
      this.errorCount++;

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;

        console.error(`[Webhook] Failed to send ${messageId}: HTTP ${status} - ${message}`);

        return {
          success: false,
          messageId,
          error: `HTTP ${status}: ${message}`,
        };
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Webhook] Failed to send ${messageId}: ${errorMessage}`);

      return {
        success: false,
        messageId,
        error: errorMessage,
      };
    }
  }

  /**
   * Send multiple payloads to the webhook
   * Sends sequentially with small delay to avoid overwhelming the Lambda
   */
  async sendBatch(
    payloads: EvolutionWebhookPayload[],
    delayMs = 100
  ): Promise<{ sent: number; failed: number; results: SendResult[] }> {
    const results: SendResult[] = [];
    let sent = 0;
    let failed = 0;

    console.log(`[Webhook] Sending batch of ${payloads.length} messages...`);

    for (const payload of payloads) {
      const result = await this.send(payload);
      results.push(result);

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay between requests
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log(`[Webhook] Batch complete: ${sent} sent, ${failed} failed`);

    return { sent, failed, results };
  }

  /**
   * Get sender statistics
   */
  getStats() {
    return {
      totalSent: this.sentCount,
      totalErrors: this.errorCount,
      successRate:
        this.sentCount + this.errorCount > 0
          ? ((this.sentCount / (this.sentCount + this.errorCount)) * 100).toFixed(1) + '%'
          : 'N/A',
    };
  }
}
