import { useEffect, useRef, useCallback, useState } from 'react';
import { encodeAudioForGemini } from '@/lib/audioFormatter';

interface UseMicrophoneProps {
  onAudioChunk?: (base64Audio: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook to capture microphone audio and convert it to Gemini format (16kHz, 16-bit PCM, Base64)
 * 
 * Data flow:
 * 1. Browser mic captures at native sample rate (usually 48kHz or 44.1kHz)
 * 2. ScriptProcessor extracts raw audio
 * 3. Audio formatter downsamples to 16kHz and converts to 16-bit PCM
 * 4. Base64 encoded chunks are sent to backend via WebSocket
 */
export function useMicrophone({ onAudioChunk, onError }: UseMicrophoneProps) {
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    try {
      // Step 1: Request microphone with noise/echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Step 2: Create AudioContext (browser will capture at its native rate, typically 48kHz)
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      console.log(`[Microphone] Audio context sample rate: ${audioContext.sampleRate}Hz`);

      // Step 3: Connect microphone stream to audio graph
      const source = audioContext.createMediaStreamSource(stream);

      // Step 4: Create ScriptProcessor to intercept audio chunks
      // 4096 samples at ~48kHz = ~85ms per chunk (good balance between latency and CPU)
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // Step 5: Process each audio chunk
      processor.onaudioprocess = (event) => {
        // Get raw float32 audio from the microphone
        const float32Chunk = event.inputBuffer.getChannelData(0);
        
        // Convert to Gemini format: downsample to 16kHz, convert to 16-bit PCM, encode to Base64
        const base64Audio = encodeAudioForGemini(
          float32Chunk,
          audioContext.sampleRate,  // Browser sample rate (usually 48kHz)
          16000                       // Target sample rate for Gemini
        );

        // Send chunk to backend via WebSocket
        onAudioChunk?.(base64Audio);
      };

      // Step 6: Wire up the audio graph: mic → processor → destination
      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsRecording(true);
      console.log('[Microphone] Recording started - audio flowing to backend');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[Microphone] Access denied or error:', errorMessage);
      onError?.(errorMessage);
    }
  }, [onAudioChunk, onError]);

  const stopRecording = useCallback(() => {
    console.log('[Microphone] Stopping recording...');
    
    // Disconnect all audio nodes and close streams
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsRecording(false);
    console.log('[Microphone] Recording stopped');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    startRecording,
    stopRecording,
    isRecording,
  };
}
