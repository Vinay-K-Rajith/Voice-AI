import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { GeminiLiveClient } from './GeminiLiveClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '5173', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is not set!');
  process.exit(1);
}

// Create HTTP server
const server = createServer(app);

// Serve static files from the dist folder (built frontend)
const distPath = path.join(__dirname, '../dist');
console.log('📁 Serving static files from:', distPath);
app.use(express.static(distPath));

// Initialize WebSocket Server
const wss = new WebSocketServer({ noServer: true });

// Shared Gemini client state
let sharedGeminiClient: GeminiLiveClient | null = null;
let connectingPromise: Promise<void> | null = null;
let audioQueue: string[] = [];
const connectedClients = new Set<any>();

/**
 * Get or create a shared Gemini connection
 */
async function getOrCreateGeminiClient() {
  if (sharedGeminiClient && sharedGeminiClient.isReady) {
    return sharedGeminiClient;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = new Promise((resolve) => {
    if (!sharedGeminiClient) {
      sharedGeminiClient = new GeminiLiveClient(GEMINI_API_KEY);

      // When Gemini sends audio back to frontends
      sharedGeminiClient!.onAudioReceived = (base64Audio) => {
        broadcastToClients({ type: 'audio', data: base64Audio });
      };

      sharedGeminiClient!.onTurnComplete = () => {
        broadcastToClients({ type: 'status', message: 'done_speaking' });
      };

      sharedGeminiClient!.onError = (error) => {
        console.error('🔴 Gemini error:', error.message);
        broadcastToClients({ type: 'error', message: error.message });
        sharedGeminiClient = null;
        connectingPromise = null;
      };

      // ✨ Handle the Green Light from Gemini
      sharedGeminiClient!.onReady = () => {
        console.log('🟢 Gemini is ready, sending GREEN LIGHT to frontend');
        
        // Flush any queued audio
        if (audioQueue.length > 0) {
          console.log(`📤 Flushing ${audioQueue.length} queued audio chunks...`);
          const queued = [...audioQueue];
          audioQueue.length = 0;
          for (const chunk of queued) {
            sharedGeminiClient?.sendAudioChunk(chunk);
          }
        }

        // Tell ALL connected frontends that Gemini is ready
        broadcastToClients({ type: 'GEMINI_READY' });
        
        connectingPromise = null;
        resolve();
      };

      console.log('🟡 Connecting to Gemini Live API...');
      sharedGeminiClient.connect();
    }
  });

  return connectingPromise;
}

/**
 * Broadcast message to all connected frontend clients
 */
function broadcastToClients(message: any) {
  const payload = JSON.stringify(message);
  connectedClients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Handle WebSocket connections
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/api/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('✅ Frontend connected to backend WebSocket');
  connectedClients.add(ws);

  // Immediately try to create/get Gemini connection
  getOrCreateGeminiClient().catch((err) => {
    console.error('Failed to connect to Gemini:', err);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to connect to Gemini' }));
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'audio') {
        // Ensure Gemini is ready
        await getOrCreateGeminiClient();

        if (sharedGeminiClient?.isReady) {
          sharedGeminiClient.sendAudioChunk(message.data);
        } else {
          // Queue the audio if Gemini isn't ready yet
          audioQueue.push(message.data);
          console.log(`⏳ Queued audio chunk (${audioQueue.length} in queue)`);
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('❌ Frontend disconnected');
    connectedClients.delete(ws);

    // If no more clients, optionally close Gemini connection
    if (connectedClients.size === 0) {
      console.log('ℹ️ No more frontend clients connected');
      // You could call sharedGeminiClient?.disconnect() here if desired
      // For now, keep it alive for reconnections
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    connectedClients.delete(ws);
  });
});

// Serve the React app for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start the server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}/`);
  console.log(`📡 WebSocket server listening on ws://localhost:${PORT}/api/ws`);
  console.log(`📁 Serving frontend from ${distPath}\n`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  sharedGeminiClient?.disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
