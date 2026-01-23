'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Stats {
  contactList: { total: number; pending: number; contacted: number };
  nudgeWindow: { total: number; urgent: number; pending: number; sent: number };
}

export default function CRMPage() {
  const [stats, setStats] = useState<Stats>({
    contactList: { total: 0, pending: 0, contacted: 0 },
    nudgeWindow: { total: 0, urgent: 0, pending: 0, sent: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [callRes, nudgeRes] = await Promise.all([
          fetch('/api/call-list'),
          fetch('/api/nudge-eligible'),
        ]);

        if (callRes.ok) {
          const data = await callRes.json();
          const items = data.items || [];
          setStats(prev => ({
            ...prev,
            contactList: {
              total: items.length,
              pending: items.filter((i: any) => !i.calledAt).length,
              contacted: items.filter((i: any) => i.calledAt).length,
            },
          }));
        }

        if (nudgeRes.ok) {
          const data = await nudgeRes.json();
          setStats(prev => ({
            ...prev,
            nudgeWindow: data.stats || { total: 0, urgent: 0, pending: 0, sent: 0 },
          }));
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">CRM</h1>
        <p className="text-zinc-500 text-sm mt-1">Müşteri ilişkileri yönetimi</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* 24 Saat Penceresi Card */}
        <Link
          href="/crm/24-saat-penceresi"
          className="group bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6 hover:border-amber-500/30 hover:bg-zinc-900/70 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-white">24 Saat Penceresi</h2>
              </div>
              <p className="text-zinc-500 text-sm">
                Henüz arama yapmamış ve mesaj gönderilebilir kullanıcılar
              </p>
            </div>
            <svg className="w-5 h-5 text-zinc-600 group-hover:text-amber-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="mt-6 h-16 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-semibold text-white">{stats.nudgeWindow.total}</div>
                <div className="text-xs text-zinc-500">Toplam</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-red-400">{stats.nudgeWindow.urgent}</div>
                <div className="text-xs text-zinc-500">Acil</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-amber-400">{stats.nudgeWindow.pending}</div>
                <div className="text-xs text-zinc-500">Bekliyor</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-emerald-400">{stats.nudgeWindow.sent}</div>
                <div className="text-xs text-zinc-500">Gönderildi</div>
              </div>
            </div>
          )}
        </Link>

        {/* İletişim Listesi Card */}
        <Link
          href="/crm/iletisim-listesi"
          className="group bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-6 hover:border-blue-500/30 hover:bg-zinc-900/70 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-white">İletişim Listesi</h2>
              </div>
              <p className="text-zinc-500 text-sm">
                Aranması veya iletişime geçilmesi gereken kullanıcılar
              </p>
            </div>
            <svg className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="mt-6 h-16 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-semibold text-white">{stats.contactList.total}</div>
                <div className="text-xs text-zinc-500">Toplam</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-amber-400">{stats.contactList.pending}</div>
                <div className="text-xs text-zinc-500">Bekliyor</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-emerald-400">{stats.contactList.contacted}</div>
                <div className="text-xs text-zinc-500">Tamamlandı</div>
              </div>
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
