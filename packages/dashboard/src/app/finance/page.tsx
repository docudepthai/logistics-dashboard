'use client';

import { useEffect, useState } from 'react';
import PageGuard from '../components/PageGuard';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

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
  lastMonthRevenue: number;
  monthlyGrowth: number;
  avgTransactionValue: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  totalTransactions: number;
  successRate: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  transactions: number;
}

interface WeeklyRevenue {
  week: string;
  revenue: number;
  transactions: number;
}

interface ConversionData {
  name: string;
  value: number;
  fill: string;
}

interface Charts {
  dailyRevenue: DailyRevenue[];
  weeklyRevenue: WeeklyRevenue[];
  conversionData: ConversionData[];
}

interface FinanceData {
  payments: Payment[];
  stats: Stats;
  charts: Charts;
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

function formatShortCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `₺${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `₺${(amount / 1000).toFixed(1)}K`;
  }
  return `₺${amount}`;
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl">
        <p className="text-neutral-400 text-xs mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-white text-sm font-medium">
            {entry.name}: {entry.name === 'revenue' ? formatCurrency(entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function FinancePageContent() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartView, setChartView] = useState<'daily' | 'weekly'>('daily');

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
    const interval = setInterval(fetchData, 60000);
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Finance</h1>
        <p className="text-neutral-500 text-sm mt-1">Track revenue, payments, and financial metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-5">
          <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{formatCurrency(data.stats.totalRevenue)}</p>
          <p className="text-neutral-500 text-xs mt-1">{data.stats.successCount} transactions</p>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-5">
          <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">{formatCurrency(data.stats.monthlyRevenue)}</p>
          <div className="flex items-center mt-1 space-x-1">
            <span className={`text-xs font-medium ${data.stats.monthlyGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.stats.monthlyGrowth >= 0 ? '↑' : '↓'} {Math.abs(data.stats.monthlyGrowth)}%
            </span>
            <span className="text-neutral-600 text-xs">vs last month</span>
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-5">
          <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Avg Transaction</p>
          <p className="text-2xl font-bold text-purple-400 mt-2">{formatCurrency(data.stats.avgTransactionValue)}</p>
          <p className="text-neutral-500 text-xs mt-1">per successful payment</p>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-5">
          <p className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Success Rate</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">{data.stats.successRate}%</p>
          <p className="text-neutral-500 text-xs mt-1">{data.stats.failedCount} failed</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Trend Chart */}
        <div className="lg:col-span-2 bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-white">Revenue Trend</h3>
              <p className="text-neutral-500 text-xs mt-1">Track your revenue over time</p>
            </div>
            <div className="flex bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setChartView('daily')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  chartView === 'daily' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setChartView('weekly')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  chartView === 'weekly' ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartView === 'daily' ? data.charts.dailyRevenue : data.charts.weeklyRevenue}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey={chartView === 'daily' ? 'date' : 'week'}
                  stroke="#52525b"
                  fontSize={11}
                  tickFormatter={(value) =>
                    chartView === 'daily'
                      ? new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
                      : value
                  }
                />
                <YAxis stroke="#52525b" fontSize={11} tickFormatter={(value) => formatShortCurrency(value)} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Status Pie Chart */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white">Payment Status</h3>
            <p className="text-neutral-500 text-xs mt-1">Distribution of payment outcomes</p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.conversionData.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {data.charts.conversionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 shadow-xl">
                          <p className="text-white text-sm font-medium">{d.name}</p>
                          <p className="text-neutral-400 text-xs">{d.value} transactions</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.charts.conversionData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                <span className="text-neutral-400 text-xs">{item.name}</span>
                <span className="text-white text-xs font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Transactions Chart */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <div className="mb-6">
          <h3 className="text-sm font-medium text-white">Daily Transactions</h3>
          <p className="text-neutral-500 text-xs mt-1">Number of successful payments per day</p>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                stroke="#52525b"
                fontSize={11}
                tickFormatter={(value) => new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
              />
              <YAxis stroke="#52525b" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-white">Recent Transactions</h3>
            <p className="text-neutral-500 text-xs mt-1">{data.stats.totalTransactions} total transactions</p>
          </div>
          {data.stats.pendingCount > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400">
              {data.stats.pendingCount} pending
            </span>
          )}
        </div>

        {data.payments.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 text-neutral-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-neutral-500">No transactions yet</p>
            <p className="text-neutral-600 text-sm mt-1">Payments will appear here when customers subscribe</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800/50">
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Customer</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Amount</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Date</th>
                  <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-6 py-3">Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.slice(0, 10).map((payment) => {
                  const badge = getStatusBadge(payment.status);
                  return (
                    <tr key={payment.merchantOid} className="border-b border-neutral-800/30 hover:bg-neutral-800/20 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-white">{formatPhoneNumber(payment.phoneNumber)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-white">{formatCurrency(payment.totalAmount || payment.amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bgColor} ${badge.textColor}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            payment.status === 'success' ? 'bg-emerald-400' :
                            payment.status === 'failed' ? 'bg-red-400' : 'bg-amber-400'
                          }`} />
                          {badge.text}
                        </span>
                        {payment.failReason && (
                          <p className="text-xs text-neutral-500 mt-1 max-w-xs truncate">{payment.failReason}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-neutral-400 text-sm">
                        {payment.paidAt ? formatDate(payment.paidAt) :
                         payment.failedAt ? formatDate(payment.failedAt) :
                         formatDate(payment.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs text-neutral-500">{payment.merchantOid.slice(0, 16)}...</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.payments.length > 10 && (
              <div className="px-6 py-4 border-t border-neutral-800/30 text-center">
                <span className="text-neutral-500 text-sm">Showing 10 of {data.payments.length} transactions</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinancePage() {
  return (
    <PageGuard permissionId="finance">
      <FinancePageContent />
    </PageGuard>
  );
}
