import { useState, useEffect } from 'react';

/**
 * Hook for Google Fit integration
 */
export const useGoogleFit = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('http://localhost:5000/google-fit/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
      }
    } catch (err) {
      console.error('Error checking Google Fit status:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const connect = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');

      // Get auth URL
      const response = await fetch('http://localhost:5000/google-fit/auth-url', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get Google auth URL');
      }

      const data = await response.json();
      
      // Open OAuth popup
      window.open(data.authUrl, '_blank', 'width=600,height=700');

      // Listen for OAuth completion
      window.addEventListener('message', handleOAuthCallback);

    } catch (err) {
      console.error('Error connecting to Google Fit:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthCallback = (event) => {
    if (event.data.type === 'google-fit-connected') {
      setIsConnected(true);
      window.removeEventListener('message', handleOAuthCallback);
    }
  };

  const disconnect = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch('http://localhost:5000/google-fit/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Error disconnecting Google Fit:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    refresh: checkConnectionStatus
  };
};
