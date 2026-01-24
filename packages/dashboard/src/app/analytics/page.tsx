'use client';

import { useEffect, useState } from 'react';

interface AnalyticsData {
  dailyTrends: { date: string; jobs: number; senders: number }[];
  parserStats: {
    originRate: number;
    destinationRate: number;
    phoneRate: number;
    bodyTypeRate: number;
    avgConfidence: number;
  };
  topOrigins: { province: string; count: number }[];
  topDestinations: { province: string; count: number }[];
  peakHours: { hour: number; count: number }[];
  weekChange: number;
  thisWeekTotal: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="text-neutral-500 text-center py-20">Failed to load</div>;

  const maxDailyJobs = Math.max(...data.dailyTrends.map(d => d.jobs), 1);
  const maxPeakHour = Math.max(...data.peakHours.map(h => h.count), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Analytics</h1>
          <p className="text-neutral-500 text-sm mt-1">Performance metrics and trends</p>
        </div>
        <div className="flex items-center space-x-2 bg-neutral-900/50 border border-neutral-800/50 rounded-lg px-3 py-2">
          <span className={`text-sm font-mono ${data.weekChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.weekChange >= 0 ? '+' : ''}{data.weekChange}%
          </span>
          <span className="text-neutral-500 text-sm">vs last week</span>
        </div>
      </div>

      {/* Daily Trends Chart */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-6">Daily Trends</h2>
        <div className="flex items-end gap-3" style={{ height: '160px' }}>
          {data.dailyTrends.map((day, i) => {
            const heightPx = Math.max((day.jobs / maxDailyJobs) * 140, 4);
            return (
              <div key={i} className="flex-1 group relative flex flex-col justify-end h-full">
                <div
                  className="w-full bg-neutral-600 rounded-sm transition-all group-hover:bg-neutral-500"
                  style={{ height: `${heightPx}px` }}
                />
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-neutral-800 px-3 py-2 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  <div className="font-mono">{day.jobs.toLocaleString()} jobs</div>
                  <div className="text-neutral-400">{day.senders} senders</div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Date labels */}
        <div className="flex gap-3 mt-3">
          {data.dailyTrends.map((day, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-xs text-neutral-500">
                {new Date(day.date).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })}
              </span>
              <div className="text-neutral-300 font-mono text-sm mt-1">{day.jobs.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Parser Stats */}
      <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-6">Parser Success Rates (24h)</h2>
        <div className="grid grid-cols-4 gap-6">
          {[
            { label: 'Origin Extracted', value: data.parserStats.originRate },
            { label: 'Destination Extracted', value: data.parserStats.destinationRate },
            { label: 'Phone Extracted', value: data.parserStats.phoneRate },
            { label: 'Body Type Extracted', value: data.parserStats.bodyTypeRate },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 text-sm">{stat.label}</span>
                <span className="text-white font-mono text-sm">{stat.value}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500"
                  style={{ width: `${stat.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-800/50 flex items-center justify-between">
          <span className="text-neutral-500 text-sm">Average Confidence Score</span>
          <div className="flex items-center space-x-3">
            <div className="w-32 h-2 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${data.parserStats.avgConfidence * 100}%` }}
              />
            </div>
            <span className="text-white font-mono">{(data.parserStats.avgConfidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Top Origins and Destinations */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Top Origins (24h)</h2>
          <div className="space-y-3">
            {data.topOrigins.slice(0, 8).map((o, i) => (
              <div key={o.province} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-neutral-600 font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-neutral-300 text-sm">{o.province}</span>
                </div>
                <span className="text-white font-mono text-sm">{o.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-6">
          <h2 className="text-sm font-medium text-white mb-4">Top Destinations (24h)</h2>
          <div className="space-y-3">
            {data.topDestinations.slice(0, 8).map((d, i) => (
              <div key={d.province} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-neutral-600 font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-neutral-300 text-sm">{d.province}</span>
                </div>
                <span className="text-white font-mono text-sm">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
