// src/components/TwintPayButton.tsx
'use client';

import { useState } from 'react';

type Props = {
  orderId: string;
};

export function TwintPayButton({ orderId }: Props) {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payments/payrexx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });

      const json = await res.json();
      if (!res.ok || !json.redirectUrl) {
        console.error('Payrexx error', json);
        alert('Zahlung konnte nicht gestartet werden. Bitte später erneut versuchen.');
        return;
      }

      window.location.href = json.redirectUrl;
    } catch (err) {
      console.error(err);
      alert('Es ist ein Fehler bei der Zahlung aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePay}
      disabled={loading}
      className="w-full rounded-2xl bg-black px-4 py-3 text-center text-sm font-semibold text-white shadow-sm disabled:opacity-60"
    >
      {loading ? 'TWINT-Zahlung wird gestartet…' : 'Mit TWINT bezahlen'}
    </button>
  );
}
