'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageGuard from '../../components/PageGuard';

interface CallListItem {
  phoneNumber: string;
  reason: string;
  notes: string;
  calledAt: string | null;
  addedAt: string;
  autoAdded: boolean;
}

const CALL_REASONS = [
  'System error occurred and was fixed',
  'Asking for vehicle we don\'t have',
  'Question about trial period',
  'Call for information',
  'Question about international shipping',
  'Question about intra-city shipping',
  'Marketing inquiry',
];

const ITEMS_PER_PAGE = 50;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Invalid Date';
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

function isValidPhoneNumber(phone: string): boolean {
  // Must be at least 10 digits and contain only numbers
  return /^\d{10,}$/.test(phone);
}

function IletisimListesiPageContent() {
  const [items, setItems] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [showContacted, setShowContacted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchCallList();
  }, []);

  const fetchCallList = async () => {
    try {
      const res = await fetch('/api/call-list');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Filter out invalid entries: empty phone numbers and "Is fonksiyonu kullanilmamis"
      const filtered = (data.items || []).filter(
        (item: CallListItem) =>
          isValidPhoneNumber(item.phoneNumber) &&
          item.reason !== 'Is fonksiyonu kullanilmamis'
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
    if (!confirm('Are you sure you want to remove this user from the list?')) return;

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

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [showContacted]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Contact List</h1>
        <p className="text-neutral-500 text-sm mt-1">Users that need to be called or contacted</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Total</div>
          <div className="text-2xl font-semibold text-white mt-1">{items.length}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Pending</div>
          <div className="text-2xl font-semibold text-amber-400 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
          <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Contacted</div>
          <div className="text-2xl font-semibold text-emerald-400 mt-1">{contactedCount}</div>
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showContacted}
            onChange={(e) => setShowContacted(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-emerald-500"
          />
          <span className="text-sm text-neutral-400">Show contacted users</span>
        </label>
        {totalPages > 1 && (
          <div className="text-sm text-neutral-500">
            Page {currentPage} / {totalPages} ({filteredItems.length} records)
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      ) : (
        <>
          <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800/50">
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3 w-12">Completed</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Phone</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Contact Reason</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Notes</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Contacted At</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Added</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                        {showContacted ? 'List is empty' : 'No one to contact'}
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr
                        key={item.phoneNumber}
                        className={`border-b border-neutral-800/30 hover:bg-neutral-800/30 transition-colors ${
                          item.calledAt ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!item.calledAt}
                            onChange={() => toggleContacted(item.phoneNumber, item.calledAt)}
                            disabled={updatingPhone === item.phoneNumber}
                            className="w-5 h-5 rounded border-neutral-600 bg-neutral-800 text-emerald-500 cursor-pointer"
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
                                Auto
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
                              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white w-full"
                            >
                              <option value="">Select...</option>
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
                                <span className="text-neutral-500 italic">Select reason...</span>
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
                                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm text-white flex-1"
                                placeholder="Add note..."
                              />
                              <button
                                onClick={() => saveNotes(item.phoneNumber)}
                                className="text-emerald-400 hover:text-emerald-300 text-sm"
                              >
                                Save
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
                                <span className="text-neutral-500 italic">Add note...</span>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-400 text-sm">
                          {item.calledAt ? (
                            <span className="text-emerald-400">{formatDate(item.calledAt)}</span>
                          ) : (
                            <span className="text-neutral-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-neutral-500 text-sm">
                          {formatDate(item.addedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeFromList(item.phoneNumber)}
                            disabled={updatingPhone === item.phoneNumber}
                            className="text-red-400 hover:text-red-300 text-sm"
                            title="Remove from list"
                          >
                            x
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
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
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 text-neutral-300 rounded text-sm transition-colors"
              >
                Previous
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
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
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
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:hover:bg-neutral-800 text-neutral-300 rounded text-sm transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function IletisimListesiPage() {
  return (
    <PageGuard permissionId="iletisim-listesi">
      <IletisimListesiPageContent />
    </PageGuard>
  );
}
