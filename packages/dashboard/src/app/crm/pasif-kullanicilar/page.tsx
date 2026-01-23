'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface NudgeEligibleUser {
  phoneNumber: string;
  firstContactAt: string;
  lastMessageAt: string;
  hoursRemaining: number;
  messageCount: number;
  firstMessage: string;
  nudgeSent: boolean;
  nudgeSentAt?: string;
}

interface NudgeSettings {
  mode: 'automatic' | 'manual';
  triggerHours: number;
  messageTemplate: string;
  lastUpdated: string | null;
  updatedBy: string | null;
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
  return `+${phone}`;
}

function formatHoursRemaining(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}dk`;
  return `${h}s ${m}dk`;
}

const ITEMS_PER_PAGE = 50;

export default function PasifKullanicilarPage() {
  const [users, setUsers] = useState<NudgeEligibleUser[]>([]);
  const [stats, setStats] = useState({ total: 0, urgent: 0, nudgeSent: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [showSent, setShowSent] = useState(false);
  const [sendingNudge, setSendingNudge] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settings, setSettings] = useState<NudgeSettings>({
    mode: 'manual',
    triggerHours: 3,
    messageTemplate: '',
    lastUpdated: null,
    updatedBy: null,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{ phone: string; step: 1 | 2 } | null>(null);

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/nudge-eligible');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setStats(data.stats || { total: 0, urgent: 0, nudgeSent: 0, pending: 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/nudge-settings');
      if (res.ok) {
        setSettings(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const saveSettings = async (newSettings: Partial<NudgeSettings>) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/nudge-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        setSettings(await res.json());
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendClick = (phoneNumber: string) => {
    // First confirmation
    setConfirmModal({ phone: phoneNumber, step: 1 });
  };

  const handleConfirmStep1 = () => {
    if (confirmModal) {
      // Second confirmation
      setConfirmModal({ phone: confirmModal.phone, step: 2 });
    }
  };

  const handleConfirmStep2 = async () => {
    if (!confirmModal) return;

    const phoneNumber = confirmModal.phone;
    setConfirmModal(null);
    setSendingNudge(phoneNumber);

    try {
      const res = await fetch('/api/send-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });

      if (res.ok) {
        setUsers(prev => prev.map(u =>
          u.phoneNumber === phoneNumber
            ? { ...u, nudgeSent: true, nudgeSentAt: new Date().toISOString() }
            : u
        ));
        setStats(prev => ({
          ...prev,
          nudgeSent: prev.nudgeSent + 1,
          pending: prev.pending - 1,
        }));
      } else {
        const error = await res.json();
        alert(`Mesaj gonderilemedi: ${error.error || 'Bilinmeyen hata'}`);
      }
    } catch (err) {
      console.error('Failed to send nudge:', err);
      alert('Mesaj gonderilemedi');
    } finally {
      setSendingNudge(null);
    }
  };

  const filteredUsers = showSent ? users : users.filter(u => !u.nudgeSent);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [showSent]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Pasif Kullanicilar</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Henuz arama yapmamis kullanicilar (24s penceresi)
            <span className="mx-2">·</span>
            <span className={settings.mode === 'automatic' ? 'text-emerald-400' : 'text-amber-400'}>
              {settings.mode === 'automatic' ? 'Otomatik' : 'Manuel'}
            </span>
            <span className="text-zinc-600"> ({settings.triggerHours}s kala)</span>
          </p>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Ayarlar</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Toplam</div>
          <div className="text-2xl font-semibold text-white mt-1">{stats.total}</div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="text-red-400/70 text-xs font-medium uppercase tracking-wider">Acil (&lt;6s)</div>
          <div className="text-2xl font-semibold text-red-400 mt-1">{stats.urgent}</div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
          <div className="text-amber-400/70 text-xs font-medium uppercase tracking-wider">Bekliyor</div>
          <div className="text-2xl font-semibold text-amber-400 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <div className="text-emerald-400/70 text-xs font-medium uppercase tracking-wider">Gonderildi</div>
          <div className="text-2xl font-semibold text-emerald-400 mt-1">{stats.nudgeSent}</div>
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showSent}
            onChange={(e) => setShowSent(e.target.checked)}
            className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
          />
          <span className="text-sm text-zinc-400">Mesaj gonderilenleri de goster</span>
        </label>
        {totalPages > 1 && (
          <div className="text-sm text-zinc-500">
            Sayfa {currentPage} / {totalPages} ({filteredUsers.length} kayit)
          </div>
        )}
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-8 text-center text-zinc-500">
          {showSent ? 'Henuz kullanici yok' : 'Mesaj gonderilecek kullanici yok'}
        </div>
      ) : (
        <>
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/50">
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Telefon</th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Kalan Sure</th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Mesaj Sayisi</th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Ilk Mesaj</th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Durum</th>
                  <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Islem</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.phoneNumber}
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors ${user.nudgeSent ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/profile/${user.phoneNumber}`}
                        className="font-mono text-sm text-white hover:text-blue-400 transition-colors"
                      >
                        {formatPhoneNumber(user.phoneNumber)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        user.hoursRemaining < 6 ? 'text-red-400' :
                        user.hoursRemaining < 12 ? 'text-amber-400' :
                        'text-emerald-400'
                      }`}>
                        {formatHoursRemaining(user.hoursRemaining)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-sm">{user.messageCount}</td>
                    <td className="px-4 py-3 text-zinc-400 text-sm truncate max-w-[200px]" title={user.firstMessage}>
                      {user.firstMessage || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {user.nudgeSent ? (
                        <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                          Gonderildi
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                          Bekliyor
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {!user.nudgeSent && (
                          <button
                            onClick={() => handleSendClick(user.phoneNumber)}
                            disabled={sendingNudge === user.phoneNumber}
                            className="text-xs px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors disabled:opacity-50"
                          >
                            {sendingNudge === user.phoneNumber ? 'Gonderiliyor...' : 'Sablon Gonder'}
                          </button>
                        )}
                        <a
                          href={`https://wa.me/${user.phoneNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-1 bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 rounded transition-colors"
                        >
                          WA Ac
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 text-zinc-300 rounded text-sm transition-colors"
            >
              Onceki
            </button>
            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded text-sm transition-colors ${
                      currentPage === pageNum
                        ? 'bg-white text-black'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800 text-zinc-300 rounded text-sm transition-colors"
            >
              Sonraki
            </button>
          </div>
        )}
        </>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Pasif Kullanicilar Ayarlari</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-3">Mesaj Gonderme Modu</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => saveSettings({ mode: 'manual' })}
                    disabled={savingSettings}
                    className={`p-4 rounded-lg border transition-all ${
                      settings.mode === 'manual'
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className="text-lg font-medium mb-1">Manuel</div>
                    <div className="text-xs opacity-70">Mesajlari kendiniz gonderin</div>
                  </button>
                  <button
                    onClick={() => saveSettings({ mode: 'automatic' })}
                    disabled={savingSettings}
                    className={`p-4 rounded-lg border transition-all ${
                      settings.mode === 'automatic'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                        : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className="text-lg font-medium mb-1">Otomatik</div>
                    <div className="text-xs opacity-70">Sistem otomatik gonderir</div>
                  </button>
                </div>
              </div>

              {/* Trigger Time */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-3">
                  Mesaj Gonderim Zamani
                  <span className="text-zinc-600 font-normal ml-2">(24 saat dolmadan kac saat once)</span>
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    min="1"
                    max="12"
                    value={settings.triggerHours}
                    onChange={(e) => saveSettings({ triggerHours: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <span className="text-white font-medium w-16 text-right">{settings.triggerHours} saat</span>
                </div>
              </div>

              {/* Message Template */}
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Mesaj Sablonu</label>
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-300">
                  {settings.messageTemplate || 'Sablon yukleniyor...'}
                </div>
                <p className="text-xs text-zinc-600 mt-2">Sablon su an degistirilemez</p>
              </div>

              {settings.lastUpdated && (
                <div className="text-xs text-zinc-600">
                  Son guncelleme: {formatDate(settings.lastUpdated)}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Step 1 */}
      {confirmModal?.step === 1 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h3 className="text-lg font-medium text-white">Sablon Mesaji Gonder</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-zinc-400 mb-4">
                <span className="font-mono text-white">{formatPhoneNumber(confirmModal.phone)}</span> numarasina
                sablon mesaji gondermek istediginize emin misiniz?
              </p>
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300">
                {settings.messageTemplate || 'Sablon yukleniyor...'}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end space-x-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleConfirmStep1}
                className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg transition-colors"
              >
                Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal - Step 2 */}
      {confirmModal?.step === 2 && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-amber-500/30 bg-amber-500/10">
              <h3 className="text-lg font-medium text-amber-400">Son Onay</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-zinc-400 mb-4">
                Bu islem geri alinamaz. Mesaj <span className="font-mono text-white">{formatPhoneNumber(confirmModal.phone)}</span> numarasina
                hemen gonderilecektir.
              </p>
              <p className="text-amber-400 text-sm">
                Gondermek istediginizden emin misiniz?
              </p>
            </div>
            <div className="px-6 py-4 border-t border-zinc-800 flex justify-end space-x-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
              >
                Iptal
              </button>
              <button
                onClick={handleConfirmStep2}
                className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
              >
                Gonder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
