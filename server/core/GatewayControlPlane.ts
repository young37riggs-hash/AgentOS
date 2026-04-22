import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { EventEmitter2 } from 'eventemitter2';
import { v4 as uuidv4 } from 'uuid';

export interface ISession {
  sessionId: string;
  type: 'direct' | 'group' | 'agent-to-agent';
  participants: Set<string>;
  metadata: Record<string, any>;
  createdAt: number;
}

export interface IGatewayConfig {
  heartbeatInterval: number;
  sessionTimeout: number;
  maxUploadSize: number;
  features: {
    telemetry: boolean;
    typingIndicators: boolean;
    readReceipts: boolean;
  };
}

/**
 * Enterprise Gateway Control Plane
 * Serves as the central nervous system for AgentOS.
 * Handles WebSockets, connection routing, agent presence, and stream chunking.
 */
export class GatewayControlPlane extends EventEmitter2 {
  public readonly io: Server;
  public readonly activeSessions = new Map<string, ISession>();
  public readonly presence = new Map<string, { status: 'online'|'idle'|'offline', lastSeen: number }>();
  
  public config: IGatewayConfig = {
    heartbeatInterval: 25000,
    sessionTimeout: 3600000,
    maxUploadSize: 50 * 1024 * 1024, // 50MB
    features: { telemetry: true, typingIndicators: true, readReceipts: true }
  };

  constructor(server: HttpServer) {
    super({ wildcard: true });
    
    this.io = new Server(server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
      maxHttpBufferSize: this.config.maxUploadSize,
      pingInterval: this.config.heartbeatInterval,
      pingTimeout: 10000
    });

    this.initialize();
  }

  private initialize() {
    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.handshake.auth?.token || socket.id;
      this.handleConnection(socket, clientId);
    });

    // Run background cron jobs
    setInterval(() => this.pruneStaleSessions(), 60000);
  }

  private handleConnection(socket: Socket, clientId: string) {
    this.updatePresence(clientId, 'online');
    
    this.emit('client.connected', { clientId, socketId: socket.id });

    // Join a personal channel for direct messaging
    socket.join(`client:${clientId}`);

    socket.on('session.create', (payload, ack) => {
      try {
        const session = this.createSession(payload.type, [clientId, ...(payload.participants || [])]);
        socket.join(`session:${session.sessionId}`);
        ack({ success: true, session });
      } catch (err: any) {
        ack({ success: false, error: err.message });
      }
    });

    socket.on('message.send', (payload) => {
      this.routeMessage(clientId, payload);
    });

    socket.on('presence.typing', (payload) => {
      if (this.config.features.typingIndicators) {
        socket.to(`session:${payload.sessionId}`).emit('presence.typing', { clientId, sessionId: payload.sessionId });
      }
    });

    socket.on('disconnect', () => {
      this.updatePresence(clientId, 'offline');
      this.emit('client.disconnected', { clientId, socketId: socket.id });
    });
  }

  public createSession(type: ISession['type'], participants: string[]): ISession {
    const session: ISession = {
      sessionId: uuidv4(),
      type,
      participants: new Set(participants),
      metadata: {},
      createdAt: Date.now()
    };
    this.activeSessions.set(session.sessionId, session);
    this.emit('session.created', session);
    return session;
  }

  public routeMessage(from: string, payload: { sessionId: string, content: any, type: string }) {
    if (!this.activeSessions.has(payload.sessionId)) {
      throw new Error("Session not found or inactive.");
    }
    
    // Broadcast message to everyone in the room except sender
    this.io.to(`session:${payload.sessionId}`).except(`client:${from}`).emit('message.receive', {
      messageId: uuidv4(),
      from,
      ...payload,
      timestamp: Date.now()
    });

    this.emit('message.routed', { from, sessionId: payload.sessionId, type: payload.type });
  }

  public updatePresence(clientId: string, status: 'online'|'idle'|'offline') {
    this.presence.set(clientId, { status, lastSeen: Date.now() });
    this.io.emit('presence.update', { clientId, status, lastSeen: Date.now() });
  }

  private pruneStaleSessions() {
    const now = Date.now();
    let pruned = 0;
    for (const [id, session] of this.activeSessions.entries()) {
      // Basic pruning metric - in reality would check last activity
      if (now - session.createdAt > this.config.sessionTimeout * 24) { 
        this.activeSessions.delete(id);
        pruned++;
      }
    }
    if (pruned > 0) {
      this.emit('system.gc', { prunedSessions: pruned });
    }
  }
}
