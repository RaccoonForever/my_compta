'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace('/login');
    } else if (user && isPublic) {
      router.replace('/dashboard');
    }
  }, [user, loading, isPublic, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-8 h-8 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Block render until redirect fires
  if (!user && !isPublic) return null;
  if (user && isPublic) return null;

  return <>{children}</>;
}
