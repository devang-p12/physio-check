import React from 'react';

export function PatientGradientBg(): React.ReactElement {
  return (
    <div className="patient-bg-layer" aria-hidden="true">
      <div className="p-grad-mesh" />
      <div className="p-blob p-blob-1" />
      <div className="p-blob p-blob-2" />
      <div className="p-blob p-blob-3" />
    </div>
  );
}

