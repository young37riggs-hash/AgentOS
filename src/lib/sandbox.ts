/**
 * SandboxManager
 * 
 * Client-side manager that communicates with the backend Docker API.
 * Falls back to simulation if the backend is unavailable.
 */

export interface SandboxConfig {
  image: string;
  networkDisabled: boolean;
  volumes: string[];
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  logs: string[];
}

export class SandboxManager {
  /**
   * Executes a command in a Docker container via the backend API.
   */
  async execute(command: string, config: SandboxConfig): Promise<SandboxResult> {
    const logs: string[] = [];
    
    try {
      const response = await fetch("/api/sandbox/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command, config }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to execute in sandbox");
      }

      return await response.json();
    } catch (error: any) {
      console.warn("Backend Sandbox failed, falling back to simulation:", error.message);
      return this.simulateExecute(command, config, logs);
    }
  }

  /**
   * High-fidelity simulation fallback.
   */
  private async simulateExecute(command: string, config: SandboxConfig, existingLogs: string[]): Promise<SandboxResult> {
    const containerId = Math.random().toString(36).substring(7);
    const logs: string[] = [
      ...existingLogs,
      `[Sandbox] (Simulation) Initializing environment: ${config.image}...`,
      `[Sandbox] (Simulation) Container ID: ${containerId}`,
      `[Sandbox] (Simulation) Network: ${config.networkDisabled ? 'Isolated' : 'Connected'}`,
      `[Sandbox] (Simulation) Executing: ${command}`,
    ];

    await new Promise(resolve => setTimeout(resolve, 1200));

    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    if (command.includes('rm -rf /')) {
      stderr = "Error: Operation not permitted in sandbox.";
      exitCode = 1;
    } else if (command.includes('python')) {
      stdout = "Python 3.9.12 (main, Mar 24 2022, 13:02:21)\n[GCC 11.2.0] on linux\nHello from the Python sandbox!";
    } else if (command.includes('node')) {
      stdout = "v18.16.0\nHello from the Node.js sandbox!";
    } else if (command.includes('ls')) {
      stdout = "README.md\npackage.json\nsrc/\nnode_modules/";
    } else {
      stdout = `Command executed successfully: ${command}\n(Executed via Sandbox Executor Mode)`;
    }

    logs.push(`[Sandbox] (Simulation) Execution finished with code ${exitCode}`);
    logs.push(`[Sandbox] (Simulation) Environment destroyed.`);

    return {
      stdout,
      stderr,
      exitCode,
      logs
    };
  }
}

export const sandboxManager = new SandboxManager();
