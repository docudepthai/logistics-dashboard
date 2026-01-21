'use client';

import { useEffect, useState } from 'react';
import AuthLayout from '../components/AuthLayout';

interface User {
  phoneNumber: string;
  firstContactAt: string;
  freeTierExpiresAt: string;
  membershipStatus: 'free_trial' | 'expired' | 'premium';
  welcomeMessageSent: boolean;
  createdAt: string;
  updatedAt: string;
  paidUntil?: string;
  paymentId?: string;
  canViewPhones: boolean;
  daysRemaining: number | null;
}

interface Stats {
  total: number;
  freeTrial: number;
  expired: number;
  premium: number;
}

interface UsersData {
  users: User[];
  stats: Stats;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhoneNumber(phone: string): string {
  if (phone.length === 12 && phone.startsWith('90')) {
    // Format: 90 532 123 45 67
    return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

function getStatusColor(user: User): string {
  if (user.membershipStatus === 'premium' && user.canViewPhones) {
    return 'text-emerald-400';
  }
  if (user.membershipStatus === 'free_trial' && user.canViewPhones) {
    return 'text-blue-400';
  }
  return 'text-red-400';
}

function getStatusBadge(user: User): { text: string; bgColor: string; textColor: string } {
  if (user.membershipStatus === 'premium' && user.canViewPhones) {
    return { text: 'Premium', bgColor: 'bg-emerald-400/10', textColor: 'text-emerald-400' };
  }
  if (user.membershipStatus === 'free_trial' && user.canViewPhones) {
    return { text: 'Free Trial', bgColor: 'bg-blue-400/10', textColor: 'text-blue-400' };
  }
  return { text: 'Expired', bgColor: 'bg-red-400/10', textColor: 'text-red-400' };
}

export default function UsersPage() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <AuthLayout>
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white">Users</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage user subscriptions and free trials</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total Users</div>
                  <div className="text-3xl font-semibold text-white mt-1">{data.stats.total}</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Free Trial</div>
                  <div className="text-3xl font-semibold text-blue-400 mt-1">{data.stats.freeTrial}</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Expired</div>
                  <div className="text-3xl font-semibold text-red-400 mt-1">{data.stats.expired}</div>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                  <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Premium</div>
                  <div className="text-3xl font-semibold text-emerald-400 mt-1">{data.stats.premium}</div>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800/50">
                  <h2 className="text-sm font-medium text-white">All Users ({data.users.length})</h2>
                </div>

                {data.users.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500">
                    No users yet. Users will appear here when they message the bot.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800/50">
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Phone</th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Status</th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Days Left</th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Welcome Sent</th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">First Contact</th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Expires At</th>
                          <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Can View Phones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.users.map((user, index) => {
                          const badge = getStatusBadge(user);
                          return (
                            <tr
                              key={user.phoneNumber}
                              className="border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors"
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <td className="px-4 py-3">
                                <span className="font-mono text-sm text-white">
                                  {formatPhoneNumber(user.phoneNumber)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                                  {badge.text}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-sm ${user.daysRemaining === 0 ? 'text-red-400' : user.daysRemaining && user.daysRemaining <= 2 ? 'text-amber-400' : 'text-zinc-300'}`}>
                                  {user.daysRemaining !== null ? `${user.daysRemaining} days` : '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {user.welcomeMessageSent ? (
                                  <span className="text-emerald-400 text-sm">Yes</span>
                                ) : (
                                  <span className="text-zinc-500 text-sm">No</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-zinc-400 text-sm">
                                {formatDate(user.firstContactAt)}
                              </td>
                              <td className="px-4 py-3 text-zinc-400 text-sm">
                                {formatDate(user.freeTierExpiresAt)}
                              </td>
                              <td className="px-4 py-3">
                                {user.canViewPhones ? (
                                  <span className="inline-flex items-center space-x-1">
                                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                                    <span className="text-emerald-400 text-sm">Yes</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1">
                                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                                    <span className="text-red-400 text-sm">Masked</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </AuthLayout>
  );
}
