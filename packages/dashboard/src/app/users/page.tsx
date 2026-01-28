'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageGuard from '../components/PageGuard';

const ITEMS_PER_PAGE = 50;

interface User {
  phoneNumber: string;
  firstContactAt: string;
  freeTierExpiresAt?: string; // Optional - only set when trial starts
  membershipStatus: 'free_trial' | 'expired' | 'premium';
  welcomeMessageSent: boolean;
  createdAt: string;
  updatedAt: string;
  paidUntil?: string;
  paymentId?: string;
  trialStartedAt?: string; // Set on first job search
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
    return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }
  return phone;
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

type SortOrder = 'asc' | 'desc';

function UsersPageContent() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // newest first by default

  const allUsers = data?.users || [];
  const filteredUsers = searchQuery.trim()
    ? allUsers.filter(user =>
        user.phoneNumber.includes(searchQuery.trim().replace(/\s+/g, '').replace(/^\+/, ''))
      )
    : allUsers;

  // Sort users by first contact date
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const dateA = new Date(a.firstContactAt).getTime();
    const dateB = new Date(b.firstContactAt).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(sortedUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = sortedUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        setData(await res.json());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
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
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Users</h1>
          <p className="text-neutral-500 text-sm mt-1">Manage user subscriptions and free trials</p>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-2xl font-semibold text-white">{data.stats.total}</div>
            <div className="text-neutral-500 text-xs">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-400">{data.stats.freeTrial}</div>
            <div className="text-neutral-500 text-xs">Trial</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-emerald-400">{data.stats.premium}</div>
            <div className="text-neutral-500 text-xs">Premium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-red-400">{data.stats.expired}</div>
            <div className="text-neutral-500 text-xs">Expired</div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800/50 flex items-center justify-between">
          <div className="text-sm text-neutral-400">
            {searchQuery ? `Found ${filteredUsers.length} of ${allUsers.length} users` : `${allUsers.length} users`}
            {totalPages > 1 && <span className="text-neutral-600"> · Page {currentPage} of {totalPages}</span>}
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by phone..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-64 px-3 py-1.5 pl-9 text-sm bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button onClick={() => handleSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {sortedUsers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            {searchQuery ? `No users found matching "${searchQuery}"` : 'No users yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800/50">
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Phone</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Days Left</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Welcome</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">
                    <button
                      onClick={toggleSortOrder}
                      className="flex items-center space-x-1 hover:text-white transition-colors"
                    >
                      <span>First Contact</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Expires</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Phones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => {
                  const badge = getStatusBadge(user);
                  return (
                    <tr key={user.phoneNumber} className="border-b border-neutral-800/30 hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/profile/${user.phoneNumber}`}
                          className="font-mono text-sm text-white hover:text-blue-400 transition-colors"
                        >
                          {formatPhoneNumber(user.phoneNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${user.daysRemaining === 0 ? 'text-red-400' : user.daysRemaining && user.daysRemaining <= 2 ? 'text-amber-400' : 'text-neutral-300'}`}>
                          {user.daysRemaining !== null ? `${user.daysRemaining} days` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={user.welcomeMessageSent ? 'text-emerald-400 text-sm' : 'text-neutral-500 text-sm'}>
                          {user.welcomeMessageSent ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-sm">{formatDate(user.firstContactAt)}</td>
                      <td className="px-4 py-3 text-neutral-400 text-sm">
                        {user.membershipStatus === 'premium' && user.paidUntil
                          ? formatDate(user.paidUntil)
                          : user.freeTierExpiresAt
                            ? formatDate(user.freeTierExpiresAt)
                            : <span className="text-neutral-600">Not started</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center space-x-1 ${user.canViewPhones ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-2 h-2 rounded-full ${user.canViewPhones ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                          <span className="text-sm">{user.canViewPhones ? 'Yes' : 'Masked'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 py-4 border-t border-neutral-800/50">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                .map((page, idx, arr) => (
                  <span key={page} className="flex items-center">
                    {idx > 0 && page - arr[idx - 1] > 1 && <span className="px-2 text-neutral-600">...</span>}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 text-sm rounded ${currentPage === page ? 'bg-white text-black font-medium' : 'text-neutral-400 hover:text-white hover:bg-neutral-700/50'}`}
                    >
                      {page}
                    </button>
                  </span>
                ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm text-neutral-400 hover:text-white bg-neutral-800/50 hover:bg-neutral-700/50 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <PageGuard permissionId="users">
      <UsersPageContent />
    </PageGuard>
  );
}
