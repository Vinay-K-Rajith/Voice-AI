import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { GeminiLiveClient } from './GeminiLiveClient';

// ============================================================================
// SHARED GEMINI CLIENT (Singleton Pattern)
// Only ONE connection to Gemini per backend instance
// All frontend clients share this single connection
// ============================================================================

let sharedGeminiClient: GeminiLiveClient | null = null;
let connectingPromise: Promise<void> | null = null;
const frontendClients = new Set<WebSocket>();
const audioQueue: string[] = [];

async function getOrCreateGeminiClient(): Promise<GeminiLiveClient> {
  // If we're already in the process of connecting, wait for it
  if (connectingPromise) {
    await connectingPromise;
    return sharedGeminiClient!;
  }

  // If we already have a healthy connection, return it
  if (sharedGeminiClient && sharedGeminiClient.isReady) {
    return sharedGeminiClient;
  }

  // Create a new connection and wait for it to be ready
  connectingPromise = new Promise((resolve) => {
    if (sharedGeminiClient) {
      sharedGeminiClient.disconnect();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY is not defined');
      broadcastToFrontends({ type: 'error', message: 'Server not configured with GEMINI_API_KEY' });
      connectingPromise = null;
      resolve();
      return;
    }

    sharedGeminiClient = new GeminiLiveClient(apiKey);

    // When Gemini sends audio back to frontends
    sharedGeminiClient.onAudioReceived = (base64Audio) => {
      broadcastToFrontends({ type: 'audio', data: base64Audio });
    };

    sharedGeminiClient.onTurnComplete = () => {
      broadcastToFrontends({ type: 'status', message: 'done_speaking' });
    };

    sharedGeminiClient.onError = (error) => {
      console.error('🔴 Gemini error:', error.message);
      broadcastToFrontends({ type: 'error', message: error.message });
      // Reset the client on error so it reconnects next time
      sharedGeminiClient = null;
      connectingPromise = null;
    };

    // ✨ NEW: Handle the Green Light directly from the SDK!
    sharedGeminiClient.onReady = () => {
        // Flush any queued audio
        if (audioQueue.length > 0) {
          console.log(`📤 Flushing ${audioQueue.length} queued audio chunks...`);
          const queued = [...audioQueue];
          audioQueue.length = 0;
          for (const chunk of queued) {
            sharedGeminiClient?.sendAudioChunk(chunk);
          }
        }
        
        connectingPromise = null;
        resolve();
    };

    // Connect to Gemini (the SDK will call onReady automatically when ready)
    sharedGeminiClient.connect();

    // Timeout after 30 seconds
    setTimeout(() => {
      if (connectingPromise) {
        connectingPromise = null;
        resolve();
      }
    }, 30000);
  });

  await connectingPromise;
  return sharedGeminiClient!;
}

function broadcastToFrontends(message: any) {
  for (const client of frontendClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
}

export function setupServer(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (socket) => {
    console.log('✅ Frontend connected to backend WebSocket');
    frontendClients.add(socket);

    // 🟢 SEND GREEN LIGHT: Get or create Gemini client
    // This ensures Gemini is connecting/ready before frontend starts sending audio
    const gemini = await getOrCreateGeminiClient();
    if (gemini.isReady) {
      console.log('🟢 Gemini is ready, sending GREEN LIGHT to frontend');
      socket.send(JSON.stringify({ type: 'GEMINI_READY' }));
    } else {
      // Wait a bit more for Gemini to be ready, then send signal
      const waitInterval = setInterval(() => {
        if (gemini.isReady && socket.readyState === WebSocket.OPEN) {
          clearInterval(waitInterval);
          console.log('🟢 Gemini ready after wait, sending GREEN LIGHT to frontend');
          socket.send(JSON.stringify({ type: 'GEMINI_READY' }));
        }
      }, 100);
      setTimeout(() => clearInterval(waitInterval), 30000);
    }

    socket.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'audio' && data.data) {
          const gemini = await getOrCreateGeminiClient();
          
          // If Gemini is ready, send immediately
          if (gemini.isReady) {
            gemini.sendAudioChunk(data.data);
          } else {
            // Otherwise, queue it
            console.log('⏳ Gemini not ready, queueing audio chunk...');
            audioQueue.push(data.data);
          }
        } else if (data.type === 'interrupt') {
          if (sharedGeminiClient) {
            console.log('User interrupted model');
            sharedGeminiClient.interruptModel();
          }
        }
      } catch (err) {
        console.error('Error parsing client message:', err);
        socket.send(JSON.stringify({ type: 'error', message: 'Failed to parse message' }));
      }
    });

    socket.on('close', () => {
      console.log('❌ Frontend disconnected');
      frontendClients.delete(socket);

      // Only disconnect from Gemini once all frontends are gone
      if (frontendClients.size === 0 && sharedGeminiClient) {
        console.log('No more frontend clients, disconnecting from Gemini...');
        sharedGeminiClient.disconnect();
        sharedGeminiClient = null;
        connectingPromise = null;
      }
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      frontendClients.delete(socket);
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.url === '/api/ws') { 
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });
}
