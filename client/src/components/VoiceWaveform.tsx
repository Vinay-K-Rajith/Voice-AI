import { useEffect, useRef, useState } from "react";

interface VoiceWaveformProps {
  isActive: boolean;
  isSpeaking: boolean;
  color?: string;
}

const NUM_BARS = 40;

export function VoiceWaveform({ isActive, isSpeaking }: VoiceWaveformProps) {
  const [amplitudes, setAmplitudes] = useState<number[]>(Array(NUM_BARS).fill(0.12));
  const animRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      setAmplitudes(Array(NUM_BARS).fill(0.12));
      return;
    }

    const animate = (ts: number) => {
      timeRef.current = ts;
      const newAmps = Array.from({ length: NUM_BARS }, (_, i) => {
        if (!isSpeaking) {
          const idle = 0.12 + 0.08 * Math.sin(ts * 0.001 + i * 0.5);
          return idle;
        }
        const base = 0.2;
        const wave1 = 0.45 * Math.sin(ts * 0.003 + i * 0.38);
        const wave2 = 0.25 * Math.sin(ts * 0.005 + i * 0.6 + 1.2);
        const wave3 = 0.15 * Math.sin(ts * 0.002 + i * 0.22 + 2.4);
        const noise = 0.08 * Math.random();
        return Math.max(0.08, Math.min(1, base + wave1 + wave2 + wave3 + noise));
      });
      setAmplitudes(newAmps);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isActive, isSpeaking]);

  const barColors = [
    "#0ea5e9",
    "#38bdf8",
    "#10b981",
    "#34d399",
    "#3b82f6",
    "#60a5fa",
  ];

  return (
    <div className="flex items-center justify-center gap-[2px] sm:gap-[3px] h-16 sm:h-24" data-testid="voice-waveform">
      {amplitudes.map((amp, i) => {
        const colorIndex = Math.floor((i / NUM_BARS) * barColors.length);
        const color = barColors[Math.min(colorIndex, barColors.length - 1)];
        const maxHeight = window.innerWidth < 640 ? 60 : 80;
        const height = Math.round(amp * maxHeight);
        const opacity = isActive ? 0.7 + amp * 0.3 : 0.25;

        return (
          <div
            key={i}
            style={{
              width: window.innerWidth < 640 ? "2px" : "3px",
              height: `${height}px`,
              backgroundColor: color,
              borderRadius: "2px",
              opacity,
              transition: "height 0.06s ease-out, opacity 0.06s ease-out",
              minHeight: "3px",
            }}
            data-testid={`waveform-bar-${i}`}
          />
        );
      })}
    </div>
  );
}
