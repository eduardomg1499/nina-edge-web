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
        const response = await fetch(`${NINA_API_URL}/equipment/mount/info`);
        let mountData = {};
        if (response.ok) {
          const resJson = await response.json();
          mountData = resJson.Response || {};
        }

        // Pedir datos reales de la camara a NINA
        const camResponse = await fetch(`${NINA_API_URL}/equipment/camera/info`);
        let camData = {};
        if (camResponse.ok) {
          const resJson = await camResponse.json();
          camData = resJson.Response || {};
        }

        // Pedir datos del clima a NINA
        let weatherData = {};
        try {
          const weatherResponse = await fetch(`${NINA_API_URL}/equipment/weather/info`);
          if (weatherResponse.ok) {
            const resJson = await weatherResponse.json();
            weatherData = resJson.Response || {};
          }
        } catch (e) {
          // Ignorar si no hay clima
        }

        // Intentar obtener la ultima imagen
        try {
          // NINA API v2 uses /prepared-image instead of /application/image
          const imgResponse = await fetch(`${NINA_API_URL}/prepared-image?resize=true&size=800x600&quality=80&stream=true`);
          if (imgResponse.ok) {
            const buffer = await imgResponse.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            ws.send(JSON.stringify({
              type: 'image',
              imageUrl: `data:image/jpeg;base64,${base64}`
            }));
          }
        } catch (e) {
          // Ignorar si no hay imagen
        }
        
        if (response.ok || camResponse.ok) {
          ws.send(JSON.stringify({
            type: 'telemetry',
            status: mountData.Connected ? 'Conectado' : 'Desconectado', 
            data: { 
              ra: mountData.RightAscension || 0,
              dec: mountData.Declination || 0,
              tracking: mountData.Tracking || false,
              cameraConnected: camData.Connected || false,
              temperature: camData.Temperature || 0,
              coolerOn: camData.CoolerOn || false,
              weather: {
                connected: weatherData.Connected || false,
                temperature: weatherData.Temperature,
                humidity: weatherData.Humidity,
                dewPoint: weatherData.DewPoint,
                pressure: weatherData.Pressure
              }
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
      
      if (comando.accion_requerida === 'conectar_equipo') {
        console.log(`-> NINA: Orden de conectar equipo...`);
        try {
          // Intentar conectar montura y camara
          await fetch(`${NINA_API_URL}/equipment/mount/connect`, { method: 'GET' });
          await fetch(`${NINA_API_URL}/equipment/camera/connect`, { method: 'GET' });
          console.log('-> NINA: Comandos de conexion enviados.');
        } catch (err) {
          console.error('-> Error al conectar equipo:', err.message);
        }
      }

      if (comando.accion_requerida === 'iniciar_observacion') {
        console.log(`-> NINA: Orden de mover telescopio a ${comando.parametros.objeto}...`);
        
        try {
          const ra = parseFloat(comando.parametros.ascension_recta);
          const dec = parseFloat(comando.parametros.declinacion);
          
          // NINA Advanced API v2 expects RA and DEC in degrees as query parameters
          // RA in hours * 15 = RA in degrees
          const raDegrees = ra * 15;
          const decDegrees = dec;
          
          console.log(`-> Moviendo telescopio a AR=${raDegrees.toFixed(4)}°, DEC=${decDegrees.toFixed(4)}°`);
          
          // 1. Desaparcar el telescopio primero (por si esta aparcado)
          console.log(`-> NINA: Desaparcando telescopio...`);
          const unparkRes = await fetch(`${NINA_API_URL}/equipment/mount/unpark`, { method: 'GET' });
          if (!unparkRes.ok) {
            console.log(`-> NINA: Advertencia al desaparcar: ${unparkRes.statusText}`);
          }
          
          // Esperar un momento para que el telescopio procese el desaparcado
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 2. Enviar comando de movimiento (Slew)
          const response = await fetch(`${NINA_API_URL}/equipment/mount/slew?ra=${raDegrees}&dec=${decDegrees}&waitForResult=false&center=true`, {
            method: 'GET' // The API uses GET for slew in v2
          });

          if (response.ok) {
            console.log('-> NINA confirmo el movimiento. El telescopio se esta moviendo.');
            ws.send(JSON.stringify({ type: 'telemetry', status: 'Moviendo y encuadrando...' }));
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
      
      if (comando.accion_requerida === 'abortar_secuencia' || comando.accion_requerida === 'abortar_todo') {
        console.log(`-> NINA: ¡ABORTANDO MOVIMIENTO Y SECUENCIAS!`);
        try {
          await fetch(`${NINA_API_URL}/equipment/mount/slew/stop`, { method: 'GET' });
          await fetch(`${NINA_API_URL}/sequence/stop`, { method: 'GET' });
          console.log('-> NINA detuvo el telescopio y las secuencias.');
        } catch (err) {
          console.error('-> Error al detener NINA:', err.message);
        }
      }

      if (comando.accion_requerida === 'tomar_vista_previa') {
        console.log(`-> NINA: Orden de tomar vista previa (Capture)...`);
        try {
          const exposureTime = comando.parametros.exposicion || 5;
          // El comando correcto en NINA Advanced API v2 para tomar una foto es /equipment/camera/capture
          const response = await fetch(`${NINA_API_URL}/equipment/camera/capture?duration=${exposureTime}&imageType=SNAPSHOT&waitForResult=false`, { method: 'GET' });
          
          if (response.ok) {
            console.log(`-> NINA: Exposición de ${exposureTime}s iniciada correctamente.`);
            ws.send(JSON.stringify({ type: 'telemetry', status: 'Tomando foto...' }));
          } else {
            const errorText = await response.text();
            console.log(`-> NINA rechazo la captura. Error: ${errorText}`);
            ws.send(JSON.stringify({ type: 'error', message: `Error al tomar foto: ${response.statusText}` }));
          }
        } catch (err) {
          console.error('-> Error al tomar foto:', err.message);
          ws.send(JSON.stringify({ type: 'error', message: `Error al tomar foto: ${err.message}` }));
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
