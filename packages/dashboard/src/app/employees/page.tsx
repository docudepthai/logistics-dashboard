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
  email: string;
  allowedPages: string[];
  status: 'active' | 'inactive';
  createdAt?: string;
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

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<Employee | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    email: '',
    tempPassword: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const createEmployee = async () => {
    if (!formData.username || !formData.displayName || !formData.email || !formData.tempPassword) {
      setFormError('All fields are required');
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError('Invalid email format');
      return;
    }

    // Validate username (no spaces, lowercase)
    if (!/^[a-z0-9._-]+$/.test(formData.username)) {
      setFormError('Username must be lowercase letters, numbers, dots, underscores, or hyphens only');
      return;
    }

    setCreating(true);
    setFormError(null);

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          username: formData.username,
          displayName: formData.displayName,
          email: formData.email,
          tempPassword: formData.tempPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to create employee');
      }

      setSuccessMessage(`Employee "${formData.displayName}" created successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowCreateModal(false);
      setFormData({ username: '', displayName: '', email: '', tempPassword: '' });
      fetchEmployees();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create employee');
    } finally {
      setCreating(false);
    }
  };

  const updateEmployee = async () => {
    if (!showEditModal) return;

    setCreating(true);
    setFormError(null);

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          username: showEditModal.username,
          displayName: formData.displayName || showEditModal.displayName,
          email: formData.email || showEditModal.email,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to update employee');
      }

      setSuccessMessage(`Employee "${formData.displayName || showEditModal.displayName}" updated successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowEditModal(null);
      setFormData({ username: '', displayName: '', email: '', tempPassword: '' });
      fetchEmployees();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setCreating(false);
    }
  };

  const deleteEmployee = async () => {
    if (!showDeleteModal) return;

    setDeleting(true);

    try {
      const res = await fetch('/api/employees', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: showDeleteModal.username }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete employee');
      }

      setSuccessMessage(`Employee "${showDeleteModal.displayName}" deleted successfully`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowDeleteModal(null);
      fetchEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee');
    } finally {
      setDeleting(false);
    }
  };

  const resetPassword = async (username: string) => {
    setSaving(username);

    try {
      const res = await fetch('/api/employees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          username,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to reset password');
      }

      setSuccessMessage(`Password reset email sent. New temporary password: ${result.tempPassword}`);
      setTimeout(() => setSuccessMessage(null), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSaving(null);
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

      setData({
        ...data,
        employees: data.employees.map(e =>
          e.username === username ? { ...e, allowedPages: newPages } : e
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const selectAll = async (username: string) => {
    if (!data) return;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const deselectAll = async (username: string) => {
    if (!data) return;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (session?.user?.name !== ADMIN_USER) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Employee Management</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {data?.employees.length || 0} employees · Manage access and permissions
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ username: '', displayName: '', email: '', tempPassword: '' });
            setFormError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Employee</span>
        </button>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
          <p className="text-emerald-400">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
          <p className="text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Employees Grid */}
      <div className="grid gap-4">
        {data?.employees.map((employee) => (
          <div
            key={employee.username}
            className="bg-neutral-900/50 border border-neutral-800/50 rounded-xl overflow-hidden"
          >
            {/* Employee Header */}
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">
                    {employee.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-semibold text-white">{employee.displayName}</h2>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      employee.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {employee.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-neutral-500 text-sm">{employee.username}</p>
                  <p className="text-neutral-600 text-xs">{employee.email}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="text-right mr-4">
                  <div className="text-sm text-neutral-400">
                    {employee.allowedPages.length} / {data.allPages.length} pages
                  </div>
                  <div className="text-xs text-neutral-600">
                    Created {formatDate(employee.createdAt)}
                  </div>
                </div>

                {/* Actions */}
                <button
                  onClick={() => {
                    setFormData({
                      username: employee.username,
                      displayName: employee.displayName,
                      email: employee.email,
                      tempPassword: '',
                    });
                    setFormError(null);
                    setShowEditModal(employee);
                  }}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button
                  onClick={() => resetPassword(employee.username)}
                  disabled={saving === employee.username}
                  className="p-2 text-neutral-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Reset Password"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowDeleteModal(employee)}
                  className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>

                <button
                  onClick={() => setExpandedEmployee(expandedEmployee === employee.username ? null : employee.username)}
                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <svg
                    className={`w-5 h-5 transition-transform ${expandedEmployee === employee.username ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Permissions Panel */}
            {expandedEmployee === employee.username && (
              <div className="px-5 pb-5 border-t border-neutral-800/50 pt-4">
                {/* Quick Actions */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-neutral-400">Page Permissions</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => selectAll(employee.username)}
                      disabled={saving === employee.username}
                      className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 rounded-lg hover:bg-emerald-400/20 transition-colors disabled:opacity-50"
                    >
                      Grant All
                    </button>
                    <button
                      onClick={() => deselectAll(employee.username)}
                      disabled={saving === employee.username}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-400/10 rounded-lg hover:bg-red-400/20 transition-colors disabled:opacity-50"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                {/* Permissions Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {data.allPages.map((page) => {
                    const isAllowed = employee.allowedPages.includes(page.id);
                    return (
                      <button
                        key={page.id}
                        onClick={() => togglePage(employee.username, page.id)}
                        disabled={saving === employee.username}
                        className={`p-2.5 rounded-lg border transition-all text-left ${
                          isAllowed
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-neutral-800/30 border-neutral-700/50 text-neutral-500 hover:border-neutral-600'
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate">{page.name}</span>
                          {isAllowed ? (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {saving === employee.username && (
                  <div className="flex items-center justify-center mt-3 text-amber-400 text-sm">
                    <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {data?.employees.length === 0 && (
          <div className="text-center py-12 text-neutral-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>No employees yet</p>
            <p className="text-sm mt-1">Click "Add Employee" to create your first employee</p>
          </div>
        )}
      </div>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add New Employee</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-neutral-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                  placeholder="john.doe"
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
                <p className="text-xs text-neutral-600 mt-1">Lowercase letters, numbers, dots, underscores, hyphens</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Temporary Password</label>
                <input
                  type="text"
                  value={formData.tempPassword}
                  onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                  placeholder="TempPass123!"
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
                <p className="text-xs text-neutral-600 mt-1">Min 8 chars, uppercase, lowercase, number, special char</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-800 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createEmployee}
                disabled={creating}
                className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {creating && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{creating ? 'Creating...' : 'Create Employee'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowEditModal(null)} />
          <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Edit Employee</h3>
              <button onClick={() => setShowEditModal(null)} className="text-neutral-500 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Username</label>
                <input
                  type="text"
                  value={showEditModal.username}
                  disabled
                  className="w-full px-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-neutral-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-800 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(null)}
                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={updateEmployee}
                disabled={creating}
                className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {creating && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{creating ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteModal(null)} />
          <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="pt-6 pb-4 flex justify-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
            </div>

            <div className="px-6 pb-5 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Employee</h3>
              <p className="text-neutral-400 text-sm">
                Are you sure you want to delete <span className="text-white font-medium">{showDeleteModal.displayName}</span>?
                This will remove their Cognito account and all permissions.
              </p>
            </div>

            <div className="border-t border-neutral-800 flex">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 py-3.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors border-r border-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={deleteEmployee}
                disabled={deleting}
                className="flex-1 py-3.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center space-x-2"
              >
                {deleting && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
