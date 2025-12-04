'use client';

import React, { useEffect, useState } from 'react';

export function GreenFlash({ durationMs }: { durationMs: number }) {
  const [off, setOff] = useState(false);

  useEffect(() => {
    const start = setTimeout(() => setOff(true), 50);
    return () => clearTimeout(start);
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-40 bg-emerald-200/60 transition-opacity ${
        off ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${durationMs}ms` }}
    />
  );
}

export default GreenFlash;
