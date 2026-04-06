import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Palette } from 'lucide-react';

interface SettingsContext {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export default function SettingsPage() {
  const { darkMode, onToggleDarkMode } = useOutletContext<SettingsContext>();

  return (
    <div className="page-content">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-[14px]" style={{ color: 'var(--text-muted)' }}>Manage your account preferences</p>
      </div>

      <div 
        className="rounded-xl border p-5"
        style={{ 
          background: 'var(--bg-surface)', 
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Palette size={16} style={{ color: 'var(--accent)' }} />
          <h2 className="text-[16px] font-medium" style={{ color: 'var(--text-primary)' }}>Appearance</h2>
        </div>
        <p className="text-[13px] mb-6" style={{ color: 'var(--text-muted)' }}>
          Customise the look of your PhysioCheck dashboard
        </p>

        <div className="flex items-center justify-between py-3.5 border-b" style={{ borderColor: 'var(--border-default)' }}>
          <div>
            <div className="text-[14px] font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>
              Dark mode
            </div>
            <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
              Switch to a dark theme optimised for low-light environments
            </div>
          </div>
          
          <button 
            onClick={onToggleDarkMode}
            className="relative flex items-center shrink-0 cursor-pointer transition-colors"
            style={{
              width: '44px',
              height: '24px',
              borderRadius: '12px',
              background: darkMode ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <div 
              className="absolute bg-white rounded-full transition-all shadow-sm"
              style={{
                width: '18px',
                height: '18px',
                top: '3px',
                left: darkMode ? 'calc(100% - 21px)' : '3px',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
