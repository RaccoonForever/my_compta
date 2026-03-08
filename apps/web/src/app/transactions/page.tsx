'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { getTransactions, deleteMultipleTransactions, getAccounts, getCategories, updateTransaction } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

export default function TransactionsPage() {
  const qc = useQueryClient();
  
  // Initialize date filters: last 30 days to today (computed once)
  const { defaultFrom, defaultTo } = useMemo(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      defaultFrom: format(thirtyDaysAgo, 'yyyy-MM-dd'),
      defaultTo: format(today, 'yyyy-MM-dd'),
    };
  }, []);
  
  const [filters, setFilters] = useState({
    accountId: '', categoryId: '', type: '', from: defaultFrom, to: defaultTo, limit: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    accountId: '', categoryId: '', type: '', from: defaultFrom, to: defaultTo, limit: '',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'uncategorized'>('all');
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    type: 'expense',
    amount: '',
    currency: '',
    date: '',
    label: '',
    categoryId: '',
    subcategory: '',
    note: '',
    isForecasted: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const activeFilters = Object.fromEntries(
    Object.entries(appliedFilters).filter(([, v]) => v !== ''),
  );

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', activeFilters],
    queryFn: () => getTransactions(activeFilters),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => getAccounts() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });

  const accountById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const uncategorizedTransactions = transactions.filter(
    tx => !tx.categoryId || !tx.subcategory,
  );

  const appliedSummaryParts = [
    `Range: ${appliedFilters.from || 'Any'} -> ${appliedFilters.to || 'Any'}`,
  ];
  if (appliedFilters.accountId) {
    appliedSummaryParts.push(`Account: ${accountById[appliedFilters.accountId]?.name ?? appliedFilters.accountId}`);
  }
  if (appliedFilters.categoryId) {
    appliedSummaryParts.push(`Category: ${catById[appliedFilters.categoryId]?.name ?? appliedFilters.categoryId}`);
  }
  if (appliedFilters.type) {
    appliedSummaryParts.push(`Type: ${appliedFilters.type}`);
  }
  const appliedSummary = appliedSummaryParts.join(' · ');

  const editingTx = editingTxId
    ? transactions.find(tx => tx.id === editingTxId) ?? null
    : null;

  // Pagination calculations
  const totalPages = Math.ceil(transactions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTransactions = transactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const filtersKey = JSON.stringify(activeFilters);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setCurrentPage(1);
    setPrevFiltersKey(filtersKey);
  }

  const deleteMut = useMutation({
    mutationFn: (ids: string[]) => deleteMultipleTransactions(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      setSelectedIds(new Set());
      setDeleteModal(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editingTx) return;
      return updateTransaction(editingTx.id, {
        amount: Number(editForm.amount),
        currency: editForm.currency,
        type: editForm.type,
        date: editForm.date,
        label: editForm.label,
        categoryId: editForm.categoryId || undefined,
        subcategory: editForm.subcategory || undefined,
        note: editForm.note || undefined,
        isForecasted: editForm.isForecasted,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      setEditingTxId(null);
      setSelectedIds(new Set());
    },
  });

  const handleToggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedTransactions.length && paginatedTransactions.every(tx => selectedIds.has(tx.id))) {
      // Unselect all on current page
      const newSet = new Set(selectedIds);
      paginatedTransactions.forEach(tx => newSet.delete(tx.id));
      setSelectedIds(newSet);
    } else {
      // Select all on current page
      const newSet = new Set(selectedIds);
      paginatedTransactions.forEach(tx => newSet.add(tx.id));
      setSelectedIds(newSet);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size > 0) {
      setDeleteModal(true);
    }
  };

  const handleSearch = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    const resetFilters = { accountId: '', categoryId: '', type: '', from: defaultFrom, to: defaultTo, limit: '' };
    setFilters(resetFilters);
    setAppliedFilters(resetFilters);
    setCurrentPage(1);
  };

  const handleEditSelected = () => {
    if (selectedIds.size !== 1) return;
    const selectedId = Array.from(selectedIds)[0];
    const tx = transactions.find(t => t.id === selectedId);
    if (!tx) return;
    setEditingTxId(tx.id);
    setEditForm({
      type: tx.type,
      amount: String(tx.amount),
      currency: tx.currency,
      date: tx.date.split('T')[0] ?? '',
      label: tx.label,
      categoryId: tx.categoryId ?? '',
      subcategory: tx.subcategory ?? '',
      note: tx.note ?? '',
      isForecasted: tx.isForecasted ?? false,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Transactions</h1>
        <div className="flex items-center gap-2">
          {selectedIds.size === 1 && (
            <button
              onClick={handleEditSelected}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Delete {selectedIds.size} selected
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={clsx(
            'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'all'
              ? 'bg-primary-600 text-white'
              : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          All transactions
        </button>
        <button
          onClick={() => setActiveTab('uncategorized')}
          className={clsx(
            'flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'uncategorized'
              ? 'bg-primary-600 text-white'
              : 'text-slate-600 hover:bg-slate-50',
          )}
        >
          Uncategorized ({uncategorizedTransactions.length})
        </button>
      </div>

      {/* Filters */}
      {activeTab === 'all' && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-2 md:grid-cols-7 gap-3">
        <select
          value={filters.accountId}
          onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select
          value={filters.categoryId}
          onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filters.type}
          onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>

        </select>
        <input
          type="date"
          value={filters.from}
          onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={filters.to}
          onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          placeholder="To"
        />
        <button
          onClick={handleSearch}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
        >
          Search
        </button>
        <button
          onClick={handleClearFilters}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>
      )}

      {activeTab === 'all' && (
        <div className="text-xs text-slate-500 px-1">
          Applied: {appliedSummary}
        </div>
      )}

      {isLoading && <div className="text-slate-400 text-sm">Loading…</div>}

      {/* Table */}
      {!isLoading && activeTab === 'all' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={paginatedTransactions.length > 0 && paginatedTransactions.every(tx => selectedIds.has(tx.id))}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Subcategory</th>
                <th className="px-4 py-3 text-left">Forecast</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.map(tx => {
                const acc = accountById[tx.accountId];
                const cat = tx.categoryId ? catById[tx.categoryId] : null;
                const isIncome = tx.type === 'income';
                return (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tx.id)}
                        onChange={() => handleToggleSelection(tx.id)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {format(parseISO(tx.date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {tx.label}
                      {tx.note && <span className="ml-2 text-xs text-slate-400">{tx.note}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{acc?.name ?? tx.accountId}</td>
                    <td className="px-4 py-3 text-slate-500">{cat?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{tx.subcategory ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          tx.isForecasted
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {tx.isForecasted ? 'Forecast' : 'Actual'}
                      </span>
                    </td>
                    <td className={clsx('px-4 py-3 text-right font-semibold tabular-nums', {
                      'text-green-600': isIncome,
                      'text-red-500': !isIncome,
                    })} data-amount>
                      {isIncome ? '+' : '−'}
                      {new Intl.NumberFormat(undefined, { style: 'currency', currency: tx.currency, currencyDisplay: 'code' }).format(Math.abs(tx.amount))}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Uncategorized Transactions */}
      {!isLoading && activeTab === 'uncategorized' && (
        <div className="space-y-3" data-testid="uncategorized-section">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wide">
                <tr>
                  <th className="px-4 py-3"></th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Label</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Subcategory</th>
                  <th className="px-4 py-3 text-left">Forecast</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uncategorizedTransactions.map(tx => {
                  const acc = accountById[tx.accountId];
                  const cat = tx.categoryId ? catById[tx.categoryId] : null;
                  const isIncome = tx.type === 'income';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => handleToggleSelection(tx.id)}
                          className="w-4 h-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {format(parseISO(tx.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {tx.label}
                        {tx.note && <span className="ml-2 text-xs text-slate-400">{tx.note}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{acc?.name ?? tx.accountId}</td>
                      <td className="px-4 py-3 text-slate-500">{cat?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{tx.subcategory ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            tx.isForecasted
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {tx.isForecasted ? 'Forecast' : 'Actual'}
                        </span>
                      </td>
                      <td className={clsx('px-4 py-3 text-right font-semibold tabular-nums', {
                        'text-green-600': isIncome,
                        'text-red-500': !isIncome,
                      })}>
                        {isIncome ? '+' : '−'}
                        {new Intl.NumberFormat(undefined, { style: 'currency', currency: tx.currency, currencyDisplay: 'code' }).format(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  );
                })}
                {uncategorizedTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                      All transactions are categorized.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && activeTab === 'all' && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1}–{Math.min(endIndex, transactions.length)} of {transactions.length} transactions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                // Show first page, last page, current page, and pages around current
                const showPage = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                const showEllipsis = (page === 2 && currentPage > 3) || (page === totalPages - 1 && currentPage < totalPages - 2);
                
                if (showEllipsis) {
                  return <span key={page} className="px-2 text-slate-400">...</span>;
                }
                
                if (!showPage) {
                  return null;
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      page === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <ConfirmationModal
          open={true}
          title={`Delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`}
          message="These transactions will be permanently deleted. This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={deleteMut.isPending}
          onConfirm={() => void deleteMut.mutate(Array.from(selectedIds))}
          onCancel={() => setDeleteModal(false)}
        />
      )}

      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-screen overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Edit Transaction</h2>
              <button
                onClick={() => setEditingTxId(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEditForm(f => ({ ...f, type: t }))}
                  className={clsx(
                    'flex-1 py-2 capitalize transition-colors',
                    editForm.type === t
                      ? t === 'income' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <select
                value={editForm.currency}
                onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}
                className="border border-slate-200 rounded-lg px-2 py-2.5 text-sm bg-slate-50"
              >
                {['CHF', 'EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={editForm.amount}
                onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
            </div>

            <input
              type="date"
              value={editForm.date}
              onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />

            <input
              type="text"
              placeholder="Label (e.g. Rent)"
              value={editForm.label}
              onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />

            <select
              value={editForm.categoryId}
              onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value, subcategory: '' }))}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="">Category (optional)</option>
              {categories
                .filter(c => editForm.type === 'income' ? c.kind === 'income' : c.kind === 'expense')
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select
              value={editForm.subcategory}
              onChange={e => setEditForm(f => ({ ...f, subcategory: e.target.value }))}
              disabled={!editForm.categoryId}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="">Subcategory (optional)</option>
              {editForm.categoryId && catById[editForm.categoryId]?.subcategories?.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Note (optional)"
              value={editForm.note}
              onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={editForm.isForecasted}
                onChange={e => setEditForm(f => ({ ...f, isForecasted: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Forecasted transaction
            </label>

            {updateMut.isError && (
              <p className="text-red-500 text-sm">{(updateMut.error as Error).message}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditingTxId(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => updateMut.mutate()}
                disabled={!editForm.amount || !editForm.date || updateMut.isPending}
                className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {updateMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
