import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { sandboxManager } from "./sandbox";

// Initialize the Gemini API client
// The API key is automatically injected by the AI Studio environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const runInSandboxDeclaration: FunctionDeclaration = {
  name: "run_in_sandbox",
  description: "Execute a command or code snippet in a secure, isolated Docker-style sandbox to verify findings or test scripts.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: "The shell command or code to execute."
      },
      image: {
        type: Type.STRING,
        description: "The Docker image to use (e.g., 'python:3.9-slim', 'node:18-alpine', 'ubuntu:latest')."
      },
      network_disabled: {
        type: Type.BOOLEAN,
        description: "Whether to disable network access in the sandbox."
      }
    },
    required: ["command", "image"]
  }
};

const PRIMARY_MODEL = "gemini-3.1-pro-preview";
const FALLBACK_MODEL = "gemini-3-flash-preview";

async function generateContentWithFallback(params: any) {
  try {
    return await ai.models.generateContent({ ...params, model: PRIMARY_MODEL });
  } catch (error) {
    console.warn(`Primary model ${PRIMARY_MODEL} failed, falling back to ${FALLBACK_MODEL}. Error:`, error);
    try {
      return await ai.models.generateContent({ ...params, model: FALLBACK_MODEL });
    } catch (fallbackError) {
      console.error(`Fallback model ${FALLBACK_MODEL} also failed. Error:`, fallbackError);
      throw fallbackError;
    }
  }
}

const PLANNER_PROMPT = `
<system_ontology>
  <core_identity>
    <role>AgentOS Strategic Planner</role>
    <objective>Deconstruct user requests into safe, logical, step-by-step operational blueprints for a Linux/Unix/Windows terminal environment.</objective>
  </core_identity>

  <axiomatic_laws>
    <law id="1">Simplicity: Never propose a complex solution if a simple one exists.</law>
    <law id="2">Non-Destruction: Always default to non-destructive analysis first. (e.g., Use \`find\` or \`ls\` before suggesting \`rm\` or \`mv\`).</law>
    <law id="3">Modularity: Break down tasks into distinct, atomic steps that can be verified individually.</law>
    <law id="4">Delegation: If a step requires complex web research, summarizing multiple search results, or comparing sources, delegate to the Explorer agent by outputting <call_explorer>your detailed research query</call_explorer> instead of a standard step.</law>
  </axiomatic_laws>

  <output_format>
    You must output your strategy using the following strict tags:
    <analysis>Break down what the user actually wants.</analysis>
    <blueprint>
      <step num="1">Describe the first logical action.</step>
      <step num="2">Describe the next logical action.</step>
    </blueprint>
    <risk_assessment>Identify what could go wrong with this plan.</risk_assessment>
  </output_format>
</system_ontology>
`;

const EXECUTOR_PROMPT = `
<system_ontology>
  <core_identity>
    <role>AgentOS Terminal Executor</role>
    <objective>Translate strategic blueprints into exact, flawless terminal commands or Python scripts.</objective>
  </core_identity>

  <operational_rules>
    <rule>You are receiving a blueprint from the Planner. You must translate ONLY the next immediate step into code.</rule>
    <rule>If the step requires a shell command, wrap it in <execute_shell>.</rule>
    <rule>If the step requires writing a script, wrap it in <write_file>.</rule>
  </operational_rules>

  <output_format>
    <translation_logic>Explain how you are converting the Planner's step into a command.</translation_logic>
    <action>
      <execute_shell>YOUR COMMAND HERE</execute_shell>
    </action>
  </output_format>
</system_ontology>
`;

const REVIEWER_PROMPT = `
<system_ontology>
  <core_identity>
    <role>AgentOS Security Auditor</role>
    <objective>Critically examine proposed terminal commands for security risks, destructive potential, or syntax errors before execution. Also determine the optimal Docker sandbox configuration for testing.</objective>
  </core_identity>

  <security_lattice>
    <fatal_flags>rm -rf, mkfs, dd, chmod 777, chown root, :(){ :|:& };:</fatal_flags>
    <warning_flags>mv, cp, wget, curl, pip install, npm install</warning_flags>
  </security_lattice>

  <output_format>
    You will receive a proposed command. You must output your verdict strictly as follows:
    <audit_log>Analyze the proposed command against the security lattice.</audit_log>
    <sandbox_config>
      <image>Determine best base image (e.g., alpine:latest, python:3.9-slim, node:18-alpine, ubuntu:latest)</image>
      <network_disabled>true or false (only enable if command requires internet, e.g., curl, wget, pip install)</network_disabled>
      <volumes>Specify any required volume mounts or 'none'</volumes>
    </sandbox_config>
    <verdict>
      [APPROVED] - The command is safe and read-only.
      [REQUIRES_USER_CONSENT] - The command modifies the system but is not malicious.
      [REJECTED] - The command is highly dangerous or syntactically flawed.
    </verdict>
  </output_format>
</system_ontology>
`;

