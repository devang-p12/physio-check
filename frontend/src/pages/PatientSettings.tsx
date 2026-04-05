import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Watch, AlertCircle, CheckCircle, XCircle, RefreshCw, Moon } from 'lucide-react';

interface Settings {
  smartwatchEnabled: boolean;
  enableRealTimeTracking: boolean;
  enableFormAnalysis: boolean;
}

interface GoogleFitStatus {
  connected: boolean;
  tokenValid: boolean;
}

interface SettingsResponse {
  settings: Settings;
  googleFit: GoogleFitStatus;
  canEnablesmartwatch: boolean;
  warnings?: string[];
}

interface ErrorModal {
  show: boolean;
  type: 'GOOGLE_FIT_NOT_CONNECTED' | 'TOKEN_EXPIRED' | null;
  message: string;
}

const PatientSettings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>({
    smartwatchEnabled: false,
    enableRealTimeTracking: true,
    enableFormAnalysis: true
  });
  const [googleFitStatus, setGoogleFitStatus] = useState<GoogleFitStatus>({
    connected: false,
    tokenValid: false
  });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModal>({
    show: false,
    type: null,
    message: ''
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if(next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('http://localhost:5000/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data: SettingsResponse = await response.json();
        setSettings(data.settings);
        setGoogleFitStatus(data.googleFit);
        console.log('Settings refreshed:', data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleSmartwatch = async () => {
    setToggling(true);
    setSuccessMessage(null);

    try {
      const response = await fetch('http://localhost:5000/settings/smartwatch/toggle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: !settings.smartwatchEnabled
        })
      });

      const data = await response.json();
      console.log('Toggle response:', data);

      if (response.ok) {
        setSettings(data.settings);
        setSuccessMessage(
          data.settings.smartwatchEnabled 
            ? 'Smartwatch tracking enabled!' 
            : 'Smartwatch tracking disabled'
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        // Handle error cases
        if (data.error === 'GOOGLE_FIT_NOT_CONNECTED') {
          setErrorModal({
            show: true,
            type: 'GOOGLE_FIT_NOT_CONNECTED',
            message: data.message
          });
        } else if (data.error === 'TOKEN_EXPIRED') {
          setErrorModal({
            show: true,
            type: 'TOKEN_EXPIRED',
            message: data.message
          });
        } else {
          console.error('Toggle error:', data);
          alert(data.message || 'Failed to update smartwatch setting');
        }
      }
    } catch (error) {
      console.error('Error toggling smartwatch:', error);
      alert('Failed to update setting. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  const handleConnectGoogleFit = () => {
    // Open Google Fit auth popup
    fetch('http://localhost:5000/google-fit/auth-url', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        const popup = window.open(data.authUrl, 'Google Fit Auth', 'width=600,height=700');
        
        // Listen for message from popup
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_FIT_CONNECTED') {
            console.log('Google Fit connected message received');
            // Refresh settings immediately
            setTimeout(() => {
              fetchSettings();
              setErrorModal({ show: false, type: null, message: '' });
              setSuccessMessage('Google Fit connected successfully!');
              setTimeout(() => setSuccessMessage(null), 3000);
            }, 500);
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);
        
        // Fallback: Check if popup closed
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            // Wait a bit for backend to process, then refresh
            setTimeout(() => {
              fetchSettings();
              setErrorModal({ show: false, type: null, message: '' });
            }, 500);
            window.removeEventListener('message', handleMessage);
          }
        }, 500);
        
        // Cleanup after 60 seconds
        setTimeout(() => {
          clearInterval(checkPopup);
          window.removeEventListener('message', handleMessage);
        }, 60000);
      })
      .catch(error => {
        console.error('Error getting auth URL:', error);
        alert('Failed to initiate Google Fit connection');
      });
  };

  const handleRefreshToken = () => {
    // Reconnect Google Fit
    handleConnectGoogleFit();
  };

  const handleDisconnectGoogleFit = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('http://localhost:5000/google-fit/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSuccessMessage('Google Fit disconnected');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        const data = await response.json();
        console.error('Disconnect failed:', data);
        alert(data.message || 'Failed to disconnect Google Fit');
      }
    } catch (err) {
      console.error('Error disconnecting Google Fit:', err);
      alert('Failed to disconnect Google Fit');
    } finally {
      setRefreshing(false);
      fetchSettings();
    }
  };

  const closeModal = () => {
    setErrorModal({ show: false, type: null, message: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your exercise tracking preferences
              </p>
            </div>
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Google Fit Status Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Google Fit Connection
              </h2>
              <p className="text-sm text-gray-600">
                Connect your smartwatch to track real-time exercise data
              </p>
            </div>
            <div className="flex items-center gap-3">
              {googleFitStatus.connected && googleFitStatus.tokenValid ? (
                <div className="flex items-center text-green-600">
                  <CheckCircle className="mr-2" size={24} />
                  <span className="font-medium">Connected</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <XCircle className="mr-2" size={24} />
                  <span className="font-medium">Not Connected</span>
                </div>
              )}
              
              {/* Manual Refresh Button */}
              <button
                onClick={fetchSettings}
                disabled={refreshing}
                className={`p-2 rounded-lg transition ${
                  refreshing 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-blue-600'
                }`}
                title="Refresh status"
              >
                <RefreshCw className={refreshing ? 'animate-spin' : ''} size={20} />
              </button>
            </div>
          </div>
          
          {!googleFitStatus.connected && (
            <button
              onClick={handleConnectGoogleFit}
              className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Connect Google Fit
            </button>
          )}

          {googleFitStatus.connected && !googleFitStatus.tokenValid && (
            <button
              onClick={handleRefreshToken}
              className="mt-4 w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center justify-center"
            >
              <RefreshCw className="mr-2" />
              Refresh Connection
            </button>
          )}
          {googleFitStatus.connected && (
            <button
              onClick={handleDisconnectGoogleFit}
              disabled={refreshing}
              className="mt-3 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Disconnect Google Fit
            </button>
          )}
        </div>

        {/* Smartwatch Tracking Toggle */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Watch className="text-blue-600" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Smartwatch Tracking
                </h3>
                <p className="text-sm text-gray-600">
                  Enable real-time sensor data collection during exercises
                </p>
              </div>
            </div>
            
            {/* Toggle Switch */}
            <button
              onClick={handleToggleSmartwatch}
              disabled={toggling}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                settings.smartwatchEnabled ? 'bg-blue-600' : 'bg-gray-300'
              } ${toggling ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  settings.smartwatchEnabled ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Status Message */}
          <div className="mt-4">
            {settings.smartwatchEnabled ? (
              googleFitStatus.connected && googleFitStatus.tokenValid ? (
                <div className="flex items-start bg-green-50 border border-green-200 rounded-lg p-3">
                  <CheckCircle className="text-green-600 mt-0.5 mr-2 flex-shrink-0" size={18} />
                  <div className="text-sm text-green-800">
                    <strong>Active:</strong> Your sessions will include real-time heart rate, movement, and form analysis.
                  </div>
                </div>
              ) : (
                <div className="flex items-start bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <AlertCircle className="text-yellow-600 mt-0.5 mr-2 flex-shrink-0" size={18} />
                  <div className="text-sm text-yellow-800">
                    <strong>Warning:</strong> Smartwatch tracking is enabled but Google Fit is not properly connected. Sessions will run in manual mode.
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-start bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm text-gray-700">
                  <strong>Manual Mode:</strong> Sessions will not collect sensor data. You can manually record your exercise completion.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global UI Preferences */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Moon className="text-indigo-600" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Dark Mode
                </h3>
                <p className="text-sm text-gray-600">
                  Switch the entire interface to Navy/Teal dark theme
                </p>
              </div>
            </div>
            
            <button
              onClick={handleToggleTheme}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isDark ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  isDark ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Advanced Options
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Real-time Tracking</p>
                <p className="text-xs text-gray-500">Stream sensor data continuously</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs ${
                settings.enableRealTimeTracking ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {settings.enableRealTimeTracking ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Form Analysis</p>
                <p className="text-xs text-gray-500">Analyze exercise form and posture</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-xs ${
                settings.enableFormAnalysis ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {settings.enableFormAnalysis ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {errorModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start">
              <AlertCircle className="text-red-600 mr-3 mt-1 flex-shrink-0" size={24} />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Cannot Enable Smartwatch Tracking
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  {errorModal.message}
                </p>

                <div className="flex space-x-3">
                  {errorModal.type === 'GOOGLE_FIT_NOT_CONNECTED' && (
                    <button
                      onClick={() => {
                        handleConnectGoogleFit();
                        closeModal();
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Connect Google Fit
                    </button>
                  )}
                  
                  {errorModal.type === 'TOKEN_EXPIRED' && (
                    <button
                      onClick={() => {
                        handleRefreshToken();
                        closeModal();
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Reconnect
                    </button>
                  )}

                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientSettings;
