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

  useEffect(() => {
    const a = new Audio('/ready.mp3'); // optional; Fallback-Beep ist integriert
    a.preload = 'auto';
    audioRef.current = a;
  }, []);

  const enableSound = useCallback(async () => {
    try {
      const Ctx = typeof window !== 'undefined'
        ? (window.AudioContext ?? window.webkitAudioContext)
        : undefined;

      if (Ctx && !audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
        await audioCtxRef.current.resume();
      }
      if (audioRef.current) {
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(true);
    }
  }, []);

  // Fallback-Beep per WebAudio
  const beep = useCallback(() => {
    try {
      const Ctx = typeof window !== 'undefined'
        ? (window.AudioContext ?? window.webkitAudioContext)
        : undefined;
      if (!Ctx) return;

      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5
      gain.gain.value = 0.001;
      osc.connect(gain).connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.stop(now + 0.42);
    } catch {
      // ignore
    }
  }, []);

  const trigger = useCallback(() => {
    let played = false;
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        const p = audioRef.current.play();
        if (p) p.catch(() => {});
        played = true;
      } catch {
        /* ignore */
      }
    }
    if (!played) beep();

    try {
      navigator.vibrate?.([220, 80, 260]);
    } catch {
      /* ignore */
    }
  }, [beep]);

  return { soundEnabled, enableSound, trigger };
}
