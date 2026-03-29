'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings,
  createTransaction,
  getAccounts,
  getCategories,
  getProjects,
  autocomplete,
  type CreateTransactionBody,
} from '@/lib/api';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

type TxType = 'income' | 'expense';
type RecurringFrequency = 'daily' | 'monthly';

const formatDateInput = (date: Date): string => date.toISOString().split('T')[0] ?? '';

const addMonthsWithClamp = (source: Date, months: number): Date => {
  const start = new Date(source);
  const day = start.getUTCDate();
  const target = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, 1));
  const maxDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, maxDay));
  return target;
};

const computeNextOccurrenceDate = (
  startDateIso: string,
  frequency: RecurringFrequency,
  interval: number,
): string => {
  const startDate = new Date(startDateIso);
  if (Number.isNaN(startDate.getTime())) {
    return startDateIso;
  }

  if (frequency === 'daily') {
    const next = new Date(startDate);
    next.setUTCDate(next.getUTCDate() + interval);
    return formatDateInput(next);
  }

  return formatDateInput(addMonthsWithClamp(startDate, interval));
};

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
  const [subcategory, setSubcategory] = useState('');
  const [note, setNote] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isForecasted, setIsForecasted] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [recurringInterval, setRecurringInterval] = useState('1');
  const [recurringEndDate, setRecurringEndDate] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ label: string; amount?: number; categoryId?: string; type?: string }>>([]);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => getSettings() });
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => getAccounts() });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories() });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => getProjects() });

  const filteredCategories = categories.filter(c =>
    type === 'income' ? c.kind === 'income' : c.kind === 'expense',
  );

  const catById = Object.fromEntries(categories.map(c => [c.id, c]));
  const recurringIntervalValue = Math.max(1, Number.parseInt(recurringInterval || '1', 10) || 1);
  const maxRecurringEndDate = (() => {
    const baseDate = new Date(date);
    if (Number.isNaN(baseDate.getTime())) return '';
    const maxDate = new Date(baseDate);
    maxDate.setUTCFullYear(maxDate.getUTCFullYear() + 2);
    return formatDateInput(maxDate);
  })();
  const minRecurringEndDate = computeNextOccurrenceDate(date, recurringFrequency, recurringIntervalValue);
  const recurringRangeInvalid =
    isRecurring &&
    recurringEndDate.length > 0 &&
    ((minRecurringEndDate && recurringEndDate < minRecurringEndDate) ||
      (maxRecurringEndDate && recurringEndDate > maxRecurringEndDate));

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCurrency('');
    setDate(new Date().toISOString().split('T')[0]!);
    setLabel('');
    setAccountId('');
    setCategoryId('');
    setSubcategory('');
    setNote('');
    setSelectedProjectId('');
    setIsForecasted(false);
    setIsRecurring(false);
    setRecurringFrequency('monthly');
    setRecurringInterval('1');
    setRecurringEndDate('');
    setSuggestions([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Set defaults when modal opens
  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]!);
      if (!currency && settings?.baseCurrency) setCurrency(settings.baseCurrency);
      if (accounts.length > 0 && !accountId) setAccountId(accounts[0]!.id);
      setTimeout(() => amountRef.current?.focus(), 50);
    }
  }, [open, accounts, settings]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!isRecurring) {
      return;
    }

    if (!recurringEndDate) {
      setRecurringEndDate(maxRecurringEndDate);
      return;
    }

    if (minRecurringEndDate && recurringEndDate < minRecurringEndDate) {
      setRecurringEndDate(minRecurringEndDate);
      return;
    }

    if (maxRecurringEndDate && recurringEndDate > maxRecurringEndDate) {
      setRecurringEndDate(maxRecurringEndDate);
    }
  }, [
    isRecurring,
    recurringEndDate,
    minRecurringEndDate,
    maxRecurringEndDate,
  ]);

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
        subcategory: subcategory || undefined,
        note: note || undefined,
        projectIds: selectedProjectId ? [selectedProjectId] : undefined,
        isForecasted,
        recurring: isRecurring
          ? {
              frequency: recurringFrequency,
              interval: recurringIntervalValue,
              byMonthDay: recurringFrequency === 'monthly'
                ? new Date(date).getUTCDate()
                : undefined,
              endDate: recurringEndDate,
              tz: 'Europe/Zurich',
            }
          : undefined,
      };
      return createTransaction(body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transactions'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['accounts'] });
      resetForm();
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-black/40 backdrop-blur-sm" role="dialog" aria-modal>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden overscroll-contain p-6 flex flex-col">
        <h2 className="text-lg font-semibold text-slate-800">Add Transaction</h2>

        <div data-testid="add-transaction-scroll-area" className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 flex flex-col gap-4">

        {/* Type selector */}
        <div data-testid="tx-type-selector" className="shrink-0 flex rounded-lg border border-slate-200 overflow-hidden text-sm font-medium">
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
            onChange={e => { setCategoryId(e.target.value); setSubcategory(''); }}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            <option value="">Category (optional)</option>
            {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

        {/* Subcategory */}
        <select
          value={subcategory}
          onChange={e => setSubcategory(e.target.value)}
          disabled={!categoryId}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          <option value="">Subcategory (optional)</option>
          {categoryId && catById[categoryId]?.subcategories?.map(sub => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>

        {/* Note */}
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        />

        {/* Projects */}
        <div className="space-y-1">
          <label className="text-sm text-slate-700 font-medium">Projects (optional)</label>
          {projects.length === 0 ? (
            <p className="text-xs text-slate-500">No projects yet. Create one in Settings.</p>
          ) : (
            <select
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            >
              <option value="">No project</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Forecasted */}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={isForecasted}
            onChange={e => setIsForecasted(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Forecasted transaction
        </label>

        {/* Recurring */}
        <div className="border border-slate-200 rounded-lg p-3 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Recurring transaction
          </label>

          {isRecurring && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={recurringFrequency}
                  onChange={e => setRecurringFrequency(e.target.value as RecurringFrequency)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                >
                  <option value="monthly">Monthly</option>
                  <option value="daily">Daily</option>
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={recurringInterval}
                  onChange={e => setRecurringInterval(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                  placeholder="Every X"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-600">Recurring end date (max 2 years)</label>
                <input
                  type="date"
                  value={recurringEndDate}
                  min={minRecurringEndDate}
                  max={maxRecurringEndDate}
                  onChange={e => setRecurringEndDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
                />
                <p className="text-xs text-slate-500">
                  Next occurrence: {minRecurringEndDate}. End date cannot exceed {maxRecurringEndDate}.
                </p>
              </div>

              {recurringRangeInvalid && (
                <p className="text-xs text-red-500">
                  End date must be between the next occurrence and the 2-year limit.
                </p>
              )}
            </>
          )}
        </div>

        {mutation.isError && (
          <p className="text-red-500 text-sm">{(mutation.error as Error).message}</p>
        )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-3 mt-4 border-t border-slate-100">
          <button
            onClick={handleClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={
              !amount ||
              !date ||
              !accountId ||
              mutation.isPending ||
              accounts.length === 0 ||
              (isRecurring && (!recurringEndDate || recurringRangeInvalid))
            }
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
