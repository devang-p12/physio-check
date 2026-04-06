import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import PatientHeader from './PatientHeader';
import PatientSidebar from './PatientSidebar';
import { PatientGradientBg } from './PatientGradientBg';

export default function PatientLayout(): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="patient-shell">
      <PatientGradientBg />
      <PatientHeader onToggle={() => setCollapsed((p) => !p)} />
      <PatientSidebar collapsed={collapsed} />

      <main className={`patient-main ${collapsed ? 'collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}

