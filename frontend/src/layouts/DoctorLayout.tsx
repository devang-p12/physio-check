import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopHeader from './TopHeader';
import LeftSidebar from './LeftSidebar';
import FloatingChatbot from './FloatingChatbot';
import RightStatsSidebar from './RightStatsSidebar';

function BackgroundBlobs() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--bg-page)' }}>
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'var(--blob-1)', filter: 'blur(80px)', borderRadius: '50%', animation: 'blobDrift1 22s ease-in-out infinite alternate' }} />
      <div style={{ position: 'absolute', top: '20%', right: '-20%', width: '60vw', height: '60vw', background: 'var(--blob-2)', filter: 'blur(100px)', borderRadius: '50%', animation: 'blobDrift2 26s ease-in-out infinite alternate' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '10%', width: '40vw', height: '40vw', background: 'var(--blob-3)', filter: 'blur(60px)', borderRadius: '50%', animation: 'blobDrift3 18s ease-in-out infinite alternate' }} />
    </div>
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
