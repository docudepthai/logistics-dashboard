'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

const ADMIN_USER = 'caglar.binici';

export function usePagePermission(permissionId: string) {
  const { data: session, status } = useSession();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      setHasPermission(false);
      return;
    }

    const username = session?.user?.name;

    // Admin always has permission
    if (username === ADMIN_USER) {
      setHasPermission(true);
      return;
    }

    // Fetch permissions
    fetch('/api/user-permissions')
      .then(res => res.json())
      .then(data => {
        const allowedPages = data.allowedPages || [];
        setHasPermission(allowedPages.includes(permissionId));
      })
      .catch(() => {
        setHasPermission(false);
      });
  }, [session, status, permissionId]);

  return {
    hasPermission,
    isLoading: hasPermission === null,
  };
}
