import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Dynamically detect the backend host on the local network (LAN)
// When running in Expo Go on a physical phone, "localhost" points to the phone itself,
// so we need the computer's actual local IP address where the Node server is running.
export const getBaseUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    // hostUri usually looks like "192.168.1.15:8081"
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000`;
  }
  // Fallback for emulators/web
  return 'http://localhost:5000';
};

export const API_BASE = getBaseUrl();

export const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const token = await AsyncStorage.getItem('token');

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return res.json();
};
