/**
 * Audio Formatting Utilities
 * Converts browser audio (Float32, 48kHz) to Gemini format (16-bit PCM, 16kHz, Base64)
 */

/**
 * Convert Float32 audio samples to Int16 (16-bit) PCM
 * Browser audio comes in as Float32 [-1, 1], Gemini expects Int16 [-32768, 32767]
 */
export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2); // 2 bytes per sample
    const view = new DataView(buffer);
    let offset = 0;
    
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
        // Clamp float to [-1, 1] range
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        
        // Convert to 16-bit signed integer
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    
    return buffer;
}

/**
 * Convert binary buffer to Base64 string
 * Required for sending audio over JSON WebSocket messages
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    
    return window.btoa(binary);
}

/**
 * Downsample audio from one sample rate to another
 * Browser captures at 48kHz, Gemini needs 16kHz
 */
export function downsampleAudio(
    audioData: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
): Float32Array {
    if (fromSampleRate === toSampleRate) {
        return audioData;
    }
    
    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.round(audioData.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const p = Math.floor(i * ratio);
        result[i] = audioData[p];
    }
    
    return result;
}

/**
 * Complete pipeline: Float32 → Downsample → Int16 → Base64
 */
export function encodeAudioForGemini(
    float32Array: Float32Array,
    fromSampleRate: number = 48000,
    toSampleRate: number = 16000
): string {
    // Step 1: Downsample if needed
    const downsampled = downsampleAudio(float32Array, fromSampleRate, toSampleRate);
    
    // Step 2: Convert to 16-bit PCM
    const pcm16Buffer = floatTo16BitPCM(downsampled);
    
    // Step 3: Encode to Base64
    const base64Audio = arrayBufferToBase64(pcm16Buffer);
    
    return base64Audio;
}
