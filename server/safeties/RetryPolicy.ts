export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

/**
 * Advanced Retry Policy with Exponential Backoff and Jitter
 * Essential for robust AgentOS interaction with third-party tools.
 */
export class RetryPolicy {
  constructor(private readonly options: RetryOptions) {}

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    let attempt = 0;
    
    while (true) {
      try {
        return await action();
      } catch (error: any) {
        attempt++;
        if (attempt > this.options.maxRetries) {
          throw new Error(`Execution failed after ${this.options.maxRetries} retries: ${error.message}`);
        }
        
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.options.baseDelayMs * Math.pow(2, attempt - 1);
    const boundedDelay = Math.min(exponentialDelay, this.options.maxDelayMs);
    
    if (this.options.jitter) {
      // Add up to 20% jitter
      const jitterFactor = 1.0 + (Math.random() * 0.2 - 0.1); 
      return Math.floor(boundedDelay * jitterFactor);
    }
    
    return boundedDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const DefaultIntegrationRetry = new RetryPolicy({
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitter: true
});
