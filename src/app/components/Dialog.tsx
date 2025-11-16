// --------------------------------
'use client';
import React, { useEffect } from 'react';


export function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
useEffect(() => {
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
window.addEventListener('keydown', onKey);
return () => window.removeEventListener('keydown', onKey);
}, [onClose]);


return (
<div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-3" role="dialog" aria-modal="true">
<div className="absolute inset-0" onClick={onClose} />
<div className="relative z-10 w-full max-w-md rounded-2xl border bg-white p-4 shadow-lg">{children}</div>
</div>
);
}