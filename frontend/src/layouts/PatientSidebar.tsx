import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  History,
  LayoutDashboard,
  MessageCircle,
  PlayCircle,
  Settings,
  UserSearch,
} from 'lucide-react';

type PatientSidebarProps = {
  collapsed: boolean;
};

type NavItem = {
  label: string;
  to: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/patient', icon: <LayoutDashboard size={18} className="p-nav-icon" /> },
  { label: 'Find Doctor', to: '/patient/doctors', icon: <UserSearch size={18} className="p-nav-icon" /> },
  { label: 'AI Assistant', to: '/patient/chatbot', icon: <MessageCircle size={18} className="p-nav-icon" /> },
  { label: 'History', to: '/patient/history', icon: <History size={18} className="p-nav-icon" /> },
  { label: "Open Plan", to: '/patient/todays-plan', icon: <PlayCircle size={18} className="p-nav-icon" /> },
  { label: 'Settings', to: '/patient/settings', icon: <Settings size={18} className="p-nav-icon" /> },
];

function getInitials(name: string | null | undefined): string {
  const safe = (name ?? '').trim();
  if (!safe) return 'P';
  const parts = safe.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'P';
}

export default function PatientSidebar({ collapsed }: PatientSidebarProps): React.ReactElement {
  const userName = localStorage.getItem('name') ?? 'Patient';
  const photoUrl = localStorage.getItem('photoUrl') ?? localStorage.getItem('profilePhoto');

  return (
    <aside
      className="fixed left-0 z-40 overflow-hidden flex flex-col"
      style={{
        top: 60,
        height: 'calc(100vh - 60px)',
        width: collapsed ? 64 : 240,
        background: 'var(--p-sidebar-bg)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        padding: '16px 0',
      }}
    >
      <nav className="flex flex-col">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            data-label={item.label}
            className={({ isActive }) =>
              `p-nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`
            }
          >
            {item.icon}
            {!collapsed && <span className="p-nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-4">
        <div className="mx-5" style={{ height: 1, background: 'rgba(168,218,220,0.2)' }} />

        {!collapsed && (
          <div className="px-5 pt-4 flex items-center gap-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Avatar"
                className="w-7 h-7 rounded-full object-cover"
                style={{ border: '2px solid var(--p-mint)' }}
              />
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                style={{ background: 'rgba(241,250,238,0.08)', color: 'var(--p-mint)', border: '1px solid rgba(168,218,220,0.35)' }}
              >
                {getInitials(userName)}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[13px] font-semibold" style={{ color: 'var(--p-mint)' }}>
                {userName}
              </div>
              <div className="text-[11px]" style={{ color: 'rgba(168,218,220,0.5)' }}>
                Patient
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

