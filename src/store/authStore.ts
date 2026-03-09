import { create } from 'zustand';

interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'Administrador' | 'Observador' | 'Usuario';
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
}));

// Initialize from localStorage
const storedToken = localStorage.getItem('token');
const storedUser = localStorage.getItem('user');
if (storedToken && storedUser) {
  try {
    useAuthStore.setState({ token: storedToken, user: JSON.parse(storedUser) });
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}