export async function runPlanner(
  userRequest: string,
  context: string = "No highly relevant past context found.",
) {
  const prompt = `
<context_memory>
${context}
</context_memory>
<user_request>
${userRequest}
</user_request>
`;

  try {
    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: PLANNER_PROMPT,
        temperature: 0.2,
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Planner Error:", error);
    throw new Error("Planner failed to generate a blueprint.");
  }
}

export async function runExecutor(
  step: string,
  currentDir: string = "/home/user",
) {
  const prompt = `
<current_step>
${step}
</current_step>
<current_directory>${currentDir}</current_directory>
`;

  try {
    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: EXECUTOR_PROMPT,
        temperature: 0.1,
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Executor Error:", error);
    throw new Error("Executor failed to generate a command.");
  }
}

export async function runReviewer(proposedCommand: string) {
  const prompt = `
<proposed_command>
${proposedCommand}
</proposed_command>
`;

  try {
    const response = await generateContentWithFallback({
      contents: prompt,
      config: {
        systemInstruction: REVIEWER_PROMPT,
        temperature: 0.1,
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Reviewer Error:", error);
    throw new Error("Reviewer failed to audit the command.");
  }
}

export async function generateMediaImage(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in response.");
  } catch (error) {
    console.error("Media Generator Error:", error);
    throw new Error("Failed to generate image.");
  }
}

export async function generateMediaVideo(prompt: string) {
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI returned.");
    
    const response = await fetch(downloadLink, {
      method: 'GET',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY || '',
      },
    });
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Video Generator Error:", error);
    throw new Error("Failed to generate video.");
  }
}

