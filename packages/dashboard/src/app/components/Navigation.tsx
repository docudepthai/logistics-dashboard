'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

const tabs = [
  { name: 'Overview', href: '/' },
  { name: 'Conversations', href: '/conversations' },
  { name: 'CRM', href: '/crm' },
  { name: 'Routes', href: '/map' },
  { name: 'Analytics', href: '/analytics' },
  { name: 'Finance', href: '/finance' },
  { name: 'Users', href: '/users' },
  { name: 'Health', href: '/health' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <nav className="border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                <span className="text-black font-bold text-xs">L</span>
              </div>
              <span className="text-white font-medium tracking-tight">logistics</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center space-x-1">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`px-4 py-1.5 text-sm font-medium transition-all duration-200 rounded ${
                    isActive
                      ? 'text-white bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-300'
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
              <span className="text-zinc-500 text-xs font-medium">Live</span>
            </div>

            {session?.user && (
              <div className="flex items-center space-x-3 pl-3 border-l border-zinc-800">
                <span className="text-zinc-400 text-sm">{session.user.name}</span>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-zinc-500 hover:text-white text-xs font-medium transition-colors"
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
