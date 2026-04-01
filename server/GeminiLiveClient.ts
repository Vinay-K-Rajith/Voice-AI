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
    public onTranscript: (role: "user" | "ai", text: string) => void = () => {}; // 📝 New: Capture transcripts

    // 📝 Transcript buffering to balance between chunks and real-time display
    private userTranscriptBuffer = "";
    private aiTranscriptBuffer = "";
    private lastEmittedUserText = "";
    private lastEmittedAiText = "";
    private transcriptFlushTimeout: NodeJS.Timeout | null = null;
    private readonly TRANSCRIPT_FLUSH_DELAY = 300; // Flush every 300ms for responsive display of current speech

    constructor(apiKey: string) {
        // Initialize the official SDK
        this.ai = new GoogleGenAI({ apiKey: apiKey });
    }

    // 📝 Intelligently emit transcripts only when they're complete paragraphs
    private flushTranscripts() {
        // Emit user transcript if it has new content
        if (this.userTranscriptBuffer && this.userTranscriptBuffer !== this.lastEmittedUserText) {
            const trimmed = this.userTranscriptBuffer.trim();
            if (trimmed) {
                console.log(`📝 [FINAL USER] ${trimmed}`);
                this.onTranscript("user", trimmed);
                this.lastEmittedUserText = this.userTranscriptBuffer;
            }
        }

        // Emit AI transcript if it has new content
        if (this.aiTranscriptBuffer && this.aiTranscriptBuffer !== this.lastEmittedAiText) {
            const trimmed = this.aiTranscriptBuffer.trim();
            if (trimmed) {
                console.log(`📝 [FINAL AI] ${trimmed}`);
                this.onTranscript("ai", trimmed);
                this.lastEmittedAiText = this.aiTranscriptBuffer;
            }
        }
    }

    // 📝 Schedule a flush of accumulated transcripts
    private scheduleTranscriptFlush() {
        // Clear any existing timeout
        if (this.transcriptFlushTimeout) {
            clearTimeout(this.transcriptFlushTimeout);
        }

        // Schedule a new flush
        this.transcriptFlushTimeout = setTimeout(() => {
            this.flushTranscripts();
            this.transcriptFlushTimeout = null;
        }, this.TRANSCRIPT_FLUSH_DELAY);
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
                            // Flush any remaining buffered transcripts when turn completes
                            if (this.transcriptFlushTimeout) {
                                clearTimeout(this.transcriptFlushTimeout);
                                this.transcriptFlushTimeout = null;
                            }
                            this.flushTranscripts();
                            this.onTurnComplete();
                        }

                        // 3. 📝 Buffer and intelligently emit User Speech Transcripts
                        if (content?.inputTranscription?.text) {
                            const newText = content.inputTranscription.text;
                            console.log(`📝 [USER CHUNK] "${newText}"`);
                            
                            // Append to buffer (don't duplicate if same text)
                            if (!this.userTranscriptBuffer.includes(newText)) {
                                this.userTranscriptBuffer += (this.userTranscriptBuffer ? " " : "") + newText;
                            }
                            
                            // Schedule flush to collect more chunks
                            this.scheduleTranscriptFlush();
                        }

                        // 4. 📝 Buffer and intelligently emit AI Speech Transcripts
                        if (content?.outputTranscription?.text) {
                            const newText = content.outputTranscription.text;
                            console.log(`📝 [AI CHUNK] "${newText}"`);
                            
                            // Append to buffer (don't duplicate if same text)
                            if (!this.aiTranscriptBuffer.includes(newText)) {
                                this.aiTranscriptBuffer += (this.aiTranscriptBuffer ? " " : "") + newText;
                            }
                            
                            // Schedule flush to collect more chunks
                            this.scheduleTranscriptFlush();
                        }
                    },
                    onerror: (e: any) => {
                        console.error('🔴 Gemini WebSocket Error:', e.message);
                        this.isReady = false;
                        // Clean up buffers on error
                        if (this.transcriptFlushTimeout) {
                            clearTimeout(this.transcriptFlushTimeout);
                            this.transcriptFlushTimeout = null;
                        }
                        this.flushTranscripts();
                        this.userTranscriptBuffer = "";
                        this.aiTranscriptBuffer = "";
                        this.onError(e);
                    },
                    onclose: (e: any) => {
                        console.log('Gemini connection closed:', e.reason);
                        this.isReady = false;
                        // Clean up buffers on close
                        if (this.transcriptFlushTimeout) {
                            clearTimeout(this.transcriptFlushTimeout);
                            this.transcriptFlushTimeout = null;
                        }
                        this.flushTranscripts();
                        this.userTranscriptBuffer = "";
                        this.aiTranscriptBuffer = "";
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

            // Clean up any pending flushes
            if (this.transcriptFlushTimeout) {
                clearTimeout(this.transcriptFlushTimeout);
                this.transcriptFlushTimeout = null;
            }

            // Flush any remaining buffered transcripts
            this.flushTranscripts();

            // Reset buffers
            this.userTranscriptBuffer = "";
            this.aiTranscriptBuffer = "";
            this.lastEmittedUserText = "";
            this.lastEmittedAiText = "";
            try {
                this.session.close();
            } catch (err) {
                console.error("Error during session cleanup:", err);
            }
            this.session = null;
        }
    }
}