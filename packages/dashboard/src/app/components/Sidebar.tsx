'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  subItems?: { name: string; href: string }[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    name: 'Operations',
    items: [
      { name: 'Overview', href: '/', icon: 'chart' },
      { name: 'Problems', href: '/problems', icon: 'alert' },
      { name: 'Health', href: '/health', icon: 'heart' },
    ],
  },
  {
    name: 'Customers',
    items: [
      { name: 'Conversations', href: '/conversations', icon: 'chat' },
      { name: 'Users', href: '/users', icon: 'users' },
      { name: 'User Analytics', href: '/user-analytics', icon: 'analytics' },
      {
        name: 'CRM',
        href: '/crm',
        icon: 'phone',
        subItems: [
          { name: '24 Saat Penceresi', href: '/crm/24-saat-penceresi' },
          { name: 'Iletisim Listesi', href: '/crm/iletisim-listesi' },
        ],
      },
    ],
  },
  {
    name: 'Business',
    items: [
      { name: 'Analytics', href: '/analytics', icon: 'trending' },
      { name: 'Finance', href: '/finance', icon: 'dollar' },
    ],
  },
  {
    name: 'Data',
    items: [
      { name: 'Routes', href: '/map', icon: 'map' },
    ],
  },
];

const icons: Record<string, React.ReactNode> = {
  chart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13h4v8H3v-8zm7-5h4v13h-4V8zm7-5h4v18h-4V3z" />
    </svg>
  ),
  alert: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  analytics: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  heart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  chat: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  trending: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  dollar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  map: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
};

export default function Sidebar() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Auto-expand CRM if we're on a CRM sub-page
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/crm')) {
      return ['CRM'];
    }
    return [];
  });

  const toggleExpand = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Auto-expand parent when on sub-page
  const isSubPageActive = (item: NavItem) => {
    return item.subItems?.some(sub => pathname === sub.href) || false;
  };

  return (
    <aside className="w-56 bg-zinc-950 border-r border-zinc-800/50 flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-zinc-800/50">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center">
            <span className="text-black font-bold text-sm">P</span>
          </div>
          <span className="text-white font-semibold tracking-tight">Patron</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navigation.map((group) => (
          <div key={group.name} className="mb-6">
            <h3 className="px-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              {group.name}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const hasSubItems = item.subItems && item.subItems.length > 0;
                const isExpanded = expandedItems.includes(item.name) || isSubPageActive(item);

                return (
                  <div key={item.name}>
                    {hasSubItems ? (
                      <>
                        <button
                          onClick={() => toggleExpand(item.name)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                            isActive || isSubPageActive(item)
                              ? 'bg-zinc-800 text-white'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className={isActive || isSubPageActive(item) ? 'text-white' : 'text-zinc-500'}>
                              {icons[item.icon]}
                            </span>
                            <span>{item.name}</span>
                          </div>
                          <svg
                            className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isExpanded && item.subItems && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.subItems.map((subItem) => {
                              const isSubActive = pathname === subItem.href;
                              return (
                                <Link
                                  key={subItem.href}
                                  href={subItem.href}
                                  className={`block px-3 py-1.5 rounded-lg text-xs transition-all duration-150 ${
                                    isSubActive
                                      ? 'bg-zinc-800/70 text-white'
                                      : 'text-zinc-500 hover:text-white hover:bg-zinc-800/30'
                                  }`}
                                >
                                  {subItem.name}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                          isActive
                            ? 'bg-zinc-800 text-white'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-zinc-500'}>
                          {icons[item.icon]}
                        </span>
                        <span>{item.name}</span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-zinc-800/50">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full pulse-glow" />
          <span className="text-zinc-500 text-xs">System Operational</span>
        </div>
      </div>
    </aside>
  );
}
