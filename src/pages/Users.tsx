import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { UserPlus, Trash2, ShieldAlert } from 'lucide-react';

interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'Administrador' | 'Observador' | 'Usuario';
  password_plain?: string;
}

export function Users() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<'Administrador' | 'Observador' | 'Usuario'>('Usuario');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.get('/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', { nombre, email, password, rol });
      setNombre('');
      setEmail('');
      setPassword('');
      setRol('Usuario');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === user?.id) {
      setError('No puedes eliminar tu propio usuario');
      return;
    }
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-indigo-400" />
          Gestion de Usuarios
        </h1>
        <p className="text-gray-400 mt-2">Administrar accesos y roles del sistema</p>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create User Form */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Nuevo Usuario
            </h2>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Contrasena</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rol</label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as any)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Usuario">Usuario (Reserva y Control)</option>
                  <option value="Observador">Observador (Solo ver)</option>
                  <option value="Administrador">Administrador</option>
                </select>
              </div>
              
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors mt-4"
              >
                Crear Usuario
              </button>
            </form>
          </div>
        </div>

        {/* Users List */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-sm text-gray-400 min-w-[600px]">
              <thead className="bg-gray-900/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 md:px-6 py-4 font-medium">Nombre</th>
                  <th className="px-4 md:px-6 py-4 font-medium">Email</th>
                  <th className="px-4 md:px-6 py-4 font-medium">Contrasena</th>
                  <th className="px-4 md:px-6 py-4 font-medium">Rol</th>
                  <th className="px-4 md:px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 md:px-6 py-4 text-white font-medium">{u.nombre}</td>
                    <td className="px-4 md:px-6 py-4">{u.email}</td>
                    <td className="px-4 md:px-6 py-4 font-mono text-xs text-gray-300">{u.password_plain || '***'}</td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                        u.rol === 'Administrador' ? 'bg-indigo-500/20 text-indigo-300' : 
                        u.rol === 'Usuario' ? 'bg-emerald-500/20 text-emerald-300' : 
                        'bg-gray-600/50 text-gray-300'
                      }`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === user?.id}
                        className={`p-2 rounded-lg transition-colors inline-block ${
                          u.id === user?.id 
                            ? 'text-gray-600 cursor-not-allowed' 
                            : 'text-red-400 hover:bg-red-500/10'
                        }`}
                        title={u.id === user?.id ? "No puedes eliminar tu propio usuario" : "Revocar acceso"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
