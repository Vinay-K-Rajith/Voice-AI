import { useState, useEffect } from "react";
import { X, Trash2, Trash } from "lucide-react";

interface TranscriptEntry {
  role: "user" | "ai";
  text: string;
  timestamp: number;
}

interface SavedChat {
  id: string;
  timestamp: Date;
  entries: TranscriptEntry[];
}

interface TranscriptsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TranscriptsModal = ({ isOpen, onClose }: TranscriptsModalProps) => {
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load all saved chats from localStorage on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      const chats: SavedChat[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("gemini_chat_")) {
          try {
            const rawData = localStorage.getItem(key);
            if (rawData) {
              const entries = JSON.parse(rawData) as TranscriptEntry[];
              // Extract timestamp from key (gemini_chat_YYYY-MM-DDTHH:mm:ss.sssZ)
              const dateStr = key.replace("gemini_chat_", "");
              chats.push({
                id: key,
                timestamp: new Date(dateStr),
                entries: entries,
              });
            }
          } catch (error) {
            console.error("Failed to parse chat:", error);
          }
        }
      }
      // Sort by timestamp descending (newest first)
      chats.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setSavedChats(chats);
    }
  }, [isOpen]);

  const handleDeleteChat = (id: string) => {
    localStorage.removeItem(id);
    setSavedChats(savedChats.filter((c) => c.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete all transcripts? This action cannot be undone.")) {
      for (const chat of savedChats) {
        localStorage.removeItem(chat.id);
      }
      setSavedChats([]);
    }
  };

  const formatDate = (date: Date): string => {
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
      });
    }
  };

  const getFirstUserMessage = (entries: TranscriptEntry[]): string => {
    const userEntry = entries.find((e) => e.role === "user");
    return userEntry ? userEntry.text : "(no user message)";
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/8">
            <h2 className="text-lg sm:text-2xl font-bold text-white">Conversation History</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white/90 transition-colors p-1.5 hover:bg-white/8 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {savedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-4 sm:px-6">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <span className="text-2xl sm:text-3xl">📝</span>
                </div>
                <p className="text-white/60 text-sm sm:text-base font-medium text-center">
                  No conversations yet
                </p>
                <p className="text-white/40 text-xs sm:text-sm text-center mt-2 max-w-xs">
                  Start a conversation to see your transcript history here
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-4 sm:p-6">
                {savedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className="bg-white/5 border border-white/8 rounded-lg overflow-hidden hover:bg-white/8 transition-colors"
                  >
                    {/* Chat Header - clickable */}
                    <button
                      className="w-full flex items-start justify-between p-3 sm:p-4 text-left"
                      onClick={() =>
                        setExpandedId(expandedId === chat.id ? null : chat.id)
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                            {formatDate(chat.timestamp)}
                          </span>
                          <span className="text-xs text-white/30">
                            • {chat.entries.length} messages
                          </span>
                        </div>
                        <p className="text-white/80 text-xs sm:text-sm line-clamp-1">
                          {getFirstUserMessage(chat.entries)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(chat.id);
                          }}
                          className="text-white/40 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded"
                          title="Delete transcript"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div
                          className={`text-white/40 transition-transform duration-300 ${
                            expandedId === chat.id ? "rotate-180" : ""
                          }`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 14l-7 7m0 0l-7-7m7 7V3"
                            />
                          </svg>
                        </div>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedId === chat.id && (
                      <div className="border-t border-white/8 px-3 sm:px-4 py-4 sm:py-5 bg-white/3 space-y-3">
                        {chat.entries.length === 0 ? (
                          <p className="text-white/40 text-xs sm:text-sm text-center py-4">
                            No messages in this conversation
                          </p>
                        ) : (
                          chat.entries.map((entry, idx) => (
                            <div key={idx}>
                              <p
                                className={`text-xs font-medium mb-2 uppercase tracking-widest ${
                                  entry.role === "user"
                                    ? "text-white/40"
                                    : "text-sky-400"
                                }`}
                              >
                                {entry.role === "user" ? "You" : "Entab AI"}
                              </p>
                              <p
                                className={`text-white/80 text-xs sm:text-sm leading-relaxed rounded-lg p-3 sm:p-4 border ${
                                  entry.role === "user"
                                    ? "bg-white/5 border-white/8"
                                    : "bg-sky-500/10 border-sky-400/15"
                                }`}
                              >
                                {entry.text || "(empty message)"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {savedChats.length > 0 && (
            <div className="border-t border-white/8 p-4 sm:p-6 flex gap-3">
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-400/20 text-red-400 text-xs font-medium transition-colors flex-1"
              >
                <Trash className="w-4 h-4" />
                Clear All
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/30 text-sky-400 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
