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

// Removed "İş fonksiyonu kullanılmamış" - that's handled in 24 saat penceresi
const CALL_REASONS = [
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

export default function IletisimListesiPage() {
  const [items, setItems] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [showContacted, setShowContacted] = useState(false);

  useEffect(() => {
    fetchCallList();
  }, []);

  const fetchCallList = async () => {
    try {
      const res = await fetch('/api/call-list');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Filter out "İş fonksiyonu kullanılmamış" items - they belong to 24 saat penceresi
      const filtered = (data.items || []).filter(
        (item: CallListItem) => item.reason !== 'İş fonksiyonu kullanılmamış'
      );
      setItems(filtered);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link href="/crm" className="text-zinc-500 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">İletişim Listesi</h1>
          <p className="text-zinc-500 text-sm mt-1">Aranması veya iletişime geçilmesi gereken kullanıcılar</p>
        </div>
      </div>

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
      <div className="flex items-center space-x-4">
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
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!item.calledAt}
                          onChange={() => toggleContacted(item.phoneNumber, item.calledAt)}
                          disabled={updatingPhone === item.phoneNumber}
                          className="w-5 h-5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 cursor-pointer"
                        />
                      </td>
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
                      <td className="px-4 py-3 text-zinc-400 text-sm">
                        {item.calledAt ? (
                          <span className="text-emerald-400">{formatDate(item.calledAt)}</span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-sm">
                        {formatDate(item.addedAt)}
                      </td>
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
  );
}
