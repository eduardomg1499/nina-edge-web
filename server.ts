import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import http from 'http';
import { setupRoutes } from './src/server/routes.js';
import { setupWebSocket } from './src/server/websocket.js';
import { initDb } from './src/server/db.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize database
  initDb();

  app.use(cors());
  app.use(express.json());

  // Setup API routes
  setupRoutes(app);

  const server = http.createServer(app);

  // Create WSS without attaching to server immediately
  const wss = new WebSocketServer({ noServer: true });
  setupWebSocket(wss);

  // Handle upgrades manually to avoid Vite conflicts
  server.on('upgrade', (request, socket, head) => {
    // In a proxy environment, the URL might be modified or we might just need to accept all upgrades
    // that aren't specifically for Vite's HMR (which usually uses a different path or protocol)
    if (request.url?.includes('/api/ws') || request.headers['x-client-type'] === 'agent') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
