import { WebSocketServer, WebSocket } from 'ws';

export function setupWebSocket(wss: WebSocketServer) {
  const clients = new Set<WebSocket>();
  let agentSocket: WebSocket | null = null;

  wss.on('connection', (ws, req) => {
    // Detectamos al agente por un header o parametro, ya que el proxy puede alterar la URL
    const isAgent = req.url?.includes('agent=true') || req.headers['x-client-type'] === 'agent';
    
    if (isAgent) {
      console.log('Agente local conectado');
      agentSocket = ws;
    } else {
      console.log('Cliente web conectado');
      clients.add(ws);
    }

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (isAgent) {
          // Broadcast agent telemetry and images to all web clients
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        } else {
          // Forward commands from web clients to the agent
          if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
            agentSocket.send(JSON.stringify(data));
          } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Agente local no conectado' }));
          }
        }
      } catch (err) {
        console.error('Error procesando mensaje WS:', err);
      }
    });

    ws.on('close', () => {
      if (isAgent) {
        console.log('Agente local desconectado');
        agentSocket = null;
      } else {
        console.log('Cliente web desconectado');
        clients.delete(ws);
      }
    });
  });
}
