'use client';

import { useEffect, useState } from 'react';

interface ServiceHealth {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
  lastCheck: string;
  details?: string;
  metrics?: Record<string, number>;
}

interface HealthData {
  status: string;
  timestamp: string;
  services: ServiceHealth[];
  processing: {
    parserSuccessRate: number;
    avgProcessingTime: number;
    errorsLast24h: number;
    jobsProcessed24h: number;
  };
  recentActivity: { hour: string; evolution: number; evolution2: number; kamyoon: number }[];
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) setHealth(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!health) return <div className="text-zinc-500 text-center py-20">Failed to load</div>;

  const statusColors = {
    operational: 'bg-emerald-400',
    degraded: 'bg-amber-400',
    down: 'bg-red-400',
  };

  const statusText = {
    operational: 'Operational',
    degraded: 'Degraded',
    down: 'Down',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Health</h1>
          <p className="text-zinc-500 text-sm mt-1">Service status and metrics</p>
        </div>
        <div className="flex items-center space-x-2 bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${statusColors[health.status as keyof typeof statusColors] || statusColors.down}`} />
          <span className="text-zinc-400 text-sm">
            {health.status === 'operational' ? 'All systems operational' : 'Issues detected'}
          </span>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-4 gap-4">
        {health.services.map((service) => (
          <div key={service.name} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6 card-hover">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-medium">{service.name}</h3>
                <p className="text-zinc-500 text-sm mt-1">{service.details}</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${statusColors[service.status]} pulse-glow`} />
                <span className={`text-xs font-medium ${
                  service.status === 'operational' ? 'text-emerald-400' :
                  service.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {statusText[service.status]}
                </span>
              </div>
            </div>

            {service.latency && (
              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-xs">Latency</span>
                  <span className="text-white font-mono text-sm">{service.latency}ms</span>
                </div>
              </div>
            )}

            {service.metrics && (
              <div className="mt-4 pt-4 border-t border-zinc-800/50 space-y-2">
                {Object.entries(service.metrics).slice(0, 3).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-zinc-500 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-zinc-300 font-mono text-sm">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Processing Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Parser Success', value: `${health.processing.parserSuccessRate}%`, sub: 'of messages parsed' },
          { label: 'Avg Processing', value: `${health.processing.avgProcessingTime}ms`, sub: 'per message' },
          { label: 'Jobs Processed', value: health.processing.jobsProcessed24h.toLocaleString(), sub: 'last 24 hours' },
          { label: 'Errors', value: health.processing.errorsLast24h.toString(), sub: 'last 24 hours' },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-5">
            <p className="text-zinc-500 text-xs uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-semibold text-white mt-2 font-mono">{stat.value}</p>
            <p className="text-zinc-600 text-xs mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Activity by Source */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6">
        <h2 className="text-sm font-medium text-white mb-6">Recent Activity by Source</h2>
        <div className="space-y-3">
          {health.recentActivity.slice(0, 8).map((activity) => {
            const total = activity.evolution + activity.evolution2 + activity.kamyoon;
            const evolutionPct = total > 0 ? (activity.evolution / total) * 100 : 33;
            const evolution2Pct = total > 0 ? (activity.evolution2 / total) * 100 : 33;
            const kamyoonPct = total > 0 ? (activity.kamyoon / total) * 100 : 34;
            return (
              <div key={activity.hour} className="flex items-center space-x-4">
                <span className="text-zinc-500 text-xs font-mono w-12">{activity.hour}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-zinc-400"
                    style={{ width: `${evolutionPct}%` }}
                    title={`Evolution: ${activity.evolution}`}
                  />
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${evolution2Pct}%` }}
                    title={`Evolution 2: ${activity.evolution2}`}
                  />
                  <div
                    className="h-full bg-zinc-600"
                    style={{ width: `${kamyoonPct}%` }}
                    title={`Kamyoon: ${activity.kamyoon}`}
                  />
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-zinc-400 font-mono">{activity.evolution}</span>
                  <span className="text-blue-400 font-mono">{activity.evolution2}</span>
                  <span className="text-zinc-600 font-mono">{activity.kamyoon}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center space-x-6 mt-4 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-2 bg-zinc-400 rounded-sm" />
            <span className="text-zinc-500 text-xs">Evolution</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-2 bg-blue-400 rounded-sm" />
            <span className="text-zinc-500 text-xs">Evolution 2</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-2 bg-zinc-600 rounded-sm" />
            <span className="text-zinc-500 text-xs">Kamyoon</span>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center">
        <p className="text-zinc-600 text-xs">
          Last checked: {new Date(health.timestamp).toLocaleString('tr-TR')}
        </p>
      </div>
    </div>
  );
}
