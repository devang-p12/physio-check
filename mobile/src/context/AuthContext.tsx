import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  token: string | null;
  name: string | null;
  email: string | null;
  role: string | null;
  isLoading: boolean;
  login: (token: string, name: string, email: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  name: null,
  email: null,
  role: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const [t, n, e, r] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('name'),
        AsyncStorage.getItem('email'),
        AsyncStorage.getItem('role'),
      ]);
      setToken(t);
      setName(n);
      setEmail(e);
      setRole(r);
    } catch {}
    setIsLoading(false);
  };

  const login = async (token: string, name: string, email: string, role: string) => {
    await Promise.all([
      AsyncStorage.setItem('token', token),
      AsyncStorage.setItem('name', name),
      AsyncStorage.setItem('email', email),
      AsyncStorage.setItem('role', role),
    ]);
    setToken(token);
    setName(name);
    setEmail(email);
    setRole(role);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('name');
    await AsyncStorage.removeItem('email');
    await AsyncStorage.removeItem('role');
    setToken(null);
    setName(null);
    setEmail(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, name, email, role, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
