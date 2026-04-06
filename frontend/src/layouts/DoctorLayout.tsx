import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopHeader from './TopHeader';
import LeftSidebar from './LeftSidebar';
import FloatingChatbot from './FloatingChatbot';
import RightStatsSidebar from './RightStatsSidebar';

function BackgroundBlobs() {
  return (
    <>
      <div className="d-grad-mesh" />
      <div className="d-blob-1" />
      <div className="d-blob-2" />
      <div className="d-blob-3" />
    </>
  )
}

export default function DoctorLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('physiocheck-dark') === 'true'
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('physiocheck-dark', String(darkMode));
  }, [darkMode]);

  const location = useLocation();
  const showRightBar = location.pathname === '/doctor' || location.pathname === '/doctor/';

  return (
    <div className="doctor-shell relative">
      <BackgroundBlobs />
      <TopHeader 
        sidebarCollapsed={sidebarCollapsed} 
        onToggleSidebar={() => setSidebarCollapsed(p => !p)} 
      />
      
      <LeftSidebar collapsed={sidebarCollapsed} />
      {showRightBar && <RightStatsSidebar />}
      
      <main 
        className={`doctor-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        style={{ marginRight: showRightBar ? '280px' : '0px' }}
      >
        {/* Pass down darkMode toggles via context so SettingsPage can access them */}
        <Outlet context={{ darkMode, onToggleDarkMode: () => setDarkMode(p => !p) }} />
      </main>
      
      <FloatingChatbot 
        open={chatOpen} 
        onToggle={() => setChatOpen(p => !p)} 
      />
    </div>
  );
}
