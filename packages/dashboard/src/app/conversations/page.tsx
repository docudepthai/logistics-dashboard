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

interface CallListItem {
  phoneNumber: string;
  reason: string;
}

const CALL_REASONS = [
  'Kullanmadı',
  'Sistem arızası oluşmuş ve düzeltildi',
  'İş fonksiyonu kullanılmamış',
  'Şu araç var mı diyor ama bizde yok',
  'Deneme süresi ile ilgili soru',
  'Bilgilendirme için ara',
  'Yurtdışına sevkiyat var mı sorusu',
  'Şehir içi var mı sorusu',
  'Marketing için yazmış',
];

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callList, setCallList] = useState<Map<string, CallListItem>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCallList, setAddingToCallList] = useState<string | null>(null);
  const [showReasonDropdown, setShowReasonDropdown] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [convRes, callRes] = await Promise.all([
          fetch('/api/conversations'),
          fetch('/api/call-list'),
        ]);

        if (convRes.ok) {
          const data = await convRes.json();
          setConversations(data.conversations || []);
        }

        const map = new Map<string, CallListItem>();
        if (callRes.ok) {
          const data = await callRes.json();
          for (const item of data.items || []) {
            map.set(item.phoneNumber, item);
          }
          setCallList(map);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const isInCallList = (userId: string) => {
    return callList.has(userId);
  };

  const addToCallList = async (userId: string, reason: string) => {
    setAddingToCallList(userId);
    try {
      const res = await fetch('/api/call-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: userId, reason, autoAdded: false }),
      });
      if (res.ok) {
        setCallList(prev => new Map(prev).set(userId, { phoneNumber: userId, reason }));
      }
    } catch (err) {
      console.error('Failed to add to call list:', err);
    } finally {
      setAddingToCallList(null);
      setShowReasonDropdown(null);
    }
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
          {conversations.map((convo) => {
            const inCallList = isInCallList(convo.userId);

            return (
              <div key={convo.userId} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <button
                    onClick={() => setExpanded(expanded === convo.userId ? null : convo.userId)}
                    className="flex items-center space-x-4 flex-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center">
                      <span className="text-zinc-400 font-mono text-sm">{convo.userId.slice(-2)}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-white font-mono text-sm">+{convo.userId}</p>
                      <p className="text-zinc-500 text-xs">
                        {convo.messageCount} messages · {formatTimeAgo(convo.updatedAt)}
                      </p>
                    </div>
                  </button>

                  {/* Call List Actions */}
                  <div className="flex items-center space-x-3 ml-4">
                    {inCallList ? (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                        Aranacaklara eklendi
                      </span>
                    ) : (
                      <div className="relative">
                        {showReasonDropdown === convo.userId ? (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-2 min-w-[280px]">
                            <div className="text-xs text-zinc-400 px-2 py-1 mb-1">Arama nedeni seçin:</div>
                            {CALL_REASONS.map((reason) => (
                              <button
                                key={reason}
                                onClick={() => addToCallList(convo.userId, reason)}
                                disabled={addingToCallList === convo.userId}
                                className="w-full text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 rounded transition-colors"
                              >
                                {reason}
                              </button>
                            ))}
                            <button
                              onClick={() => setShowReasonDropdown(null)}
                              className="w-full text-left px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-700 rounded mt-1 border-t border-zinc-700"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowReasonDropdown(convo.userId)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded transition-colors"
                          >
                            + Aranacaklara Ekle
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded(expanded === convo.userId ? null : convo.userId)}
                    >
                      <svg
                        className={`w-5 h-5 text-zinc-500 transition-transform ${expanded === convo.userId ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

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
            );
          })}
        </div>
      )}
    </div>
  );
}
