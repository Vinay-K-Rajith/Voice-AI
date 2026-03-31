import { useRef, useCallback, useEffect } from 'react';

interface UseAudioPlaybackProps {
  onPlaybackComplete?: () => void;
}

/**
 * Hook to play back audio received from the Gemini backend
 * 
 * Expected input: Base64 encoded 16-bit PCM audio at 24kHz (Gemini's voice output rate)
 * Properly decodes Int16 → Float32 and queues chunks for seamless playback
 */
export function useAudioPlayback({ onPlaybackComplete }: UseAudioPlaybackProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Initialize AudioContext on mount with 24kHz sample rate (Gemini's voice output)
  useEffect(() => {
    // 🎯 CRITICAL: Gemini's output voice is 24kHz, NOT 16kHz!
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    
    return () => {
      // Stop all active sources before closing context
      activeSourcesRef.current.forEach(source => {
        try {
          source.stop();
        } catch (err) {
          // Source might already be stopped, ignore error
        }
      });
      activeSourcesRef.current = [];
      audioContextRef.current?.close();
    };
  }, []);

  // Decode Base64 → Int16 → Float32 and queue for seamless playback
  const playAudio = useCallback(
    (base64Audio: string) => {
      try {
        if (!audioContextRef.current) {
          console.error('[AudioPlayback] AudioContext not initialized');
          return;
        }

        const ctx = audioContextRef.current;

        // Resume context if suspended (required on some browsers)
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        // STEP 1: Convert Base64 string → Raw binary bytes
        const binaryString = window.atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // STEP 2: View bytes as 16-bit signed integers (Gemini sends Int16 PCM)
        const int16Array = new Int16Array(bytes.buffer);

        // STEP 3: Convert Int16 → Float32 (what Web Audio API requires: -1.0 to 1.0)
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          // Divide by 32768 to normalize to [-1, 1] range
          float32Array[i] = int16Array[i] / 32768.0;
        }

        // STEP 4: Create AudioBuffer at 24kHz (Gemini's output rate)
        const audioBuffer = ctx.createBuffer(
          1, // 1 channel (mono)
          float32Array.length,
          24000 // 🎯 24kHz - Gemini's voice output sample rate
        );
        audioBuffer.getChannelData(0).set(float32Array);

        // STEP 5: Create source node and connect to speakers
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        // STEP 6: QUEUEING LOGIC - Seamless chunk playback
        // If the next play time is in the past, reset it to "now"
        if (nextPlayTimeRef.current < ctx.currentTime) {
          nextPlayTimeRef.current = ctx.currentTime;
        }

        // Schedule this chunk to start exactly when the previous one ends
        source.start(nextPlayTimeRef.current);

        // Update tracker for the next chunk
        nextPlayTimeRef.current += audioBuffer.duration;

        // Track this source so we can stop it later
        activeSourcesRef.current.push(source);

        // Notify when this chunk finishes
        source.onended = () => {
          // Remove from active sources when done
          activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
          
          // If we've passed all scheduled playback times, audio is completely done
          if (ctx.currentTime >= nextPlayTimeRef.current) {
            onPlaybackComplete?.();
          }
        };

        console.log(
          `[AudioPlayback] Queued chunk: ${bytes.length} bytes, duration: ${audioBuffer.duration.toFixed(3)}s, next play at: ${nextPlayTimeRef.current.toFixed(3)}s`
        );
      } catch (err) {
        console.error('[AudioPlayback] Failed to play audio:', err);
      }
    },
    [onPlaybackComplete]
  );

  const stopPlayback = useCallback(() => {
    // Stop ALL currently-playing audio sources immediately
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
      } catch (err) {
        // Source might already be stopped, that's fine
      }
    });
    // Clear the list
    activeSourcesRef.current = [];

    // Reset the queue time tracker
    nextPlayTimeRef.current = 0;
    console.log('[AudioPlayback] All playback stopped and queue reset');
  }, []);

  return {
    playAudio,
    stopPlayback,
  };
}
