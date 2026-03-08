import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Home, Calendar, Telescope, Users, LogOut, Menu, X } from 'lucide-react';

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMenu = () => setIsMobileMenuOpen(false);

  const navLinks = [
    { to: '/', icon: Home, label: 'Dashboard' },
    { to: '/scheduler', icon: Calendar, label: 'Reservas' },
    { to: '/control-room', icon: Telescope, label: 'Sala de Control' },
  ];

  if (user?.rol === 'Administrador') {
    navLinks.push({ to: '/users', icon: Users, label: 'Usuarios' });
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Telescope className="w-6 h-6 text-indigo-400" />
          NINA Edge
        </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar (Desktop & Mobile) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 flex flex-col transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 border-b border-gray-700 hidden md:block">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Telescope className="w-6 h-6 text-indigo-400" />
            NINA Edge
          </h1>
          <p className="text-sm text-gray-400 mt-1">{user?.nombre}</p>
          <p className="text-xs text-indigo-400">{user?.rol}</p>
        </div>
        
        {/* Mobile User Info */}
        <div className="p-4 border-b border-gray-700 md:hidden mt-16">
          <p className="text-sm text-gray-400">{user?.nombre}</p>
          <p className="text-xs text-indigo-400">{user?.rol}</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link 
                key={link.to}
                to={link.to} 
                onClick={closeMenu}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700 text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
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

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeMenu}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-full">
        <Outlet />
      </main>
    </div>
  );
}
