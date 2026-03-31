interface VoiceStatusBadgeProps {
  status: "idle" | "listening" | "speaking" | "processing";
}

const STATUS_CONFIG = {
  idle: {
    label: "Voice Mode Ready",
    dotColor: "bg-slate-400",
    textColor: "text-slate-400",
    bgColor: "bg-slate-400/10",
    borderColor: "border-slate-400/20",
    pulse: false,
  },
  listening: {
    label: "Listening...",
    dotColor: "bg-sky-400",
    textColor: "text-sky-400",
    bgColor: "bg-sky-400/10",
    borderColor: "border-sky-400/25",
    pulse: true,
  },
  speaking: {
    label: "Speaking",
    dotColor: "bg-emerald-400",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    borderColor: "border-emerald-400/25",
    pulse: true,
  },
  processing: {
    label: "Processing",
    dotColor: "bg-violet-400",
    textColor: "text-violet-400",
    bgColor: "bg-violet-400/10",
    borderColor: "border-violet-400/25",
    pulse: true,
  },
};

export function VoiceStatusBadge({ status }: VoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border text-xs sm:text-sm font-medium tracking-wide ${config.bgColor} ${config.borderColor} ${config.textColor}`}
      data-testid="voice-status-badge"
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotColor} opacity-60`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
      </span>
      {config.label}
    </div>
  );
}
