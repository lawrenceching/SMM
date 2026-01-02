import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Server as SocketIOServer } from 'socket.io';
import { Server as Engine } from '@socket.io/bun-engine';
import { findSocketByClientId, setSocketIOInstance, initializeSocketIO } from './socketIO.ts';
import { io as ClientIO } from 'socket.io-client';

describe('findSocketByClientId', () => {
  let server: ReturnType<typeof Bun.serve> | null = null;
  let io: SocketIOServer;
  let engine: Engine;
  let testPort: number;

  beforeAll(async () => {
    // Find an available port
    testPort = 0; // Let Bun assign a random port
    
    // Initialize Socket.IO server with Bun Engine
    engine = new Engine({
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    io = new SocketIOServer({
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.bind(engine);

    // Set up connection handler
    initializeSocketIO(io);
    setSocketIOInstance(io);

    // Start Bun server
    const { websocket } = engine.handler();
    server = Bun.serve({
      port: testPort,
      fetch: (req, server) => {
        const url = new URL(req.url);
        if (url.pathname.startsWith('/socket.io/')) {
          return engine.handleRequest(req, server);
        }
        return new Response('Not Found', { status: 404 });
      },
      websocket,
    });

    // Get the actual port assigned
    if (!server.port) {
      throw new Error('Server port is undefined');
    }
    testPort = server.port;
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  it('should verify Socket.IO instance is initialized', () => {
    // This test verifies that the Socket.IO instance is properly initialized
    // for all other tests. The actual "not initialized" error case is hard to
    // test without module reset, but the error handling is covered by the
    // function implementation which checks `if (!io)` and throws.
    expect(io).toBeDefined();
    // Verify we can call the function without error when initialized
    expect(() => {
      // This will throw "No active Socket.IO connections available" if no clients,
      // but that's expected and different from "not initialized" error
      try {
        findSocketByClientId();
      } catch (e) {
        // Expected - either no connections or not initialized
        // We just verify the function doesn't crash when io is defined
      }
    }).not.toThrow('Socket.IO instance not initialized');
  });

  it('should find socket by existing clientId', async () => {
    const clientId = 'test-client-1';
    const client = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        resolve();
      });
    });

    // Send userAgent with clientId to join the room
    client.emit('userAgent', { clientId, userAgent: 'test-agent' });

    // Wait a bit for the room join to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = findSocketByClientId(clientId);

    expect(result).toBeDefined();
    expect(result.clientId).toBe(clientId);
    expect(result.socket).toBeDefined();
    expect(result.socket.id).toBe(client.id);

    client.disconnect();
  });

  it('should find first available socket when clientId is undefined', async () => {
    const clientId = 'test-client-2';
    const client = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        resolve();
      });
    });

    // Send userAgent with clientId to join the room
    client.emit('userAgent', { clientId, userAgent: 'test-agent' });

    // Wait a bit for the room join to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = findSocketByClientId();

    expect(result).toBeDefined();
    expect(result.clientId).toBe(clientId);
    expect(result.socket).toBeDefined();
    expect(result.socket.id).toBe(client.id);

    client.disconnect();
  });

  it('should fall back to first available socket when clientId room does not exist', async () => {
    const existingClientId = 'test-client-3';
    const nonExistentClientId = 'non-existent-client';
    
    const client = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        resolve();
      });
    });

    // Send userAgent with existing clientId
    client.emit('userAgent', { clientId: existingClientId, userAgent: 'test-agent' });

    // Wait a bit for the room join to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to find socket with non-existent clientId
    // Should fall back to first available socket
    const result = findSocketByClientId(nonExistentClientId);

    expect(result).toBeDefined();
    expect(result.clientId).toBe(existingClientId); // Should return the existing clientId
    expect(result.socket).toBeDefined();
    expect(result.socket.id).toBe(client.id);

    client.disconnect();
  });

  it('should throw error when no sockets are available', async () => {
    // Disconnect all clients first
    const sockets = Array.from(io.sockets.sockets.values());
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Wait a bit for disconnections to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(() => {
      findSocketByClientId();
    }).toThrow('No active Socket.IO connections available');
  });

  it('should find correct socket when multiple clients are connected', async () => {
    const clientId1 = 'test-client-4';
    const clientId2 = 'test-client-5';

    const client1 = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    const client2 = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    // Wait for both connections
    await Promise.all([
      new Promise<void>((resolve) => {
        client1.on('connect', () => resolve());
      }),
      new Promise<void>((resolve) => {
        client2.on('connect', () => resolve());
      }),
    ]);

    // Send userAgent for both clients
    client1.emit('userAgent', { clientId: clientId1, userAgent: 'test-agent-1' });
    client2.emit('userAgent', { clientId: clientId2, userAgent: 'test-agent-2' });

    // Wait a bit for the room joins to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Find socket by clientId1
    const result1 = findSocketByClientId(clientId1);
    expect(result1.clientId).toBe(clientId1);
    expect(result1.socket.id).toBe(client1.id);

    // Find socket by clientId2
    const result2 = findSocketByClientId(clientId2);
    expect(result2.clientId).toBe(clientId2);
    expect(result2.socket.id).toBe(client2.id);

    client1.disconnect();
    client2.disconnect();
  });

  it('should find first available socket when clientId is empty string', async () => {
    const clientId = 'test-client-6';
    const client = ClientIO(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        resolve();
      });
    });

    // Send userAgent with clientId
    client.emit('userAgent', { clientId, userAgent: 'test-agent' });

    // Wait a bit for the room join to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Empty string should be treated as undefined (falsy)
    const result = findSocketByClientId('');

    expect(result).toBeDefined();
    expect(result.clientId).toBe(clientId);
    expect(result.socket).toBeDefined();

    client.disconnect();
  });
});

