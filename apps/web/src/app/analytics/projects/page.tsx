'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getProjects,
  getProjectAnalytics,
  getCategories,
  getAccounts,
} from '@/lib/api';

const CHART_COLORS = [
  '#4f46e5', '#10b981', '#f59e0b', '#ef4444',
  '#6366f1', '#ec4899', '#14b8a6', '#f97316',
];

export default function ProjectsAnalyticsPage() {
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', true],
    queryFn: () => getProjects(true),
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => getAccounts() });

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showCategoryChart, setShowCategoryChart] = useState(false);
  const [showSubcategoryChart, setShowSubcategoryChart] = useState(false);
  const [showNetChart, setShowNetChart] = useState(false);
  const [showCategoryPie, setShowCategoryPie] = useState(false);
  const [showSubcategoryPie, setShowSubcategoryPie] = useState(false);

  const analyticsQ = useQuery({
    queryKey: ['analytics-project', selectedProjectId],
    queryFn: () => getProjectAnalytics(selectedProjectId),
    enabled: selectedProjectId.length > 0,
  });

  const projectById = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p])),
    [projects],
  );
  const categoryById = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c])),
    [categories],
  );
  const accountById = useMemo(
    () => Object.fromEntries(accounts.map(a => [a.id, a])),
    [accounts],
  );

  const chartData = useMemo(() => {
    if (!analyticsQ.data) return { rows: [], categoryNames: [] as string[] };

    const monthMap = new Map<string, { label: string; cats: Map<string, number> }>();
    const categorySet = new Set<string>();

    for (const tx of analyticsQ.data.transactions) {
      if (tx.type !== 'expense') continue;
      const sortKey = format(parseISO(tx.date), 'yyyy-MM');
      const label = format(parseISO(tx.date), 'MMM yyyy');
      const catName = tx.categoryId
        ? (categoryById[tx.categoryId]?.name ?? 'Unknown')
        : 'Uncategorized';

      categorySet.add(catName);

      if (!monthMap.has(sortKey)) {
        monthMap.set(sortKey, { label, cats: new Map<string, number>() });
      }
      const bucket = monthMap.get(sortKey)!;
      bucket.cats.set(catName, (bucket.cats.get(catName) ?? 0) + tx.amount);
    }

    const rows = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { label, cats }]) => {
        const row: Record<string, string | number> = { month: label };
        for (const [cat, total] of cats) {
          row[cat] = Math.round(total * 100) / 100;
        }
        return row;
      });

    return { rows, categoryNames: [...categorySet] };
  }, [analyticsQ.data, categoryById]);

  const netChartData = useMemo(() => {
    if (!analyticsQ.data) return [];

    const monthMap = new Map<string, { label: string; income: number; expenses: number }>();

    for (const tx of analyticsQ.data.transactions) {
      const sortKey = format(parseISO(tx.date), 'yyyy-MM');
      const label = format(parseISO(tx.date), 'MMM yyyy');

      if (!monthMap.has(sortKey)) {
        monthMap.set(sortKey, { label, income: 0, expenses: 0 });
      }
      const bucket = monthMap.get(sortKey)!;
      if (tx.type === 'income') bucket.income += tx.amount;
      else bucket.expenses += tx.amount;
    }

    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { label, income, expenses }]) => ({
        month: label,
        Income: Math.round(income * 100) / 100,
        Expenses: Math.round(expenses * 100) / 100,
        Net: Math.round((income - expenses) * 100) / 100,
      }));
  }, [analyticsQ.data]);

  const subcategoryChartData = useMemo(() => {
    if (!analyticsQ.data) return { rows: [], subcategoryNames: [] as string[] };

    const monthMap = new Map<string, { label: string; subs: Map<string, number> }>();
    const subcategorySet = new Set<string>();

    for (const tx of analyticsQ.data.transactions) {
      if (tx.type !== 'expense') continue;
      const sortKey = format(parseISO(tx.date), 'yyyy-MM');
      const label = format(parseISO(tx.date), 'MMM yyyy');
      const subName = tx.subcategory ?? 'No subcategory';

      subcategorySet.add(subName);

      if (!monthMap.has(sortKey)) {
        monthMap.set(sortKey, { label, subs: new Map<string, number>() });
      }
      const bucket = monthMap.get(sortKey)!;
      bucket.subs.set(subName, (bucket.subs.get(subName) ?? 0) + tx.amount);
    }

    const rows = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, { label, subs }]) => {
        const row: Record<string, string | number> = { month: label };
        for (const [sub, total] of subs) {
          row[sub] = Math.round(total * 100) / 100;
        }
        return row;
      });

    return { rows, subcategoryNames: [...subcategorySet] };
  }, [analyticsQ.data]);

  const categoryPieData = useMemo(() => {
    if (!analyticsQ.data) return [];
    const totals = new Map<string, number>();
    for (const tx of analyticsQ.data.transactions) {
      if (tx.type !== 'expense') continue;
      const name = tx.categoryId
        ? (categoryById[tx.categoryId]?.name ?? 'Unknown')
        : 'Uncategorized';
      totals.set(name, (totals.get(name) ?? 0) + tx.amount);
    }
    return [...totals.entries()].map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));
  }, [analyticsQ.data, categoryById]);

  const subcategoryPieData = useMemo(() => {
    if (!analyticsQ.data) return [];
    const totals = new Map<string, number>();
    for (const tx of analyticsQ.data.transactions) {
      if (tx.type !== 'expense') continue;
      const name = tx.subcategory ?? 'No subcategory';
      totals.set(name, (totals.get(name) ?? 0) + tx.amount);
    }
    return [...totals.entries()].map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
    }));
  }, [analyticsQ.data]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Projects Analytics</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <label className="block text-sm font-medium text-slate-700">Select a project</label>
        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="w-full md:w-96 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          disabled={projectsLoading}
        >
          <option value="">Choose a project...</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {selectedProjectId && projectById[selectedProjectId]?.description && (
          <p className="text-sm text-slate-500">{projectById[selectedProjectId].description}</p>
        )}
      </div>

      {!selectedProjectId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center text-sm text-slate-500">
          Select a project to view tagged transactions analytics.
        </div>
      )}

      {selectedProjectId && analyticsQ.isLoading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-sm text-slate-400">
          Loading project analytics…
        </div>
      )}

      {selectedProjectId && analyticsQ.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Total Income</p>
              <p className="text-3xl font-bold text-green-600" data-amount>
                {new Intl.NumberFormat(undefined).format(analyticsQ.data.totalIncome)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Total Expenses</p>
              <p className="text-3xl font-bold text-red-500" data-amount>
                {new Intl.NumberFormat(undefined).format(analyticsQ.data.totalExpenses)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Net</p>
              <p
                className={`text-3xl font-bold ${analyticsQ.data.net >= 0 ? 'text-emerald-600' : 'text-orange-600'}`}
                data-amount
              >
                {new Intl.NumberFormat(undefined).format(analyticsQ.data.net)}
              </p>
            </div>
          </div>

          {analyticsQ.data.transactions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4" data-testid="graph-toggles">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Graphs</p>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCategoryChart}
                    onChange={e => setShowCategoryChart(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                    aria-label="Expenses by Category"
                  />
                  Expenses by Category
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSubcategoryChart}
                    onChange={e => setShowSubcategoryChart(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                    aria-label="Expenses by Subcategory"
                  />
                  Expenses by Subcategory
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showNetChart}
                    onChange={e => setShowNetChart(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                    aria-label="Monthly Net"
                  />
                  Monthly Net
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showCategoryPie}
                    onChange={e => setShowCategoryPie(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                    aria-label="Pie by Category"
                  />
                  Pie by Category
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showSubcategoryPie}
                    onChange={e => setShowSubcategoryPie(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300"
                    aria-label="Pie by Subcategory"
                  />
                  Pie by Subcategory
                </label>
              </div>
            </div>
          )}

          {showCategoryChart && chartData.rows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="project-chart">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Expenses by Category</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData.rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: unknown) =>
                      new Intl.NumberFormat(undefined).format(value as number)
                    }
                  />
                  <Legend />
                  {chartData.categoryNames.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="stack"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {showSubcategoryChart && subcategoryChartData.rows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="subcategory-chart">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Expenses by Subcategory</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={subcategoryChartData.rows} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: unknown) =>
                      new Intl.NumberFormat(undefined).format(value as number)
                    }
                  />
                  <Legend />
                  {subcategoryChartData.subcategoryNames.map((sub, i) => (
                    <Bar
                      key={sub}
                      dataKey={sub}
                      stackId="stack"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {showNetChart && netChartData.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="net-chart">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Monthly Net (Income vs Expenses)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={netChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: unknown) =>
                      new Intl.NumberFormat(undefined).format(value as number)
                    }
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Bar dataKey="Income" fill="#10b981" opacity={0.85} />
                  <Bar dataKey="Expenses" fill="#ef4444" opacity={0.85} />
                  <Line
                    type="monotone"
                    dataKey="Net"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#4f46e5' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {(showCategoryPie || showSubcategoryPie) && (categoryPieData.length > 0 || subcategoryPieData.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {showCategoryPie && categoryPieData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="category-pie">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Expenses by Category</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {categoryPieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown) =>
                          new Intl.NumberFormat(undefined).format(value as number)
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {showSubcategoryPie && subcategoryPieData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6" data-testid="subcategory-pie">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Expenses by Subcategory</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={subcategoryPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {subcategoryPieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown) =>
                          new Intl.NumberFormat(undefined).format(value as number)
                        }
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analyticsQ.data.transactions.map(tx => {
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {format(parseISO(tx.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {tx.label}
                        {tx.note && <span className="ml-2 text-xs text-slate-400">{tx.note}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{accountById[tx.accountId]?.name ?? tx.accountId}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.categoryId ? categoryById[tx.categoryId]?.name ?? tx.categoryId : '—'}</td>
                      <td className="px-4 py-3 text-slate-500 capitalize">{tx.type}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isIncome ? 'text-green-600' : 'text-red-500'}`} data-amount>
                        {isIncome ? '+' : '−'}
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: tx.currency, currencyDisplay: 'code' }).format(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  );
                })}
                {analyticsQ.data.transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                      No transaction tagged with this project.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
