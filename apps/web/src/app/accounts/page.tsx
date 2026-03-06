'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings,
  getAccounts,
  getTransactions,
  createAccount,
  updateAccount,
  archiveAccount,
  clearAccountTransactions,
  confirmCsvImport,
  type AccountResponse,
  type CreateAccountBody,
  type ImportSummary,
} from '@/lib/api';
import { ImportModal } from '@/components/ImportModal';
import { ConfirmationModal } from '@/components/ConfirmationModal';

const ACCOUNT_TYPES = ['bank', 'wallet', 'envelope', 'crypto', 'broker'];
const ACCOUNT_USAGES = ['Savings', 'Checking', 'Investment', 'Emergency Fund', 'Travel', 'Business'];
const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

export default function AccountsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AccountResponse | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedAccountForImport, setSelectedAccountForImport] = useState<string>('');
  const [clearTxAccount, setClearTxAccount] = useState<AccountResponse | null>(null);
  const [clearTxError, setClearTxError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateAccountBody & { usage?: string[] }>({ name: '', type: 'bank', currency: 'CHF', balance: 0, usage: [], createdAt: new Date().toISOString().split('T')[0] });

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => getSettings() });
  const { data: accounts = [], isLoading } = useQuery({ queryKey: ['accounts', true], queryFn: () => getAccounts(true) });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions', 'all'], queryFn: () => getTransactions({ limit: '5000' }) });
  const active = accounts.filter(a => !a.isArchived);
  const archived = accounts.filter(a => a.isArchived);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const effectiveBalance = (acc: AccountResponse): number => {
    const txSum = transactions
      .filter(tx => tx.accountId === acc.id && new Date(tx.date) <= today)
      .reduce((sum, tx) => {
        if (tx.type === 'income') return sum + tx.amount;
        if (tx.type === 'expense') return sum - tx.amount;
        return sum;
      }, 0);
    return acc.balance + txSum;
  };

  const handleImportConfirm = async (summary: ImportSummary) => {
    if (!selectedAccountForImport) {
      throw new Error('No account selected for import');
    }

    const result = await confirmCsvImport({
      summary,
      accountId: selectedAccountForImport,
      autoMapCategories: true,
      skipDuplicateCheck: false,
    });

    console.log('Import completed:', result);

    // Refresh transactions and accounts data
    await qc.invalidateQueries({ queryKey: ['transactions'] });
    await qc.invalidateQueries({ queryKey: ['accounts'] });

    // Check results and throw error if needed
    if (result.failedCount > 0 && result.createdCount === 0) {
      throw new Error(`Failed to import all transactions: ${result.errors?.join(', ') || 'Unknown error'}`);
    }

    // Return the result so the modal can display it
    return result;
  };

  const openImportModal = (accountId: string) => {
    setSelectedAccountForImport(accountId);
    setImportModalOpen(true);
  };

  // Initialize form currency from settings
  useEffect(() => {
    if (settings?.baseCurrency && form.currency === 'CHF' && !editing) {
      setForm(f => ({ ...f, currency: settings.baseCurrency }));
    }
  }, [settings, editing]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: CreateAccountBody = {
        name: form.name,
        type: form.type,
        currency: form.currency,
        balance: form.balance,
        createdAt: form.createdAt,
      };
      return editing
        ? updateAccount(editing.id, { name: form.name, type: form.type, currency: form.currency })
        : createAccount(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowForm(false);
      setEditing(null);
      setForm({ name: '', type: 'bank', currency: settings?.baseCurrency ?? 'CHF', balance: 0, usage: [], createdAt: new Date().toISOString().split('T')[0] });
    },
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveAccount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  const clearTxMut = useMutation({
    mutationFn: (accountId: string) => clearAccountTransactions(accountId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['transactions'] });
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      setClearTxError(null);
      setClearTxAccount(null);
    },
    onError: (error: Error) => {
      setClearTxError(error.message || 'Failed to clear account transactions');
    },
  });

  const openEdit = (acc: AccountResponse) => {
    setEditing(acc);
    setForm({ name: acc.name, type: acc.type, currency: acc.currency });
    setShowForm(true);
  };

  const getAccountTransactionCount = (accountId: string) =>
    transactions.filter(tx => tx.accountId === accountId).length;

  const handleConfirmClearTransactions = async () => {
    if (!clearTxAccount) return;
    await clearTxMut.mutateAsync(clearTxAccount.id);
  };

  if (isLoading) return <div className="p-8 text-slate-400">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">Accounts</h1>
        <button
          onClick={() => { setEditing(null); setForm({ name: '', type: 'bank', currency: settings?.baseCurrency ?? 'CHF', balance: 0, usage: [], createdAt: new Date().toISOString().split('T')[0] }); setShowForm(true); }}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          + New Account
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-slate-700">{editing ? 'Edit Account' : 'New Account'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Account name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-700">Usage (optional)</label>
              <div className="grid grid-cols-2 gap-3">
                {ACCOUNT_USAGES.map(usage => (
                  <label key={usage} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.usage?.includes(usage) ?? false}
                      onChange={e => {
                        if (e.target.checked) {
                          setForm(f => ({ ...f, usage: [...(f.usage ?? []), usage] }));
                        } else {
                          setForm(f => ({ ...f, usage: (f.usage ?? []).filter(u => u !== usage) }));
                        }
                      }}
                      className="w-4 h-4 rounded text-primary-600"
                    />
                    <span className="text-sm text-slate-600">{usage}</span>
                  </label>
                ))}
              </div>
            </div>
            {!editing && (
              <>
                <input
                  type="number"
                  placeholder="Opening balance (optional)"
                  value={form.balance && form.balance !== 0 ? form.balance : ''}
                  onChange={e => setForm(f => ({ ...f, balance: Number(e.target.value) || 0 }))}
                  className="col-span-2 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-500">Account opening date</label>
                  <input
                    type="date"
                    value={form.createdAt ?? ''}
                    onChange={e => setForm(f => ({ ...f, createdAt: e.target.value || undefined }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
              </>
            )}
          </div>
          {saveMut.isError && <p className="text-red-500 text-sm">{(saveMut.error as Error).message}</p>}
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">Cancel</button>
            <button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending} className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {saveMut.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Active accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {active.map(acc => (
          <div key={acc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-800">{acc.name}</p>
                <p className="text-xs text-slate-400">{acc.type.charAt(0).toUpperCase() + acc.type.slice(1)} · {acc.currency}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-2">
                  <button onClick={() => openEdit(acc)} className="text-xs text-primary-600 hover:underline">Edit</button>
                  <button onClick={() => openImportModal(acc.id)} className="text-xs text-blue-600 hover:underline">Import</button>
                  <button onClick={() => void archiveMut.mutate(acc.id)} className="text-xs text-slate-400 hover:text-red-500">Archive</button>
                </div>
                <button
                  onClick={() => {
                    setClearTxError(null);
                    setClearTxAccount(acc);
                  }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear Transactions
                </button>
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900" data-amount>
              {new Intl.NumberFormat(undefined, { style: 'currency', currency: acc.currency, currencyDisplay: 'code' }).format(effectiveBalance(acc))}
            </p>
          </div>
        ))}
      </div>

      {/* Archived */}
      {archived.length > 0 && (
        <details className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <summary className="text-sm font-medium text-slate-500 cursor-pointer">Archived ({archived.length})</summary>
          <div className="mt-3 space-y-2">
            {archived.map(acc => (
              <div key={acc.id} className="flex items-center justify-between text-sm text-slate-400">
                <span>{acc.name} ({acc.currency})</span>
                <span data-amount>{new Intl.NumberFormat(undefined, { style: 'currency', currency: acc.currency, currencyDisplay: 'code' }).format(effectiveBalance(acc))}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <ImportModal
        isOpen={importModalOpen}
        accountId={selectedAccountForImport}
        onClose={() => setImportModalOpen(false)}
        onConfirm={handleImportConfirm}
      />

      <ConfirmationModal
        open={!!clearTxAccount}
        title={clearTxAccount ? `Clear all transactions for ${clearTxAccount.name}?` : 'Clear all transactions?'}
        message={clearTxAccount
          ? `This will permanently delete ${getAccountTransactionCount(clearTxAccount.id)} transaction(s) linked to this account. This action cannot be undone.`
          : 'This action cannot be undone.'}
        confirmText="Clear Transactions"
        cancelText="Cancel"
        isDangerous={true}
        isLoading={clearTxMut.isPending}
        onCancel={() => {
          setClearTxError(null);
          setClearTxAccount(null);
        }}
        onConfirm={() => {
          void handleConfirmClearTransactions();
        }}
      >
        {clearTxError && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {clearTxError}
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
}
