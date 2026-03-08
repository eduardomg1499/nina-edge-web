import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Telescope, StopCircle, Loader2, Image as ImageIcon } from 'lucide-react';

interface CatalogObject {
  id: number;
  nombre: string;
  designacion: string;
  ascension_recta: string;
  declinacion: string;
  url_imagen_referencia: string;
  requiere_aprobacion: number;
}

export function ControlRoom() {
  const { user, token } = useAuthStore();
  const [catalog, setCatalog] = useState<CatalogObject[]>([]);
  const [status, setStatus] = useState('Conectando...');
  const [telemetry, setTelemetry] = useState({ 
    ra: 0, 
    dec: 0, 
    tracking: false,
    cameraConnected: false,
    temperature: 0,
    coolerOn: false
  });
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isObserving, setIsObserving] = useState(false);
  const [hasActiveReservation, setHasActiveReservation] = useState(false);
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    checkActiveReservation();
    fetchCatalog();
    connectWebSocket();
    
    const interval = setInterval(checkActiveReservation, 60000); // Check every minute
    
    return () => {
      clearInterval(interval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const checkActiveReservation = async () => {
    try {
      const active = await api.get('/reservations/active');
      setHasActiveReservation(!!active || user?.rol === 'Administrador');
    } catch (err) {
      setHasActiveReservation(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const data = await api.get('/catalog');
      setCatalog(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/api/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Conectado al servidor WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry') {
          setStatus(data.status);
          if (data.data) {
            setTelemetry({
              ra: data.data.ra || 0,
              dec: data.data.dec || 0,
              tracking: data.data.tracking || false,
              cameraConnected: data.data.cameraConnected || false,
              temperature: data.data.temperature || 0,
              coolerOn: data.data.coolerOn || false
            });
          }
        } else if (data.type === 'image') {
          setCurrentImage(data.imageUrl);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      } catch (err) {
        console.error('Error parseando mensaje WS:', err);
      }
    };

    ws.onclose = () => {
      console.log('Desconectado del servidor WebSocket');
      // Intentar reconectar despues de 5 segundos
      setTimeout(connectWebSocket, 5000);
    };

    wsRef.current = ws;
  };

  const sendCommand = (action: string, params: any = {}) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('No hay conexion con el servidor');
      return;
    }

    const payload = {
      id_comando: `cmd_${Date.now()}`,
      accion_requerida: action,
      parametros: params,
      verificacion_seguridad: {
        token_sesion: token,
        usuario_autorizado: user?.email
      }
    };

    wsRef.current.send(JSON.stringify(payload));
  };

  const handleObserve = (obj: CatalogObject) => {
    if (obj.requiere_aprobacion === 1) {
      if (user?.rol !== 'Administrador') {
        const confirm = window.confirm(`⚠️ ADVERTENCIA: Observar ${obj.nombre} requiere aprobación del administrador por motivos de seguridad (riesgo de daño al equipo). ¿Deseas solicitar aprobación?`);
        if (confirm) {
          alert('Solicitud enviada al administrador. (Esta función se implementará completamente en la próxima actualización).');
        }
        return;
      } else {
        const confirm = window.confirm(`⚠️ ADVERTENCIA DE SEGURIDAD: Estás a punto de apuntar a ${obj.nombre}. Asegúrate de tener los filtros solares adecuados instalados. ¿Continuar bajo tu propio riesgo?`);
        if (!confirm) return;
      }
    }

    setIsObserving(true);
    setStatus('Moviendo');
    
    // Parse coordinates from string (e.g. "05h35m17s" -> decimal hours)
    // This is a simplified parser, in production you'd want robust coordinate parsing
    // or store decimal coordinates in the DB directly.
    const parseCoord = (coordStr: string) => {
      // Basic extraction of numbers
      const matches = coordStr.match(/([+-]?\d+)[hdm°]?(\d+)?[ms']?(\d+)?[s"]?/);
      if (!matches) return 0;
      const d = parseFloat(matches[1] || '0');
      const m = parseFloat(matches[2] || '0');
      const s = parseFloat(matches[3] || '0');
      const sign = d < 0 || coordStr.startsWith('-') ? -1 : 1;
      return sign * (Math.abs(d) + m/60 + s/3600);
    };

    sendCommand('iniciar_observacion', {
      objeto: obj.nombre,
      ascension_recta: parseCoord(obj.ascension_recta), // Send as decimal for NINA
      declinacion: parseCoord(obj.declinacion),         // Send as decimal for NINA
      tipo_captura: 'secuencia_automatica',
      tamano_imagen: 'reducido'
    });
  };

  const handleStop = () => {
    setIsObserving(false);
    setStatus('Deteniendo');
    sendCommand('abortar_secuencia');
    setTimeout(() => setStatus('En Reposo'), 2000);
  };

  const handlePreview = () => {
    if (!hasActiveReservation) {
      setError('Debes tener una reserva activa para tomar una vista previa.');
      return;
    }
    setStatus('Tomando foto...');
    sendCommand('tomar_vista_previa', { exposicion: 5 }); // 5 segundos de exposicion por defecto
  };

  return (
    <div className="space-y-6">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <Telescope className="w-7 h-7 md:w-8 md:h-8 text-indigo-400" />
            Sala de Control
          </h1>
          <p className="text-sm md:text-base text-gray-400 mt-2">Control en tiempo real del telescopio NINA Edge</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {!hasActiveReservation && (
            <span className="text-amber-500 text-xs md:text-sm font-medium bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-full md:w-auto text-center">
              No tienes turno activo
            </span>
          )}
          <div className="bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 flex-1 md:flex-none justify-center">
            <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${status === 'Conectado' || status === 'Moviendo...' || status === 'En Reposo' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="text-white font-medium text-xs md:text-sm">{status}</span>
          </div>
          
          <button
            onClick={() => sendCommand('conectar_equipo')}
            disabled={!hasActiveReservation || status === 'Conectado' || status === 'Moviendo...' || status === 'En Reposo'}
            className={`px-3 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm flex-1 md:flex-none ${
              hasActiveReservation && status !== 'Conectado' && status !== 'Moviendo...' && status !== 'En Reposo'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            Conectar
          </button>
          
          <button
            onClick={handleStop}
            disabled={!isObserving || !hasActiveReservation}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm flex-1 md:flex-none ${
              isObserving && hasActiveReservation
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            <StopCircle className="w-4 h-4" />
            Abortar
          </button>
          
          <button
            onClick={handlePreview}
            disabled={!hasActiveReservation || isObserving || status === 'Tomando foto...'}
            className={`px-3 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm flex-1 md:flex-none ${
              hasActiveReservation && !isObserving && status !== 'Tomando foto...'
                ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            Vista Previa
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Catalog */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">Catalogo de Objetos</h2>
          
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {catalog.map((obj) => (
              <div key={obj.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-colors">
                <div className="h-32 w-full relative bg-gray-900">
                  <img 
                    src={obj.url_imagen_referencia} 
                    alt={obj.nombre} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${obj.designacion}/800/600`;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                  <div className="absolute bottom-2 left-3">
                    <span className="text-xs font-mono bg-indigo-600/80 text-white px-2 py-1 rounded">
                      {obj.designacion}
                    </span>
                  </div>
                </div>
                
                <div className="p-4">
                  <h3 className="text-white font-medium mb-1">{obj.nombre}</h3>
                  <div className="flex justify-between text-xs text-gray-400 mb-4 font-mono">
                    <span>AR: {obj.ascension_recta}</span>
                    <span>DEC: {obj.declinacion}</span>
                  </div>
                  
                  {obj.requiere_aprobacion === 1 && (
                    <div className="mb-3 text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                      ⚠️ Requiere aprobación del admin
                    </div>
                  )}
                  
                  <button
                    onClick={() => handleObserve(obj)}
                    disabled={isObserving || !hasActiveReservation}
                    className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                      isObserving || !hasActiveReservation
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    GoTo y Centrar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Image Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl h-[400px] md:h-[600px] flex flex-col overflow-hidden relative">
            {/* Overlay Status */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                {isObserving && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                <span className="text-xs md:text-sm font-mono text-white">{status}</span>
              </div>
            </div>

            {currentImage ? (
              <img 
                src={currentImage} 
                alt="Captura NINA" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-4 text-center">
                <ImageIcon className="w-12 h-12 md:w-16 md:h-16 mb-4 opacity-50" />
                <p className="text-sm md:text-base">Esperando imagen de telemetria...</p>
                <p className="text-xs md:text-sm mt-2 font-mono">Selecciona un objeto para iniciar</p>
              </div>
            )}
            
            {/* Telemetry Bar */}
            <div className="bg-gray-900 border-t border-gray-800 p-3 md:p-4 flex flex-col md:flex-row justify-between items-center text-[10px] md:text-xs font-mono text-gray-400 gap-2 md:gap-0">
              <div className="flex gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
                <span>AR: {telemetry.ra.toFixed(4)}h</span>
                <span>DEC: {telemetry.dec.toFixed(4)}°</span>
                <span className={telemetry.tracking ? "text-emerald-400" : "text-amber-400"}>
                  TRK: {telemetry.tracking ? 'ON' : 'OFF'}
                </span>
              </div>
              <div className="flex gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
                <span className={telemetry.cameraConnected ? "text-emerald-400" : "text-gray-500"}>
                  CAM: {telemetry.cameraConnected ? 'OK' : 'OFF'}
                </span>
                <span>TMP: {telemetry.temperature.toFixed(1)}°C</span>
                <span className={telemetry.coolerOn ? "text-blue-400" : "text-gray-500"}>
                  CLR: {telemetry.coolerOn ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
