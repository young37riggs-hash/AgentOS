export interface IIntegrationSpec {
  id: string;
  name: string;
  version: string;
  description: string;
  categories: string[];
  capabilities: ('trigger' | 'action' | 'query')[];
}

export interface IToolInvocation {
  toolId: string;
  parameters: Record<string, any>;
  sessionContext?: Record<string, any>;
}

export interface IIntegrationResult {
  success: boolean;
  data?: any;
  error?: string;
  meta?: {
    latencyMs: number;
    usageCredits?: number;
  };
}

/**
 * Base Class for the 400+ n8n-style integrations (Google Sheets, Airtable, GitHub, etc.)
 */
export abstract class BaseIntegration {
  public abstract readonly spec: IIntegrationSpec;
  
  /**
   * Initializes the integration (e.g. validating auth, setting up webhooks)
   */
  public abstract initialize(): Promise<void>;

  /**
   * Executes a specific tool action requested by the Agent Runtime
   */
  public abstract executeAction(invocation: IToolInvocation): Promise<IIntegrationResult>;

  /**
   * Health check for gateway diagnostics
   */
  public async ping(): Promise<boolean> {
    return true; // Simple default
  }
}
