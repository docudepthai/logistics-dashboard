'use client';

import { useEffect, useState } from 'react';

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

export default function AranacaklarPage() {
  const [items, setItems] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editingReason, setEditingReason] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState<string>('');
  const [showCalled, setShowCalled] = useState(false);

  useEffect(() => {
    fetchCallList();
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

  const toggleCalled = async (phoneNumber: string, currentlyCalledAt: string | null) => {
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
      console.error('Failed to toggle called:', err);
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

  const filteredItems = showCalled ? items : items.filter(item => !item.calledAt);
  const calledCount = items.filter(item => item.calledAt).length;
  const uncalledCount = items.filter(item => !item.calledAt).length;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Call List</h1>
          <p className="text-neutral-500 text-sm mt-1">Users that need to be called</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Total</div>
            <div className="text-2xl font-semibold text-white mt-1">{items.length}</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">To Call</div>
            <div className="text-2xl font-semibold text-amber-400 mt-1">{uncalledCount}</div>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg p-4">
            <div className="text-neutral-500 text-xs font-medium uppercase tracking-wider">Called</div>
            <div className="text-2xl font-semibold text-emerald-400 mt-1">{calledCount}</div>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="mb-4 flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCalled}
              onChange={(e) => setShowCalled(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-emerald-500"
            />
            <span className="text-sm text-neutral-400">Show called users</span>
          </label>
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
          <div className="bg-neutral-900/50 border border-neutral-800/50 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-800/50">
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3 w-12">Called</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Phone</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Call Reason</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Notes</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Called At</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3">Added</th>
                    <th className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                        {showCalled ? 'List is empty' : 'No one to call'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr
                        key={item.phoneNumber}
                        className={`border-b border-neutral-800/30 hover:bg-neutral-800/30 transition-colors ${
                          item.calledAt ? 'opacity-60' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={!!item.calledAt}
                            onChange={() => toggleCalled(item.phoneNumber, item.calledAt)}
                            disabled={updatingPhone === item.phoneNumber}
                            className="w-5 h-5 rounded border-neutral-600 bg-neutral-800 text-emerald-500 cursor-pointer"
                          />
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm text-white">
                              {formatPhoneNumber(item.phoneNumber)}
                            </span>
                            {item.autoAdded && (
                              <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                Auto
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

                        {/* Called At */}
                        <td className="px-4 py-3 text-neutral-400 text-sm">
                          {item.calledAt ? (
                            <span className="text-emerald-400">{formatDate(item.calledAt)}</span>
                          ) : (
                            <span className="text-neutral-600">-</span>
                          )}
                        </td>

                        {/* Added At */}
                        <td className="px-4 py-3 text-neutral-500 text-sm">
                          {formatDate(item.addedAt)}
                        </td>

                        {/* Delete */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeFromList(item.phoneNumber)}
                            disabled={updatingPhone === item.phoneNumber}
                            className="text-red-400 hover:text-red-300 text-sm"
                            title="Remove from list"
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