export async function runChat(prompt: string, history: string) {
  try {
    const response = await generateContentWithFallback({
      contents: `History:\n${history}\n\nUser: ${prompt}`,
      config: {
        systemInstruction: "You are a helpful, conversational AI agent. Be concise and friendly.",
        temperature: 0.7,
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Chat Error:", error);
    throw new Error("Chat agent failed to respond.");
  }
}

export async function runExplorer(
  query: string, 
  onStatusChange?: (status: "idle" | "working" | "done" | "error") => void,
  onLog?: (type: "user" | "system" | "planner" | "executor" | "reviewer" | "sandbox" | "terminal", content: string, status?: "success" | "warning" | "error") => void
) {
  const systemInstruction = `You are an elite autonomous Explorer Sub-Agent. Your goal is to perform complex research tasks, summarize multiple search results, and compare information from different sources.
You have complete visibility into the application's state and can suggest actions for other agents.

SANDBOX CAPABILITY: You have access to a secure Docker-style sandbox. Use the 'run_in_sandbox' tool to:
1. Verify code snippets you find during research.
2. Test shell commands before suggesting them to the Executor.
3. Perform data analysis in an isolated environment.
Always report the results of your sandbox executions in your final synthesis.

CRITICAL: After your research synthesis, if you identify a high-value opportunity, a bug to fix, or a necessary next step, you MUST output a <handoff> block.
The <handoff> block should contain a JSON array of tasks for the Orchestrator.
Example:
<handoff>
[
  { "action": "add", "text": "Implement the security fix identified in research", "agent": "agentos", "priority": "high" },
  { "action": "add", "text": "Update documentation with new API endpoints", "agent": "chat", "priority": "medium" }
]
</handoff>

Always cross-reference facts and provide a comprehensive, well-structured report.
Use the Google Search tool extensively.
Communicate clearly and format your output with markdown for readability.`;

  let contents: any[] = [{ role: 'user', parts: [{ text: query }] }];
  let iterations = 0;
  const maxIterations = 5;

  try {
    while (iterations < maxIterations) {
      iterations++;
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents,
        config: {
          systemInstruction,
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [runInSandboxDeclaration] }
          ],
          toolConfig: { includeServerSideToolInvocations: true },
          temperature: 0.3,
        }
      });

      const candidate = response.candidates?.[0];
      if (!candidate) break;

      contents.push(candidate.content);

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const functionResponses = [];
        for (const call of functionCalls) {
          if (call.name === "run_in_sandbox") {
            onStatusChange?.("working");
            const { command, image, network_disabled } = call.args as any;
            
            onLog?.("system", `Explorer is initializing sandbox: ${image}...`);
            const result = await sandboxManager.execute(command, {
              image,
              networkDisabled: !!network_disabled,
              volumes: []
            });
            
            result.logs.forEach(log => onLog?.("system", log));
            
            functionResponses.push({
              name: call.name,
              id: call.id,
              response: result
            });
          }
        }
        if (functionResponses.length > 0) {
          contents.push({ role: 'tool', parts: functionResponses.map(r => ({ functionResponse: r })) });
          continue;
        }
      }

      onStatusChange?.("done");
      return response.text || "";
    }
    onStatusChange?.("idle");
    return "Explorer reached maximum iterations without a final response.";
  } catch (error) {
    onStatusChange?.("error");
    console.warn("Primary explorer model failed, falling back to gemini-3-flash-preview...");
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research Request: ${query}\n\nProvide a highly structured summary of the findings, comparing multiple sources if applicable.`,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
          temperature: 0.3,
        }
      });
      return fallbackResponse.text || "";
    } catch (fallbackError) {
      console.warn("Secondary explorer model failed, falling back to gemini-2.5-flash...");
      const lastFallback = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Research Request: ${query}\n\nProvide a highly structured summary of the findings. Note: Live search may be limited in this fallback mode, rely on your extensive training data to provide the best possible comparison and summary.`,
        config: {
          systemInstruction,
          temperature: 0.3,
        }
      });
      return lastFallback.text || "";
    }
  }
}

export interface OrchestratorAction {
  action: "add" | "remove" | "update" | "run";
  id?: string;
  text?: string;
  agent?: string;
  status?: "todo" | "in-progress" | "done";
  priority?: "low" | "medium" | "high";
  dependencies?: string[];
  dueDate?: string;
}

export async function runOrchestrator(task: string, currentTasks: {id: string, text: string, status: string, priority: string, assignedAgent?: string, dependencies?: string[], dueDate?: string | null}[], explorerContext: string = ""): Promise<OrchestratorAction[]> {
  try {
    const response = await generateContentWithFallback({
      contents: `Recent Explorer Research Context:\n${explorerContext}\n\nCurrent Tasks:\n${JSON.stringify(currentTasks, null, 2)}\n\nUser Request: ${task}`,
      config: {
        systemInstruction: `You are a Task Orchestrator. Your job is to manage the user's task list, assign tasks to specialized agents, and execute them.
Available Agents:
- agentos: Core system agent for terminal commands, docker execution, and file manipulation.
- chat: Conversational agent for general questions and text generation.
- explorer: Autonomous research agent with web search capabilities.
- media: Generates images and videos.

You can add new tasks, assign them to agents, remove tasks, update tasks (including status, priority, dependencies, due date), or run them.
When a user asks to accomplish a goal, you should break it down into tasks, assign them to the appropriate agents, set priorities, and optionally run the first task.
If the user asks to create more tasks based on a pattern, analyze the current tasks and add new ones that follow the pattern.
Output ONLY a JSON array of action objects. Do not include markdown formatting like \`\`\`json.
Action object format:
{ "action": "add", "text": "Task description", "agent": "agentos", "priority": "high", "status": "todo", "dependencies": ["task-id-1"], "dueDate": "2026-04-10" }
{ "action": "remove", "id": "task-id" }
{ "action": "update", "id": "task-id", "text": "New description", "agent": "explorer", "status": "in-progress", "priority": "medium" }
{ "action": "run", "id": "task-id" }`,
        temperature: 0.2,
      }
    });
    
    let text = response.text || "[]";
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Orchestrator Error:", error);
    throw new Error("Orchestrator failed to break down task.");
  }
}
