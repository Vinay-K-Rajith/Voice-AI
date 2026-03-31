import { useEffect, useRef } from "react";

interface VoiceOrbProps {
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
}

export function VoiceOrb({ isActive, isSpeaking, isListening }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Responsive sizing: use smaller size on mobile
    const SIZE = window.innerWidth < 640 ? 160 : 240;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    ctx.scale(dpr, dpr);

    const cx = SIZE / 2;
    const cy = SIZE / 2;

    const draw = (ts: number) => {
      timeRef.current = ts;
      ctx.clearRect(0, 0, SIZE, SIZE);

      const t = ts * 0.001;
      const activity = isActive ? 1 : 0;
      const speaking = isSpeaking ? 1 : 0;

      const baseRadius = SIZE < 200 ? 48 : 72;
      const pulse = activity * (speaking * 6 + 3) * Math.sin(t * 2.5);
      const radius = baseRadius + pulse;

      if (isActive) {
        const ringCount = 3;
        for (let r = 0; r < ringCount; r++) {
          const ringRadius = radius + 18 + r * 22;
          const ringAlpha = (0.18 - r * 0.05) * (0.6 + 0.4 * Math.sin(t * 1.8 + r));
          const ringGrad = ctx.createRadialGradient(cx, cy, ringRadius - 4, cx, cy, ringRadius + 4);
          const hue = 200 + r * 25 + speaking * 20;
          ringGrad.addColorStop(0, `hsla(${hue}, 85%, 60%, ${ringAlpha})`);
          ringGrad.addColorStop(1, `hsla(${hue}, 85%, 60%, 0)`);
          ctx.beginPath();
          ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = ringGrad;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      const orbGrad = ctx.createRadialGradient(cx - 18, cy - 18, 0, cx, cy, radius + 8);
      if (isActive) {
        if (isSpeaking) {
          orbGrad.addColorStop(0, "rgba(56, 189, 248, 0.95)");
          orbGrad.addColorStop(0.4, "rgba(14, 165, 233, 0.88)");
          orbGrad.addColorStop(0.7, "rgba(16, 185, 129, 0.8)");
          orbGrad.addColorStop(1, "rgba(59, 130, 246, 0.6)");
        } else {
          orbGrad.addColorStop(0, "rgba(56, 189, 248, 0.85)");
          orbGrad.addColorStop(0.5, "rgba(14, 165, 233, 0.75)");
          orbGrad.addColorStop(1, "rgba(59, 130, 246, 0.5)");
        }
      } else {
        orbGrad.addColorStop(0, "rgba(148, 163, 184, 0.5)");
        orbGrad.addColorStop(0.5, "rgba(100, 116, 139, 0.4)");
        orbGrad.addColorStop(1, "rgba(71, 85, 105, 0.3)");
      }

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      if (isActive && isSpeaking) {
        const wavePoints = 120;
        for (let layer = 0; layer < 2; layer++) {
          ctx.beginPath();
          const layerOffset = layer * Math.PI;
          for (let i = 0; i <= wavePoints; i++) {
            const angle = (i / wavePoints) * Math.PI * 2;
            const waveAmp = 5 + 3 * Math.sin(t * 3 + layer * 1.5);
            const freq1 = 5 + layer * 2;
            const freq2 = 7 + layer * 3;
            const wave =
              waveAmp *
              (Math.sin(angle * freq1 + t * 4 + layerOffset) * 0.6 +
                Math.sin(angle * freq2 + t * 2.5 + layerOffset) * 0.4);
            const r = radius + wave;
            const x = cx + r * Math.cos(angle);
            const y = cy + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          const alpha = 0.12 - layer * 0.04;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 1.5 - layer * 0.5;
          ctx.stroke();
        }
      }

      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius + 30);
      if (isActive) {
        const glowAlpha = 0.15 + speaking * 0.1 + 0.05 * Math.sin(t * 2);
        glowGrad.addColorStop(0, `rgba(14, 165, 233, ${glowAlpha})`);
        glowGrad.addColorStop(1, "rgba(14, 165, 233, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 30, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      const highlightGrad = ctx.createRadialGradient(cx - 24, cy - 28, 0, cx - 18, cy - 18, radius * 0.55);
      highlightGrad.addColorStop(0, isActive ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)");
      highlightGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = highlightGrad;
      ctx.fill();

      if (isActive && isListening) {
        const particleCount = 6;
        for (let p = 0; p < particleCount; p++) {
          const pAngle = (p / particleCount) * Math.PI * 2 + t * 0.8;
          const pDist = radius + 28 + 8 * Math.sin(t * 2 + p * 1.1);
          const px = cx + pDist * Math.cos(pAngle);
          const py = cy + pDist * Math.sin(pAngle);
          const pSize = 2 + 1.5 * Math.sin(t * 3 + p * 0.9);
          const pAlpha = 0.5 + 0.4 * Math.sin(t * 2.5 + p * 0.7);
          ctx.beginPath();
          ctx.arc(px, py, pSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(56, 189, 248, ${pAlpha})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isActive, isSpeaking, isListening]);

  return (
    <div className="relative flex items-center justify-center" data-testid="voice-orb">
      <canvas
        ref={canvasRef}
        className="drop-shadow-2xl"
      />
    </div>
  );
}
