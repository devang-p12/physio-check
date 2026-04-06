import React from 'react';
import { Menu, Activity, Bell, LogOut } from 'lucide-react';

interface TopHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function TopHeader({ sidebarCollapsed, onToggleSidebar }: TopHeaderProps) {
  const doctorName = localStorage.getItem("name") || "Doctor";
  const specialization = localStorage.getItem("specialization") || "Physiotherapist";
  
  const handleLogout = () => {
    localStorage.clear();
    window.location.replace("/login");
  };

  const unreadCount = 0; // Stub, as there's no global notifications yet

  return (
    <header 
      className="fixed top-0 left-0 w-full h-[60px] z-50 flex items-center justify-between px-4 transition-colors"
      style={{ 
        background: 'var(--bg-header)', 
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="flex items-center gap-4 pl-1">
        <button 
          onClick={onToggleSidebar}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Menu size={20} />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded flex items-center justify-center text-white" style={{ background: 'var(--accent)' }}>
            <Activity size={18} strokeWidth={2.5} />
          </div>
          <span className="text-[17px] font-semibold" style={{ color: 'var(--accent)' }}>
            PhysioCheck
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          className="relative p-1.5 rounded transition-colors" 
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        
        <div className="w-px h-6" style={{ background: 'var(--border-default)' }} />
        
        <div className="flex items-center gap-2.5">
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctorName}`} 
            alt="Doctor profile"
            className="w-9 h-9 rounded-full object-cover border-2"
            style={{ borderColor: 'var(--accent)' }}
          />
          <div className="flex flex-col justify-center hidden sm:flex">
            <span className="text-[14px] font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
              Dr. {doctorName}
            </span>
            <span className="text-[12px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
              {specialization}
            </span>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="p-1.5 rounded transition-colors ml-2"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--danger-light)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
