const WebSocket = require('ws');

// ==========================================
// CONFIGURACION
// ==========================================
// URL de tu servidor en Google Cloud
const WS_URL = 'ws://35.226.5.214/api/ws';

// URL de la Advanced API de NINA (v2)
const NINA_API_URL = 'http://localhost:1888/v2/api'; 

// ==========================================
// LOGICA DEL AGENTE
// ==========================================
console.log('====================================');
console.log(' NINA Edge - Agente Local Iniciando');
console.log('====================================\n');

function conectar() {
  console.log(`[${new Date().toLocaleTimeString()}] Intentando conectar a la plataforma web...`);
  
  const ws = new WebSocket(WS_URL, {
    headers: { 'x-client-type': 'agent' }
  });

  ws.on('open', () => {
    console.log(`[${new Date().toLocaleTimeString()}] ¡Conectado exitosamente a la nube!`);
    
    // Bucle de Telemetria: Preguntar a NINA cada 5 segundos
    setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) return;

      try {
        // Pedir datos reales del telescopio a NINA
        const response = await fetch(`${NINA_API_URL}/equipment/telescope`);
        
        if (response.ok) {
          const telescopeData = await response.json();
          
          ws.send(JSON.stringify({
            type: 'telemetry',
            status: telescopeData.Connected ? 'Conectado' : 'Desconectado', 
            data: { 
              ra: telescopeData.RightAscension || 0,
              dec: telescopeData.Declination || 0,
              tracking: telescopeData.Tracking || false
            }
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'telemetry',
            status: 'NINA Abierto (Telescopio no detectado)', 
            data: {}
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'telemetry',
          status: 'NINA Apagado', 
          data: {}
        }));
      }
    }, 5000);
  });

  ws.on('message', async (data) => {
    try {
      const comando = JSON.parse(data);
      console.log(`\n[${new Date().toLocaleTimeString()}] COMANDO RECIBIDO:`, comando.accion_requerida);
      
      if (comando.accion_requerida === 'iniciar_observacion') {
        console.log(`-> NINA: Orden de mover telescopio a ${comando.parametros.objeto}...`);
        
        try {
          const ra = parseFloat(comando.parametros.ascension_recta);
          const dec = parseFloat(comando.parametros.declinacion);
          
          console.log(`-> Coordenadas a enviar: AR=${ra}, DEC=${dec}`);
          
          const response = await fetch(`${NINA_API_URL}/equipment/telescope/slew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              RightAscension: ra,
              Declination: dec
            })
          });

          if (response.ok) {
            console.log('-> NINA confirmo el movimiento. El telescopio se esta moviendo.');
            ws.send(JSON.stringify({ type: 'telemetry', status: 'Moviendo...' }));
          } else {
            const errorText = await response.text();
            console.log(`-> NINA rechazo el movimiento. Error: ${errorText}`);
            ws.send(JSON.stringify({ type: 'error', message: `NINA rechazo el movimiento: ${response.statusText}` }));
          }
        } catch (err) {
          console.error('-> Error al comunicarse con NINA:', err.message);
          ws.send(JSON.stringify({ type: 'error', message: `Error de red con NINA: ${err.message}` }));
        }
      }
      
      if (comando.accion_requerida === 'abortar_secuencia') {
        console.log(`-> NINA: ¡ABORTANDO MOVIMIENTO!`);
        try {
          await fetch(`${NINA_API_URL}/equipment/telescope/abort`, { method: 'POST' });
          console.log('-> NINA detuvo el telescopio.');
        } catch (err) {
          console.error('-> Error al detener NINA:', err.message);
        }
      }
      
    } catch (err) {
      console.error('Error al procesar el comando:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Desconectado de la nube. Reconectando en 5 segundos...`);
    setTimeout(conectar, 5000);
  });

  ws.on('error', (error) => {
    console.error(`[${new Date().toLocaleTimeString()}] Error de conexion:`, error.message);
  });
}

conectar();
