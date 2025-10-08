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

  // Optionaler Dateisound (/ready.mp3). Fallback ist WebAudio-Chime.
  useEffect(() => {
    try {
      const a = new Audio('/ready.mp3');
      a.preload = 'auto';
      audioRef.current = a;
    } catch {
      audioRef.current = null;
    }
  }, []);

  // Einmal per Nutzer-Geste aufrufen (Button/Tap). Weckt den AudioContext.
  const enableSound = useCallback(async () => {
    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? window.webkitAudioContext)
        : undefined;
    if (!Ctx) {
      setSoundEnabled(true);
      return;
    }

    try {
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      await audioCtxRef.current.resume();

      // Kurz anspielen & stoppen (manche Browser „primen“ so das Element)
      if (audioRef.current) {
        try {
          await audioRef.current.play();
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {
          // ignorieren – Fallback übernimmt später
        }
      }
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(true);
    }
  }, []);

  // Lauterer, gut hörbarer Chime: zwei kurze Akkorde
  const beep = useCallback(async () => {
    try {
      const Ctx =
        typeof window !== 'undefined'
          ? (window.AudioContext ?? window.webkitAudioContext)
          : undefined;
      if (!Ctx) return;

      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      try {
        await ctx.resume();
      } catch {}

      const playChord = (freqs: number[], start: number, dur = 0.42) => {
        const master = ctx.createGain();
        // Hüllkurve: schnell rein, schnell raus, etwas lauter als vorher
        master.gain.setValueAtTime(0.0001, start);
        master.gain.exponentialRampToValueAtTime(0.14, start + 0.03);
        master.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        master.connect(ctx.destination);

        freqs.forEach((f) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle'; // angenehmer als square, lauter als sine
          osc.frequency.value = f;
          g.gain.value = 1 / freqs.length; // Mischung
          osc.connect(g).connect(master);
          osc.start(start);
          osc.stop(start + dur);
        });
      };

      const now = (audioCtxRef.current ?? ctx).currentTime;
      // A5 (880), E6 (1319), A6 (1760)
      playChord([880, 1319, 1760], now, 0.45);
      // Danach etwas höher
      playChord([988, 1480, 1976], now + 0.25, 0.38);
    } catch {
      // ignore
    }
  }, []);

  // Spürbarere Vibration (Android)
  const vibrateStrong = useCallback(() => {
    try {
      // vibrieren – pause – vibrieren – pause – länger vibrieren
      navigator.vibrate?.([320, 60, 320, 60, 480]);
    } catch {
      /* ignore */
    }
  }, []);

  // Löst Sound + Vibration aus. Erst /ready.mp3 versuchen, sonst Chime.
  const trigger = useCallback(() => {
    const tryFile = () => {
      if (!audioRef.current) return false;
      try {
        audioRef.current.currentTime = 0;
        const p = audioRef.current.play();
        if (p && typeof (p as Promise<void>).then === 'function') {
          (p as Promise<void>).catch(() => {
            void beep();
          });
        }
        return true; // Versuch unternommen; Fallback ggf. im catch
      } catch {
        return false;
      }
    };

    const attempted = tryFile();
    if (!attempted) void beep();

    vibrateStrong();
  }, [beep, vibrateStrong]);

  return { soundEnabled, enableSound, trigger };
}
