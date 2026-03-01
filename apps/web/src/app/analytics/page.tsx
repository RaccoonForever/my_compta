'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getYearlyEarnings, getCategoryExpenses, getNetCashflow, getCategories } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

type Tab = 'earnings' | 'expenses' | 'cashflow';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('earnings');
  const [year, setYear] = useState(new Date().getFullYear());

  const earningsQ = useQuery({
    queryKey: ['analytics-earnings', year],
    queryFn: () => getYearlyEarnings(year),
    enabled: tab === 'earnings',
  });
  const expensesQ = useQuery({
    queryKey: ['analytics-expenses', year],
    queryFn: () => getCategoryExpenses(year),
    enabled: tab === 'expenses',
  });
  const cashflowQ = useQuery({
    queryKey: ['analytics-cashflow', year],
    queryFn: () => getNetCashflow(`${year}-01-01`, `${year}-12-31`),
    enabled: tab === 'cashflow',
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'earnings', label: 'Earnings' },
    { key: 'expenses', label: 'Expenses by Category' },
    { key: 'cashflow', label: 'Net Cashflow' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">‹</button>
          <span className="font-semibold text-slate-700 w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">›</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'}
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Earnings */}
      {tab === 'earnings' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
          {earningsQ.isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
          {earningsQ.data && (
            <>
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Income</p>
                  <p className="text-3xl font-bold text-green-600" data-amount>
                    {new Intl.NumberFormat(undefined).format(earningsQ.data.totalIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Expenses</p>
                  <p className="text-3xl font-bold text-red-500" data-amount>
                    {new Intl.NumberFormat(undefined).format(earningsQ.data.totalExpenses)}
                  </p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={earningsQ.data.monthly.map(m => ({ month: MONTHS[m.month - 1], income: m.income, expenses: m.expenses }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* Expenses by Category */}
      {tab === 'expenses' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {expensesQ.isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
          {expensesQ.data && (
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <PieChart width={280} height={280}>
                <Pie
                  data={expensesQ.data}
                  dataKey="total"
                  nameKey="categoryId"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ categoryId }) => catById[categoryId]?.name ?? 'Uncategorized'}
                  labelLine={false}
                >
                  {expensesQ.data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => new Intl.NumberFormat(undefined).format(v)} />
              </PieChart>
              <div className="flex-1 space-y-2">
                {expensesQ.data.sort((a, b) => b.total - a.total).map((item, i) => (
                  <div key={item.categoryId ?? 'none'} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="text-sm text-slate-600 flex-1">
                      {item.categoryId ? catById[item.categoryId]?.name ?? item.categoryId : 'Uncategorized'}
                    </span>
                    <span className="text-sm font-semibold text-slate-800" data-amount>
                      {new Intl.NumberFormat(undefined).format(item.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Net Cashflow */}
      {tab === 'cashflow' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {cashflowQ.isLoading && <p className="text-slate-400 text-sm">Loading…</p>}
          {cashflowQ.data && (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cashflowQ.data.map(m => ({ month: m.month.slice(0, 7), income: m.income, expenses: m.expenses, net: m.net }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
