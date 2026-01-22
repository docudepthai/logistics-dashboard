'use client';

import { useEffect, useState } from 'react';
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
  Legend,
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

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-zinc-400 text-xs mb-1">{label}</p>
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

// Stat card component
function StatCard({
  title,
  value,
  subValue,
  trend,
  trendLabel,
  icon,
  color = 'emerald',
}: {
  title: string;
  value: string;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  color?: 'emerald' | 'blue' | 'amber' | 'red' | 'purple';
}) {
  const colorClasses = {
    emerald: 'text-emerald-400 bg-emerald-400/10',
    blue: 'text-blue-400 bg-blue-400/10',
    amber: 'text-amber-400 bg-amber-400/10',
    red: 'text-red-400 bg-red-400/10',
    purple: 'text-purple-400 bg-purple-400/10',
  };

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-5 hover:border-zinc-700/50 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wider">{title}</p>
          <p className={`text-2xl font-bold mt-2 ${colorClasses[color].split(' ')[0]}`}>{value}</p>
          {subValue && <p className="text-zinc-500 text-xs mt-1">{subValue}</p>}
          {trend !== undefined && (
            <div className="flex items-center mt-2 space-x-1">
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </span>
              {trendLabel && <span className="text-zinc-600 text-xs">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color].split(' ')[1]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function FinancePage() {
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
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Finance Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-1">Track revenue, payments, and financial metrics</p>
          </div>
          <div className="flex items-center space-x-2 text-xs text-zinc-500">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span>Live</span>
          </div>
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
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                title="Total Revenue"
                value={formatCurrency(data.stats.totalRevenue)}
                subValue={`${data.stats.successCount} transactions`}
                icon={
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="emerald"
              />
              <StatCard
                title="This Month"
                value={formatCurrency(data.stats.monthlyRevenue)}
                trend={data.stats.monthlyGrowth}
                trendLabel="vs last month"
                icon={
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                }
                color="blue"
              />
              <StatCard
                title="Avg Transaction"
                value={formatCurrency(data.stats.avgTransactionValue)}
                subValue="per successful payment"
                icon={
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                }
                color="purple"
              />
              <StatCard
                title="Success Rate"
                value={`${data.stats.successRate}%`}
                subValue={`${data.stats.failedCount} failed`}
                icon={
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                color="amber"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Revenue Trend Chart */}
              <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-medium text-white">Revenue Trend</h3>
                    <p className="text-zinc-500 text-sm">Track your revenue over time</p>
                  </div>
                  <div className="flex bg-zinc-800 rounded-lg p-1">
                    <button
                      onClick={() => setChartView('daily')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        chartView === 'daily'
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Daily
                    </button>
                    <button
                      onClick={() => setChartView('weekly')}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        chartView === 'weekly'
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-400 hover:text-white'
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
                      <YAxis
                        stroke="#52525b"
                        fontSize={11}
                        tickFormatter={(value) => formatShortCurrency(value)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payment Status Pie Chart */}
              <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6">
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-white">Payment Status</h3>
                  <p className="text-zinc-500 text-sm">Distribution of payment outcomes</p>
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
                            const data = payload[0].payload;
                            return (
                              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 shadow-xl">
                                <p className="text-white text-sm font-medium">{data.name}</p>
                                <p className="text-zinc-400 text-xs">{data.value} transactions</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {data.charts.conversionData.map((item) => (
                    <div key={item.name} className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="text-zinc-400 text-xs">{item.name}</span>
                      <span className="text-white text-xs font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Transactions per Day Chart */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6 mb-8">
              <div className="mb-6">
                <h3 className="text-lg font-medium text-white">Daily Transactions</h3>
                <p className="text-zinc-500 text-sm">Number of successful payments per day</p>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis
                      dataKey="date"
                      stroke="#52525b"
                      fontSize={11}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
                      }
                    />
                    <YAxis stroke="#52525b" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="transactions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-white">Recent Transactions</h3>
                  <p className="text-zinc-500 text-sm">{data.stats.totalTransactions} total transactions</p>
                </div>
                {data.stats.pendingCount > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400">
                    {data.stats.pendingCount} pending
                  </span>
                )}
              </div>

              {data.payments.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-12 h-12 text-zinc-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <p className="text-zinc-500">No transactions yet</p>
                  <p className="text-zinc-600 text-sm mt-1">Payments will appear here when customers subscribe</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">Customer</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">Amount</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">Status</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">Date</th>
                        <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-6 py-4">Transaction ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payments.slice(0, 10).map((payment) => {
                        const badge = getStatusBadge(payment.status);
                        return (
                          <tr
                            key={payment.merchantOid}
                            className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-sm text-white">
                                {formatPhoneNumber(payment.phoneNumber)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-semibold text-white">
                                {formatCurrency(payment.totalAmount || payment.amount)}
                              </span>
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
                                <p className="text-xs text-zinc-500 mt-1 max-w-xs truncate">
                                  {payment.failReason}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-zinc-400 text-sm">
                              {payment.paidAt ? formatDate(payment.paidAt) :
                               payment.failedAt ? formatDate(payment.failedAt) :
                               formatDate(payment.createdAt)}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs text-zinc-500">
                                {payment.merchantOid.slice(0, 16)}...
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {data.payments.length > 10 && (
                    <div className="px-6 py-4 border-t border-zinc-800/30 text-center">
                      <span className="text-zinc-500 text-sm">
                        Showing 10 of {data.payments.length} transactions
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
