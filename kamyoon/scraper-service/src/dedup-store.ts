/**
 * Simple in-memory deduplication store
 * Tracks processed Kamyoon offer IDs to avoid sending duplicates
 */

export class DedupStore {
  private processedIds: Set<number> = new Set();
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
  }

  /**
   * Check if an offer ID has been processed
   */
  has(id: number): boolean {
    return this.processedIds.has(id);
  }

  /**
   * Mark an offer ID as processed
   */
  add(id: number): void {
    // If we're at max capacity, clear oldest entries (first 20%)
    if (this.processedIds.size >= this.maxSize) {
      const idsArray = Array.from(this.processedIds);
      const toRemove = Math.floor(this.maxSize * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.processedIds.delete(idsArray[i]);
      }
      console.log(`[DedupStore] Cleared ${toRemove} old entries, now tracking ${this.processedIds.size} IDs`);
    }

    this.processedIds.add(id);
  }

  /**
   * Add multiple IDs
   */
  addMany(ids: number[]): void {
    ids.forEach((id) => this.add(id));
  }

  /**
   * Filter out already processed offers
   */
  filterNew<T extends { id: number }>(offers: T[]): T[] {
    return offers.filter((offer) => !this.has(offer.id));
  }

  /**
   * Get store statistics
   */
  getStats() {
    return {
      trackedIds: this.processedIds.size,
      maxSize: this.maxSize,
      utilization: ((this.processedIds.size / this.maxSize) * 100).toFixed(1) + '%',
    };
  }

  /**
   * Clear all tracked IDs
   */
  clear(): void {
    this.processedIds.clear();
  }
}
