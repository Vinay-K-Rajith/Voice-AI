import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, PhoneOff, Volume2, Settings, ChevronDown } from "lucide-react";
import { VoiceOrb } from "@/components/VoiceOrb";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import { VoiceStatusBadge } from "@/components/VoiceStatusBadge";
import { useVoiceWebSocket } from "@/hooks/useVoiceWebSocket";
import { useMicrophone } from "@/hooks/useMicrophone";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";

type VoiceStatus = "idle" | "listening" | "speaking" | "processing" | "connecting";
type VoicePhase = "inactive" | "active";

export default function VoicePage() {
  const [phase, setPhase] = useState<VoicePhase>("inactive");
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [sessionTime, setSessionTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [volume] = useState(78);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [wsError, setWsError] = useState<string>("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const microphoneStartedRef = useRef(false);

  // Setup WebSocket communication with GEMINI_READY gate
  const { 
    sendAudioChunk, 
    isConnected, 
    isGeminiReady,
  } = useVoiceWebSocket({
    onAudioReceived: (base64Audio) => {
      setStatus("speaking");
      playAudio(base64Audio);
    },
    onStatusChange: (message) => {
      if (message === "done_speaking") {
        setStatus("listening");
      }
    },
    onGeminiReady: () => {
      console.log("🟢 VoicePage: Gemini is ready!");
      setStatus("listening");
      // Microphone will auto-start once session is active and Gemini is ready
    },
    onError: (error) => {
      setWsError(error);
      console.error("WebSocket error:", error);
      setStatus("idle");
    },
  });

  // Setup microphone audio capture
  const { startRecording, stopRecording } = useMicrophone({
    onAudioChunk: (base64Audio) => {
      // Only send if:
      // 1. Connected to backend
      // 2. Gemini is ready
      // 3. Session is active
      if (isConnected && isGeminiReady && phase === "active") {
        sendAudioChunk(base64Audio);
      }
    },
    onError: (error) => {
      console.error("Microphone error:", error);
      setWsError(error);
    },
  });

  // Setup audio playback
  const { playAudio, stopPlayback } = useAudioPlayback({
    onPlaybackComplete: () => {
      // Audio finished playing
    },
  });

  // Auto-start microphone once both:
  // 1. Session is active
  // 2. Gemini is ready (GREEN LIGHT received)
  useEffect(() => {
    if (phase === "active" && isGeminiReady && !microphoneStartedRef.current) {
      console.log("🎤 Auto-starting microphone now that Gemini is ready");
      startRecording().catch(err => {
        console.error("Failed to start microphone:", err);
        setWsError("Failed to start microphone");
      });
      microphoneStartedRef.current = true;
    }
  }, [phase, isGeminiReady, startRecording]);

  const startSession = useCallback(async () => {
    // Don't start if not connected yet
    if (!isConnected) {
      setStatus("connecting");
      setWsError("Connecting to server...");
      // Wait a moment for connection
      setTimeout(() => {
        if (!isConnected) {
          setWsError("Connection timeout. Please refresh the page.");
        }
      }, 5000);
      return;
    }

    // Clear the flag for new session
    microphoneStartedRef.current = false;

    setPhase("active");
    setStatus(isGeminiReady ? "listening" : "connecting");
    setSessionTime(0);
    setTranscript("");
    setAiResponse("");
    setWsError("");

    timerRef.current = setInterval(() => {
      setSessionTime((t) => t + 1);
    }, 1000);
  }, [isConnected, isGeminiReady]);

  const endSession = useCallback(() => {
    setPhase("inactive");
    setStatus("idle");
    setTranscript("");
    setAiResponse("");
    microphoneStartedRef.current = false;
    stopRecording();
    stopPlayback();
    if (timerRef.current) clearInterval(timerRef.current);
  }, [stopRecording, stopPlayback]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopRecording();
      stopPlayback();
    };
  }, [stopRecording, stopPlayback]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const isActive = phase === "active";
  const isSpeaking = status === "speaking";
  const isListening = status === "listening";

  return (
    <div className="min-h-screen bg-animated-gradient relative overflow-hidden flex flex-col">
      {/* Ambient background blobs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute top-[-10%] left-[-5%] w-[50vw] h-[50vw] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)",
            animation: "orb1 12s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-5%] w-[55vw] h-[55vw] rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
            animation: "orb2 15s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-[40%] left-[60%] w-[30vw] h-[30vw] rounded-full opacity-6"
          style={{
            background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
            animation: "outerRing 18s ease-in-out infinite",
          }}
        />
      </div>

      {/* Top navigation */}
      <header className="relative z-10 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 flex-wrap gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white text-xs font-bold">E</span>
            </div>
            <span className="text-white font-semibold tracking-tight text-sm sm:text-lg">
              Entab <span className="gradient-text">AI</span>
            </span>
          </div>
          <div className="hidden sm:block w-px h-5 bg-white/20" />
          <span className="hidden sm:block text-white/50 text-sm font-medium">Voice Mode</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isActive && (
            <div
              className="text-sky-300 text-xs sm:text-sm font-mono tabular-nums px-2.5 sm:px-3 py-1 rounded-full bg-white/5 border border-white/10"
              data-testid="session-timer"
            >
              {formatTime(sessionTime)}
            </div>
          )}
          <button
            className="text-white/60 hover:text-white/90 transition-colors p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-white/8"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Connection Status & Error Messages */}
      <div className="relative z-10 px-3 sm:px-6">
        {!isConnected && (
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-yellow-500/10 border border-yellow-400/20 text-yellow-400 text-xs sm:text-sm">
            ⚠️ Connecting to server...
          </div>
        )}
        {wsError && (
          <div className="mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg sm:rounded-xl bg-red-500/10 border border-red-400/20 text-red-400 text-xs sm:text-sm">
            ❌ {wsError}
          </div>
        )}
      </div>

      {/* Settings panel */}
      {isSettingsOpen && (
        <div
          className="absolute top-12 sm:top-16 right-3 sm:right-6 z-20 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 w-48 sm:w-56 shadow-2xl animate-fade-in"
          data-testid="settings-panel"
        >
          <p className="text-white/80 text-xs sm:text-sm font-semibold mb-2 sm:mb-3">Settings</p>
          <div className="space-y-2 sm:space-y-3">
            <div>
              <p className="text-white/50 text-xs mb-1 sm:mb-1.5">Volume</p>
              <div className="flex items-center gap-2">
                <Volume2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-sky-400 flex-shrink-0" />
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full"
                    style={{ width: `${volume}%` }}
                  />
                </div>
                <span className="text-white/50 text-xs w-7">{volume}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-xs">Language</span>
              <span className="text-white/70 text-xs">English (US)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-xs">Voice</span>
              <span className="text-white/70 text-xs">Neural Pro</span>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center px-3 sm:px-6 gap-4 sm:gap-6 py-4 sm:py-0">

        {/* Status badge */}
        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <VoiceStatusBadge status={status === 'connecting' ? 'idle' : status} />
        </div>

        {/* Orb */}
        <div className="relative animate-slide-up w-32 h-32 sm:w-40 sm:h-40" style={{ animationDelay: "0.2s" }}>
          <VoiceOrb isActive={isActive} isSpeaking={isSpeaking} isListening={isListening} />
        </div>

        {/* Waveform */}
        <div
          className="w-full max-w-xs sm:max-w-sm px-2 animate-slide-up"
          style={{ animationDelay: "0.3s", opacity: isActive ? 1 : 0.35 }}
        >
          <VoiceWaveform isActive={isActive} isSpeaking={isSpeaking} />
        </div>

        {/* Transcript / AI response area */}
        {isActive && (
          <div className="w-full max-w-xs sm:max-w-md space-y-2 sm:space-y-3 animate-fade-in px-2">
            {transcript && (
              <div className="bg-white/5 backdrop-blur-sm border border-white/8 rounded-lg sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3">
                <p className="text-white/40 text-xs font-medium mb-1 uppercase tracking-widest">You</p>
                <p className="text-white/85 text-xs sm:text-sm leading-relaxed" data-testid="text-transcript">
                  {transcript}
                </p>
              </div>
            )}
            {aiResponse && isSpeaking && (
              <div className="bg-sky-500/10 backdrop-blur-sm border border-sky-400/15 rounded-lg sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3">
                <p className="text-sky-400 text-xs font-medium mb-1 uppercase tracking-widest">Entab AI</p>
                <p className="text-white/85 text-xs sm:text-sm leading-relaxed" data-testid="text-ai-response">
                  {aiResponse}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Inactive state message */}
        {!isActive && (
          <div className="text-center animate-fade-in space-y-2 mt-2 px-4">
            <h2 className="text-white text-lg sm:text-2xl font-semibold tracking-tight">
              Talk to Entab AI
            </h2>
            <p className="text-white/45 text-xs sm:text-sm max-w-xs leading-relaxed">
              Start a natural voice conversation. Ask questions, get answers, and collaborate in real-time.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 mt-2 sm:mt-4 animate-slide-up w-full sm:w-auto px-2 sm:px-0" style={{ animationDelay: "0.4s" }}>
          {!isActive ? (
            <button
              onClick={startSession}
              onTouchEnd={startSession}
              className="group relative flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-semibold text-white text-sm sm:text-base shadow-2xl overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95 animate-glow-pulse w-full sm:w-auto"
              style={{
                background: "linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #10b981 100%)",
                backgroundSize: "200% 200%",
              }}
              data-testid="button-start-talking"
            >
              <Mic className="w-4 sm:w-5 h-4 sm:h-5 flex-shrink-0" />
              Start Talking
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/10" />
            </button>
          ) : (
            <>
              <div className="flex gap-2 sm:gap-4 order-2 sm:order-1">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  onTouchEnd={() => setIsMuted(!isMuted)}
                  className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl border transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0 ${
                    isMuted
                      ? "bg-red-500/20 border-red-400/30 text-red-400"
                      : "bg-white/8 border-white/12 text-white/70 hover:text-white hover:bg-white/12"
                  }`}
                  data-testid="button-mute"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="w-4 sm:w-5 h-4 sm:h-5" /> : <Mic className="w-4 sm:w-5 h-4 sm:h-5" />}
                </button>

                <button
                  onClick={() => setShowTranscript(!showTranscript)}
                  onTouchEnd={() => setShowTranscript(!showTranscript)}
                  className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-white/8 border border-white/12 text-white/70 hover:text-white hover:bg-white/12 transition-all duration-300 hover:scale-105 active:scale-95 flex-shrink-0"
                  data-testid="button-transcript-toggle"
                  title="Toggle transcript"
                >
                  <ChevronDown
                    className={`w-4 sm:w-5 h-4 sm:h-5 transition-transform duration-300 ${showTranscript ? "rotate-180" : ""}`}
                  />
                </button>
              </div>

              <button
                onClick={endSession}
                onTouchEnd={endSession}
                className="flex items-center justify-center gap-1 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-lg sm:rounded-2xl font-semibold text-white text-xs sm:text-sm bg-red-500/20 border border-red-400/25 hover:bg-red-500/30 hover:border-red-400/40 transition-all duration-300 hover:scale-105 active:scale-95 w-full sm:w-auto order-1 sm:order-2 touch-none"
                data-testid="button-end-session"
              >
                <PhoneOff className="w-4 h-4 flex-shrink-0" />
                <span>End Session</span>
              </button>
            </>
          )}
        </div>

        {/* Feature hints when inactive */}
        {!isActive && (
          <div className="flex gap-2 sm:gap-4 flex-wrap justify-center mt-3 sm:mt-4 animate-fade-in px-2" style={{ animationDelay: "0.5s" }}>
            {[
              { icon: "🔊", label: "Natural voice" },
              { icon: "⚡", label: "Real-time AI" },
              { icon: "🔒", label: "Private & secure" },
            ].map((f) => (
              <div
                key={f.label}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/5 border border-white/8 text-white/55 text-xs font-medium"
              >
                <span className="text-sm">{f.icon}</span>
                <span className="hidden xs:inline">{f.label}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-2 sm:py-4 px-3">
        <p className="text-white/20 text-xs tracking-wide">
          Powered by <span className="text-white/35 font-medium">Entab AI</span>
        </p>
      </footer>
    </div>
  );
}
