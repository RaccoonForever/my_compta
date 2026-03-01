'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import {
  getSettings, updateSettings,
  getCategories, createCategory, updateCategory, deleteCategory,
  seedDefaultCategories,
  getRecurringTemplates, createRecurringTemplate, pauseRecurring, resumeRecurring, deleteRecurring,
  type CategoryResponse, type CreateCategoryBody, type RecurringTemplateResponse,
  type LinkedTransaction, CategoryConflictError,
} from '@/lib/api';

type Tab = 'general' | 'categories' | 'recurring';

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const qc = useQueryClient();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'categories', label: 'Categories' },
    { key: 'recurring', label: 'Recurring' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-xl font-bold text-slate-800">Settings</h1>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab qc={qc} />}
      {tab === 'categories' && <CategoriesTab qc={qc} />}
      {tab === 'recurring' && <RecurringTab qc={qc} />}
    </div>
  );
}

// ── General ──────────────────────────────────────────────────────────────────
function GeneralTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: settings, isLoading, isError, error } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const mut = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (isLoading) return <div className="text-slate-400 text-sm">Loading…</div>;
  if (isError || !settings) return <div className="text-red-500 text-sm">Error: {(error as Error)?.message ?? 'Failed to load settings'}</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Base currency */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Base Currency</label>
        <select
          value={settings.baseCurrency}
          onChange={e => mut.mutate({ baseCurrency: e.target.value })}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
        >
          {CURRENCIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* FX Rates */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">FX Rates (relative to base)</label>
        <div className="space-y-2">
          {CURRENCIES.filter(c => c !== settings.baseCurrency).map(c => (
            <div key={c} className="flex items-center gap-3">
              <span className="text-sm text-slate-500 w-12">{c}</span>
              <input
                type="number"
                step="0.0001"
                value={settings.fxRates[c] ?? 1}
                onChange={e => mut.mutate({ fxRates: { ...settings.fxRates, [c]: Number(e.target.value) } })}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Privacy mode */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="privacy"
          checked={settings.privacyMode}
          onChange={e => mut.mutate({ privacyMode: e.target.checked })}
          className="w-4 h-4 rounded text-primary-600"
        />
        <label htmlFor="privacy" className="text-sm text-slate-700">
          Privacy mode — blur all amounts in the UI
        </label>
      </div>

      {mut.isError && <p className="text-red-500 text-sm">{(mut.error as Error).message}</p>}
    </div>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
function CategoriesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ['categories', true],
    queryFn: () => getCategories(true),
  });
  const [form, setForm] = useState<CreateCategoryBody>({ name: '', kind: 'expense' });
  const [editing, setEditing] = useState<CategoryResponse | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ categoryId: string; categoryName: string } | null>(null);
  const [conflict, setConflict] = useState<{ message: string; transactions: LinkedTransaction[]; total: number } | null>(null);

  const saveMut = useMutation({
    mutationFn: () => editing ? updateCategory(editing.id, form) : createCategory(form),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['categories'] }); setEditing(null); setForm({ name: '', kind: 'expense' }); },
  });
  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      setDeleteModal(null);
      setConflict(null);
    },
    onError: (err) => {
      if (err instanceof CategoryConflictError) {
        setConflict({ message: err.message, transactions: err.transactions, total: err.total });
      } else {
        // For other errors, just close the delete modal
        setDeleteModal(null);
      }
    },
  });
  const seedMut = useMutation({
    mutationFn: seedDefaultCategories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });

  return (
    <div className="space-y-4">
      {/* Quick form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">{editing ? 'Edit Category' : 'New Category'}</h3>
        <div className="flex gap-3">
          <input
            placeholder="Category name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
          <select
            value={form.kind}
            onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'income' | 'expense' }))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <button
            onClick={() => saveMut.mutate()}
            disabled={!form.name || saveMut.isPending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {editing ? 'Update' : 'Add'}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm({ name: '', kind: 'expense' }); }} className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500">
              Cancel
            </button>
          )}
        </div>
        <button
          onClick={() => seedMut.mutate()}
          disabled={seedMut.isPending || categories.some(c => !c.isArchived)}
          className="text-xs text-primary-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Seed default categories
        </button>
      </div>

      {/* Category list - two columns */}
      {isLoading ? <p className="text-slate-400 text-sm">Loading…</p> : isError ? <p className="text-red-500 text-sm">Failed to load categories</p> : (
        <div className="grid grid-cols-2 gap-4">
          {/* Income column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-green-50 px-4 py-2.5 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-green-800">Income</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.filter(c => c.kind === 'income' && !c.isArchived).map(cat => (
                <div key={cat.id} className="flex items-center px-4 py-3 gap-2 hover:bg-slate-50 transition-colors">
                  <span className="flex-1 text-sm text-slate-800">{cat.name}</span>
                  <button
                    onClick={() => { setEditing(cat); setForm({ name: cat.name, kind: cat.kind as 'income' | 'expense' }); }}
                    className="text-xs text-primary-600 hover:underline shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ categoryId: cat.id, categoryName: cat.name })}
                    disabled={deleteMut.isPending}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {categories.filter(c => c.kind === 'income' && !c.isArchived).length === 0 && (
                <p className="px-4 py-6 text-xs text-slate-400 text-center">No income categories</p>
              )}
            </div>
          </div>

          {/* Expense column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 px-4 py-2.5 border-b border-slate-200">
              <h4 className="text-sm font-semibold text-red-800">Expenses</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {categories.filter(c => c.kind === 'expense' && !c.isArchived).map(cat => (
                <div key={cat.id} className="flex items-center px-4 py-3 gap-2 hover:bg-slate-50 transition-colors">
                  <span className="flex-1 text-sm text-slate-800">{cat.name}</span>
                  <button
                    onClick={() => { setEditing(cat); setForm({ name: cat.name, kind: cat.kind as 'income' | 'expense' }); }}
                    className="text-xs text-primary-600 hover:underline shrink-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteModal({ categoryId: cat.id, categoryName: cat.name })}
                    disabled={deleteMut.isPending}
                    className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {categories.filter(c => c.kind === 'expense' && !c.isArchived).length === 0 && (
                <p className="px-4 py-6 text-xs text-slate-400 text-center">No expense categories</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && !conflict && (
        <ConfirmationModal
          open={true}
          title={`Delete "${deleteModal.categoryName}"?`}
          message="This action cannot be undone. Confirm to delete this category."
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={deleteMut.isPending}
          onConfirm={() => void deleteMut.mutate(deleteModal.categoryId)}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      {/* Conflict modal (category has linked transactions) */}
      {conflict && deleteModal && (
        <ConfirmationModal
          open={true}
          title={`Cannot delete "${deleteModal.categoryName}"`}
          message={conflict.message}
          confirmText="OK"
          isDangerous={false}
          isLoading={false}
          onConfirm={() => {
            setConflict(null);
            setDeleteModal(null);
          }}
          onCancel={() => {
            setConflict(null);
            setDeleteModal(null);
          }}
        >
          <div className="divide-y divide-slate-100">
            {conflict.transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="px-4 py-2.5 flex justify-between items-center gap-4">
                <span className="text-sm text-slate-700 truncate flex-1">{tx.label}</span>
                <span className="text-xs text-slate-400 shrink-0">{tx.date}</span>
                <span className="text-sm font-medium text-slate-800 shrink-0">
                  {tx.currency} {tx.amount.toFixed(2)}
                </span>
              </div>
            ))}
            {conflict.total > 5 && (
              <p className="px-4 py-2 text-xs text-slate-400 italic">…and {conflict.total - 5} more</p>
            )}
          </div>
        </ConfirmationModal>
      )}
    </div>
  );
}

