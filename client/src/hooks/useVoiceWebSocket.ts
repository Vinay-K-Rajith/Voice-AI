import { useEffect, useRef, useCallback, useState } from 'react';

interface VoiceMessage {
  type: 'audio' | 'interrupt' | 'status' | 'error' | 'GEMINI_READY' | 'transcript';
  data?: string;
  message?: string;
  role?: 'user' | 'ai';
  text?: string;
}

interface UseVoiceWebSocketProps {
  onAudioReceived?: (base64Audio: string) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onGeminiReady?: () => void;
  onTranscript?: (role: 'user' | 'ai', text: string) => void;
}

/**
 * WebSocket hook for bidirectional voice communication with backend
 * 
 * 🟢 GREEN LIGHT PROTOCOL:
 * 1. Frontend connects to /api/ws
 * 2. Backend immediately starts Gemini connection
 * 3. When Gemini setup completes, backend sends { type: 'GEMINI_READY' }
 * 4. Frontend sets isGeminiReady = true
 * 5. Frontend can NOW safely start microphone and send audio
 * 
 * This prevents race conditions where audio is sent before Gemini is ready.
 */
export function useVoiceWebSocket({
  onAudioReceived,
  onStatusChange,
  onError,
  onGeminiReady,
  onTranscript,
}: UseVoiceWebSocketProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'open'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [isGeminiReady, setIsGeminiReady] = useState(false);

  // Store latest callbacks in refs so we don't re-create the socket
  const callbacksRef = useRef({
    onAudioReceived,
    onStatusChange,
    onError,
    onGeminiReady,
    onTranscript,
  });

  // Update refs when callbacks change (no dependency issues)
  useEffect(() => {
    callbacksRef.current = {
      onAudioReceived,
      onStatusChange,
      onError,
      onGeminiReady,
      onTranscript,
    };
  }, [onAudioReceived, onStatusChange, onError, onGeminiReady, onTranscript]);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Single useEffect with EMPTY dependency array - only runs on mount/unmount
  useEffect(() => {
    // Prevent duplicate connections
    if (connectionStateRef.current !== 'disconnected') {
      console.log('[VoiceWS] Already connecting or connected, skipping');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[VoiceWS] WebSocket already exists with state:', wsRef.current.readyState);
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/ws`;
      
      console.log(`[VoiceWS] Connecting to ${wsUrl}`);
      connectionStateRef.current = 'connecting';
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[VoiceWS] ✅ Connected to backend (waiting for Gemini...)');
        connectionStateRef.current = 'open';
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: VoiceMessage = JSON.parse(event.data);
          
          // 🟢 GREEN LIGHT: Backend says Gemini is ready
          if (message.type === 'GEMINI_READY') {
            console.log('[VoiceWS] 🟢 RECEIVED GREEN LIGHT - Gemini is ready!');
            setIsGeminiReady(true);
            callbacksRef.current.onGeminiReady?.();
            return;
          }
          
          if (message.type === 'audio' && message.data) {
            console.log(`[VoiceWS] 📢 Received audio chunk (${message.data.length} chars)`);
            callbacksRef.current.onAudioReceived?.(message.data);
          } else if (message.type === 'transcript' && message.role && message.text) {
            console.log(`[VoiceWS] 📝 Received transcript: [${message.role}] ${message.text.substring(0, 50)}...`);
            callbacksRef.current.onTranscript?.(message.role, message.text);
          } else if (message.type === 'status' && message.message) {
            console.log(`[VoiceWS] Status: ${message.message}`);
            callbacksRef.current.onStatusChange?.(message.message);
          } else if (message.type === 'error') {
            console.error(`[VoiceWS] Backend error: ${message.message}`);
            callbacksRef.current.onError?.(message.message || 'Backend error');
          }
        } catch (err) {
          console.error('[VoiceWS] Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('[VoiceWS] ❌ WebSocket error:', error);
        callbacksRef.current.onError?.('WebSocket connection error');
      };

      ws.onclose = () => {
        console.log('[VoiceWS] Disconnected from backend');
        connectionStateRef.current = 'disconnected';
        wsRef.current = null;
        setIsConnected(false);
        setIsGeminiReady(false);
        
        // Attempt to reconnect after delay
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          console.log(`[VoiceWS] Reconnecting... (attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS})`);
          setTimeout(() => {
            if (connectionStateRef.current === 'disconnected' && wsRef.current === null) {
              // Trigger a new connection by updating a trigger ref
              setIsConnected(false); // This will cause parent to retry
            }
          }, RECONNECT_DELAY);
        } else {
          console.error('[VoiceWS] Max reconnect attempts reached');
          callbacksRef.current.onError?.('Failed to reconnect to server');
        }
      };
    } catch (err) {
      console.error('[VoiceWS] Failed to create WebSocket:', err);
      connectionStateRef.current = 'disconnected';
      callbacksRef.current.onError?.('Failed to create WebSocket');
    }

    // Cleanup on unmount only
    return () => {
      console.log('[VoiceWS] Cleaning up WebSocket connection');
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
      wsRef.current = null;
      connectionStateRef.current = 'disconnected';
    };
  }, []); // ✅ EMPTY dependency array - only runs on mount/unmount

  const sendAudioChunk = useCallback((base64Audio: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[VoiceWS] Cannot send: WebSocket not open');
      return;
    }

    // Parent component (VoicePage) is responsible for checking isGeminiReady
    // before calling this function, so this is just a safety check
    wsRef.current.send(JSON.stringify({
      type: 'audio',
      data: base64Audio
    }));
  }, []); // Empty dependency array - function doesn't depend on any external state

  const interrupt = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
  }, []);

  return {
    isConnected,
    isGeminiReady,
    sendAudioChunk,
    interrupt,
  };
}

