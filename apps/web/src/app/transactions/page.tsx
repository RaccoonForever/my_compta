'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { getTransactions, deleteMultipleTransactions, getAccounts, getCategories } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    accountId: '', categoryId: '', type: '', from: '', to: '', limit: '50',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteModal, setDeleteModal] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const activeFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== ''),
  );

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', activeFilters],
    queryFn: () => getTransactions(activeFilters),
  });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => getAccounts() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });

  const accountById = Object.fromEntries(accounts.map(a => [a.id, a]));
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Transactions</h1>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Delete {selectedIds.size} selected
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
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
          onClick={() => setFilters({ accountId: '', categoryId: '', type: '', from: '', to: '', limit: '50' })}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      {isLoading && <div className="text-slate-400 text-sm">Loading…</div>}

      {/* Table */}
      {!isLoading && (
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
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
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
    </div>
  );
}
