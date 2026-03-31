import { GoogleGenAI, Modality } from '@google/genai';
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.0-flash-exp'; // Maybe 3.1 is not valid for their account, using 2.0-flash-exp just in case
const config = { responseModalities: [Modality.AUDIO] };

async function main() {
  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: () => console.log('Opened'),
      onmessage: (msg: any) => console.log('Message:', JSON.stringify(msg)),
      onerror: (e: any) => console.error('Error:', e),
      onclose: (e: any) => console.log('Close:', e),
    },
    config: config,
  });
  console.log("Session started. Wait 2 seconds then closing.");
  setTimeout(() => session.close(), 2000);
}

main().catch(console.error);