'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface CallListItem {
  phoneNumber: string;
  reason: string;
  notes: string;
  calledAt: string | null;
  addedAt: string;
  autoAdded: boolean;
}

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

const CALL_REASONS = [
  'İş fonksiyonu kullanılmamış',
  'Sistem arızası oluşmuş ve düzeltildi',
  'Şu araç var mı diyor ama bizde yok',
  'Deneme süresi ile ilgili soru',
  'Bilgilendirme için ara',
  'Yurtdışına sevkiyat var mı sorusu',
  'Şehir içi var mı sorusu',
  'Marketing için yazmış',
];

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

export default function CRMPage() {
  const [items, setItems] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [showContacted, setShowContacted] = useState(false);

  // 24h Window state
  const [nudgeUsers, setNudgeUsers] = useState<NudgeEligibleUser[]>([]);
  const [nudgeStats, setNudgeStats] = useState({ total: 0, urgent: 0, nudgeSent: 0, pending: 0 });
  const [nudgeLoading, setNudgeLoading] = useState(true);
  const [markingNudge, setMarkingNudge] = useState<string | null>(null);
  const [showNudged, setShowNudged] = useState(false);

  useEffect(() => {
    fetchCallList();
    fetchNudgeEligible();
  }, []);

  const fetchCallList = async () => {
    try {
      const res = await fetch('/api/call-list');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNudgeEligible = async () => {
    try {
      const res = await fetch('/api/nudge-eligible');
      if (!res.ok) throw new Error('Failed to fetch nudge eligible');
      const data = await res.json();
      setNudgeUsers(data.users || []);
      setNudgeStats(data.stats || { total: 0, urgent: 0, nudgeSent: 0, pending: 0 });
    } catch (err) {
      console.error('Failed to fetch nudge eligible:', err);
    } finally {
      setNudgeLoading(false);
    }
  };

  const markAsNudged = async (phoneNumber: string) => {
    setMarkingNudge(phoneNumber);
    try {
      const res = await fetch('/api/nudge-eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      if (res.ok) {
        setNudgeUsers(prev => prev.map(u =>
          u.phoneNumber === phoneNumber
            ? { ...u, nudgeSent: true, nudgeSentAt: new Date().toISOString() }
            : u
        ));
        setNudgeStats(prev => ({
          ...prev,
          nudgeSent: prev.nudgeSent + 1,
          pending: prev.pending - 1,
        }));
      }
    } catch (err) {
      console.error('Failed to mark nudge:', err);
    } finally {
      setMarkingNudge(null);
    }
  };

  const toggleContacted = async (phoneNumber: string, currentlyCalledAt: string | null) => {
    setUpdatingPhone(phoneNumber);
    try {
      const newCalledAt = currentlyCalledAt ? null : new Date().toISOString();
      const res = await fetch('/api/call-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, calledAt: newCalledAt }),
      });
      if (res.ok) {
        setItems(prev => prev.map(item =>
          item.phoneNumber === phoneNumber
            ? { ...item, calledAt: newCalledAt }
            : item
        ));
      }
    } catch (err) {
      console.error('Failed to toggle contacted:', err);
    } finally {
      setUpdatingPhone(null);
    }
  };

  const updateReason = async (phoneNumber: string, reason: string) => {
    setUpdatingPhone(phoneNumber);
    try {
      const res = await fetch('/api/call-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, reason }),
      });
      if (res.ok) {
        setItems(prev => prev.map(item =>
          item.phoneNumber === phoneNumber
            ? { ...item, reason }
            : item
        ));
      }
    } catch (err) {
      console.error('Failed to update reason:', err);
    } finally {
      setUpdatingPhone(null);
      setEditingReason(null);
    }
  };

  const saveNotes = async (phoneNumber: string) => {
    setUpdatingPhone(phoneNumber);
    try {
      const res = await fetch('/api/call-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, notes: tempNotes }),
      });
      if (res.ok) {
        setItems(prev => prev.map(item =>
          item.phoneNumber === phoneNumber
            ? { ...item, notes: tempNotes }
            : item
        ));
      }
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setUpdatingPhone(null);
      setEditingNotes(null);
      setTempNotes('');
    }
  };

  const removeFromList = async (phoneNumber: string) => {
    if (!confirm('Bu kullanıcıyı listeden silmek istediğinize emin misiniz?')) return;

    setUpdatingPhone(phoneNumber);
    try {
      const res = await fetch('/api/call-list', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.phoneNumber !== phoneNumber));
      }
    } catch (err) {
      console.error('Failed to remove:', err);
    } finally {
      setUpdatingPhone(null);
    }
  };

  const filteredItems = showContacted ? items : items.filter(item => !item.calledAt);
  const contactedCount = items.filter(item => item.calledAt).length;
  const pendingCount = items.filter(item => !item.calledAt).length;

  // 24h window filtered users
  const filteredNudgeUsers = showNudged ? nudgeUsers : nudgeUsers.filter(u => !u.nudgeSent);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">CRM</h1>
        <p className="text-zinc-500 text-sm mt-1">İletişime geçilmesi gereken kullanıcılar</p>
      </div>

      {/* 24h Window Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-white">24 Saat Mesaj Penceresi</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Henüz arama yapmamış ve hala mesaj gönderilebilir kullanıcılar</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <span className="text-red-400">{nudgeStats.urgent}</span>
              <span className="text-zinc-600">acil</span>
              <span className="text-zinc-600">·</span>
              <span className="text-amber-400">{nudgeStats.pending}</span>
              <span className="text-zinc-600">bekliyor</span>
              <span className="text-zinc-600">·</span>
              <span className="text-emerald-400">{nudgeStats.nudgeSent}</span>
              <span className="text-zinc-600">gönderildi</span>
            </div>
          </div>
        </div>

        {/* 24h Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Toplam</div>
            <div className="text-xl font-semibold text-white mt-1">{nudgeStats.total}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="text-red-400/70 text-xs font-medium uppercase tracking-wider">Acil (&lt;6s)</div>
            <div className="text-xl font-semibold text-red-400 mt-1">{nudgeStats.urgent}</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <div className="text-amber-400/70 text-xs font-medium uppercase tracking-wider">Bekliyor</div>
            <div className="text-xl font-semibold text-amber-400 mt-1">{nudgeStats.pending}</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
            <div className="text-emerald-400/70 text-xs font-medium uppercase tracking-wider">Gönderildi</div>
            <div className="text-xl font-semibold text-emerald-400 mt-1">{nudgeStats.nudgeSent}</div>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showNudged}
              onChange={(e) => setShowNudged(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <span className="text-sm text-zinc-400">Mesaj gönderilenleri de göster</span>
          </label>
        </div>

        {/* 24h Window Users Table */}
        {nudgeLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : filteredNudgeUsers.length === 0 ? (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-6 text-center text-zinc-500">
            {showNudged ? 'Henüz kullanıcı yok' : 'Mesaj gönderilecek kullanıcı yok'}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Telefon</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Kalan Süre</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Mesaj Sayısı</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">İlk Mesaj</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Durum</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNudgeUsers.slice(0, 20).map((user) => (
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
                          {user.hoursRemaining.toFixed(1)}s
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-sm">{user.messageCount}</td>
                      <td className="px-4 py-3 text-zinc-400 text-sm truncate max-w-[200px]" title={user.firstMessage}>
                        {user.firstMessage || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {user.nudgeSent ? (
                          <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                            Gönderildi
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                            Bekliyor
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <a
                            href={`https://wa.me/${user.phoneNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors"
                          >
                            Mesaj Gönder
                          </a>
                          {!user.nudgeSent && (
                            <button
                              onClick={() => markAsNudged(user.phoneNumber)}
                              disabled={markingNudge === user.phoneNumber}
                              className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors disabled:opacity-50"
                            >
                              {markingNudge === user.phoneNumber ? '...' : 'Tamamlandı'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredNudgeUsers.length > 20 && (
              <div className="px-4 py-2 border-t border-zinc-800/50 text-center text-zinc-500 text-sm">
                +{filteredNudgeUsers.length - 20} daha...
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-zinc-800/50"></div>

      {/* Call List Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">İletişim Listesi</h2>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Toplam</div>
            <div className="text-2xl font-semibold text-white mt-1">{items.length}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Bekleyen</div>
            <div className="text-2xl font-semibold text-amber-400 mt-1">{pendingCount}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">İletişime Geçildi</div>
            <div className="text-2xl font-semibold text-emerald-400 mt-1">{contactedCount}</div>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="mb-4 flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showContacted}
              onChange={(e) => setShowContacted(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
            />
            <span className="text-sm text-zinc-400">İletişime geçilmiş olanları da göster</span>
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/50">
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 w-12">Tamamlandı</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Telefon</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">İletişim Nedeni</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Notlar</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">İletişim Tarihi</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">Eklenme</th>
                    <th className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        {showContacted ? 'Liste boş' : 'İletişime geçilecek kimse yok'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr
                        key={item.phoneNumber}
                        className={`border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors ${
                          item.calledAt ? 'opacity-60' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!item.calledAt}
                            onChange={() => toggleContacted(item.phoneNumber, item.calledAt)}
                            disabled={updatingPhone === item.phoneNumber}
                            className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <Link
                              href={`/profile/${item.phoneNumber}`}
                              className="font-mono text-sm text-white hover:text-blue-400 transition-colors"
                            >
                              {formatPhoneNumber(item.phoneNumber)}
                            </Link>
                            {item.autoAdded && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Oto
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Reason */}
                        <td className="px-4 py-3">
                          {editingReason === item.phoneNumber ? (
                            <select
                              value={item.reason}
                              onChange={(e) => updateReason(item.phoneNumber, e.target.value)}
                              autoFocus
                              onBlur={() => setEditingReason(null)}
                              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white w-full"
                            >
                              <option value="">Seçiniz...</option>
                              {CALL_REASONS.map((reason) => (
                                <option key={reason} value={reason}>
                                  {reason}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditingReason(item.phoneNumber)}
                              className="text-sm text-left hover:text-white transition-colors w-full"
                            >
                              {item.reason || (
                                <span className="text-zinc-500 italic">Neden seç...</span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Notes */}
                        <td className="px-4 py-3">
                          {editingNotes === item.phoneNumber ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={tempNotes}
                                onChange={(e) => setTempNotes(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveNotes(item.phoneNumber);
                                  if (e.key === 'Escape') {
                                    setEditingNotes(null);
                                    setTempNotes('');
                                  }
                                }}
                                autoFocus
                                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white flex-1"
                                placeholder="Not ekle..."
                              />
                              <button
                                onClick={() => saveNotes(item.phoneNumber)}
                                className="text-emerald-400 hover:text-emerald-300 text-sm"
                              >
                                Kaydet
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingNotes(item.phoneNumber);
                                setTempNotes(item.notes);
                              }}
                              className="text-sm text-left hover:text-white transition-colors w-full"
                            >
                              {item.notes || (
                                <span className="text-zinc-500 italic">Not ekle...</span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Called At */}
                        <td className="px-4 py-3 text-zinc-400 text-sm">
                          {item.calledAt ? (
                            <span className="text-emerald-400">{formatDate(item.calledAt)}</span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>

                        {/* Added At */}
                        <td className="px-4 py-3 text-zinc-500 text-sm">
                          {formatDate(item.addedAt)}
                        </td>

                        {/* Delete */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeFromList(item.phoneNumber)}
                            disabled={updatingPhone === item.phoneNumber}
                            className="text-red-400 hover:text-red-300 text-sm"
                            title="Listeden sil"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
