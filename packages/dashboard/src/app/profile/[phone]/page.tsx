'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface UserProfile {
  phoneNumber: string;
  firstContactAt: string;
  freeTierExpiresAt: string;
  membershipStatus: 'free_trial' | 'expired' | 'premium';
  welcomeMessageSent: boolean;
  paidUntil?: string;
  paymentId?: string;
}

interface FrequentRoute {
  origin: string;
  destination?: string;
  count: number;
  lastSearched: string;
}

interface ConversationContext {
  lastOrigin?: string;
  lastDestination?: string;
  lastBodyType?: string;
  lastVehicleType?: string;
  // Learning fields
  frequentRoutes?: FrequentRoute[];
  totalSearches?: number;
  preferredVehicle?: string;
  firstSeen?: string;
}

interface Conversation {
  messages: Message[];
  context: ConversationContext;
  createdAt: string;
  updatedAt: string;
}

interface UserData {
  profile: UserProfile | null;
  conversation: Conversation | null;
}

function formatPhone(phone: string): string {
  if (phone.length === 12 && phone.startsWith('90')) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Fix truncated province names from old data (before suffix stripping bug was fixed)
const TRUNCATED_NAMES: Record<string, string> = {
  'ankar': 'ankara',
  'ispart': 'isparta',
  'antaly': 'antalya',
  'adан': 'adana',
  'malatyac': 'malatya',
  'samsun': 'samsun', // not truncated but keep for consistency
  'kony': 'konya',
  'afyonkarahisa': 'afyonkarahisar',
};

function fixProvinceName(name: string): string {
  if (!name) return name;
  const lower = name.toLowerCase();
  return TRUNCATED_NAMES[lower] || name;
}

function getHoursRemaining(lastMessageAt: string): number {
  const lastMsg = new Date(lastMessageAt).getTime();
  const now = Date.now();
  const hoursElapsed = (now - lastMsg) / (1000 * 60 * 60);
  return Math.max(0, 24 - hoursElapsed);
}

export default function UserProfilePage() {
  const params = useParams();
  const phone = params.phone as string;

  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/user-profile?phone=${phone}`);
        if (!res.ok) throw new Error('Failed to fetch user');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [phone]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-red-400 text-center py-20">
        {error || 'User not found'}
      </div>
    );
  }

  const { profile, conversation } = data;
  const messages = conversation?.messages || [];
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];
  const hoursRemaining = lastUserMessage ? getHoursRemaining(lastUserMessage.timestamp) : 0;
  const hasSearched = !!(conversation?.context?.lastOrigin || conversation?.context?.lastDestination);

  // Calculate unique search days
  const searchDays = new Set(messages.map(m => new Date(m.timestamp).toDateString())).size;

  // Status badge
  const statusConfig = {
    premium: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Premium' },
    free_trial: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Free Trial' },
    expired: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Expired' },
  };
  const status = statusConfig[profile?.membershipStatus || 'expired'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/users"
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight font-mono">
              {formatPhone(phone)}
            </h1>
            <div className="flex items-center space-x-3 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.text}`}>
                {status.label}
              </span>
              {profile?.firstContactAt && (
                <span className="text-neutral-500 text-sm">
                  Joined {getTimeAgo(profile.firstContactAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href={`https://wa.me/${phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors text-sm"
          >
            Message on WhatsApp
          </a>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs uppercase tracking-wider">Messages</div>
          <div className="text-2xl font-semibold text-white mt-1">{messages.length}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs uppercase tracking-wider">Active Days</div>
          <div className="text-2xl font-semibold text-white mt-1">{searchDays}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs uppercase tracking-wider">Searched</div>
          <div className={`text-2xl font-semibold mt-1 ${hasSearched ? 'text-emerald-400' : 'text-red-400'}`}>
            {hasSearched ? 'Yes' : 'No'}
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs uppercase tracking-wider">Last Route</div>
          <div className="text-lg font-semibold text-white mt-1 truncate">
            {conversation?.context?.lastOrigin
              ? `${fixProvinceName(conversation.context.lastOrigin)} → ${conversation.context.lastDestination ? fixProvinceName(conversation.context.lastDestination) : '?'}`
              : '-'}
          </div>
        </div>
        <div className={`border rounded-lg p-4 ${hoursRemaining > 6 ? 'bg-emerald-500/10 border-emerald-500/30' : hoursRemaining > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="text-neutral-500 text-xs uppercase tracking-wider">24h Window</div>
          <div className={`text-2xl font-semibold mt-1 ${hoursRemaining > 6 ? 'text-emerald-400' : hoursRemaining > 0 ? 'text-amber-400' : 'text-red-400'}`}>
            {hoursRemaining > 0 ? `${hoursRemaining.toFixed(1)}h left` : 'Closed'}
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: User Info */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">User Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-500 text-sm">Phone</span>
              <span className="text-white font-mono text-sm">{formatPhone(phone)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-500 text-sm">Status</span>
              <span className={`${status.text} text-sm`}>{status.label}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-500 text-sm">First Contact</span>
              <span className="text-white text-sm">{formatDate(profile?.firstContactAt || '')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-500 text-sm">Trial Expires</span>
              <span className="text-white text-sm">{formatDate(profile?.freeTierExpiresAt || '')}</span>
            </div>
            {profile?.paidUntil && (
              <div className="flex justify-between py-2 border-b border-neutral-800/50">
                <span className="text-neutral-500 text-sm">Paid Until</span>
                <span className="text-emerald-400 text-sm">{formatDate(profile.paidUntil)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-500 text-sm">Welcome Sent</span>
              <span className={profile?.welcomeMessageSent ? 'text-emerald-400 text-sm' : 'text-neutral-500 text-sm'}>
                {profile?.welcomeMessageSent ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-neutral-500 text-sm">Last Active</span>
              <span className="text-white text-sm">{conversation?.updatedAt ? getTimeAgo(conversation.updatedAt) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Right: Search Context */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Search Context</h2>
          {hasSearched ? (
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-neutral-800/50">
                <span className="text-neutral-500 text-sm">Last Origin</span>
                <span className="text-cyan-400 text-sm">{conversation?.context?.lastOrigin ? fixProvinceName(conversation.context.lastOrigin) : '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-800/50">
                <span className="text-neutral-500 text-sm">Last Destination</span>
                <span className="text-orange-400 text-sm">{conversation?.context?.lastDestination ? fixProvinceName(conversation.context.lastDestination) : '-'}</span>
              </div>
              {conversation?.context?.lastBodyType && (
                <div className="flex justify-between py-2 border-b border-neutral-800/50">
                  <span className="text-neutral-500 text-sm">Body Type</span>
                  <span className="text-white text-sm">{conversation.context.lastBodyType}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-neutral-500 text-sm py-8 text-center">
              User hasn't searched yet
            </div>
          )}
        </div>
      </div>

      {/* Learned Preferences */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-4">Learned Preferences</h2>
        {conversation?.context?.totalSearches || conversation?.context?.preferredVehicle || conversation?.context?.frequentRoutes?.length ? (
          <div className="space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-neutral-500 text-xs uppercase tracking-wider">Total Searches</div>
                <div className="text-xl font-semibold text-white mt-1">
                  {conversation?.context?.totalSearches || 0}
                </div>
              </div>
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-neutral-500 text-xs uppercase tracking-wider">Preferred Vehicle</div>
                <div className="text-xl font-semibold text-purple-400 mt-1">
                  {conversation?.context?.preferredVehicle || '-'}
                </div>
              </div>
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-neutral-500 text-xs uppercase tracking-wider">First Seen</div>
                <div className="text-sm font-medium text-white mt-1">
                  {conversation?.context?.firstSeen ? formatDate(conversation.context.firstSeen) : '-'}
                </div>
              </div>
            </div>

            {/* Frequent Routes */}
            {conversation?.context?.frequentRoutes && conversation.context.frequentRoutes.length > 0 && (
              <div>
                <div className="text-neutral-500 text-xs uppercase tracking-wider mb-2">Frequent Routes</div>
                <div className="space-y-2">
                  {conversation.context.frequentRoutes.slice(0, 5).map((route, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-neutral-800/30 rounded px-3 py-2"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-neutral-500 text-xs w-5">{idx + 1}.</span>
                        <span className="text-cyan-400 text-sm">{fixProvinceName(route.origin)}</span>
                        <span className="text-neutral-600">→</span>
                        <span className="text-orange-400 text-sm">{route.destination ? fixProvinceName(route.destination) : 'any'}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-white text-sm font-medium">{route.count}x</span>
                        <span className="text-neutral-500 text-xs">{getTimeAgo(route.lastSearched)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-neutral-500 text-sm py-8 text-center">
            No learned preferences yet - user needs to search more
          </div>
        )}
      </div>

      {/* Conversation History */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-4">
          Conversation History ({messages.length} messages)
        </h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="text-neutral-500 text-sm text-center py-8">No messages yet</div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-500/20 text-blue-100'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                  <div className="text-xs text-neutral-500 mt-1">
                    {formatDate(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
