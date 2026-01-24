'use client';

import { useEffect, useState } from 'react';
import PageGuard from './components/PageGuard';

interface Stats {
  overview: {
    totalJobs: number;
    totalMessages: number;
    uniqueSenders24h: number;
    uniqueGroups: number;
    conversations: number;
  };
  sources: { source: string; count: number }[];
  hourly: { hour: string; count: number }[];
  topRoutes: { origin: string; destination: string; count: number }[];
  bodyTypes: { bodyType: string; count: number }[];
  cargoTypes: { cargoType: string; count: number }[];
}

function DashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error('Failed to fetch');
        setStats(await res.json());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500">{error || 'No data'}</p>
      </div>
    );
  }

  const maxHourly = Math.max(...stats.hourly.map(x => x.count), 1);
  const maxSource = Math.max(...stats.sources.map(x => x.count), 1);
  const maxBodyType = Math.max(...stats.bodyTypes.map(x => x.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Overview</h1>
        <p className="text-neutral-500 text-sm mt-1">Real-time logistics monitoring</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Jobs (24h)', value: stats.overview.totalJobs },
          { label: 'Messages', value: stats.overview.totalMessages },
          { label: 'Senders', value: stats.overview.uniqueSenders24h },
          { label: 'Groups', value: stats.overview.uniqueGroups },
          { label: 'Conversations', value: stats.overview.conversations },
        ].map((stat) => (
          <div key={stat.label} className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-5 card-hover">
            <p className="text-neutral-500 text-xs uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-semibold text-white mt-2 font-mono">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Sources */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Sources</h2>
          {(() => {
            const total = stats.sources.reduce((sum, s) => sum + s.count, 0) || 1;
            const evolution = stats.sources.find(s => s.source === 'evolution')?.count || 0;
            const evolution2 = stats.sources.find(s => s.source === 'evolution-2')?.count || 0;
            const kamyoon = stats.sources.find(s => s.source === 'kamyoon')?.count || 0;
            const yukbul = stats.sources.find(s => s.source === 'yukbul')?.count || 0;
            const evolutionPct = (evolution / total) * 100;
            const evolution2Pct = (evolution2 / total) * 100;
            const kamyoonPct = (kamyoon / total) * 100;
            const yukbulPct = (yukbul / total) * 100;
            return (
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="w-full h-4 bg-neutral-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-white transition-all duration-500"
                    style={{ width: `${evolutionPct}%` }}
                  />
                  <div
                    className="h-full bg-blue-400 transition-all duration-500"
                    style={{ width: `${evolution2Pct}%` }}
                  />
                  <div
                    className="h-full bg-neutral-500 transition-all duration-500"
                    style={{ width: `${kamyoonPct}%` }}
                  />
                  <div
                    className="h-full bg-emerald-400 transition-all duration-500"
                    style={{ width: `${yukbulPct}%` }}
                  />
                </div>

                {/* Four columns for each source */}
                <div className="grid grid-cols-4 gap-2">
                  {/* Evolution */}
                  <div className="bg-neutral-800/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-white rounded-full" />
                      <span className="text-neutral-300 text-xs font-medium">Evolution</span>
                    </div>
                    <p className="text-lg font-semibold text-white font-mono">{evolution.toLocaleString()}</p>
                    <p className="text-neutral-500 text-xs mt-1">{evolutionPct.toFixed(1)}%</p>
                  </div>

                  {/* Evolution 2 */}
                  <div className="bg-neutral-800/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full" />
                      <span className="text-neutral-300 text-xs font-medium">Evolution 2</span>
                    </div>
                    <p className="text-lg font-semibold text-white font-mono">{evolution2.toLocaleString()}</p>
                    <p className="text-neutral-500 text-xs mt-1">{evolution2Pct.toFixed(1)}%</p>
                  </div>

                  {/* Kamyoon */}
                  <div className="bg-neutral-800/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-neutral-500 rounded-full" />
                      <span className="text-neutral-300 text-xs font-medium">Kamyoon</span>
                    </div>
                    <p className="text-lg font-semibold text-white font-mono">{kamyoon.toLocaleString()}</p>
                    <p className="text-neutral-500 text-xs mt-1">{kamyoonPct.toFixed(1)}%</p>
                  </div>

                  {/* Yukbul */}
                  <div className="bg-neutral-800/30 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                      <span className="text-neutral-300 text-xs font-medium">Yukbul</span>
                    </div>
                    <p className="text-lg font-semibold text-white font-mono">{yukbul.toLocaleString()}</p>
                    <p className="text-neutral-500 text-xs mt-1">{yukbulPct.toFixed(1)}%</p>
                  </div>
                </div>

                {/* Total */}
                <div className="text-center pt-2 border-t border-neutral-800/50">
                  <span className="text-neutral-500 text-sm">Total: </span>
                  <span className="text-white font-mono">{total.toLocaleString()}</span>
                  <span className="text-neutral-500 text-sm"> jobs (24h)</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Vehicle Body Types */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Vehicle Body Types</h2>
          <div className="space-y-3">
            {stats.bodyTypes.slice(0, 6).map((bt) => {
              const percentage = (bt.count / maxBodyType) * 100;
              return (
                <div key={bt.bodyType}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-neutral-400 text-sm">{bt.bodyType || 'Unspecified'}</span>
                    <span className="text-white font-mono text-sm">{bt.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-neutral-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Routes and Cargo Types - Side by Side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top Routes */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Top Routes</h2>
          <div className="space-y-2">
            {stats.topRoutes.slice(0, 6).map((route, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-800/30">
                <div className="flex items-center space-x-3">
                  <span className="text-neutral-600 text-xs font-mono w-4">{i + 1}</span>
                  <span className="text-neutral-300 text-sm">{route.origin}</span>
                  <span className="text-neutral-600">→</span>
                  <span className="text-neutral-400 text-sm">{route.destination || 'Any'}</span>
                </div>
                <span className="text-neutral-500 font-mono text-sm">{route.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cargo Types */}
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Cargo Types</h2>
          <div className="space-y-3">
            {stats.cargoTypes.slice(0, 6).map((ct) => {
              const maxCargoType = Math.max(...stats.cargoTypes.map(x => x.count), 1);
              const percentage = (ct.count / maxCargoType) * 100;
              return (
                <div key={ct.cargoType}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-neutral-400 text-sm">{ct.cargoType || 'Unspecified'}</span>
                    <span className="text-white font-mono text-sm">{ct.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Hourly Activity */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-6">Daily Activity</h2>
        <div className="flex items-end gap-1" style={{ height: '128px' }}>
          {stats.hourly.map((h, i) => {
            const heightPx = Math.max((h.count / maxHourly) * 120, h.count > 0 ? 4 : 0);
            const isNow = new Date().getHours() === parseInt(h.hour);
            return (
              <div key={i} className="flex-1 group relative flex flex-col justify-end h-full">
                <div
                  className={`w-full rounded-sm transition-all duration-300 ${
                    isNow ? 'bg-white' : 'bg-neutral-600 group-hover:bg-neutral-500'
                  }`}
                  style={{ height: `${heightPx}px` }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {h.hour}: {h.count}
                </div>
              </div>
            );
          })}
        </div>
        {/* Hour labels */}
        <div className="flex gap-1 mt-2">
          {stats.hourly.map((h, i) => (
            <div key={i} className="flex-1 text-center">
              {i % 6 === 0 && (
                <span className="text-xs text-neutral-600">{h.hour.split(':')[0]}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <PageGuard permissionId="overview">
      <DashboardContent />
    </PageGuard>
  );
}
