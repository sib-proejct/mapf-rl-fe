/**
 * Exponential backoff with full jitter calculation.
 * Formula: Math.random() * Math.min(maxDelayMs, baseDelayMs * 2^attempt)
 */

export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

export class ExponentialBackoff {
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly maxAttempts: number;
  private attempt: number = 0;

  constructor(options: BackoffOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 250;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.maxAttempts = options.maxAttempts ?? Infinity;
  }

  /**
   * Calculates the next jittered backoff delay in milliseconds.
   */
  nextDelay(): number {
    const exponent = Math.min(this.attempt, 10);
    const ceiling = Math.min(
      this.maxDelayMs,
      this.baseDelayMs * Math.pow(2, exponent),
    );
    this.attempt++;
    // Full jitter
    return Math.floor(Math.random() * ceiling);
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  get isExhausted(): boolean {
    return this.attempt >= this.maxAttempts;
  }

  reset(): void {
    this.attempt = 0;
  }
}
