'use client';

import { useSession, signOut } from 'next-auth/react';

const displayNames: Record<string, string> = {
  'caglar.binici': 'Caglar Binici',
  'sadettin.okan': 'Sadettin Okan',
  'atakan.akarsu': 'Atakan Akarsu',
};

function getDisplayName(username: string | null | undefined): string {
  if (!username) return 'User';
  return displayNames[username] || username;
}

export default function TopBar() {
  const { data: session } = useSession();
  const displayName = getDisplayName(session?.user?.name);

  return (
    <header className="h-14 border-b border-zinc-800/50 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-end px-6">
      {session?.user && (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-zinc-800 rounded-full flex items-center justify-center">
              <span className="text-zinc-400 text-xs font-medium">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-zinc-400 text-sm">{displayName}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-zinc-500 hover:text-white text-xs font-medium transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-800"
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
