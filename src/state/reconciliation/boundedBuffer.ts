/**
 * Bounded event buffer for WebSocket stream messages during initial snapshot load and replay.
 */

import type { StreamEnvelope } from "../../domain/event/types.ts";

export interface BoundedBufferOptions {
  maxCapacity?: number;
  maxAgeMs?: number;
}

export class BoundedEventBuffer {
  private readonly maxCapacity: number;
  private readonly maxAgeMs: number;
  private buffer: StreamEnvelope[] = [];
  private overflowDetected: boolean = false;

  constructor(options: BoundedBufferOptions = {}) {
    this.maxCapacity = options.maxCapacity ?? 5000;
    this.maxAgeMs = options.maxAgeMs ?? 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Enqueues an event into the buffer maintaining monotonic sequence order.
   * Returns false if buffer overflowed and item had to be dropped/flagged.
   */
  push(event: StreamEnvelope): boolean {
    // Check if buffer is already at max capacity
    if (this.buffer.length >= this.maxCapacity) {
      this.overflowDetected = true;
      return false;
    }

    // Binary or sorted insertion by eventSequence
    const seq = event.eventSequence;
    let low = 0;
    let high = this.buffer.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.buffer[mid].eventSequence < seq) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    // Check for exact duplicate message ID at position
    if (
      low < this.buffer.length &&
      this.buffer[low].messageId === event.messageId
    ) {
      return true; // Duplicate already in buffer
    }

    this.buffer.splice(low, 0, event);
    return true;
  }

  /**
   * Returns all events in the buffer strictly greater than the given sequence number.
   */
  getEventsAfter(sequence: number): StreamEnvelope[] {
    return this.buffer.filter((e) => e.eventSequence > sequence);
  }

  /**
   * Cleans out events older than the specified sequence number.
   */
  trimBefore(sequence: number): void {
    this.buffer = this.buffer.filter((e) => e.eventSequence >= sequence);
  }

  /**
   * Clears the entire buffer and resets overflow flag.
   */
  clear(): void {
    this.buffer = [];
    this.overflowDetected = false;
  }

  get size(): number {
    return this.buffer.length;
  }

  get hasOverflow(): boolean {
    return this.overflowDetected;
  }

  resetOverflow(): void {
    this.overflowDetected = false;
  }

  toArray(): StreamEnvelope[] {
    return [...this.buffer];
  }
}
