'use client';

import { useEffect, useState } from 'react';

interface ProblemConversation {
  userId: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  durationMinutes: number;
  problems: string[];
  severity: 'critical' | 'warning' | 'low';
  firstMessage: string;
  lastMessage: string;
  lastBotMessage: string;
  hasSearched: boolean;
  foundResults: boolean;
  context: {
    lastOrigin?: string;
    lastDestination?: string;
    lastJobIds?: string[];
    swearWarned?: boolean;
  };
}

interface Stats {
  total: number;
  critical: number;
  warning: number;
  low: number;
}

interface ApiResponse {
  conversations: ProblemConversation[];
  stats: Stats;
}

function formatPhone(phone: string): string {
  if (phone.length === 12 && phone.startsWith('90')) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('tr-TR');
}

const severityConfig = {
  critical: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    badge: 'bg-red-500',
    icon: '🔴',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    badge: 'bg-amber-500',
    icon: '🟡',
  },
  low: {
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/30',
    text: 'text-zinc-400',
    badge: 'bg-zinc-500',
    icon: '⚪',
  },
};

export default function ProblemsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'low'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/problem-conversations');
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-zinc-500 text-center py-20">Failed to load</div>
    );
  }

  const filtered = filter === 'all'
    ? data.conversations
    : data.conversations.filter(c => c.severity === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Problem Conversations</h1>
          <p className="text-zinc-500 text-sm mt-1">Users who may have had issues with the bot</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <span className="text-red-400 text-2xl font-bold">{data.stats.critical}</span>
            <span className="text-red-400 text-xs">Critical</span>
          </div>
          <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <span className="text-amber-400 text-2xl font-bold">{data.stats.warning}</span>
            <span className="text-amber-400 text-xs">Warning</span>
          </div>
          <div className="flex items-center space-x-2 bg-zinc-500/10 border border-zinc-500/30 rounded-lg px-3 py-2">
            <span className="text-zinc-400 text-2xl font-bold">{data.stats.low}</span>
            <span className="text-zinc-400 text-xs">Low</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        {(['all', 'critical', 'warning', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === f
                ? 'bg-white text-black font-medium'
                : 'bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            {f === 'all' ? `All (${data.stats.total})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${data.stats[f]})`}
          </button>
        ))}
      </div>

      {/* Conversations List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            {filter === 'all' ? 'No problem conversations detected' : `No ${filter} conversations`}
          </div>
        ) : (
          filtered.map((conv) => {
            const config = severityConfig[conv.severity];
            const isExpanded = expanded === conv.userId;

            return (
              <div
                key={conv.userId}
                className={`${config.bg} border ${config.border} rounded-lg overflow-hidden`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : conv.userId)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-lg">{config.icon}</span>
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="text-white font-mono text-sm">{formatPhone(conv.userId)}</span>
                        <span className="text-zinc-600 text-xs">{conv.messageCount} msgs</span>
                        <span className="text-zinc-600 text-xs">{formatTime(conv.updatedAt)}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        {conv.problems.map((p, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.text}`}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {conv.context.lastOrigin && (
                      <span className="text-zinc-500 text-xs">
                        {conv.context.lastOrigin} → {conv.context.lastDestination || '?'}
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-zinc-800/50 pt-3">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-zinc-500 text-xs mb-1">First message</div>
                        <div className="text-white text-sm bg-zinc-800/50 rounded p-2">
                          "{conv.firstMessage}"
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs mb-1">Last bot response</div>
                        <div className="text-zinc-300 text-sm bg-zinc-800/50 rounded p-2">
                          "{conv.lastBotMessage}"
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6 text-xs">
                      <div>
                        <span className="text-zinc-500">Duration:</span>
                        <span className="text-white ml-1">{conv.durationMinutes} min</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Searched:</span>
                        <span className={conv.hasSearched ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
                          {conv.hasSearched ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Found results:</span>
                        <span className={conv.foundResults ? 'text-emerald-400 ml-1' : 'text-red-400 ml-1'}>
                          {conv.foundResults ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {conv.context.swearWarned && (
                        <div className="text-red-400">⚠️ Swore at bot</div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center space-x-2">
                      <a
                        href={`https://wa.me/${conv.userId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors"
                      >
                        Message on WhatsApp
                      </a>
                      <a
                        href={`/conversations?search=${conv.userId}`}
                        className="px-3 py-1.5 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
                      >
                        View Full Conversation
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
