import { BaseIntegration } from './BaseIntegration.ts';
import { CircuitBreaker } from '../safeties/CircuitBreaker.ts';
import { RetryPolicy, DefaultIntegrationRetry } from '../safeties/RetryPolicy.ts';

/**
 * Enterprise Tool Registry
 * Manages the lifecycle, routing, and execution safeties (Circuit Breakers/Retries) 
 * for 400+ enterprise integrations (Airtable, Sheets, GitHub, Slack, etc.)
 */
export class IntegrationRegistry {
  private readonly integrations = new Map<string, BaseIntegration>();
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  constructor() {}

  /**
   * Registers a new integration and prepares its safety harnesses.
   */
  public async register(integration: BaseIntegration): Promise<void> {
    const id = integration.spec.id;
    if (this.integrations.has(id)) {
      throw new Error(`Integration [${id}] is already registered.`);
    }

    try {
      await integration.initialize();
      this.integrations.set(id, integration);
      
      // Setup dynamic circuit breaker for this specific integration
      this.circuitBreakers.set(id, new CircuitBreaker(id, {
        failureThreshold: 5,
        resetTimeoutMs: 60000,
        requestTimeoutMs: 15000 // Timeouts to manage strict connection rules
      }));

    } catch (e: any) {
      console.error(`Failed to initialize integration ${id}: ${e.message}`);
    }
  }

  /**
   * Execute an action with full safety wrappers (Circuit Breaker + Exponential Retry)
   */
  public async executeTool(integrationId: string, payload: any): Promise<any> {
    const integration = this.integrations.get(integrationId);
    const cb = this.circuitBreakers.get(integrationId);

    if (!integration || !cb) {
      throw new Error(`Integration [${integrationId}] not found or misconfigured.`);
    }

    // Execute with Exponential Backoff Retry Policy wrapped around a Circuit Breaker
    return await DefaultIntegrationRetry.execute(() => {
      return cb.execute(async () => {
        return await integration.executeAction(payload);
      });
    });
  }

  public getAvailableTools(): any[] {
    return Array.from(this.integrations.values()).map(i => i.spec);
  }
}