// ── Recurring ──────────────────────────────────────────────────────────────────
function RecurringTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['recurring'],
    queryFn: getRecurringTemplates,
  });
  const [deleteModal, setDeleteModal] = useState<{ templateId: string; templateLabel: string } | null>(null);

  const pauseMut = useMutation({ mutationFn: pauseRecurring, onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }) });
  const resumeMut = useMutation({ mutationFn: resumeRecurring, onSuccess: () => qc.invalidateQueries({ queryKey: ['recurring'] }) });
  const deleteMut = useMutation({
    mutationFn: deleteRecurring,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring'] });
      setDeleteModal(null);
    },
  });

  if (isLoading) return <div className="text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
      {templates.map((t: RecurringTemplateResponse) => (
        <div key={t.id} className="px-5 py-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate">{t.label}</p>
            <p className="text-xs text-slate-400">
              {t.currency} {t.amount} · next: {t.nextRunDate?.slice(0, 10)} · {t.status}
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {t.status === 'active'
              ? <button onClick={() => pauseMut.mutate(t.id)} className="text-amber-500 hover:underline">Pause</button>
              : <button onClick={() => resumeMut.mutate(t.id)} className="text-green-600 hover:underline">Resume</button>
            }
            <button
              onClick={() => setDeleteModal({ templateId: t.id, templateLabel: t.label })}
              className="text-red-400 hover:text-red-600 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      {templates.length === 0 && (
        <p className="px-5 py-10 text-slate-400 text-sm text-center">No recurring templates.</p>
      )}

      {/* Delete confirmation modal */}
      {deleteModal && (
        <ConfirmationModal
          open={true}
          title={`Delete "${deleteModal.templateLabel}"?`}
          message="This recurring template will be permanently deleted."
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={deleteMut.isPending}
          onConfirm={() => void deleteMut.mutate(deleteModal.templateId)}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
