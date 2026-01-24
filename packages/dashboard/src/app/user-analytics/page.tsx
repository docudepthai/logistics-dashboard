'use client';

import { useEffect, useState } from 'react';

interface SourceData {
  count: number;
  percentage: number;
  premiumCount: number;
  conversionRate: number;
}

interface TrafficSourcesData {
  instagram: SourceData;
  organic: SourceData;
  atakan: SourceData;
}

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

interface SearchAnalysisData {
  topOrigins: { name: string; count: number }[];
  topDestinations: { name: string; count: number }[];
  topRoutes: { route: string; count: number }[];
  totalSearches: number;
  uniqueOrigins: number;
  uniqueDestinations: number;
}

interface BehaviorData {
  engagement: EngagementData;
  conversion: ConversionData;
  trafficSources: TrafficSourcesData;
  searchAnalysis: SearchAnalysisData;
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

  if (!behaviorData) return null;

  const { engagement, conversion, trafficSources, searchAnalysis } = behaviorData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">User Analytics</h1>
        <p className="text-neutral-500 text-sm mt-1">Engagement metrics, retention, and conversion analysis</p>
      </div>

      {/* Traffic Sources */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-6">Traffic Sources</h2>
        <div className="grid grid-cols-4 gap-6">
          {/* Instagram */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Instagram</div>
                <div className="text-neutral-500 text-xs">From ads</div>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{trafficSources.instagram.count}</div>
                <div className="text-neutral-500 text-sm">{trafficSources.instagram.percentage}% of users</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-purple-400">{trafficSources.instagram.conversionRate}%</div>
                <div className="text-neutral-600 text-xs">conversion</div>
              </div>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                style={{ width: `${trafficSources.instagram.percentage}%` }}
              />
            </div>
          </div>

          {/* Organic */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Organic</div>
                <div className="text-neutral-500 text-xs">Direct / referral</div>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{trafficSources.organic.count}</div>
                <div className="text-neutral-500 text-sm">{trafficSources.organic.percentage}% of users</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-emerald-400">{trafficSources.organic.conversionRate}%</div>
                <div className="text-neutral-600 text-xs">conversion</div>
              </div>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${trafficSources.organic.percentage}%` }}
              />
            </div>
          </div>

          {/* Atakan'dan gelen */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Atakan</div>
                <div className="text-neutral-500 text-xs">NAZPX referral</div>
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold text-white">{trafficSources.atakan.count}</div>
                <div className="text-neutral-500 text-sm">{trafficSources.atakan.percentage}% of users</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-amber-400">{trafficSources.atakan.conversionRate}%</div>
                <div className="text-neutral-600 text-xs">conversion</div>
              </div>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${trafficSources.atakan.percentage}%` }}
              />
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-neutral-800/50 rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium text-white">Conversion Comparison</div>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-400 text-xs">Instagram</span>
                  <span className="text-purple-400 font-mono text-xs">{trafficSources.instagram.conversionRate}%</span>
                </div>
                <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full"
                    style={{ width: `${Math.min(trafficSources.instagram.conversionRate * 5, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-400 text-xs">Organic</span>
                  <span className="text-emerald-400 font-mono text-xs">{trafficSources.organic.conversionRate}%</span>
                </div>
                <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(trafficSources.organic.conversionRate * 5, 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-neutral-400 text-xs">Atakan</span>
                  <span className="text-amber-400 font-mono text-xs">{trafficSources.atakan.conversionRate}%</span>
                </div>
                <div className="h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${Math.min(trafficSources.atakan.conversionRate * 5, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-neutral-700 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Premium IG</span>
                <span className="text-white font-mono">{trafficSources.instagram.premiumCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Premium Organic</span>
                <span className="text-white font-mono">{trafficSources.organic.premiumCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-500">Premium Atakan</span>
                <span className="text-white font-mono">{trafficSources.atakan.premiumCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Analysis */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium text-white">Search Analysis</h2>
          <div className="flex items-center space-x-4 text-xs text-neutral-500">
            <span>{searchAnalysis.totalSearches} users searched</span>
            <span>•</span>
            <span>{searchAnalysis.uniqueOrigins} unique origins</span>
            <span>•</span>
            <span>{searchAnalysis.uniqueDestinations} unique destinations</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {/* Top Origins */}
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Top Origins (From)</h3>
            <div className="space-y-2">
              {searchAnalysis.topOrigins.length === 0 ? (
                <div className="text-neutral-600 text-sm">No data yet</div>
              ) : (
                searchAnalysis.topOrigins.slice(0, 7).map((item, index) => {
                  const maxCount = searchAnalysis.topOrigins[0]?.count || 1;
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={item.name} className="flex items-center space-x-3">
                      <span className="text-neutral-600 text-xs font-mono w-4">{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm">{item.name}</span>
                          <span className="text-neutral-400 font-mono text-xs">{item.count}</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top Destinations */}
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Top Destinations (To)</h3>
            <div className="space-y-2">
              {searchAnalysis.topDestinations.length === 0 ? (
                <div className="text-neutral-600 text-sm">No data yet</div>
              ) : (
                searchAnalysis.topDestinations.slice(0, 7).map((item, index) => {
                  const maxCount = searchAnalysis.topDestinations[0]?.count || 1;
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={item.name} className="flex items-center space-x-3">
                      <span className="text-neutral-600 text-xs font-mono w-4">{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm">{item.name}</span>
                          <span className="text-neutral-400 font-mono text-xs">{item.count}</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top Routes */}
          <div>
            <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Top Routes</h3>
            <div className="space-y-2">
              {searchAnalysis.topRoutes.length === 0 ? (
                <div className="text-neutral-600 text-sm">No data yet</div>
              ) : (
                searchAnalysis.topRoutes.slice(0, 7).map((item, index) => {
                  const maxCount = searchAnalysis.topRoutes[0]?.count || 1;
                  const percentage = (item.count / maxCount) * 100;
                  return (
                    <div key={item.route} className="flex items-center space-x-3">
                      <span className="text-neutral-600 text-xs font-mono w-4">{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white text-sm truncate" title={item.route}>{item.route}</span>
                          <span className="text-neutral-400 font-mono text-xs ml-2">{item.count}</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-orange-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Distribution */}
      {userStats && (
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">User Distribution</h2>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">Total Users</span>
                <span className="text-white font-mono text-lg">{userStats.total}</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">Free Trial</span>
                <span className="text-blue-400 font-mono text-lg">{userStats.freeTrial}</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${userStats.total > 0 ? (userStats.freeTrial / userStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-neutral-600 text-xs mt-1">
                {userStats.total > 0 ? Math.round((userStats.freeTrial / userStats.total) * 100) : 0}% of total
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">Premium</span>
                <span className="text-emerald-400 font-mono text-lg">{userStats.premium}</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${userStats.total > 0 ? (userStats.premium / userStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-neutral-600 text-xs mt-1">
                {userStats.total > 0 ? Math.round((userStats.premium / userStats.total) * 100) : 0}% of total
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">Expired</span>
                <span className="text-red-400 font-mono text-lg">{userStats.expired}</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: `${userStats.total > 0 ? (userStats.expired / userStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-neutral-600 text-xs mt-1">
                {userStats.total > 0 ? Math.round((userStats.expired / userStats.total) * 100) : 0}% of total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Active Users</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 text-sm">Last 24 hours</span>
              <span className="text-2xl font-semibold text-cyan-400">{engagement.active24h}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 text-sm">Last 7 days</span>
              <span className="text-2xl font-semibold text-cyan-400">{engagement.active7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 text-sm">Last 30 days</span>
              <span className="text-2xl font-semibold text-cyan-400">{engagement.active30d}</span>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Engagement</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-400 text-sm">Total Messages</span>
                <span className="text-white font-mono">{engagement.totalMessages.toLocaleString()}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-400 text-sm">Avg per User</span>
                <span className="text-purple-400 font-mono text-xl">{engagement.avgMessagesPerUser}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-400 text-sm">Users Who Searched</span>
                <span className="text-white font-mono">{engagement.usersWhoSearched}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white mb-4">Retention</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">Return Rate</span>
                <span className="text-amber-400 font-mono text-xl">{engagement.returnRate}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${engagement.returnRate}%` }}
                />
              </div>
              <div className="text-neutral-600 text-xs mt-1">Users who came back again</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">Search Rate</span>
                <span className="text-purple-400 font-mono text-xl">{engagement.searchRate}%</span>
              </div>
              <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${engagement.searchRate}%` }}
                />
              </div>
              <div className="text-neutral-600 text-xs mt-1">Users who used search</div>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
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
                    <span className="w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-mono">
                      {index + 1}
                    </span>
                    <span className="text-white text-sm font-medium">{step.step}</span>
                    <span className="text-neutral-600 text-xs">{step.description}</span>
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
                <div className="ml-9 h-3 bg-neutral-800 rounded-full overflow-hidden">
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
                    <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <span className="text-neutral-500">
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
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Trial → Premium</h3>
            <span className="text-3xl font-bold text-emerald-400">{conversion.trialToPremiumRate}%</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${conversion.trialToPremiumRate}%` }}
            />
          </div>
          <p className="text-neutral-600 text-xs">
            {conversion.premiumUsers} users converted to premium
          </p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Trial → Expired</h3>
            <span className="text-3xl font-bold text-red-400">{conversion.trialToExpiredRate}%</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${conversion.trialToExpiredRate}%` }}
            />
          </div>
          <p className="text-neutral-600 text-xs">
            {conversion.expiredUsers} users let trial expire
          </p>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-white">Active Trials</h3>
            <span className="text-3xl font-bold text-blue-400">{conversion.activeTrialUsers}</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${conversion.totalUsers > 0 ? (conversion.activeTrialUsers / conversion.totalUsers) * 100 : 0}%` }}
            />
          </div>
          <p className="text-neutral-600 text-xs">
            Currently in free trial period
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-4">Key Insights</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-400 text-sm">Users with multiple active days</span>
              <span className="text-white font-mono">{engagement.usersWithMultipleDays}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-400 text-sm">Users who performed searches</span>
              <span className="text-white font-mono">{engagement.usersWhoSearched}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400 text-sm">Total messages sent</span>
              <span className="text-white font-mono">{engagement.totalMessages.toLocaleString()}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-400 text-sm">7-day active rate</span>
              <span className="text-white font-mono">
                {conversion.totalUsers > 0 ? Math.round((engagement.active7d / conversion.totalUsers) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-neutral-800/50">
              <span className="text-neutral-400 text-sm">Paying user ratio</span>
              <span className="text-white font-mono">
                {conversion.totalUsers > 0 ? Math.round((conversion.premiumUsers / conversion.totalUsers) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400 text-sm">Churn rate (expired/total)</span>
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
