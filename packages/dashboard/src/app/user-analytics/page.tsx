'use client';

import { useEffect, useState } from 'react';

interface EngagementData {
  active24h: number;
  active7d: number;
  active30d: number;
  totalMessages: number;
  avgMessagesPerUser: number;
  usersWhoSearched: number;
  searchRate: number;
  usersWithMultipleDays: number;
  returnRate: number;
}

interface FunnelStep {
  step: string;
  count: number;
  percentage: number;
  description: string;
}

interface ConversionData {
  totalUsers: number;
  activeTrialUsers: number;
  expiredUsers: number;
  premiumUsers: number;
  trialToPremiumRate: number;
  trialToExpiredRate: number;
  funnel: FunnelStep[];
}

interface BehaviorData {
  engagement: EngagementData;
  conversion: ConversionData;
}

interface UserStats {
  total: number;
  freeTrial: number;
  expired: number;
  premium: number;
}

export default function UserAnalyticsPage() {
  const [behaviorData, setBehaviorData] = useState<BehaviorData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [behaviorRes, usersRes] = await Promise.all([
          fetch('/api/user-behavior'),
          fetch('/api/users'),
        ]);

        if (!behaviorRes.ok) throw new Error('Failed to fetch user behavior data');
        setBehaviorData(await behaviorRes.json());

        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUserStats(usersData.stats);
        }

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
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
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

  if (!behaviorData) return null;

  const { engagement, conversion } = behaviorData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">User Analytics</h1>
        <p className="text-zinc-500 text-sm mt-1">Engagement metrics, retention, and conversion analysis</p>
      </div>

      {/* User Distribution */}
      {userStats && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">User Distribution</h2>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Total Users</span>
                <span className="text-white font-mono text-lg">{userStats.total}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Free Trial</span>
                <span className="text-blue-400 font-mono text-lg">{userStats.freeTrial}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${userStats.total > 0 ? (userStats.freeTrial / userStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-zinc-600 text-xs mt-1">
                {userStats.total > 0 ? Math.round((userStats.freeTrial / userStats.total) * 100) : 0}% of total
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Premium</span>
                <span className="text-emerald-400 font-mono text-lg">{userStats.premium}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${userStats.total > 0 ? (userStats.premium / userStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-zinc-600 text-xs mt-1">
                {userStats.total > 0 ? Math.round((userStats.premium / userStats.total) * 100) : 0}% of total
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Expired</span>
                <span className="text-red-400 font-mono text-lg">{userStats.expired}</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${userStats.total > 0 ? (userStats.expired / userStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-zinc-600 text-xs mt-1">
                {userStats.total > 0 ? Math.round((userStats.expired / userStats.total) * 100) : 0}% of total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Active Users</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Last 24 hours</span>
              <span className="text-2xl font-semibold text-cyan-400">{engagement.active24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Last 7 days</span>
              <span className="text-2xl font-semibold text-cyan-400">{engagement.active7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-sm">Last 30 days</span>
              <span className="text-2xl font-semibold text-cyan-400">{engagement.active30d}</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Engagement</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 text-sm">Total Messages</span>
                <span className="text-white font-mono">{engagement.totalMessages.toLocaleString()}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 text-sm">Avg per User</span>
                <span className="text-purple-400 font-mono text-xl">{engagement.avgMessagesPerUser}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-zinc-400 text-sm">Users Who Searched</span>
                <span className="text-white font-mono">{engagement.usersWhoSearched}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Retention</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Return Rate</span>
                <span className="text-amber-400 font-mono text-xl">{engagement.returnRate}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${engagement.returnRate}%` }}
                />
              </div>
              <div className="text-zinc-600 text-xs mt-1">Users who came back again</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 text-sm">Search Rate</span>
                <span className="text-purple-400 font-mono text-xl">{engagement.searchRate}%</span>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${engagement.searchRate}%` }}
                />
              </div>
              <div className="text-zinc-600 text-xs mt-1">Users who used search</div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-6">Conversion Funnel</h2>
        <div className="space-y-4">
          {conversion.funnel.map((step, index) => {
            const isLast = index === conversion.funnel.length - 1;
            const prevStep = index > 0 ? conversion.funnel[index - 1] : null;
            const dropoff = prevStep ? prevStep.count - step.count : 0;
            const dropoffPct = prevStep && prevStep.count > 0 ? Math.round((dropoff / prevStep.count) * 100) : 0;

            return (
              <div key={step.step}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs font-mono">
                      {index + 1}
                    </span>
                    <span className="text-white text-sm font-medium">{step.step}</span>
                    <span className="text-zinc-600 text-xs">{step.description}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-white font-mono text-sm">{step.count.toLocaleString()}</span>
                    <span className={`text-xs font-mono w-12 text-right ${
                      step.percentage >= 50 ? 'text-emerald-400' :
                      step.percentage >= 20 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {step.percentage}%
                    </span>
                  </div>
                </div>
                <div className="ml-9 h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      step.percentage >= 50 ? 'bg-emerald-500' :
                      step.percentage >= 20 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(step.percentage, 100)}%` }}
                  />
                </div>
                {!isLast && dropoff > 0 && (
                  <div className="ml-9 mt-2 mb-4 flex items-center space-x-2 text-xs">
                    <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-zinc-500">
                      -{dropoff.toLocaleString()} users ({dropoffPct}% dropoff)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion Rates */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Trial → Premium</h3>
            <span className="text-3xl font-bold text-emerald-400">{conversion.trialToPremiumRate}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${conversion.trialToPremiumRate}%` }}
            />
          </div>
          <p className="text-zinc-600 text-xs">
            {conversion.premiumUsers} users converted to premium
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Trial → Expired</h3>
            <span className="text-3xl font-bold text-red-400">{conversion.trialToExpiredRate}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${conversion.trialToExpiredRate}%` }}
            />
          </div>
          <p className="text-zinc-600 text-xs">
            {conversion.expiredUsers} users let trial expire
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Active Trials</h3>
            <span className="text-3xl font-bold text-blue-400">{conversion.activeTrialUsers}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${conversion.totalUsers > 0 ? (conversion.activeTrialUsers / conversion.totalUsers) * 100 : 0}%` }}
            />
          </div>
          <p className="text-zinc-600 text-xs">
            Currently in free trial period
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-4">Key Insights</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400 text-sm">Users with multiple active days</span>
              <span className="text-white font-mono">{engagement.usersWithMultipleDays}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400 text-sm">Users who performed searches</span>
              <span className="text-white font-mono">{engagement.usersWhoSearched}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-400 text-sm">Total messages sent</span>
              <span className="text-white font-mono">{engagement.totalMessages.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400 text-sm">7-day active rate</span>
              <span className="text-white font-mono">
                {conversion.totalUsers > 0 ? Math.round((engagement.active7d / conversion.totalUsers) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
              <span className="text-zinc-400 text-sm">Paying user ratio</span>
              <span className="text-white font-mono">
                {conversion.totalUsers > 0 ? Math.round((conversion.premiumUsers / conversion.totalUsers) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-400 text-sm">Churn rate (expired/total)</span>
              <span className="text-white font-mono">
                {conversion.totalUsers > 0 ? Math.round((conversion.expiredUsers / conversion.totalUsers) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
