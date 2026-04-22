import express from "express";
import http from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Docker from 'dockerode';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import { initVectorDB, storeMemory, retrieveContext } from './server/memory.ts';
import { GatewayControlPlane } from './server/core/GatewayControlPlane.ts';
import { IntegrationRegistry } from './server/tools/IntegrationRegistry.ts';
import { ChannelManager } from './server/channels/ChannelManager.ts';
import { AgentRuntime } from './server/agents/AgentRuntime.ts';
import { loadN8nFrameworkPolyfills } from './server/tools/n8n/SkeletonLoader.ts';

const execPromise = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SSE clients for file monitoring
const sseClients = new Set<express.Response>();
const activeWatchers = new Map<string, fs.FSWatcher>();

function broadcastEvent(type: string, data: any) {
  const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
}

async function startServer() {
  await initVectorDB();

  const app = express();
  const PORT = 3000;
  
  // Attach raw HTTP server to bind our Gateway WebSockets
  const httpServer = http.createServer(app);

  app.use(express.json());

  // === ENTERPRISE GATEWAY CONTROL PLANE ===
  // Initialize WebSockets, Presence, Channels, and Tools
  const gateway = new GatewayControlPlane(httpServer);
  const toolRegistry = new IntegrationRegistry();
  const channelManager = new ChannelManager(gateway);
  const agentRuntime = new AgentRuntime(gateway, toolRegistry, channelManager, {
    mode: 'rpc',
    streaming: 'tool',
    failoverModels: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview']
  });
  
  // Load massive n8n-style integration suite (400+ tool mock skeletons)
  loadN8nFrameworkPolyfills(toolRegistry);

  gateway.on('client.connected', (evt) => {
    console.log(`[Gateway] Client Connected: ${evt.clientId}`);
  });

  // Example of executing a tool from the gateway REST API layer
  app.post("/api/gateway/tools/execute", async (req, res) => {
    try {
      const { toolId, parameters } = req.body;
      const result = await toolRegistry.executeTool(toolId, parameters);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/gateway/tools", (req, res) => {
    res.json(toolRegistry.getAvailableTools());
  });

  // SSE Endpoint
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Monitor API
  app.post("/api/monitor/add", (req, res) => {
    const { targetPath } = req.body;
    try {
      if (activeWatchers.has(targetPath)) {
        return res.json({ success: true, message: "Already monitoring" });
      }
      
      const watcher = fs.watch(targetPath, { recursive: true }, (eventType, filename) => {
        broadcastEvent('file_change', { targetPath, eventType, filename });
      });
      activeWatchers.set(targetPath, watcher);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/monitor/remove", (req, res) => {
    const { targetPath } = req.body;
    if (activeWatchers.has(targetPath)) {
      activeWatchers.get(targetPath)!.close();
      activeWatchers.delete(targetPath);
    }
    res.json({ success: true });
  });

  // Memory API
  app.post("/api/memory/store", async (req, res) => {
    try {
      const { content, type, key } = req.body;
      await storeMemory(content, type, key);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/memory/retrieve", async (req, res) => {
    try {
      const { query } = req.body;
      const results = await retrieveContext(query);
      res.json({ results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Host Execution Logic
  app.post("/api/host/execute", async (req, res) => {
    const { command, cwd } = req.body;
    try {
      const { stdout, stderr } = await execPromise(command, { cwd: cwd || process.cwd() });
      res.json({
        stdout,
        stderr,
        exitCode: 0
      });
    } catch (error: any) {
      res.json({
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      });
    }
  });

  // WSL2 Execution Logic
  app.post("/api/wsl/execute", async (req, res) => {
    const { command, cwd } = req.body;
    try {
      // Wrap the command to execute inside WSL
      // Using bash -c to ensure shell builtins work
      const wslCommand = `wsl -- bash -c ${JSON.stringify(command)}`;
      const { stdout, stderr } = await execPromise(wslCommand, { cwd: cwd || process.cwd() });
      res.json({
        stdout,
        stderr,
        exitCode: 0
      });
    } catch (error: any) {
      res.json({
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      });
    }
  });

  // Docker Sandbox Logic
  const docker = new Docker();

  app.post("/api/sandbox/execute", async (req, res) => {
    const { command, config, cwd } = req.body;
    const logs: string[] = [];
    
    try {
      logs.push(`[Docker SDK] Creating container with image ${config.image}...`);
      
      const hostConfig: any = {
        NetworkMode: config.networkDisabled ? 'none' : 'bridge',
      };

      // If a working directory is provided, bind mount it to /workspace
      let workingDir = undefined;
      const binds = [];
      
      // Handle explicitly passed volumes from config
      if (config.volumes && Array.isArray(config.volumes)) {
        for (const vol of config.volumes) {
          binds.push(vol);
        }
      }

      if (cwd) {
        binds.push(`${cwd}:/workspace:rw`);
        workingDir = '/workspace';
        logs.push(`[Docker SDK] Mounting host directory ${cwd} to /workspace`);
      }

      if (binds.length > 0) {
        hostConfig.Binds = binds;
      }

      const container = await docker.createContainer({
        Image: config.image,
        Cmd: ['/bin/sh', '-c', command],
        HostConfig: hostConfig,
        WorkingDir: workingDir,
        Tty: false,
      });

      logs.push(`[Docker SDK] Starting container ${container.id.substring(0, 12)}...`);
      await container.start();
      
      logs.push(`[Docker SDK] Waiting for execution to complete...`);
      const waitResult = await container.wait();
      
      logs.push(`[Docker SDK] Capturing logs...`);
      const buffer = await container.logs({ stdout: true, stderr: true });
      const output = buffer.toString();

      logs.push(`[Docker SDK] Cleaning up container...`);
      await container.remove();

      res.json({
        stdout: output,
        stderr: "",
        exitCode: waitResult.StatusCode,
        logs
      });
    } catch (error: any) {
      console.error("Sandbox Error:", error);
      res.status(500).json({ error: error.message, logs });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Enterprise Gateway Server listening on http://localhost:${PORT}`);
  });
}

startServer();
