import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';

export function Dashboard() {
  const { user } = useAuthStore();
  const [status, setStatus] = useState('Desconectado');
  const [nextReservation, setNextReservation] = useState<any>(null);
  const [weather, setWeather] = useState({ 
    connected: false, 
    temperature: null as number | null, 
    humidity: null as number | null 
  });
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleTimeString());
  const [adminStats, setAdminStats] = useState({ totalUsers: 0, totalReservations: 0 });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchNextReservation();
    if (user?.rol === 'Administrador') {
      fetchAdminStats();
    }
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [user]);

  const fetchAdminStats = async () => {
    try {
      const [users, reservations] = await Promise.all([
        api.get('/users'),
        api.get('/reservations')
      ]);
      setAdminStats({
        totalUsers: users.length,
        totalReservations: reservations.length
      });
    } catch (err) {
      console.error('Error fetching admin stats', err);
    }
  };

  const fetchNextReservation = async () => {
    try {
      // Assuming there's an endpoint for this, or we can fetch all and find the next one
      const reservations = await api.get('/reservations');
      const upcoming = reservations.filter((r: any) => new Date(r.fecha_hora_inicio) > new Date() && r.estado === 'activa');
      if (upcoming.length > 0) {
        // Sort by closest date
        upcoming.sort((a: any, b: any) => new Date(a.fecha_hora_inicio).getTime() - new Date(b.fecha_hora_inicio).getTime());
        setNextReservation(upcoming[0]);
      }
    } catch (err) {
      console.error('Error fetching reservations', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.host}/api/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry') {
          setStatus(data.status);
          setLastUpdate(new Date().toLocaleTimeString());
          if (data.data && data.data.weather) {
            setWeather({
              connected: data.data.weather.connected,
              temperature: data.data.weather.temperature,
              humidity: data.data.weather.humidity
            });
          }
        }
      } catch (err) {
        console.error('Error parseando mensaje WS:', err);
      }
    };

    ws.onclose = () => {
      setTimeout(connectWebSocket, 5000);
    };

    wsRef.current = ws;
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Bienvenido, {user?.nombre}</h1>
        <p className="text-gray-400 mt-2">Sistema de Control Telescopico Remoto NINA Edge</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Estado del Equipo</h3>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${status === 'Conectado' || status === 'Moviendo...' || status === 'En Reposo' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-xl font-semibold text-white">{status}</span>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Proxima Reserva</h3>
          {nextReservation ? (
            <>
              <p className="text-xl font-semibold text-white">
                {new Date(nextReservation.fecha_hora_inicio).toLocaleString()}
              </p>
              <p className="text-sm text-indigo-400 mt-1">Reserva ID: {nextReservation.id}</p>
            </>
          ) : (
            <p className="text-xl font-semibold text-gray-500">No hay reservas proximas</p>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Condiciones Clima</h3>
          {weather.connected ? (
            <>
              <p className="text-xl font-semibold text-white">
                {weather.temperature != null ? `${Number(weather.temperature).toFixed(1)}°C` : 'N/A'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Humedad: {weather.humidity != null ? `${Number(weather.humidity).toFixed(1)}%` : 'N/A'}
              </p>
            </>
          ) : (
            <p className="text-xl font-semibold text-gray-500">Sin datos de clima</p>
          )}
        </div>
      </div>

      {user?.rol === 'Administrador' && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Monitorización del Sistema (Admin)</h2>
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-400">Estado de Conexión NINA</p>
                <p className={`text-lg font-medium ${status === 'Desconectado' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {status !== 'Desconectado' ? 'Activa' : 'Inactiva'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Última Actualización</p>
                <p className="text-lg font-medium text-white">{lastUpdate}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Usuarios Registrados</p>
                <p className="text-lg font-medium text-white">{adminStats.totalUsers}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Reservas Totales</p>
                <p className="text-lg font-medium text-white">{adminStats.totalReservations}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
