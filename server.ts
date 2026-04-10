import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Docker from 'dockerode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Docker Sandbox Logic
  const docker = new Docker();

  app.post("/api/sandbox/execute", async (req, res) => {
    const { command, config } = req.body;
    const logs: string[] = [];
    
    try {
      logs.push(`[Docker SDK] Creating container with image ${config.image}...`);
      const container = await docker.createContainer({
        Image: config.image,
        Cmd: ['/bin/sh', '-c', command],
        HostConfig: {
          NetworkMode: config.networkDisabled ? 'none' : 'bridge',
        },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
