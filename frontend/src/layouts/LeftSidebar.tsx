import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Dumbbell, UserPlus, Settings } from 'lucide-react';

interface LeftSidebarProps {
  collapsed: boolean;
}

export default function LeftSidebar({ collapsed }: LeftSidebarProps) {
  const navigate = useNavigate();
  const doctorName = localStorage.getItem("name") || "Doctor";
  const specialization = localStorage.getItem("specialization") || "Physiotherapist";

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', route: '/doctor', exact: true },
    { icon: Users, label: 'Patients', route: '/doctor/patients' },
    { icon: Calendar, label: 'Schedule', route: '/doctor/calendar' },
    { icon: Dumbbell, label: 'Create Exercise', route: '/doctor/create-exercise' },
    { icon: Settings, label: 'Settings', route: '/doctor/settings' },
  ];

  return (
    <aside 
      className={`left-sidebar ${collapsed ? 'collapsed' : ''}`}
      style={{ 
        background: 'var(--d-bg-sidebar)', 
        borderRight: '1px solid #2E5470',
        zIndex: 40
      }}
    >
      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.route}
            to={item.route}
            end={item.exact}
            className={({ isActive }) => 
              `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`
            }
            title={collapsed ? item.label : undefined}
            data-label={item.label}
          >
            <item.icon size={20} className="shrink-0" />
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}

        {/* Add patient button triggers the same route since dashboard currently uses navigate */}
        <button
          onClick={() => navigate('/doctor/add-patient')}
          className={`nav-item w-full text-left bg-transparent cursor-pointer ${collapsed ? 'collapsed' : ''}`}
          title={collapsed ? 'Add Patient' : undefined}
          data-label="Add Patient"
        >
          <UserPlus size={20} className="shrink-0" />
          {!collapsed && <span className="nav-label">Add Patient</span>}
        </button>
      </nav>

      <div className="mt-auto px-4 pb-4 w-full">
        <div className="h-px w-full my-4" style={{ background: 'var(--border-default)' }} />
        
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${doctorName}`} 
            alt="Doctor profile"
            className="w-7 h-7 rounded-full object-cover shrink-0 border"
            style={{ borderColor: 'var(--border-default)' }}
            title={collapsed ? `Dr. ${doctorName}` : undefined}
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-medium truncate" style={{ color: 'var(--d-accent-cream)' }}>
                Dr. {doctorName}
              </span>
              <span className="text-[11px] truncate" style={{ color: 'rgba(241, 250, 238, 0.65)' }}>
                {specialization}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
