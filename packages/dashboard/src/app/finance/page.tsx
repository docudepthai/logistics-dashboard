'use client';

import { useEffect, useState } from 'react';

interface Payment {
  merchantOid: string;
  phoneNumber: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
  paidAt?: string;
  failedAt?: string;
  failReason?: string;
  totalAmount?: number;
}

interface Stats {
  totalRevenue: number;
  monthlyRevenue: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  totalTransactions: number;
}

interface FinanceData {
  payments: Payment[];
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatPhoneNumber(phone: string): string {
  if (phone.length === 12 && phone.startsWith('90')) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 5)} ${phone.slice(5, 8)} ${phone.slice(8, 10)} ${phone.slice(10)}`;
  }
  return phone;
}

function getStatusBadge(status: string): { text: string; bgColor: string; textColor: string } {
  switch (status) {
    case 'success':
      return { text: 'Paid', bgColor: 'bg-emerald-400/10', textColor: 'text-emerald-400' };
    case 'failed':
      return { text: 'Failed', bgColor: 'bg-red-400/10', textColor: 'text-red-400' };
    default:
      return { text: 'Pending', bgColor: 'bg-amber-400/10', textColor: 'text-amber-400' };
  }
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/finance');
        if (!res.ok) throw new Error('Failed to fetch finance data');
        const json = await res.json();
        setData(json);
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

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Finance</h1>
          <p className="text-zinc-500 text-sm mt-1">Track payments and revenue</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Total Revenue</div>
                <div className="text-3xl font-semibold text-emerald-400 mt-1">
                  {formatCurrency(data.stats.totalRevenue)}
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">This Month</div>
                <div className="text-3xl font-semibold text-blue-400 mt-1">
                  {formatCurrency(data.stats.monthlyRevenue)}
                </div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Successful</div>
                <div className="text-3xl font-semibold text-emerald-400 mt-1">{data.stats.successCount}</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
                <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Failed</div>
                <div className="text-3xl font-semibold text-red-400 mt-1">{data.stats.failedCount}</div>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex justify-between items-center">
                <h2 className="text-sm font-medium text-white">
                  Transactions ({data.stats.totalTransactions})
                </h2>
                {data.stats.pendingCount > 0 && (
                  <span className="text-xs text-amber-400">
                    {data.stats.pendingCount} pending
                  </span>
                )}
              </div>

              {data.payments.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  No transactions yet. Payments will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800/50">
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Phone</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Amount</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Created</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.map((payment, index) => {
                        const badge = getStatusBadge(payment.status);
                        return (
                          <tr
                            key={payment.merchantOid}
                            className="border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-sm text-white">
                                {formatPhoneNumber(payment.phoneNumber)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-white">
                                {formatCurrency(payment.totalAmount || payment.amount)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                                {badge.text}
                              </span>
                              {payment.failReason && (
                                <span className="block text-xs text-zinc-500 mt-1">
                                  {payment.failReason}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-400 text-sm">
                              {formatDate(payment.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-zinc-400 text-sm">
                              {payment.paidAt ? formatDate(payment.paidAt) :
                               payment.failedAt ? formatDate(payment.failedAt) : '-'}
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
  );
}
