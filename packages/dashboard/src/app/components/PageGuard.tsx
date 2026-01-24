'use client';

import { usePagePermission } from '../hooks/usePagePermission';

interface PageGuardProps {
  permissionId: string;
  children: React.ReactNode;
}

export default function PageGuard({ permissionId, children }: PageGuardProps) {
  const { hasPermission, isLoading } = usePagePermission(permissionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasPermission) {
    return null; // AuthLayout will handle redirect
  }

  return <>{children}</>;
}
