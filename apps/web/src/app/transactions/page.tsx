'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { getTransactions, deleteTransaction, getAccounts, getCategories } from '@/lib/api';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({
    accountId: '', categoryId: '', type: '', from: '', to: '', limit: '50',
  });
  const [deleteModal, setDeleteModal] = useState<{ transactionId: string; transactionLabel: string } | null>(null);

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

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      setDeleteModal(null);
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Transactions</h1>

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
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Account</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map(tx => {
                const acc = accountById[tx.accountId];
                const cat = tx.categoryId ? catById[tx.categoryId] : null;
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
                    <td className="px-4 py-3 text-slate-500">{acc?.name ?? tx.accountId}</td>
                    <td className="px-4 py-3 text-slate-500">{cat?.name ?? '—'}</td>
                    <td className={clsx('px-4 py-3 text-right font-semibold tabular-nums', {
                      'text-green-600': isIncome,
                      'text-red-500': !isIncome,
                    })} data-amount>
                      {isIncome ? '+' : '−'}
                      {new Intl.NumberFormat(undefined, { style: 'currency', currency: tx.currency, currencyDisplay: 'code' }).format(Math.abs(tx.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteModal({ transactionId: tx.id, transactionLabel: tx.label })}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">No transactions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <ConfirmationModal
          open={true}
          title={`Delete "${deleteModal.transactionLabel}"?`}
          message="This transaction will be permanently deleted. This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={deleteMut.isPending}
          onConfirm={() => void deleteMut.mutate(deleteModal.transactionId)}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
