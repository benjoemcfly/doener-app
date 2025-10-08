'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export function useReadyFeedback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Optionaler Dateisound (wenn /ready.mp3 fehlt, fällt alles auf Beep zurück)
  useEffect(() => {
    try {
      const a = new Audio('/ready.mp3');
      a.preload = 'auto';
      audioRef.current = a;
    } catch {
      audioRef.current = null;
    }
  }, []);

  // Einmalig durch User-Geste aufrufen (Klick/Tap). Startet/ent-sperrt den AudioContext.
  const enableSound = useCallback(async () => {
    const Ctx = typeof window !== 'undefined' ? (window.AudioContext ?? window.webkitAudioContext) : undefined;
    if (!Ctx) {
      setSoundEnabled(true);
      return;
    }

    try {
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      await audioCtxRef.current.resume();

      // Versuche kurz die Datei zu spielen (sofern vorhanden), stoppe sofort wieder
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {
          // Ignorieren – Fallback übernimmt später
        }
      }
      setSoundEnabled(true);
    } catch {
      // Letzter Ausweg: trotzdem als enabled markieren – Beep wird's später versuchen
      setSoundEnabled(true);
    }
  }, []);

  // Fallback-Beep per WebAudio (funktioniert auch ohne /ready.mp3)
  const beep = useCallback(async () => {
    try {
      const Ctx = typeof window !== 'undefined' ? (window.AudioContext ?? window.webkitAudioContext) : undefined;
      if (!Ctx) return;

      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      // Sicherstellen, dass der Context läuft
      try { await ctx.resume(); } catch {}

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5

      // Hüllkurve – ausreichend laut aber kurz
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    } catch {
      // ignore – manche Browser ohne Audio
    }
  }, []);

  // Löst Sound + Vibration aus. Nutzt Datei, fällt zuverlässig auf Beep zurück.
  const trigger = useCallback(() => {
    const tryFile = () => {
      if (!audioRef.current) return false;
      try {
        audioRef.current.currentTime = 0;
        const p = audioRef.current.play();
        if (p && typeof (p as Promise<void>).then === 'function') {
          (p as Promise<void>).catch(() => { void beep(); });
        }
        return true; // Versuch wurde unternommen – Beep wird ggf. im Catch ausgelöst
      } catch {
        return false;
      }
    };

    const attempted = tryFile();
    if (!attempted) void beep();

    try { navigator.vibrate?.([220, 80, 260]); } catch {}
  }, [beep]);

  return { soundEnabled, enableSound, trigger };
}
