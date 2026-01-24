'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';

const displayNames: Record<string, string> = {
  'caglar.binici': 'Caglar Binici',
  'sadettin.okan': 'Sadettin Okan',
  'atakan.akarsu': 'Atakan Akarsu',
};

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
  const displayName = getDisplayName(session?.user?.name);
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

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
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-neutral-800 rounded-full flex items-center justify-center">
                <span className="text-neutral-400 text-xs font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-neutral-400 text-sm">{displayName}</span>
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
