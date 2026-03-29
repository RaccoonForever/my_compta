'use client';

import Link from 'next/link';

const PAGES = [
  {
    href: '/analytics/basic',
    title: 'Basic Analytics',
    description: 'Earnings, expenses by category, and net cashflow.',
  },
  {
    href: '/analytics/accounts',
    title: 'Accounts Analytics',
    description: 'Account-level balances and trends over time.',
  },
  {
    href: '/analytics/categories',
    title: 'Categories Analytics',
    description: 'Category spending patterns and breakdowns.',
  },
];

export default function AnalyticsIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PAGES.map(page => (
          <Link
            key={page.href}
            href={page.href}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-primary-300 hover:shadow-md transition"
          >
            <h2 className="text-sm font-semibold text-slate-800">{page.title}</h2>
            <p className="text-xs text-slate-500 mt-2">{page.description}</p>
            <span className="text-xs text-primary-600 font-medium mt-4 inline-block">Open</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
