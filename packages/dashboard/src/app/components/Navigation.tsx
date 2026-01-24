'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

const tabs = [
  { name: 'Overview', href: '/', id: 'overview' },
  { name: 'Conversations', href: '/conversations', id: 'conversations' },
  { name: 'CRM', href: '/crm', id: 'crm' },
  { name: 'Routes', href: '/map', id: 'map' },
  { name: 'Analytics', href: '/analytics', id: 'analytics' },
  { name: 'Finance', href: '/finance', id: 'finance' },
  { name: 'Users', href: '/users', id: 'users' },
  { name: 'Health', href: '/health', id: 'health' },
];

const ADMIN_USER = 'caglar.binici';

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [allowedPages, setAllowedPages] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (session?.user?.name) {
      // Admin always sees all tabs
      if (session.user.name === ADMIN_USER) {
        setIsAdmin(true);
        setAllowedPages(tabs.map(t => t.id));
        setLoaded(true);
      } else {
        // Fetch permissions for regular users
        fetch('/api/user-permissions')
          .then(res => res.json())
          .then(data => {
            setIsAdmin(data.isAdmin);
            setAllowedPages(data.allowedPages || []);
            setLoaded(true);
          })
          .catch(() => {
            // On error, show all tabs (fail open)
            setAllowedPages(tabs.map(t => t.id));
            setLoaded(true);
          });
      }
    }
  }, [session]);

  // Filter tabs based on permissions
  const visibleTabs = loaded
    ? tabs.filter(tab => allowedPages.includes(tab.id))
    : tabs; // Show all while loading to prevent flicker

  return (
    <nav className="border-b border-neutral-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                <span className="text-black font-bold text-xs">P</span>
              </div>
              <span className="text-white font-medium tracking-tight">Patron</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-1">
            {visibleTabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`px-4 py-1.5 text-sm font-medium transition-all duration-200 rounded ${
                    isActive
                      ? 'text-white bg-neutral-800'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>

          {/* User & Status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-glow" />
              <span className="text-neutral-500 text-xs font-medium">Live</span>
            </div>

            {session?.user && (
              <div className="flex items-center space-x-3 pl-3 border-l border-neutral-800">
                <span className="text-neutral-400 text-sm">{session.user.name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-neutral-500 hover:text-white text-xs font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
