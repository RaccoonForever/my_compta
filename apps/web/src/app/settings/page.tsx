'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { CategoryImportModal } from '@/components/CategoryImportModal';
import {
  getSettings, updateSettings,
  getCategories, createCategory, updateCategory, deleteCategory,
  seedDefaultCategories,
  getRecurringTemplates, createRecurringTemplate, pauseRecurring, resumeRecurring, deleteRecurring,
  getProjects, createProject, updateProject, deleteProject,
  type CategoryResponse, type CreateCategoryBody, type RecurringTemplateResponse,
  type ProjectResponse, type CreateProjectBody,
  type LinkedTransaction, CategoryConflictError, ProjectConflictError,
} from '@/lib/api';

type Tab = 'general' | 'categories' | 'recurring' | 'projects';

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const qc = useQueryClient();

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'categories', label: 'Categories' },
    { key: 'projects', label: 'Projects' },
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
      {tab === 'projects' && <ProjectsTab qc={qc} />}
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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [mode, setMode] = useState<'category' | 'subcategory'>('category');
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [subcategoryName, setSubcategoryName] = useState<string>('');
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{ kind: 'income' | 'expense'; count: number } | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{
    categoryId: string;
    index: number;
    value: string;
  } | null>(null);
  const [deleteSubcategoryModal, setDeleteSubcategoryModal] = useState<{
    categoryId: string;
    categoryName: string;
    index: number;
    subcategory: string;
  } | null>(null);

  const incomeCategories = categories.filter(c => c.kind === 'income' && !c.isArchived);
  const expenseCategories = categories.filter(c => c.kind === 'expense' && !c.isArchived);

  const toggleExpanded = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const saveMut = useMutation({
    mutationFn: () => {
      if (mode === 'subcategory' && parentCategoryId && subcategoryName) {
        // Adding a subcategory to an existing category
        const parentCategory = categories.find(c => c.id === parentCategoryId);
        if (!parentCategory) throw new Error('Parent category not found');
        const updatedSubcategories = [...(parentCategory.subcategories ?? []), subcategoryName];
        return updateCategory(parentCategoryId, { subcategories: updatedSubcategories });
      }
      return editing ? updateCategory(editing.id, form) : createCategory(form);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      setEditing(null);
      setForm({ name: '', kind: 'expense' });
      setParentCategoryId('');
      setSubcategoryName('');
    },
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
  const bulkDeleteMut = useMutation({
    mutationFn: async (kind: 'income' | 'expense') => {
      const targets = kind === 'income' ? incomeCategories : expenseCategories;

      for (const category of targets) {
        try {
          await deleteCategory(category.id);
        } catch (err) {
          if (err instanceof CategoryConflictError) {
            const conflictError = new CategoryConflictError(err.message, err.transactions, err.total) as CategoryConflictError & {
              categoryName?: string;
              categoryId?: string;
            };
            conflictError.categoryName = category.name;
            conflictError.categoryId = category.id;
            throw conflictError;
          }
          throw err;
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      setBulkDeleteModal(null);
      setDeleteModal(null);
      setConflict(null);
    },
    onError: (err) => {
      if (err instanceof CategoryConflictError) {
        const conflictError = err as CategoryConflictError & { categoryName?: string; categoryId?: string };
        setDeleteModal({
          categoryId: conflictError.categoryId ?? '',
          categoryName: conflictError.categoryName ?? 'category',
        });
        setConflict({ message: err.message, transactions: err.transactions, total: err.total });
      }
      setBulkDeleteModal(null);
    },
  });
  const seedMut = useMutation({
    mutationFn: seedDefaultCategories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
  const subcategoryMut = useMutation({
    mutationFn: ({ categoryId, subcategories }: { categoryId: string; subcategories: string[] }) =>
      updateCategory(categoryId, { subcategories }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['categories'] });
      setEditingSubcategory(null);
      setDeleteSubcategoryModal(null);
    },
  });

  const startEditSubcategory = (categoryId: string, index: number, value: string) => {
    setEditingSubcategory({ categoryId, index, value });
  };

  const saveEditedSubcategory = () => {
    if (!editingSubcategory) return;
    const { categoryId, index, value } = editingSubcategory;
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const trimmed = value.trim();
    if (!trimmed) return;

    const updated = [...(category.subcategories ?? [])];
    updated[index] = trimmed;
    subcategoryMut.mutate({ categoryId, subcategories: updated });
  };

  const confirmDeleteSubcategory = () => {
    if (!deleteSubcategoryModal) return;
    const { categoryId, index } = deleteSubcategoryModal;
    const category = categories.find(c => c.id === categoryId);
    if (!category) return;

    const updated = (category.subcategories ?? []).filter((_, idx) => idx !== index);
    subcategoryMut.mutate({ categoryId, subcategories: updated });
  };

  return (
    <div className="space-y-4">
      {/* Quick form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        {/* Mode selector - only show when not editing */}
        {!editing && (
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="category"
                checked={mode === 'category'}
                onChange={() => { setMode('category'); setParentCategoryId(''); setSubcategoryName(''); }}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-slate-700">New Category</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="subcategory"
                checked={mode === 'subcategory'}
                onChange={() => { setMode('subcategory'); setForm({ name: '', kind: 'expense' }); }}
                className="w-4 h-4 text-primary-600"
              />
              <span className="text-sm text-slate-700">New Subcategory</span>
            </label>
          </div>
        )}

        <h3 className="text-sm font-semibold text-slate-700">
          {editing ? 'Edit Category' : mode === 'category' ? 'New Category' : 'New Subcategory'}
        </h3>

        {/* Category mode */}
        {mode === 'category' && (
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
        )}

        {/* Subcategory mode */}
        {mode === 'subcategory' && !editing && (
          <div className="flex gap-3">
            <select
              value={parentCategoryId}
              onChange={e => setParentCategoryId(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm min-w-[180px]"
            >
              <option value="">Select category...</option>
              {categories
                .filter(c => !c.isArchived)
                .sort((a, b) => {
                  // Sort by kind first (income before expense)
                  if (a.kind !== b.kind) {
                    return a.kind === 'income' ? -1 : 1;
                  }
                  // Then by name alphabetically
                  return a.name.localeCompare(b.name);
                })
                .map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.kind === 'income' ? 'Income' : 'Expense'})
                  </option>
                ))}
            </select>
            <input
              placeholder="Subcategory name"
              value={subcategoryName}
              onChange={e => setSubcategoryName(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
            <button
              onClick={() => saveMut.mutate()}
              disabled={!parentCategoryId || !subcategoryName || saveMut.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending || categories.some(c => !c.isArchived)}
            className="text-xs text-primary-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Seed default categories
          </button>
          <button
            onClick={() => setImportModalOpen(true)}
            className="text-xs text-primary-600 hover:underline"
          >
            Import from CSV
          </button>
        </div>
      </div>

      {/* Category list - two columns */}
      {isLoading ? <p className="text-slate-400 text-sm">Loading…</p> : isError ? <p className="text-red-500 text-sm">Failed to load categories</p> : (
        <div className="grid grid-cols-2 gap-4">
          {/* Income column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-green-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-green-800">Income</h4>
              <button
                onClick={() => setBulkDeleteModal({ kind: 'income', count: incomeCategories.length })}
                disabled={incomeCategories.length === 0 || bulkDeleteMut.isPending || deleteMut.isPending}
                className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete all
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {incomeCategories.map(cat => (
                <div key={cat.id}>
                  <div className="flex items-center px-4 py-3 gap-2 hover:bg-slate-50 transition-colors">
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(cat.id)}
                        className="text-slate-400 hover:text-slate-600 shrink-0 w-5 flex items-center justify-center"
                      >
                        {expandedCategories.has(cat.id) ? '▼' : '▶'}
                      </button>
                    )}
                    {(!cat.subcategories || cat.subcategories.length === 0) && (
                      <span className="w-5 shrink-0" />
                    )}
                    <span className="flex-1 text-sm text-slate-800 font-medium">{cat.name}</span>
                    <button
                      onClick={() => { setEditing(cat); setForm({ name: cat.name, kind: cat.kind as 'income' | 'expense' }); }}
                      className="text-xs text-primary-600 hover:underline shrink-0"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteModal({ categoryId: cat.id, categoryName: cat.name })}
                      disabled={deleteMut.isPending || bulkDeleteMut.isPending}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                  {expandedCategories.has(cat.id) && cat.subcategories && cat.subcategories.length > 0 && (
                    <div className="bg-slate-50 divide-y divide-slate-100">
                      {cat.subcategories.map((subcat, idx) => (
                        <div key={idx} className="flex items-center px-4 py-2.5 pl-10 gap-2">
                          {editingSubcategory && editingSubcategory.categoryId === cat.id && editingSubcategory.index === idx ? (
                            <>
                              <input
                                value={editingSubcategory.value}
                                onChange={e => setEditingSubcategory({ ...editingSubcategory, value: e.target.value })}
                                className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-600"
                              />
                              <button
                                onClick={saveEditedSubcategory}
                                disabled={subcategoryMut.isPending}
                                className="text-xs text-primary-600 hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingSubcategory(null)}
                                disabled={subcategoryMut.isPending}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-xs text-slate-600">{subcat}</span>
                              <button
                                onClick={() => startEditSubcategory(cat.id, idx, subcat)}
                                className="text-xs text-primary-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteSubcategoryModal({
                                  categoryId: cat.id,
                                  categoryName: cat.name,
                                  index: idx,
                                  subcategory: subcat,
                                })}
                                className="text-xs text-red-400 hover:text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {incomeCategories.length === 0 && (
                <p className="px-4 py-6 text-xs text-slate-400 text-center">No income categories</p>
              )}
            </div>
          </div>

          {/* Expense column */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-red-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-red-800">Expenses</h4>
              <button
                onClick={() => setBulkDeleteModal({ kind: 'expense', count: expenseCategories.length })}
                disabled={expenseCategories.length === 0 || bulkDeleteMut.isPending || deleteMut.isPending}
                className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete all
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {expenseCategories.map(cat => (
                <div key={cat.id}>
                  <div className="flex items-center px-4 py-3 gap-2 hover:bg-slate-50 transition-colors">
                    {cat.subcategories && cat.subcategories.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(cat.id)}
                        className="text-slate-400 hover:text-slate-600 shrink-0 w-5 flex items-center justify-center"
                      >
                        {expandedCategories.has(cat.id) ? '▼' : '▶'}
                      </button>
                    )}
                    {(!cat.subcategories || cat.subcategories.length === 0) && (
                      <span className="w-5 shrink-0" />
                    )}
                    <span className="flex-1 text-sm text-slate-800 font-medium">{cat.name}</span>
                    <button
                      onClick={() => { setEditing(cat); setForm({ name: cat.name, kind: cat.kind as 'income' | 'expense' }); }}
                      className="text-xs text-primary-600 hover:underline shrink-0"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteModal({ categoryId: cat.id, categoryName: cat.name })}
                      disabled={deleteMut.isPending || bulkDeleteMut.isPending}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                  {expandedCategories.has(cat.id) && cat.subcategories && cat.subcategories.length > 0 && (
                    <div className="bg-slate-50 divide-y divide-slate-100">
                      {cat.subcategories.map((subcat, idx) => (
                        <div key={idx} className="flex items-center px-4 py-2.5 pl-10 gap-2">
                          {editingSubcategory && editingSubcategory.categoryId === cat.id && editingSubcategory.index === idx ? (
                            <>
                              <input
                                value={editingSubcategory.value}
                                onChange={e => setEditingSubcategory({ ...editingSubcategory, value: e.target.value })}
                                className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-600"
                              />
                              <button
                                onClick={saveEditedSubcategory}
                                disabled={subcategoryMut.isPending}
                                className="text-xs text-primary-600 hover:underline disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingSubcategory(null)}
                                disabled={subcategoryMut.isPending}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-xs text-slate-600">{subcat}</span>
                              <button
                                onClick={() => startEditSubcategory(cat.id, idx, subcat)}
                                className="text-xs text-primary-600 hover:underline"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteSubcategoryModal({
                                  categoryId: cat.id,
                                  categoryName: cat.name,
                                  index: idx,
                                  subcategory: subcat,
                                })}
                                className="text-xs text-red-400 hover:text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {expenseCategories.length === 0 && (
                <p className="px-4 py-6 text-xs text-slate-400 text-center">No expense categories</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteModal && (
        <ConfirmationModal
          open={true}
          title={`Delete all ${bulkDeleteModal.kind} categories?`}
          message={`This action will delete ${bulkDeleteModal.count} ${bulkDeleteModal.kind} categor${bulkDeleteModal.count > 1 ? 'ies' : 'y'}. This action cannot be undone.`}
          confirmText="Delete all"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={bulkDeleteMut.isPending}
          onConfirm={() => void bulkDeleteMut.mutate(bulkDeleteModal.kind)}
          onCancel={() => setBulkDeleteModal(null)}
        />
      )}

      {/* Subcategory delete confirmation */}
      {deleteSubcategoryModal && (
        <ConfirmationModal
          open={true}
          title={`Delete subcategory "${deleteSubcategoryModal.subcategory}"?`}
          message={`This will remove the subcategory from "${deleteSubcategoryModal.categoryName}".`}
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={subcategoryMut.isPending}
          onConfirm={confirmDeleteSubcategory}
          onCancel={() => setDeleteSubcategoryModal(null)}
        />
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

      <CategoryImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false);
          void qc.invalidateQueries({ queryKey: ['categories'] });
        }}
      />
    </div>
  );
}

// ── Projects ───────────────────────────────────────────────────────────────────
function ProjectsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(false),
  });
  const [form, setForm] = useState<CreateProjectBody>({ name: '', description: '', color: '#6366f1' });
  const [editing, setEditing] = useState<ProjectResponse | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ projectId: string; projectName: string } | null>(null);
  const [conflict, setConflict] = useState<{ message: string; transactions: LinkedTransaction[]; total: number } | null>(null);

  const saveMut = useMutation({
    mutationFn: () =>
      editing ? updateProject(editing.id, form) : createProject(form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      setEditing(null);
      setForm({ name: '', description: '', color: '#6366f1' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['projects'] });
      setDeleteModal(null);
      setConflict(null);
    },
    onError: (err) => {
      if (err instanceof ProjectConflictError) {
        setConflict({ message: err.message, transactions: err.transactions, total: err.total });
      } else {
        setDeleteModal(null);
      }
    },
  });

  const COLOR_OPTIONS = [
    { value: '#6366f1', label: 'Indigo' },
    { value: '#ef4444', label: 'Red' },
    { value: '#f97316', label: 'Orange' },
    { value: '#eab308', label: 'Yellow' },
    { value: '#22c55e', label: 'Green' },
    { value: '#0ea5e9', label: 'Blue' },
    { value: '#8b5cf6', label: 'Purple' },
    { value: '#ec4899', label: 'Pink' },
  ];

  if (isLoading) return <div className="text-slate-400 text-sm">Loading…</div>;
  if (isError) return <div className="text-red-500 text-sm">Failed to load projects</div>;

  return (
    <div className="space-y-4">
      {/* Quick form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">
          {editing ? 'Edit Project' : 'New Project'}
        </h3>

        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              placeholder="e.g., Home Renovation"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
            <input
              placeholder="e.g., Buying & renovating a flat"
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
            <div className="flex gap-2">
              {COLOR_OPTIONS.map(color => (
                <button
                  key={color.value}
                  onClick={() => setForm(f => ({ ...f, color: color.value }))}
                  title={color.label}
                  className={`w-8 h-8 rounded-lg border-2 transition-all ${
                    form.color === color.value
                      ? 'border-slate-800'
                      : 'border-transparent hover:border-slate-400'
                  }`}
                  style={{ backgroundColor: color.value }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => saveMut.mutate()}
              disabled={!form.name || saveMut.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {editing ? 'Update' : 'Add'}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ name: '', description: '', color: '#6366f1' });
                }}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-500"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Projects list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {projects.length === 0 ? (
          <p className="px-5 py-10 text-slate-400 text-sm text-center">No projects yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {projects.map(project => (
              <div
                key={project.id}
                className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
              >
                <div
                  className="w-4 h-4 rounded shrink-0"
                  style={{ backgroundColor: project.color ?? '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{project.name}</p>
                  {project.description && (
                    <p className="text-xs text-slate-400 truncate">{project.description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditing(project);
                    setForm({
                      name: project.name,
                      description: project.description,
                      color: project.color,
                    });
                  }}
                  className="text-xs text-primary-600 hover:underline shrink-0"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteModal({ projectId: project.id, projectName: project.name })}
                  disabled={deleteMut.isPending}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline disabled:opacity-50 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <ConfirmationModal
          open={true}
          title={`Delete "${deleteModal.projectName}"?`}
          message={
            conflict
              ? `${conflict.message} (${conflict.total} transaction${conflict.total !== 1 ? 's' : ''})`
              : 'This project will be permanently deleted.'
          }
          confirmText="Delete"
          cancelText="Cancel"
          isDangerous={true}
          isLoading={deleteMut.isPending}
          onConfirm={() => void deleteMut.mutate(deleteModal.projectId)}
          onCancel={() => {
            setDeleteModal(null);
            setConflict(null);
          }}
        />
      )}

      {saveMut.isError && <p className="text-red-500 text-sm">{(saveMut.error as Error).message}</p>}
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
