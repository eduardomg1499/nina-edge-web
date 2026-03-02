import { useAuthStore } from '../store/authStore';

export function Dashboard() {
  const { user } = useAuthStore();

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
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xl font-semibold text-white">En Linea</span>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Proxima Reserva</h3>
          <p className="text-xl font-semibold text-white">Hoy, 22:00</p>
          <p className="text-sm text-indigo-400 mt-1">Nebulosa de Orion</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Condiciones Clima</h3>
          <p className="text-xl font-semibold text-white">Despejado</p>
          <p className="text-sm text-gray-400 mt-1">Humedad: 45%</p>
        </div>
      </div>
    </div>
  );
}
