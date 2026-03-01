'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { AddTransactionModal } from './AddTransactionModal';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: '⚙' },
];

export function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  if (pathname === '/login') return null;

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
          {/* Logo */}
          <Link href="/dashboard" className="font-bold text-primary-600 text-lg tracking-tight">
            MyCompta
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname.startsWith(item.href)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Global + Add */}
          <button
            onClick={() => setAddOpen(true)}
            className="ml-auto flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">Add Transaction</span>
          </button>

          {user && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[140px]">
                {user.email}
              </span>
              <button
                onClick={() => void signOut()}
                className="text-xs font-medium text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-300 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
