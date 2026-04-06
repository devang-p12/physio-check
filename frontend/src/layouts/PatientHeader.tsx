import React from 'react';
import { Activity, Bell, LogOut, Menu } from 'lucide-react';

type PatientHeaderProps = {
  onToggle: () => void;
};

function getInitials(name: string | null | undefined): string {
  const safe = (name ?? '').trim();
  if (!safe) return 'P';
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'P';
}

export default function PatientHeader({ onToggle }: PatientHeaderProps): React.ReactElement {
  const userName = localStorage.getItem('name') ?? 'Patient';
  const photoUrl = localStorage.getItem('photoUrl') ?? localStorage.getItem('profilePhoto');
  const unreadNotifications = Number(localStorage.getItem('unreadNotifications') ?? '0');

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{ height: 60, background: 'var(--p-header-bg)', borderBottom: '1px solid var(--p-border)' }}
    >
      <div className="h-[60px] px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="w-9 h-9 rounded-xl hover:bg-[var(--p-bg-hover)] transition flex items-center justify-center"
            aria-label="Toggle sidebar"
          >
            <Menu size={20} color="var(--p-blue)" />
          </button>

          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--p-navy)' }}>
            <Activity size={16} color="var(--p-cream)" />
          </div>
          <span className="text-[16px] font-semibold" style={{ color: 'var(--p-text-primary)' }}>
            PhysioCheck
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Bell size={18} color="var(--p-blue)" />
            {unreadNotifications > 0 && (
              <span
                className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style={{ background: 'var(--p-red)' }}
              />
            )}
          </div>

          <div className="w-px h-6" style={{ background: 'var(--p-border)' }} />

          <div className="flex items-center gap-2.5">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Avatar"
                className="w-9 h-9 rounded-full object-cover"
                style={{ border: '2px solid var(--p-mint)' }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold"
                style={{ background: 'var(--p-navy)', color: 'var(--p-cream)', border: '2px solid var(--p-mint)' }}
              >
                {getInitials(userName)}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[14px] font-medium" style={{ color: 'var(--p-text-primary)' }}>
                {userName}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              window.location.replace('/login');
            }}
            className="w-9 h-9 rounded-xl hover:bg-[var(--p-bg-hover)] transition flex items-center justify-center"
            aria-label="Logout"
          >
            <LogOut size={18} color="var(--p-blue)" />
          </button>
        </div>
      </div>
    </header>
  );
}

