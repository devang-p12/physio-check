import React, { useState, useEffect } from 'react';

export default function PageLoader({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(visible);

  useEffect(() => {
    if (!visible) {
      const t = setTimeout(() => setShow(false), 350);
      return () => clearTimeout(t);
    } else {
      setShow(true);
    }
  }, [visible]);

  if (!show) return null;

  return (
    <div className={`page-loader-overlay ${!visible ? 'fading' : ''}`}>
      <div className="loader-content">
        <div className="ambulance-track">
          {/* SVG Ambulance icon — simple side-view */}
          <div className="ambulance-vehicle text-teal-600 dark:text-teal-400" style={{ color: 'var(--accent)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="10" rx="2" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <polyline points="16 7 16 3 8 3 8 7" />
              <circle cx="6" cy="19" r="2" />
              <circle cx="18" cy="19" r="2" />
              <line x1="12" y1="8" x2="12" y2="10" strokeWidth="3" stroke="var(--danger)" />
              <line x1="11" y1="9" x2="13" y2="9" strokeWidth="3" stroke="var(--danger)" />
            </svg>
          </div>
          <div className="ambulance-road"></div>
        </div>
        <div className="loader-text font-semibold uppercase tracking-widest text-[#B08070]">Loading...</div>
      </div>
    </div>
  );
}
