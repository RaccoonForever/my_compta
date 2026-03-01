'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings,
  createTransaction,
  getAccounts,
  getCategories,
  autocomplete,
  type CreateTransactionBody,
} from '@/lib/api';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TxType = 'income' | 'expense';

export function AddTransactionModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const amountRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [label, setLabel] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ label: string; amount?: number; categoryId?: string; type?: string }>>([]);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => getSettings() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => getAccounts() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });

  const filteredCategories = categories.filter(c =>
    type === 'income' ? c.kind === 'income' : c.kind === 'expense',
  );

  // Set defaults when modal opens
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]!);
      if (!currency && settings?.baseCurrency) setCurrency(settings.baseCurrency);
      if (accounts.length > 0 && !accountId) setAccountId(accounts[0]!.id);
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [open, accounts, settings]);

  // Autocomplete suggestions
  useEffect(() => {
    if (label.length < 2) { setSuggestions([]); return; }
    const id = setTimeout(async () => {
      const results = await autocomplete(label);
      setSuggestions(results);
    }, 200);
    return () => clearTimeout(id);
  }, [label]);

  const applySuggestion = (s: typeof suggestions[0]) => {
    setLabel(s.label);
    if (s.amount) setAmount(String(s.amount));
    if (s.categoryId) setCategoryId(s.categoryId);
    if (s.type && (s.type === 'income' || s.type === 'expense')) setType(s.type);
    setSuggestions([]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const body: CreateTransactionBody = {
        amount: Number(amount),
        currency,
        type,
        date,
        accountId,
        label,
        categoryId: categoryId || undefined,
        note: note || undefined,
      };
      return createTransaction(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
      resetForm();
    },
  });

  const resetForm = () => {
    setAmount(''); setLabel(''); setCategoryId(''); setNote('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-screen overflow-y-auto p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Add Transaction</h2>

        {/* Type selector */}
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
          {(['income', 'expense'] as TxType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={clsx(
                'flex-1 py-2 capitalize transition-colors',
                type === t
                  ? t === 'income' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-2.5 text-sm bg-slate-50"
          >
            {['CHF', 'EUR', 'USD', 'GBP'].map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            ref={amountRef}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        />

        {/* Account */}
        {accounts.length === 0 ? (
          <div className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-400 bg-slate-50 flex items-center justify-center h-10">
            No accounts yet. Create one in the Accounts page
          </div>
        ) : (
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        )}

        {/* Label with autocomplete */}
        <div className="relative z-20">
          <input
            type="text"
            placeholder="Label (e.g. Rent)"
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-30 bg-white border border-slate-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-auto">
              {suggestions.map(s => (
                <li
                  key={s.label}
                  onClick={() => applySuggestion(s)}
                  className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer flex justify-between whitespace-nowrap"
                >
                  <span className="truncate">{s.label}</span>
                  {s.amount && <span className="text-slate-400 ml-2 shrink-0 text-xs">{s.amount}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Category */}
        <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            <option value="">Category (optional)</option>
            {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

        {/* Note */}
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        />

        {mutation.isError && (
          <p className="text-red-500 text-sm">{(mutation.error as Error).message}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!amount || !date || !accountId || mutation.isPending || accounts.length === 0}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
