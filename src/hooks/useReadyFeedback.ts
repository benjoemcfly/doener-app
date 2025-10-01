'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useReadyFeedback() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Audio-Element vorbereiten (wenn vorhanden)
  useEffect(() => {
    const a = new Audio('/ready.mp3');
    a.preload = 'auto';
    audioRef.current = a;
  }, []);

  // Einmaliger User-Gesture zum Freischalten von Audio
  const enableSound = useCallback(async () => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (Ctx && !audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
        await audioCtxRef.current.resume(); // iOS/Android "unlock"
      }
      // Kurzer Play/Pause-"Kick", damit Browser Autoplay erlaubt
      if (audioRef.current) {
        await audioRef.current.play();
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setSoundEnabled(true);
    } catch {
      // Nicht schlimm – der Fallback-Beep funktioniert trotzdem
      setSoundEnabled(true);
    }
  }, []);

  // Fallback-Beep über Web Audio (falls MP3 nicht lädt oder blockiert ist)
  const beep = useCallback(() => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880; // A5-ish
      gain.gain.value = 0.001;
      osc.connect(gain).connect(ctx.destination);
      const now = ctx.currentTime;
      // kurzer "ding"
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      osc.start(now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc.stop(now + 0.42);
    } catch {}
  }, []);

  const trigger = useCallback(() => {
    // 1) Ton
    let kicked = false;
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        kicked = true;
      } catch { /* ignore */ }
    }
    if (!kicked) beep();

    // 2) Vibration (Android/Chrome sicher; iOS je nach System)
    try {
      navigator.vibrate?.([220, 80, 260]); // kurz–Pause–kurz
    } catch { /* ignore */ }
  }, [beep]);

  return { soundEnabled, enableSound, trigger };
}
