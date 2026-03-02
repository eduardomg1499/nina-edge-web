import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Home, Calendar, Telescope, Users, LogOut } from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-gray-800 border-b md:border-b-0 md:border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Telescope className="w-6 h-6 text-indigo-400" />
            NINA Edge
          </h1>
          <p className="text-sm text-gray-400 mt-1">{user?.nombre}</p>
          <p className="text-xs text-indigo-400">{user?.rol}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
            <Home className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
          <Link to="/scheduler" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
            <Calendar className="w-5 h-5" />
            <span>Reservas</span>
          </Link>
          <Link to="/control-room" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
            <Telescope className="w-5 h-5" />
            <span>Sala de Control</span>
          </Link>
          {user?.rol === 'Administrador' && (
            <Link to="/users" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
              <Users className="w-5 h-5" />
              <span>Usuarios</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-red-900/50 text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
