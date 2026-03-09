import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Telescope, StopCircle, Loader2, Image as ImageIcon, Download, Eye } from 'lucide-react';

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

  const isObserver = user?.rol === 'Observador';

  // Parse coordinates from string (e.g. "05h35m17s" -> decimal hours)
  const parseCoord = (coordStr: string) => {
    const matches = coordStr.match(/([+-]?\d+)[hdm°]?(\d+)?[ms']?(\d+)?[s"]?/);
    if (!matches) return 0;
    const d = parseFloat(matches[1] || '0');
    const m = parseFloat(matches[2] || '0');
    const s = parseFloat(matches[3] || '0');
    const sign = d < 0 || coordStr.startsWith('-') ? -1 : 1;
    return sign * (Math.abs(d) + m/60 + s/3600);
  };

  // Calculate Local Sidereal Time (LST) for UPIICSA (Longitude ~ -99.09)
  const getLST = () => {
    const now = new Date();
    const timeInMs = now.getTime();
    const j2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0)).getTime();
    const daysSinceJ2000 = (timeInMs - j2000) / 86400000;
    const longitude = -99.09;
    const lst = (18.697374558 + 24.06570982441908 * daysSinceJ2000 + longitude / 15) % 24;
    return lst < 0 ? lst + 24 : lst;
  };

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
      setHasActiveReservation(!!active || user?.rol === 'Administrador' || isObserver);
    } catch (err) {
      setHasActiveReservation(isObserver); // Observers can always watch
    }
  };

  const fetchCatalog = async () => {
    try {
      const data = await api.get('/catalog');
      
      // Sort catalog by visibility (closest to meridian / LST)
      const currentLST = getLST();
      const sortedData = [...data].sort((a, b) => {
        const raA = parseCoord(a.ascension_recta);
        const raB = parseCoord(b.ascension_recta);
        
        // Calculate hour angle (difference between LST and RA)
        let haA = Math.abs(currentLST - raA);
        if (haA > 12) haA = 24 - haA;
        
        let haB = Math.abs(currentLST - raB);
        if (haB > 12) haB = 24 - haB;
        
        return haA - haB;
      });
      
      setCatalog(sortedData);
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
          if (data.status.includes('Moviendo')) {
            setIsObserving(true);
          } else if (data.status === 'En Reposo' || data.status === 'Conectado') {
            setIsObserving(false);
          }
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
    if (isObserver) {
      setError('Modo Observador: No tienes permisos para enviar comandos.');
      return;
    }

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
    if (isObserver) return;

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
    setStatus('Moviendo telescopio y encuadrando...');
    
    sendCommand('iniciar_observacion', {
      objeto: obj.nombre,
      ascension_recta: parseCoord(obj.ascension_recta), // Send as decimal for NINA
      declinacion: parseCoord(obj.declinacion),         // Send as decimal for NINA
      tipo_captura: 'secuencia_automatica',
      tamano_imagen: 'reducido'
    });
  };

  const handleStop = () => {
    if (isObserver) return;
    setIsObserving(false);
    setStatus('Deteniendo');
    sendCommand('abortar_secuencia');
    setTimeout(() => setStatus('En Reposo'), 2000);
  };

  const handlePreview = () => {
    if (isObserver) return;
    if (!hasActiveReservation) {
      setError('Debes tener una reserva activa para tomar una vista previa.');
      return;
    }
    setStatus('Tomando foto...');
    sendCommand('tomar_vista_previa', { exposicion: 5 }); // 5 segundos de exposicion por defecto
  };

  const handleDownloadAgent = () => {
    window.open('/api/download-agent', '_blank');
  };

  const handleDownloadImage = () => {
    if (!currentImage) return;
    const a = document.createElement('a');
    a.href = currentImage;
    a.download = `nina-capture-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          {isObserver && (
            <span className="text-cyan-400 text-xs md:text-sm font-medium bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 w-full md:w-auto text-center flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" />
              Modo Observador
            </span>
          )}

          {user?.rol === 'Administrador' && (
            <button
              onClick={handleDownloadAgent}
              className="px-3 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              title="Descargar script del agente local"
            >
              <Download className="w-4 h-4" />
              Agente
            </button>
          )}
          
          {!hasActiveReservation && !isObserver && (
            <span className="text-amber-500 text-xs md:text-sm font-medium bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-full md:w-auto text-center">
              No tienes turno activo
            </span>
          )}
          <div className="bg-gray-800 border border-gray-700 px-3 py-2 rounded-lg flex items-center gap-2 flex-1 md:flex-none justify-center">
            <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${status === 'Conectado' || status === 'En Reposo' ? 'bg-emerald-500' : status.includes('Moviendo') ? 'bg-indigo-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`}></div>
            <span className="text-white font-medium text-xs md:text-sm">{status}</span>
          </div>
          
          {!isObserver && (
            <>
              <button
                onClick={() => sendCommand('conectar_equipo')}
                disabled={!hasActiveReservation || status === 'Conectado' || status.includes('Moviendo') || status === 'En Reposo'}
                className={`px-3 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm flex-1 md:flex-none ${
                  hasActiveReservation && status !== 'Conectado' && !status.includes('Moviendo') && status !== 'En Reposo'
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
            </>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-8">
        {/* Image Viewer (Top on mobile, Right on Desktop) */}
        <div className="order-1 lg:order-2 lg:col-span-2">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl h-[400px] md:h-[600px] flex flex-col overflow-hidden relative">
            {/* Overlay Status */}
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2">
                {isObserving && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                <span className="text-xs md:text-sm font-mono text-white">{status}</span>
              </div>
            </div>

            {/* Download Button */}
            {currentImage && (
              <button 
                onClick={handleDownloadImage}
                className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-lg backdrop-blur-md border border-white/10 transition-colors shadow-lg"
                title="Descargar imagen actual"
              >
                <Download className="w-5 h-5" />
              </button>
            )}

            {/* Encuadrando Animation Overlay */}
            {isObserving && status.includes('Moviendo') && (
              <div className="absolute inset-0 bg-black/80 z-20 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <div className="relative">
                  <Telescope className="w-20 h-20 text-indigo-500 animate-pulse" />
                  <div className="absolute -inset-4 border-2 border-indigo-500/30 rounded-full animate-ping"></div>
                </div>
                <h3 className="text-xl md:text-2xl font-bold mt-8 mb-2">Encuadrando Objeto</h3>
                <p className="text-gray-400 text-sm md:text-base text-center px-4">
                  Por favor espere, el telescopio se está moviendo a las coordenadas...
                </p>
              </div>
            )}

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

        {/* Catalog (Bottom on mobile, Left on Desktop) */}
        <div className="order-2 lg:order-1 lg:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold text-white mb-4">Catálogo de Objetos</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {catalog.map((obj) => (
              <div key={obj.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-colors flex flex-col">
                <div className="h-24 lg:h-32 w-full relative bg-gray-900 shrink-0">
                  <img 
                    src={obj.url_imagen_referencia} 
                    alt={obj.nombre} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Fallback a un campo de estrellas genérico si falla la imagen de Wikipedia
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=800&auto=format&fit=crop';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                  <div className="absolute bottom-2 left-2 lg:left-3">
                    <span className="text-[10px] lg:text-xs font-mono bg-indigo-600/80 text-white px-1.5 py-0.5 lg:px-2 lg:py-1 rounded">
                      {obj.designacion}
                    </span>
                  </div>
                </div>
                
                <div className="p-3 lg:p-4 flex flex-col flex-1">
                  <h3 className="text-white font-medium text-sm lg:text-base mb-1 line-clamp-1" title={obj.nombre}>{obj.nombre}</h3>
                  <div className="flex flex-col lg:flex-row lg:justify-between text-[10px] lg:text-xs text-gray-400 mb-3 lg:mb-4 font-mono">
                    <span>AR: {obj.ascension_recta}</span>
                    <span>DEC: {obj.declinacion}</span>
                  </div>
                  
                  {obj.requiere_aprobacion === 1 && (
                    <div className="mb-3 text-[10px] lg:text-xs text-amber-500 bg-amber-500/10 p-1.5 lg:p-2 rounded border border-amber-500/20">
                      ⚠️ Requiere admin
                    </div>
                  )}
                  
                  <div className="mt-auto">
                    <button
                      onClick={() => handleObserve(obj)}
                      disabled={isObserving || !hasActiveReservation || isObserver}
                      className={`w-full py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium transition-colors ${
                        isObserving || !hasActiveReservation || isObserver
                          ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      GoTo y Centrar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

