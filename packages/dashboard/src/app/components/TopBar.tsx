'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

const displayNames: Record<string, string> = {
  'caglar.binici': 'Caglar Binici',
  'sadettin.okan': 'Sadettin Okan',
  'atakan.akarsu': 'Atakan Akarsu',
};

const ADMIN_USER = 'caglar.binici';

const motivationalQuotes = [
  "The best time to start was yesterday. The second best time is now.",
  "Small steps every day lead to massive results.",
  "Be better than you were yesterday.",
  "Your only limit is the one you set for yourself.",
  "Success is built on daily disciplines.",
  "The grind never lies. Keep pushing.",
  "Dream big. Start small. Act now.",
  "Comfort zone is where dreams go to die.",
  "Every expert was once a beginner.",
  "Fall seven times, stand up eight.",
  "Progress, not perfection.",
  "Hard work beats talent when talent doesn't work hard.",
  "The pain of discipline or the pain of regret. Choose wisely.",
  "Winners are not people who never fail, but people who never quit.",
  "Your future self will thank you.",
  "Doubt kills more dreams than failure ever will.",
  "Stay hungry. Stay foolish.",
  "What you do today matters.",
  "Greatness is not a destination, it's a journey.",
  "Be the energy you want to attract.",
];

function getDisplayName(username: string | null | undefined): string {
  if (!username) return 'User';
  return displayNames[username] || username;
}

export default function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const displayName = getDisplayName(session?.user?.name);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = session?.user?.name === ADMIN_USER;

  useEffect(() => {
    // Start with a random quote
    setQuoteIndex(Math.floor(Math.random() * motivationalQuotes.length));

    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setQuoteIndex((prev) => (prev + 1) % motivationalQuotes.length);
        setIsVisible(true);
      }, 300);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAdminMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-neutral-800/50 bg-neutral-950/50 backdrop-blur-sm flex items-center px-6">
      {/* Spacer for centering */}
      <div className="flex-1" />

      {/* Motivational Quote - Centered */}
      <div className="flex-[2] flex justify-center px-4 overflow-hidden">
        <span
          className={`text-neutral-500 text-sm italic transition-opacity duration-300 whitespace-nowrap truncate max-w-full ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          "{motivationalQuotes[quoteIndex]}"
        </span>
      </div>

      {/* User info - Right aligned */}
      <div className="flex-1 flex justify-end">
        {session?.user && (
          <div className="flex items-center space-x-4">
            {/* User name with admin dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => isAdmin && setShowAdminMenu(!showAdminMenu)}
                className={`flex items-center space-x-2 ${isAdmin ? 'cursor-pointer hover:bg-neutral-800/50 rounded-lg px-2 py-1 transition-colors' : ''}`}
              >
                <div className="w-7 h-7 bg-neutral-800 rounded-full flex items-center justify-center">
                  <span className="text-neutral-400 text-xs font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-neutral-400 text-sm">{displayName}</span>
                {isAdmin && (
                  <>
                    {/* Admin badge */}
                    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {/* Dropdown arrow */}
                    <svg className={`w-4 h-4 text-neutral-500 transition-transform ${showAdminMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {/* Admin dropdown menu */}
              {isAdmin && showAdminMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50">
                  <button
                    onClick={() => {
                      setShowAdminMenu(false);
                      router.push('/employees');
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors flex items-center space-x-3 rounded-lg"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                    <span>Employees</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-neutral-500 hover:text-white text-xs font-medium transition-colors px-3 py-1.5 rounded-md hover:bg-neutral-800"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
