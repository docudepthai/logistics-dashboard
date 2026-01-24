'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Page {
  id: string;
  name: string;
  href: string;
}

interface Employee {
  username: string;
  displayName: string;
  allowedPages: string[];
}

interface EmployeesData {
  employees: Employee[];
  allPages: Page[];
}

const ADMIN_USER = 'caglar.binici';

export default function EmployeesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<EmployeesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.name !== ADMIN_USER) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    if (session?.user?.name === ADMIN_USER) {
      fetchEmployees();
    }
  }, [session]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const togglePage = async (username: string, pageId: string) => {
    if (!data) return;

    const employee = data.employees.find(e => e.username === username);
    if (!employee) return;

    setSaving(username);
    setSuccessMessage(null);

    const currentPages = employee.allowedPages;
    const newPages = currentPages.includes(pageId)
      ? currentPages.filter(p => p !== pageId)
      : [...currentPages, pageId];

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, allowedPages: newPages }),
      });

      if (!res.ok) throw new Error('Failed to update permissions');

      // Update local state
      setData({
        ...data,
        employees: data.employees.map(e =>
          e.username === username ? { ...e, allowedPages: newPages } : e
        ),
      });
      setSuccessMessage(`Updated permissions for ${employee.displayName}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const selectAll = async (username: string) => {
    if (!data) return;

    const employee = data.employees.find(e => e.username === username);
    if (!employee) return;

    setSaving(username);
    const allPageIds = data.allPages.map(p => p.id);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, allowedPages: allPageIds }),
      });

      if (!res.ok) throw new Error('Failed to update permissions');

      setData({
        ...data,
        employees: data.employees.map(e =>
          e.username === username ? { ...e, allowedPages: allPageIds } : e
        ),
      });
      setSuccessMessage(`Granted all permissions to ${employee.displayName}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const deselectAll = async (username: string) => {
    if (!data) return;

    const employee = data.employees.find(e => e.username === username);
    if (!employee) return;

    setSaving(username);

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, allowedPages: [] }),
      });

      if (!res.ok) throw new Error('Failed to update permissions');

      setData({
        ...data,
        employees: data.employees.map(e =>
          e.username === username ? { ...e, allowedPages: [] } : e
        ),
      });
      setSuccessMessage(`Removed all permissions from ${employee.displayName}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (session?.user?.name !== ADMIN_USER) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-white">Employee Management</h1>
          </div>
          <p className="text-neutral-500">Manage employee access to dashboard pages</p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <p className="text-emerald-400">{successMessage}</p>
          </div>
        )}

        {/* Employees List */}
        <div className="space-y-6">
          {data?.employees.map((employee) => (
            <div
              key={employee.username}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-6"
            >
              {/* Employee Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center">
                    <span className="text-neutral-300 text-lg font-medium">
                      {employee.displayName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">{employee.displayName}</h2>
                    <p className="text-neutral-500 text-sm">{employee.username}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-neutral-500 text-sm">
                    {employee.allowedPages.length} / {data.allPages.length} pages
                  </span>
                  {saving === employee.username && (
                    <svg className="w-5 h-5 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => selectAll(employee.username)}
                  disabled={saving === employee.username}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 rounded-lg hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
                >
                  Select All
                </button>
                <button
                  onClick={() => deselectAll(employee.username)}
                  disabled={saving === employee.username}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
                >
                  Remove All
                </button>
              </div>

              {/* Page Permissions Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.allPages.map((page) => {
                  const isAllowed = employee.allowedPages.includes(page.id);
                  return (
                    <button
                      key={page.id}
                      onClick={() => togglePage(employee.username, page.id)}
                      disabled={saving === employee.username}
                      className={`p-3 rounded-lg border transition-all ${
                        isAllowed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-neutral-800/50 border-neutral-700 text-neutral-500 hover:border-neutral-600'
                      } disabled:opacity-50`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{page.name}</span>
                        {isAllowed ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/')}
            className="text-neutral-500 hover:text-white text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
