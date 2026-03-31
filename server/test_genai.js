import { GoogleGenAI, Modality } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.0-flash-exp';

async function main() {
  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: () => console.log('Opened'),
      onmessage: (msg) => console.log('Message:', JSON.stringify(msg)),
      onerror: (e) => console.error('Error:', e),
      onclose: (e) => console.log('Close:', e),
    },
    config: { systemInstruction: "Be brief." },
  });
  console.log("Session started.");
  
  session.sendRealtimeInput({
    audio: {
      data: Buffer.from("hello").toString('base64'),
      mimeType: 'audio/pcm;rate=16000'
    }
  });

  setTimeout(() => session.close(), 3000);
}

main().catch(console.error);