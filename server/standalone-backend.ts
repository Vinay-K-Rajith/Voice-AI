#!/usr/bin/env node
/**
 * Standalone Backend Server for Voice AI
 * 
 * This is the real backend that handles WebSocket connections and Gemini API
 * Deploy this separately to a service like Railway, Render, or Heroku
 * 
 * Set BACKEND_PORT env var (default: 3001)
 * Set GEMINI_API_KEY env var (required)
 */

import http from 'http';
import { setupServer } from './plugin.js';

const PORT = parseInt(process.env.BACKEND_PORT || '3001', 10);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ ERROR: GEMINI_API_KEY environment variable is not set');
  process.exit(1);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // CORS headers for frontend requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Setup WebSocket handler
setupServer(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Voice AI Backend Server`);
  console.log(`\n✅ Server listening on ws://0.0.0.0:${PORT}`);
  console.log(`\n📍 WebSocket endpoint: ws://localhost:${PORT}/api/ws`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`\n🔑 GEMINI_API_KEY loaded: ${GEMINI_API_KEY ? '✅' : '❌'}\n`);
});

server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n📍 Shutting down gracefully...');
  server.close();
  process.exit(0);
});
