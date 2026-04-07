import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Watch, AlertCircle, CheckCircle, XCircle, RefreshCw, Moon, Settings, ChevronLeft, Activity, Wifi, WifiOff, Shield } from 'lucide-react';

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

/* ── Branded Toggle Component ── */
const Toggle = ({ enabled, onToggle, disabled = false }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none ${
      enabled ? 'bg-[#457B9D] shadow-md shadow-[#457B9D]/30' : 'bg-[#1D3557]/10'
    } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const PatientSettings: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings>({
    smartwatchEnabled: false,
    enableRealTimeTracking: true,
    enableFormAnalysis: true
  });
  const [googleFitStatus, setGoogleFitStatus] = useState<GoogleFitStatus>({ connected: false, tokenValid: false });
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorModal, setErrorModal] = useState<ErrorModal>({ show: false, type: null, message: '' });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const handleToggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('http://localhost:5000/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data: SettingsResponse = await response.json();
        setSettings(data.settings);
        setGoogleFitStatus(data.googleFit);
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
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !settings.smartwatchEnabled })
      });
      const data = await response.json();
      if (response.ok) {
        setSettings(data.settings);
        setSuccessMessage(data.settings.smartwatchEnabled ? 'Smartwatch tracking enabled!' : 'Smartwatch tracking disabled');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        if (data.error === 'GOOGLE_FIT_NOT_CONNECTED') {
          setErrorModal({ show: true, type: 'GOOGLE_FIT_NOT_CONNECTED', message: data.message });
        } else if (data.error === 'TOKEN_EXPIRED') {
          setErrorModal({ show: true, type: 'TOKEN_EXPIRED', message: data.message });
        }
      }
    } catch (error) {
      alert('Failed to update setting. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  const handleConnectGoogleFit = () => {
    fetch('http://localhost:5000/google-fit/auth-url', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        const popup = window.open(data.authUrl, 'Google Fit Auth', 'width=600,height=700');
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'GOOGLE_FIT_CONNECTED') {
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
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            setTimeout(() => { fetchSettings(); setErrorModal({ show: false, type: null, message: '' }); }, 500);
            window.removeEventListener('message', handleMessage);
          }
        }, 500);
        setTimeout(() => { clearInterval(checkPopup); window.removeEventListener('message', handleMessage); }, 60000);
      })
      .catch(() => alert('Failed to initiate Google Fit connection'));
  };

  const handleDisconnectGoogleFit = async () => {
    try {
      setRefreshing(true);
      const response = await fetch('http://localhost:5000/google-fit/disconnect', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        setSuccessMessage('Google Fit disconnected');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      alert('Failed to disconnect Google Fit');
    } finally {
      setRefreshing(false);
      fetchSettings();
    }
  };

  const closeModal = () => setErrorModal({ show: false, type: null, message: '' });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1FAEE] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#A8DADC] border-t-[#1D3557] rounded-full animate-spin" />
          <p className="text-[#457B9D] font-bold text-sm uppercase tracking-widest">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans bg-[#F1FAEE] pb-20">

      {/* ── DEEP OCEAN HEADER ── */}
      <section className="relative w-full bg-gradient-to-br from-[#1D3557] via-[#1D3557] to-[#457B9D] px-6 py-12 md:px-12 md:py-16 overflow-hidden rounded-b-[3rem] shadow-2xl shadow-[#1D3557]/20 mb-10">
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#A8DADC]/10 via-transparent to-transparent z-0 opacity-80" />
        <div className="absolute inset-0 z-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(168,218,220,1) 1px, transparent 1px), linear-gradient(90deg, rgba(168,218,220,1) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="max-w-3xl mx-auto relative z-10">
          <button onClick={() => navigate('/patient')} className="flex items-center text-[#A8DADC] font-bold text-sm mb-6 hover:text-white transition-colors group">
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Settings size={28} className="text-[#F1FAEE]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-[#F1FAEE] tracking-tight">Settings</h1>
              <p className="text-[#A8DADC] text-lg mt-1">Manage your exercise tracking preferences.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-6 md:px-12 space-y-5">

        {/* Success toast */}
        {successMessage && (
          <div className="flex items-center gap-3 bg-[#A8DADC]/20 border border-[#A8DADC]/40 text-[#1D3557] px-5 py-4 rounded-2xl font-bold shadow-md animate-fadeIn">
            <CheckCircle size={20} className="text-[#457B9D] shrink-0" />
            {successMessage}
          </div>
        )}

        {/* ── Google Fit Card ── */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-[#1D3557]/[0.04] border border-[#1D3557]/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#457B9D]/10 border border-[#457B9D]/20 flex items-center justify-center text-[#457B9D]">
                {googleFitStatus.connected && googleFitStatus.tokenValid ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
              <div>
                <h2 className="font-black text-[#1D3557] text-[16px]">Google Fit Connection</h2>
                <p className="text-[#457B9D]/70 text-[12px] font-semibold">Connect your smartwatch for real-time exercise data</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${googleFitStatus.connected && googleFitStatus.tokenValid ? 'bg-[#A8DADC]/20 text-[#1D3557] border-[#A8DADC]/40' : 'bg-[#E63946]/10 text-[#E63946] border-[#E63946]/20'}`}>
                {googleFitStatus.connected && googleFitStatus.tokenValid
                  ? <><CheckCircle size={12} /> Connected</>
                  : <><XCircle size={12} /> Not Connected</>}
              </span>
              <button onClick={fetchSettings} disabled={refreshing} className="w-9 h-9 rounded-xl bg-[#F1FAEE] border border-[#A8DADC]/30 flex items-center justify-center text-[#457B9D] hover:bg-[#457B9D] hover:text-[#F1FAEE] transition-all" title="Refresh status">
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-3">
            {!googleFitStatus.connected && (
              <button onClick={handleConnectGoogleFit} className="w-full py-3.5 bg-[#457B9D] hover:bg-[#A8DADC] hover:text-[#1D3557] text-[#F1FAEE] rounded-2xl font-black text-[14px] uppercase tracking-widest shadow-lg shadow-[#457B9D]/20 transition-all hover:-translate-y-0.5">
                Connect Google Fit
              </button>
            )}
            {googleFitStatus.connected && !googleFitStatus.tokenValid && (
              <button onClick={handleConnectGoogleFit} className="w-full py-3.5 bg-[#1D3557] hover:bg-[#457B9D] text-[#F1FAEE] rounded-2xl font-black text-[14px] uppercase tracking-widest shadow-lg shadow-[#1D3557]/20 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5">
                <RefreshCw size={16} /> Refresh Connection
              </button>
            )}
            {googleFitStatus.connected && (
              <button onClick={handleDisconnectGoogleFit} disabled={refreshing} className="w-full py-3 border-2 border-[#E63946]/20 text-[#E63946] rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-[#E63946]/10 transition-all disabled:opacity-50">
                Disconnect Google Fit
              </button>
            )}
          </div>
        </div>

        {/* ── Smartwatch Tracking Card ── */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-[#1D3557]/[0.04] border border-[#1D3557]/5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#457B9D]/10 border border-[#457B9D]/20 flex items-center justify-center text-[#457B9D]">
                <Watch size={20} />
              </div>
              <div>
                <h3 className="font-black text-[#1D3557] text-[16px]">Smartwatch Tracking</h3>
                <p className="text-[#457B9D]/70 text-[12px] font-semibold">Enable real-time sensor data during exercises</p>
              </div>
            </div>
            <Toggle enabled={settings.smartwatchEnabled} onToggle={handleToggleSmartwatch} disabled={toggling} />
          </div>

          {settings.smartwatchEnabled ? (
            googleFitStatus.connected && googleFitStatus.tokenValid ? (
              <div className="flex items-start gap-3 bg-[#A8DADC]/15 border border-[#A8DADC]/30 rounded-2xl p-4">
                <CheckCircle size={18} className="text-[#457B9D] shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-[#1D3557]">
                  <span className="font-black">Active:</span> Your sessions will include real-time heart rate, movement, and form analysis.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 bg-[#E63946]/5 border border-[#E63946]/20 rounded-2xl p-4">
                <AlertCircle size={18} className="text-[#E63946] shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-[#1D3557]">
                  <span className="font-black">Warning:</span> Smartwatch enabled but Google Fit is not connected. Sessions will run in manual mode.
                </p>
              </div>
            )
          ) : (
            <div className="flex items-start gap-3 bg-[#F1FAEE] border border-[#A8DADC]/30 rounded-2xl p-4">
              <AlertCircle size={18} className="text-[#457B9D]/50 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-[#457B9D]/60">
                <span className="font-black text-[#1D3557]">Manual Mode:</span> Sessions will not collect sensor data. You can manually record exercise completion.
              </p>
            </div>
          )}
        </div>

        {/* ── Appearance Card ── */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-[#1D3557]/[0.04] border border-[#1D3557]/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#457B9D]/10 border border-[#457B9D]/20 flex items-center justify-center text-[#457B9D]">
                <Moon size={20} />
              </div>
              <div>
                <h3 className="font-black text-[#1D3557] text-[16px]">Dark Mode</h3>
                <p className="text-[#457B9D]/70 text-[12px] font-semibold">Switch interface to Navy/Teal dark theme</p>
              </div>
            </div>
            <Toggle enabled={isDark} onToggle={handleToggleTheme} />
          </div>
        </div>

        {/* ── Advanced Options Card ── */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-[#1D3557]/[0.04] border border-[#1D3557]/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-[#457B9D]/10 border border-[#457B9D]/20 flex items-center justify-center text-[#457B9D]">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-black text-[#1D3557] text-[16px]">Advanced Options</h3>
              <p className="text-[#457B9D]/70 text-[12px] font-semibold">System-level tracking configuration</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {[
              { label: 'Real-time Tracking', desc: 'Stream sensor data continuously', enabled: settings.enableRealTimeTracking },
              { label: 'Form Analysis', desc: 'Analyze exercise form and posture', enabled: settings.enableFormAnalysis },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between px-4 py-3.5 bg-[#F1FAEE] rounded-2xl border border-[#A8DADC]/20">
                <div>
                  <p className="text-[14px] font-black text-[#1D3557]">{item.label}</p>
                  <p className="text-[11px] text-[#457B9D]/60 font-semibold">{item.desc}</p>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${item.enabled ? 'bg-[#A8DADC]/20 text-[#1D3557] border-[#A8DADC]/40' : 'bg-[#F1FAEE] text-[#457B9D]/50 border-[#1D3557]/10'}`}>
                  {item.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Error Modal ── */}
      {errorModal.show && (
        <div className="fixed inset-0 bg-[#1D3557]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl shadow-[#1D3557]/20 max-w-md w-full p-8">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#E63946]/10 border border-[#E63946]/20 flex items-center justify-center shrink-0">
                <AlertCircle size={24} className="text-[#E63946]" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-[#1D3557] text-lg mb-2">Cannot Enable Smartwatch</h3>
                <p className="text-[#457B9D] font-medium text-sm mb-6">{errorModal.message}</p>
                <div className="flex gap-3">
                  {errorModal.type === 'GOOGLE_FIT_NOT_CONNECTED' && (
                    <button onClick={() => { handleConnectGoogleFit(); closeModal(); }} className="flex-1 py-3 bg-[#457B9D] hover:bg-[#A8DADC] hover:text-[#1D3557] text-[#F1FAEE] rounded-2xl font-black text-[13px] uppercase tracking-widest transition-all">
                      Connect Google Fit
                    </button>
                  )}
                  {errorModal.type === 'TOKEN_EXPIRED' && (
                    <button onClick={() => { handleConnectGoogleFit(); closeModal(); }} className="flex-1 py-3 bg-[#457B9D] hover:bg-[#A8DADC] hover:text-[#1D3557] text-[#F1FAEE] rounded-2xl font-black text-[13px] uppercase tracking-widest transition-all">
                      Reconnect
                    </button>
                  )}
                  <button onClick={closeModal} className="flex-1 py-3 bg-[#F1FAEE] border border-[#1D3557]/10 text-[#1D3557] rounded-2xl font-black text-[13px] uppercase tracking-widest hover:bg-[#A8DADC]/20 transition-all">
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
