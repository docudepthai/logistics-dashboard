'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ITEMS_PER_PAGE = 50;

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
  'Sistem arızası oluşmuş ve düzeltildi',
  'Şu araç var mı diyor ama bizde yok',
  'Deneme süresi ile ilgili soru',
  'Bilgilendirme için ara',
  'Yurtdışına sevkiyat var mı sorusu',
  'Şehir içi var mı sorusu',
  'Marketing için yazmış',
];

export default function ConversationsPage() {
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callList, setCallList] = useState<Map<string, CallListItem>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCallList, setAddingToCallList] = useState<string | null>(null);
  const [showReasonDropdown, setShowReasonDropdown] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchFromUrl);

  // Filter conversations by search
  const filteredConversations = searchQuery
    ? conversations.filter(c => c.userId.includes(searchQuery.replace(/\D/g, '')))
    : conversations;

  // Pagination calculations
  const totalPages = Math.ceil(filteredConversations.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedConversations = filteredConversations.slice(startIndex, endIndex);

  // Auto-expand if searching for specific user
  useEffect(() => {
    if (searchFromUrl && filteredConversations.length === 1) {
      setExpanded(filteredConversations[0].userId);
    }
  }, [searchFromUrl, filteredConversations]);

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
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Conversations</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {searchQuery ? `${filteredConversations.length} of ${conversations.length} conversations` : `${conversations.length} active conversations`}
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
          </p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by phone..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-64 px-3 py-1.5 pl-9 text-sm bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-500">
            {searchQuery ? `No conversations found for "${searchQuery}"` : 'No conversations yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedConversations.map((convo) => {
            const inCallList = isInCallList(convo.userId);

            return (
              <div key={convo.userId} className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between">
                  <button
                    onClick={() => setExpanded(expanded === convo.userId ? null : convo.userId)}
                    className="flex items-center space-x-4 flex-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center">
                      <span className="text-neutral-400 font-mono text-sm">{convo.userId.slice(-2)}</span>
                    </div>
                    <div className="text-left">
                      <Link
                        href={`/profile/${convo.userId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-white font-mono text-sm hover:text-blue-400 transition-colors"
                      >
                        +{convo.userId}
                      </Link>
                      <p className="text-neutral-500 text-xs">
                        {convo.messageCount} messages · {formatTimeAgo(convo.updatedAt)}
                      </p>
                    </div>
                  </button>

                  {/* Call List Actions */}
                  <div className="flex items-center space-x-3 ml-4">
                    {inCallList ? (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                        İletişime geçileceklere eklendi
                      </span>
                    ) : (
                      <div className="relative">
                        {showReasonDropdown === convo.userId ? (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2 min-w-[280px]">
                            <div className="text-xs text-neutral-400 px-2 py-1 mb-1">İletişim nedeni seçin:</div>
                            {CALL_REASONS.map((reason) => (
                              <button
                                key={reason}
                                onClick={() => addToCallList(convo.userId, reason)}
                                disabled={addingToCallList === convo.userId}
                                className="w-full text-left px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded transition-colors"
                              >
                                {reason}
                              </button>
                            ))}
                            <button
                              onClick={() => setShowReasonDropdown(null)}
                              className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-700 rounded mt-1 border-t border-neutral-700"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowReasonDropdown(convo.userId)}
                            className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded transition-colors"
                          >
                            + İletişime Geçileceklere Ekle
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setExpanded(expanded === convo.userId ? null : convo.userId)}
                    >
                      <svg
                        className={`w-5 h-5 text-neutral-500 transition-transform ${expanded === convo.userId ? 'rotate-180' : ''}`}
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
                  <div className="px-6 py-4 border-t border-neutral-800/50 bg-black/20 max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                      {convo.messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-white text-black'
                              : 'bg-neutral-800 text-neutral-200'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-neutral-500' : 'text-neutral-500'}`}>
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-6">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>

          {/* Page Numbers */}
          <div className="flex items-center space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                // Show first, last, current, and pages around current
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 2) return true;
                return false;
              })
              .map((page, idx, arr) => {
                // Add ellipsis if there's a gap
                const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1;
                return (
                  <span key={page} className="flex items-center">
                    {showEllipsisBefore && <span className="px-2 text-neutral-600">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 text-sm rounded transition-colors ${
                        currentPage === page
                          ? 'bg-white text-black font-medium'
                          : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
                      }`}
                    >
                      {page}
                    </button>
                  </span>
                );
              })}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Last
          </button>
        </div>
      )}
    </div>
  );
}
