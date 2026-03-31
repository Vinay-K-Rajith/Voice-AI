import { GoogleGenAI, Modality } from '@google/genai';

export class GeminiLiveClient {
    private ai: GoogleGenAI;
    private session: any = null;
    public isReady: boolean = false;
    
    // Callbacks to send data back to your frontend
    public onAudioReceived: (base64Audio: string) => void = () => {};
    public onTurnComplete: () => void = () => {};
    public onError: (error: any) => void = () => {};
    public onReady: () => void = () => {}; // 🟢 Fires when Gemini completes setup

    constructor(apiKey: string) {
        // Initialize the official SDK
        this.ai = new GoogleGenAI({ apiKey: apiKey });
    }

    public async connect() {
        try {
            // The SDK automatically handles the URL, the wss:// connection, 
            // and the initial setup JSON message.
            this.session = await this.ai.live.connect({
                model: 'gemini-3.1-flash-live-preview',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Zephyr"
                            }
                        }
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log('✅ Connected to Gemini Live API');
                        this.isReady = true;
                        this.onReady(); // 🟢 Fire the Green Light to your frontend!
                    },
                    onmessage: (response: any) => {
                        const content = response.serverContent;
                        
                        // 1. Extract and route the audio chunks
                        if (content?.modelTurn?.parts) {
                            for (const part of content.modelTurn.parts) {
                                if (part.inlineData) {
                                    this.onAudioReceived(part.inlineData.data);
                                }
                            }
                        }

                        // 2. Detect when the AI has finished its current reply
                        if (content?.turnComplete) {
                            this.onTurnComplete();
                        }
                    },
                    onerror: (e: any) => {
                        console.error('🔴 Gemini WebSocket Error:', e.message);
                        this.isReady = false;
                        this.onError(e);
                    },
                    onclose: (e: any) => {
                        console.log('Gemini connection closed:', e.reason);
                        this.isReady = false;
                    }
                }
            });
        } catch (err) {
            console.error("Failed to connect to Gemini:", err);
            this.isReady = false;
            this.onError(err);
        }
    }

    public sendAudioChunk(pcmBase64Data: string) {
        if (!this.session || !this.isReady) {
            console.warn("Ignored audio chunk: Gemini is not ready yet.");
            return;
        }

        // The SDK formats the JSON payload for you
        this.session.sendRealtimeInput({
            audio: {
                data: pcmBase64Data,
                mimeType: 'audio/pcm;rate=16000'
            }
        });
    }

    public interruptModel() {
        if (!this.session || !this.isReady) return;
         
         // Forcefully stop the AI's current generation
         this.session.sendClientContent({ turnComplete: true });
    }

    public disconnect() {
        if (this.session) {
            this.isReady = false;
            try {
                this.session.close();
            } catch (err) {
                console.error("Error during session cleanup:", err);
            }
            this.session = null;
        }
    }
}