import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { format, addDays, startOfDay, addMinutes, isBefore, isSameDay } from 'date-fns';

interface Reservation {
  id: number;
  id_usuario: number;
  usuario_nombre: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  estado: string;
}

export function Scheduler() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      const data = await api.get('/reservations');
      setReservations(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReserve = async (startTime: Date) => {
    setError('');
    const endTime = addMinutes(startTime, 30);
    
    // Check max 2 blocks per night
    const userReservationsForNight = reservations.filter(r => {
      if (r.id_usuario !== user?.id || r.estado === 'cancelada') return false;
      const rStart = new Date(r.fecha_hora_inicio);
      return isSameDay(rStart, selectedDate) || isSameDay(addDays(rStart, -1), selectedDate);
    });

    if (userReservationsForNight.length >= 2 && user?.rol !== 'Administrador') {
      setError('No puedes reservar mas de 2 bloques por noche');
      return;
    }
    
    try {
      await api.post('/reservations', {
        fecha_hora_inicio: startTime.toISOString(),
        fecha_hora_fin: endTime.toISOString()
      });
      fetchReservations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.delete(`/reservations/${id}`);
      fetchReservations();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Generate 30-min blocks for the selected night (18:00 to 06:00 next day)
  const generateBlocks = () => {
    const blocks = [];
    let current = startOfDay(selectedDate);
    current.setHours(18, 0, 0, 0); // Start at 6 PM
    
    const end = addDays(startOfDay(selectedDate), 1);
    end.setHours(6, 0, 0, 0); // End at 6 AM next day

    while (current < end) {
      blocks.push(new Date(current));
      current = addMinutes(current, 30);
    }
    return blocks;
  };

  const blocks = generateBlocks();

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Calendario de Reservas</h1>
        <p className="text-gray-400 mt-2">Selecciona bloques de 30 minutos</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 md:gap-4 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {[0, 1, 2, 3, 4].map((offset) => {
          const date = addDays(new Date(), offset);
          return (
            <button
              key={offset}
              onClick={() => setSelectedDate(date)}
              className={`px-3 md:px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-sm md:text-base ${
                isSameDay(date, selectedDate)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {format(date, 'dd MMM')}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blocks.map((block, index) => {
          const blockEnd = addMinutes(block, 30);
          const isPast = isBefore(block, new Date());
          const reservation = reservations.find(r => 
            r.estado !== 'cancelada' && 
            new Date(r.fecha_hora_inicio) <= block && 
            new Date(r.fecha_hora_fin) > block
          );

          return (
            <div 
              key={index} 
              className={`p-4 rounded-xl border ${
                reservation 
                  ? reservation.id_usuario === user?.id 
                    ? 'bg-indigo-900/30 border-indigo-500/50' 
                    : 'bg-red-900/20 border-red-900/50'
                  : isPast 
                    ? 'bg-gray-900 border-gray-800 opacity-50' 
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-white font-medium">
                  {format(block, 'HH:mm')} - {format(blockEnd, 'HH:mm')}
                </span>
                {reservation && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    reservation.id_usuario === user?.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {reservation.id_usuario === user?.id ? 'Tu Reserva' : 'Ocupado'}
                  </span>
                )}
              </div>
              
              {reservation ? (
                <div className="flex justify-between items-center mt-4">
                  <span className="text-sm text-gray-400">{reservation.usuario_nombre}</span>
                  {(user?.rol === 'Administrador' || reservation.id_usuario === user?.id) && (
                    <button 
                      onClick={() => handleCancel(reservation.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleReserve(block)}
                  disabled={isPast}
                  className={`w-full mt-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isPast 
                      ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  Reservar Bloque
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
