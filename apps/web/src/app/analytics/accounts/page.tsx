'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardFromAccounts, getTransactions } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';

function Money({ value, currency, size = 'base' }: { value: number; currency: string; size?: 'base' | 'xl' }) {
  const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(value);
  const cls = size === 'xl' ? 'text-2xl font-semibold' : 'text-base font-medium';
  return <span className={cls} data-amount>{formatted}</span>;
}

export default function AccountsAnalyticsPage() {
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardFromAccounts,
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions', { limit: '1000' }],
    queryFn: () => getTransactions({ limit: '1000' }),
    enabled: !!data,
  });

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Failed to load accounts data.</div>;

  // Sort transactions by date
  const sortedTransactions = [...allTransactions]
    .filter(tx => tx.date && typeof tx.date === 'string')
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Calculate balance at a specific date for an account
  const getBalanceAtDate = (d: Date, accountId: string): number => {
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);

    const acc = data.accounts.find(a => a.id === accountId);
    if (!acc) return 0;

    const createdAt = acc.createdAt 
      ? (typeof acc.createdAt === 'string' ? parseISO(acc.createdAt) : new Date(acc.createdAt)) 
      : ninetyDaysAgo;

    let balance = 0;

    if (createdAt <= dEnd) {
      balance = acc.balance;
    }

    sortedTransactions.forEach(tx => {
      if (tx.accountId === accountId) {
        const txDate = parseISO(tx.date);
        if (txDate >= createdAt && txDate <= dEnd) {
          if (tx.type === 'income') balance += tx.amount;
          else if (tx.type === 'expense') balance -= tx.amount;
        }
      }
    });

    return balance;
  };

  const getCurrentAccountBalance = (accountId: string): number => getBalanceAtDate(today, accountId);

  // Sort accounts by current balance (descending)
  const sortedAccounts = [...data.accounts].sort((a, b) => {
    const balanceA = getCurrentAccountBalance(a.id);
    const balanceB = getCurrentAccountBalance(b.id);
    return balanceB - balanceA;
  });

  // Toggle account selection
  const toggleAccount = (accountId: string) => {
    const newSet = new Set(selectedAccountIds);
    if (newSet.has(accountId)) {
      newSet.delete(accountId);
    } else {
      newSet.add(accountId);
    }
    setSelectedAccountIds(newSet);
  };

  // Color palette for accounts
  const accountColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#14b8a6', // teal
  ];

  // Find the earliest account creation date
  const earliestCreationDate = data.accounts.reduce((earliest, acc) => {
    if (!acc.createdAt) return earliest;
    const createdAt = typeof acc.createdAt === 'string' ? parseISO(acc.createdAt) : new Date(acc.createdAt);
    return createdAt < earliest ? createdAt : earliest;
  }, new Date());

  // Build chart data from earliest account creation to today
  const chartData: Array<{ date: string; dateLabel: string; total?: number; [key: string]: string | number | undefined }> = [];
  
  const chartStartDate = new Date(earliestCreationDate);
  chartStartDate.setHours(0, 0, 0, 0); // Start of day
  const chartEndDate = new Date(today);

  const currentDate = new Date(chartStartDate);
  while (currentDate <= chartEndDate) {
    const dataPoint: any = {
      date: format(currentDate, 'yyyy-MM-dd'),
      dateLabel: format(currentDate, 'dd MMM'),
    };

    // Add balance for each account and calculate total of selected accounts
    let totalSelectedBalance = 0;
    data.accounts.forEach((acc) => {
      const balance = getBalanceAtDate(currentDate, acc.id);
      dataPoint[`account_${acc.id}`] = balance;
      
      // Add to total if this account is selected
      if (selectedAccountIds.has(acc.id)) {
        totalSelectedBalance += balance;
      }
    });

    // Add total field for selected accounts
    if (selectedAccountIds.size > 1) {
      dataPoint.total = totalSelectedBalance;
    }

    chartData.push(dataPoint);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Only show accounts that are selected
  const accountsToShow = data.accounts.filter(acc => selectedAccountIds.has(acc.id));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Accounts Analytics</h1>

      {/* Accounts grid - sorted by balance */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Accounts (ordered by balance)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAccounts.map((acc) => {
            const isSelected = selectedAccountIds.has(acc.id);
            return (
              <button
                key={acc.id}
                onClick={() => toggleAccount(acc.id)}
                className={`text-left bg-white rounded-xl border-2 shadow-sm p-4 transition-all hover:shadow-md ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                }`}
              >
                <p className="text-sm font-medium text-slate-700">{acc.name}</p>
                <p className="text-xs text-slate-400 capitalize mb-2">{acc.type} · {acc.currency}</p>
                <Money value={getCurrentAccountBalance(acc.id)} currency={acc.currency} size="xl" />
                {acc.createdAt && (
                  <p className="text-xs text-slate-400 mt-1">
                    Opened {format(parseISO(acc.createdAt), 'dd MMM yyyy')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
        {selectedAccountIds.size > 0 && (
          <p className="text-xs text-slate-500 mt-2">
            {selectedAccountIds.size} account{selectedAccountIds.size !== 1 ? 's' : ''} selected. Click to deselect.
          </p>
        )}
      </div>

      {/* Account evolution chart - only show when accounts are selected */}
      {selectedAccountIds.size > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Account Balance Evolution (Full History)
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => new Intl.NumberFormat(undefined).format(v)} />
              <Legend />
              {/* Show total line when multiple accounts selected */}
              {selectedAccountIds.size > 1 && (
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#1f2937"
                  dot={false}
                  strokeWidth={3}
                  name="Total"
                  legendType="line"
                />
              )}
              {/* Individual account lines */}
              {accountsToShow.map((acc, idx) => (
                <Line
                  key={acc.id}
                  type="monotone"
                  dataKey={`account_${acc.id}`}
                  stroke={accountColors[idx % accountColors.length]}
                  dot={false}
                  strokeWidth={2}
                  name={acc.name}
                  legendType="line"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
