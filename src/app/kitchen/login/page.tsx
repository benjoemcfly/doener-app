'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function KitchenLoginPage() {
  const [pin, setPin] = useState('');
  const router = useRouter();

  return (
    <div className="min-h-dvh grid place-items-center bg-emerald-50 p-4 text-gray-800">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">🥙</div>
          <div>
            <h1 className="text-lg font-semibold">Kitchen-Login</h1>
            <p className="text-xs text-gray-500">Nur für Mitarbeiter</p>
          </div>
        </div>

        <label className="mt-4 block text-sm">
          PIN
          <input
            type="password"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN eingeben"
          />
        </label>

        <button
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 text-white shadow disabled:opacity-50"
          onClick={() => {
            if (!pin) return;
            // Sichtbarkeits-Cookie für Middleware
            document.cookie = `kitchen=1; Max-Age=86400; Path=/; SameSite=Lax`;
            // PIN in Cookie speichern, damit der Client sie für Header lesen kann (MVP; nicht HttpOnly)
            document.cookie = `kpin=${encodeURIComponent(pin)}; Max-Age=86400; Path=/; SameSite=Lax`;
            router.replace('/kitchen');
          }}
          disabled={!pin}
        >
          Login
        </button>
      </div>
    </div>
  );
}
