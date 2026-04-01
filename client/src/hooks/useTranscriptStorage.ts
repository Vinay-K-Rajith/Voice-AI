export interface Transcript {
  id: string;
  timestamp: number;
  userMessage: string;
  aiResponse: string;
  duration: number; // in seconds
}

const STORAGE_KEY = "voice_transcripts";

export const useTranscriptStorage = () => {
  const getTranscripts = (): Transcript[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to get transcripts from storage:", error);
      return [];
    }
  };

  const saveTranscript = (userMessage: string, aiResponse: string, duration: number): Transcript => {
    try {
      const transcripts = getTranscripts();
      const newTranscript: Transcript = {
        id: `transcript_${Date.now()}`,
        timestamp: Date.now(),
        userMessage,
        aiResponse,
        duration,
      };
      
      transcripts.push(newTranscript);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transcripts));
      return newTranscript;
    } catch (error) {
      console.error("Failed to save transcript:", error);
      throw error;
    }
  };

  const deleteTranscript = (id: string): void => {
    try {
      let transcripts = getTranscripts();
      transcripts = transcripts.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transcripts));
    } catch (error) {
      console.error("Failed to delete transcript:", error);
      throw error;
    }
  };

  const deleteAllTranscripts = (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to delete all transcripts:", error);
      throw error;
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (isYesterday) {
      return `Yesterday at ${date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })}`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      }) as string;
    }
  };

  return {
    getTranscripts,
    saveTranscript,
    deleteTranscript,
    deleteAllTranscripts,
    formatDate,
  };
};
