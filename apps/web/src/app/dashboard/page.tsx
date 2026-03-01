'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboard, getTransactions } from '@/lib/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';

function Money({ value, currency, size = 'base' }: { value: number; currency: string; size?: 'base' | 'xl' | '2xl' }) {
  const formatted = new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'code' }).format(value);
  const cls = size === '2xl' ? 'text-4xl font-bold' : size === 'xl' ? 'text-2xl font-semibold' : 'text-base font-medium';
  return <span className={cls} data-amount>{formatted}</span>;
}

function SummaryCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions', { limit: '1000' }],
    queryFn: () => getTransactions({ limit: '1000' }),
    enabled: !!data,
  });

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>;
  if (isError || !data) return <div className="p-8 text-red-500">Failed to load dashboard.</div>;

  // Compute historical balance from transactions (last 7 days)
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Set to end of day to include all today's transactions
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000); // used for opening balance fallback
  
  // Sort actual transactions by date (used for chart historical data)
  const sortedTransactions = [...allTransactions]
    .filter(tx => tx.date && typeof tx.date === 'string')
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

  // Compute each account's original opening balance:
  // openingBalance = currentBalance - sum(all past transactions for that account)
  const pastTxSumByAccount: Record<string, number> = {};
  sortedTransactions.forEach(tx => {
    const txDate = parseISO(tx.date);
    if (txDate > today) return;
    if (tx.type === 'income') pastTxSumByAccount[tx.accountId] = (pastTxSumByAccount[tx.accountId] ?? 0) + tx.amount;
    else if (tx.type === 'expense') pastTxSumByAccount[tx.accountId] = (pastTxSumByAccount[tx.accountId] ?? 0) - tx.amount;
  });

  // For each display day, balance = sum of opening balances of accounts created on/before that day
  //                                + sum of all transactions on/before that day
  const getBalanceAtDate = (d: Date): number => {
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);

    // Sum opening balances of accounts that existed by this date
    let balance = 0;
    data.accounts.forEach(acc => {
      // If createdAt missing, assume account always existed
      const createdAt = acc.createdAt ? (typeof acc.createdAt === 'string' ? parseISO(acc.createdAt) : new Date(acc.createdAt)) : ninetyDaysAgo;
      if (createdAt <= dEnd) {
        const openingBalance = acc.balance - (pastTxSumByAccount[acc.id] ?? 0);
        balance += openingBalance;
      }
    });

    // Add all transactions up to this date
    sortedTransactions.forEach(tx => {
      const txDate = parseISO(tx.date);
      if (txDate <= dEnd) {
        if (tx.type === 'income') balance += tx.amount;
        else if (tx.type === 'expense') balance -= tx.amount;
      }
    });

    return balance;
  };

  // Build chart data: 7 days back → today + 90 days forward
  const chartData: Array<{ date: string; dateLabel: string; balance: number }> = [];
  const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

  const histDate = new Date(sevenDaysAgo);
  while (histDate <= ninetyDaysFromNow) {
    chartData.push({
      date: format(histDate, 'yyyy-MM-dd'),
      dateLabel: format(histDate, 'dd MMM'),
      balance: getBalanceAtDate(histDate),
    });
    histDate.setDate(histDate.getDate() + 1);
  }

  // Remove duplicate dates
  const uniqueData = chartData.filter((item, index, arr) =>
    index === arr.length - 1 || item.date !== arr[index + 1].date
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Total Cash">
          <Money value={data.totalCash} currency={data.baseCurrency} size="2xl" />
        </SummaryCard>
        <SummaryCard title="End-of-Month Projection">
          <Money value={data.endOfMonthProjection} currency={data.baseCurrency} size="xl" />
        </SummaryCard>
        <SummaryCard title="Income MTD">
          <span className="text-2xl font-semibold text-green-600" data-amount>
            +{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.baseCurrency, currencyDisplay: 'code' }).format(data.mtd.income)}
          </span>
        </SummaryCard>
        <SummaryCard title="Expenses MTD">
          <span className="text-2xl font-semibold text-red-500" data-amount>
            -{new Intl.NumberFormat(undefined, { style: 'currency', currency: data.baseCurrency, currencyDisplay: 'code' }).format(data.mtd.expenses)}
          </span>
        </SummaryCard>
      </div>

      {/* Forecast chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Cash Balance (Last 7 Days + 90-Day Forecast)</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={uniqueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => new Intl.NumberFormat(undefined).format(v)} />
            <Legend />
            <Line type="monotone" dataKey="balance" stroke="#4f46e5" dot={false} strokeWidth={2} name="Balance" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Accounts list */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Accounts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.accounts.map(acc => (
            <div key={acc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p className="text-sm font-medium text-slate-700">{acc.name}</p>
              <p className="text-xs text-slate-400 capitalize mb-2">{acc.type} · {acc.currency}</p>
              <Money value={acc.balance} currency={acc.currency} size="xl" />
              {acc.createdAt && (
                <p className="text-xs text-slate-400 mt-1">Opened {format(parseISO(acc.createdAt), 'dd MMM yyyy')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
