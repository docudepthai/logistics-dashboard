'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageGuard from '../components/PageGuard';

const ITEMS_PER_PAGE = 25;

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
  membershipStatus: 'free_trial' | 'expired' | 'premium' | 'unknown';
}

interface CallListItem {
  phoneNumber: string;
  reason: string;
}

const CALL_REASONS = [
  'System error occurred and was fixed',
  'Asking for vehicle we don\'t have',
  'Question about trial period',
  'Call for information',
  'Question about international shipping',
  'Question about intra-city shipping',
  'Marketing inquiry',
];

function ConversationsPageContent() {
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get('search') || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [callList, setCallList] = useState<Map<string, CallListItem>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCallList, setAddingToCallList] = useState<string | null>(null);
  const [showReasonDropdown, setShowReasonDropdown] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalConversations, setTotalConversations] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(searchFromUrl);
  const [searching, setSearching] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'free_trial' | 'expired' | 'premium'>('all');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  // Scroll messages container to bottom when conversation is expanded
  useEffect(() => {
    if (expanded && messagesContainerRef.current) {
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [expanded]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-expand if searching for specific user
  useEffect(() => {
    if (searchFromUrl && conversations.length === 1) {
      setExpanded(conversations[0].userId);
    }
  }, [searchFromUrl, conversations]);

  // Fetch conversations with server-side pagination
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const res = await fetch(`/api/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setTotalPages(data.totalPages || 1);
        setTotalConversations(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, [currentPage, debouncedSearch]);

  // Fetch call list separately (doesn't need pagination)
  const fetchCallList = useCallback(async () => {
    try {
      const res = await fetch('/api/call-list');
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, CallListItem>();
        for (const item of data.items || []) {
          map.set(item.phoneNumber, item);
        }
        setCallList(map);
      }
    } catch (error) {
      console.error('Failed to fetch call list:', error);
    }
  }, []);

  // Initial load only - runs once on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchConversations(), fetchCallList()]);
      setLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount

  // Refresh conversations when page or search changes (after initial load)
  useEffect(() => {
    if (loading) return; // Skip during initial load

    const doSearch = async () => {
      setSearching(true);
      await fetchConversations();
      setSearching(false);
    };
    doSearch();
  }, [currentPage, debouncedSearch, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      fetchCallList();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchCallList]);

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

  // Check if the last user message is within 24 hours
  const getMessageWindowStatus = (messages: Message[]): { canSend: boolean; hoursAgo: number | null } => {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return { canSend: false, hoursAgo: null };
    }
    const lastUserMessage = userMessages[userMessages.length - 1];
    const hoursAgo = (Date.now() - new Date(lastUserMessage.timestamp).getTime()) / (1000 * 60 * 60);
    return { canSend: hoursAgo <= 24, hoursAgo: Math.round(hoursAgo) };
  };

  // Send custom message to user
  const sendMessage = async (userId: string) => {
    if (!messageInput.trim()) return;

    setSendingMessage(userId);
    setSendError(null);
    setSendSuccess(null);

    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: userId, message: messageInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error || 'Failed to send message');
        return;
      }

      // Add message to local state
      setConversations(prev => prev.map(c => {
        if (c.userId === userId) {
          return {
            ...c,
            messages: [...c.messages, data.message],
            messageCount: c.messageCount + 1,
            updatedAt: data.message.timestamp,
          };
        }
        return c;
      }));

      setMessageInput('');
      setSendSuccess('Message sent!');

      // Scroll to bottom after adding message
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 100);

      // Clear success message after 3 seconds
      setTimeout(() => setSendSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError('Network error');
    } finally {
      setSendingMessage(null);
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
            {totalConversations} conversations
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 bg-neutral-800/50 rounded-lg p-1">
            {[
              { key: 'all', label: 'All' },
              { key: 'free_trial', label: 'Free Trial' },
              { key: 'expired', label: 'Expired' },
              { key: 'premium', label: 'Premium' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => {
                  setStatusFilter(key as typeof statusFilter);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  statusFilter === key
                    ? 'bg-white text-black'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Search Input */}
          <div className="relative">
          <input
            type="text"
            placeholder="Search by phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 px-3 py-1.5 pl-9 text-sm bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
          />
          {searching ? (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
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
      </div>

      {/* Conversations List */}
      {conversations.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-500">
            {searchQuery ? `No conversations found for "${searchQuery}"` : 'No conversations yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conversations.map((convo) => {
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
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/profile/${convo.userId}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-white font-mono text-sm hover:text-blue-400 transition-colors"
                        >
                          +{convo.userId}
                        </Link>
                        {convo.membershipStatus === 'premium' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-medium">
                            PREMIUM
                          </span>
                        )}
                        {convo.membershipStatus === 'free_trial' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                            FREE TRIAL
                          </span>
                        )}
                        {convo.membershipStatus === 'expired' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                            EXPIRED
                          </span>
                        )}
                      </div>
                      <p className="text-neutral-500 text-xs">
                        {convo.messageCount} messages · {formatTimeAgo(convo.updatedAt)}
                      </p>
                    </div>
                  </button>

                  {/* Call List Actions */}
                  <div className="flex items-center space-x-3 ml-4">
                    {inCallList ? (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                        Added to contact list
                      </span>
                    ) : (
                      <div className="relative">
                        {showReasonDropdown === convo.userId ? (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl p-2 min-w-[280px]">
                            <div className="text-xs text-neutral-400 px-2 py-1 mb-1">Select contact reason:</div>
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
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setShowReasonDropdown(convo.userId);
                              setExpanded(convo.userId);
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 px-3 py-1.5 rounded transition-colors"
                          >
                            + Add to Contact List
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
                  <>
                    <div
                      ref={messagesContainerRef}
                      className="px-6 py-4 border-t border-neutral-800/50 bg-black/20 max-h-[600px] overflow-y-auto"
                    >
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

                    {/* Send Message Input */}
                    {(() => {
                      const windowStatus = getMessageWindowStatus(convo.messages);
                      return (
                        <div className="px-6 py-3 border-t border-neutral-800/50 bg-neutral-900/50">
                          {windowStatus.canSend ? (
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                placeholder="Type a message to send..."
                                value={sendingMessage === convo.userId ? '' : messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage(convo.userId);
                                  }
                                }}
                                disabled={sendingMessage === convo.userId}
                                className="flex-1 px-4 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
                              />
                              <button
                                onClick={() => sendMessage(convo.userId)}
                                disabled={sendingMessage === convo.userId || !messageInput.trim()}
                                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white rounded-lg transition-colors flex items-center gap-2"
                              >
                                {sendingMessage === convo.userId ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-neutral-500 border-t-white rounded-full animate-spin" />
                                    Sending...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                    Send
                                  </>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-amber-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>
                                24 saat penceresi doldu.
                                {windowStatus.hoursAgo !== null && ` Son mesaj ${windowStatus.hoursAgo} saat once.`}
                              </span>
                            </div>
                          )}

                          {/* Error/Success messages */}
                          {sendError && expanded === convo.userId && (
                            <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {sendError}
                            </div>
                          )}
                          {sendSuccess && expanded === convo.userId && (
                            <div className="mt-2 text-sm text-emerald-400 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {sendSuccess}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
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

export default function ConversationsPage() {
  return (
    <PageGuard permissionId="conversations">
      <ConversationsPageContent />
    </PageGuard>
  );
}
