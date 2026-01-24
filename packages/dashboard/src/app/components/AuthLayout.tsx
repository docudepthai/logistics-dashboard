'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

const ADMIN_USER = 'caglar.binici';

// Map paths to permission IDs
const PATH_TO_PERMISSION: Record<string, string> = {
  '/': 'overview',
  '/health': 'health',
  '/problems': 'problems',
  '/users': 'users',
  '/user-analytics': 'user-analytics',
  '/conversations': 'conversations',
  '/crm/pasif-kullanicilar': 'crm-inactive',
  '/crm/iletisim-listesi': 'crm-contacts',
  '/analytics': 'analytics',
  '/finance': 'finance',
  '/map': 'map',
  '/employees': 'admin', // Admin only
};

// Permission ID to path mapping (for finding fallback redirect)
const PERMISSION_TO_PATH: Record<string, string> = {
  'overview': '/',
  'health': '/health',
  'problems': '/problems',
  'users': '/users',
  'user-analytics': '/user-analytics',
  'conversations': '/conversations',
  'crm-inactive': '/crm/pasif-kullanicilar',
  'crm-contacts': '/crm/iletisim-listesi',
  'analytics': '/analytics',
  'finance': '/finance',
  'map': '/map',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const isLoginPage = pathname === '/login';
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);

  // Check page permissions
  useEffect(() => {
    if (status !== 'authenticated' || isLoginPage) {
      setPermissionChecked(true);
      setHasPermission(true);
      return;
    }

    const username = session?.user?.name;

    // Admin can access everything
    if (username === ADMIN_USER) {
      setPermissionChecked(true);
      setHasPermission(true);
      return;
    }

    const permissionId = PATH_TO_PERMISSION[pathname];

    // If path not in map, allow
    if (!permissionId) {
      setPermissionChecked(true);
      setHasPermission(true);
      return;
    }

    // Admin-only pages - fetch permissions to find redirect target
    if (permissionId === 'admin') {
      fetch('/api/user-permissions')
        .then(res => res.json())
        .then(data => {
          const allowedPages = data.allowedPages || [];
          const firstAllowedPermission = allowedPages.find((p: string) => PERMISSION_TO_PATH[p]);
          const redirectPath = firstAllowedPermission ? PERMISSION_TO_PATH[firstAllowedPermission] : '/';
          router.push(redirectPath);
          setHasPermission(false);
          setPermissionChecked(true);
        })
        .catch(() => {
          router.push('/');
          setHasPermission(false);
          setPermissionChecked(true);
        });
      return;
    }

    // Fetch and check permissions
    fetch('/api/user-permissions')
      .then(res => res.json())
      .then(data => {
        const allowedPages = data.allowedPages || [];
        if (allowedPages.includes(permissionId)) {
          setHasPermission(true);
        } else {
          setHasPermission(false);
          // Find first allowed page to redirect to
          const firstAllowedPermission = allowedPages.find((p: string) => PERMISSION_TO_PATH[p]);
          const redirectPath = firstAllowedPermission ? PERMISSION_TO_PATH[firstAllowedPermission] : null;
          if (redirectPath && redirectPath !== pathname) {
            router.push(redirectPath);
          }
          // If no allowed pages or already on that page, will show "no access" message
        }
        setPermissionChecked(true);
      })
      .catch(() => {
        setHasPermission(true);
        setPermissionChecked(true);
      });
  }, [status, session, pathname, isLoginPage, router]);

  // Show nothing while checking auth (prevents flash)
  if (status === 'loading' || !permissionChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect to login if not authenticated (and not already on login page)
  if (status === 'unauthenticated' && !isLoginPage) {
    router.push('/login');
    return null;
  }

  // No permission - show access denied message
  if (!hasPermission && !isLoginPage) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-neutral-500 mb-2">Bu sayfaya erişim izniniz yok</div>
          <div className="text-neutral-600 text-sm">Yöneticinizle iletişime geçin</div>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-black flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
