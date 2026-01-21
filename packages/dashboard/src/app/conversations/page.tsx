'use client';

import { useEffect, useState } from 'react';

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface Conversation {
  userId: string;
  messages: Message[];
  context: { lastOrigin?: string; lastDestination?: string; lastBodyType?: string };
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/conversations');
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Conversations</h1>
        <p className="text-zinc-500 text-sm mt-1">{conversations.length} active conversations</p>
      </div>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500">No conversations yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((convo) => (
            <div key={convo.userId} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpanded(expanded === convo.userId ? null : convo.userId)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                    <span className="text-zinc-400 font-mono text-sm">{convo.userId.slice(-2)}</span>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-mono text-sm">+{convo.userId}</p>
                    <p className="text-zinc-500 text-xs">
                      {convo.messageCount} messages · {formatTimeAgo(convo.updatedAt)}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-zinc-500 transition-transform ${expanded === convo.userId ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Messages */}
              {expanded === convo.userId && (
                <div className="px-6 py-4 border-t border-zinc-800/50 bg-black/20 max-h-96 overflow-y-auto">
                  <div className="space-y-3">
                    {convo.messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-white text-black'
                            : 'bg-zinc-800 text-zinc-200'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
