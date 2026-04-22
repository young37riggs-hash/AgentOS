import { EventEmitter2 } from 'eventemitter2';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  requestTimeoutMs?: number;
}

export const CircuitState = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
} as const;

export type CircuitState = typeof CircuitState[keyof typeof CircuitState];

/**
 * Enterprise Production Grade Circuit Breaker
 * Prevents cascading failures when integrating with 400+ external systems.
 */
export class CircuitBreaker extends EventEmitter2 {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private nextAttemptTime: number = 0;
  private readonly options: CircuitBreakerOptions;

  public readonly serviceName: string;

  constructor(serviceName: string, options?: Partial<CircuitBreakerOptions>) {
    super({ wildcard: true, maxListeners: 100 });
    this.serviceName = serviceName;
    this.options = {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      requestTimeoutMs: 10000,
      ...options
    };
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttemptTime) {
        this.transition(CircuitState.HALF_OPEN);
      } else {
        throw new Error(`CircuitBreaker [${this.serviceName}] is OPEN. Fast failing request.`);
      }
    }

    try {
      const result = await this.executeWithTimeout(action);
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);
      throw error;
    }
  }

  private executeWithTimeout<T>(action: () => Promise<T>): Promise<T> {
    if (!this.options.requestTimeoutMs) return action();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout of ${this.options.requestTimeoutMs}ms exceeded`));
      }, this.options.requestTimeoutMs);

      action().then((res) => {
        clearTimeout(timer);
        resolve(res);
      }).catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.transition(CircuitState.CLOSED);
    }
  }

  private onFailure(error: Error): void {
    this.failureCount += 1;
    this.emit('failure', { service: this.serviceName, error: error.message, count: this.failureCount });

    if (this.failureCount >= this.options.failureThreshold) {
      this.transition(CircuitState.OPEN);
    }
  }

  private transition(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    
    if (newState === CircuitState.OPEN) {
      this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
    }
    
    this.emit('state_change', { service: this.serviceName, oldState, newState });
  }

  public getState(): CircuitState {
    return this.state;
  }
}
