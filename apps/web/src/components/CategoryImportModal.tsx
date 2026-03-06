'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { extractCategoriesFromCSV, confirmCategoryImport, type ImportCategoryRow, type CategoryImportSummary } from '@/lib/api';

interface CategoryImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CategoryImportModal({ open, onClose, onSuccess }: CategoryImportModalProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'success'>('upload');
  const [csvContent, setCsvContent] = useState('');
  const [summary, setSummary] = useState<CategoryImportSummary | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [selectedRows, setSelectedRows] = useState<ImportCategoryRow[]>([]);

  const toggleExpanded = (rowNumber: number) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  const extractMut = useMutation({
    mutationFn: async (csv: string) => {
      const result = await extractCategoriesFromCSV(csv);
      setSummary(result);
      setSelectedRows(result.rows);
      setStep('review');
      return result;
    },
  });

  const confirmMut = useMutation({
    mutationFn: async (rows: ImportCategoryRow[]) => {
      return confirmCategoryImport(rows);
    },
    onSuccess: () => {
      setStep('success');
      setTimeout(() => {
        handleClose();
        onSuccess();
      }, 1500);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      void extractMut.mutate(content);
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setStep('upload');
    setCsvContent('');
    setSummary(null);
    setSelectedRows([]);
    setExpandedCategories(new Set());
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Import Categories from CSV</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Upload a bank transaction CSV file to extract unique categories and subcategories.
              </p>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-upload"
                  disabled={extractMut.isPending}
                />
                <label htmlFor="csv-upload" className="cursor-pointer block">
                  <div className="text-sm text-slate-600 font-medium">
                    {extractMut.isPending ? 'Processing...' : 'Click to select CSV file'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">or drag and drop</div>
                </label>
              </div>

              {extractMut.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">
                    {(extractMut.error as Error)?.message || 'Failed to extract categories'}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'review' && summary && (
            <div className="space-y-4">
              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-600 font-medium">Total Pairs</div>
                  <div className="text-2xl font-bold text-blue-900">{summary.totalPairs}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 font-medium">New Categories</div>
                  <div className="text-2xl font-bold text-green-900">{summary.newCategoriesCount}</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-xs text-purple-600 font-medium">New Subcategories</div>
                  <div className="text-2xl font-bold text-purple-900">{summary.newSubcategoriesCount}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-xs text-amber-600 font-medium">Existing Pairs</div>
                  <div className="text-2xl font-bold text-amber-900">{summary.existingPairsCount}</div>
                </div>
              </div>

              {/* Grouped view */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Categories to Import</h3>
                <div className="space-y-2">
                  {summary.groupedByCategory.map((group, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg">
                      <div
                        className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                        onClick={() => toggleExpanded(group.count)}
                      >
                        <span
                          className="text-slate-400"
                        >
                          {group.subcategories.length > 0 ? (expandedCategories.has(group.count) ? '▼' : '▶') : ''}
                        </span>
                        <span className={`text-sm font-medium ${group.kind === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                          {group.category}
                        </span>
                        <span className="text-xs text-slate-500 ml-auto">
                          {group.count} transaction{group.count !== 1 ? 's' : ''}
                        </span>
                        {group.exists && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded">
                            Exists
                          </span>
                        )}
                      </div>
                      {expandedCategories.has(group.count) && group.subcategories.length > 0 && (
                        <div className="bg-slate-50 border-t border-slate-200 divide-y divide-slate-200">
                          {group.subcategories.map((subcat, sidx) => (
                            <div key={sidx} className="px-3 py-2 text-xs text-slate-600 pl-8 flex items-center gap-2">
                              <span className="flex-1">{subcat.name}</span>
                              {subcat.exists && (
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                                  Exists
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Detailed rows (collapsible) */}
              {summary.rows.length > 0 && (
                <details className="bg-slate-50 rounded-lg p-4">
                  <summary className="cursor-pointer font-medium text-sm text-slate-700">
                    Show all rows ({summary.rows.length})
                  </summary>
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {summary.rows.map((row) => (
                      <div key={row.rowNumber} className="bg-white border border-slate-200 rounded p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700 min-w-fit">
                            Row {row.rowNumber}:
                          </span>
                          <span className="text-sm text-slate-800">{row.category}</span>
                          {row.subcategory && (
                            <>
                              <span className="text-slate-400">/</span>
                              <span className="text-sm text-slate-600 italic">{row.subcategory}</span>
                            </>
                          )}
                          <span className="text-xs text-slate-500 ml-auto">
                            {row.occurrences}x
                          </span>
                          {row.warnings && row.warnings.length > 0 && (
                            <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                              ⚠
                            </span>
                          )}
                        </div>
                        {row.warnings && row.warnings.length > 0 && (
                          <div className="text-xs text-amber-700 mt-1 ml-20">
                            {row.warnings.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <div className="text-3xl">✓</div>
              </div>
              <h3 className="text-lg font-semibold text-slate-800">Categories imported successfully!</h3>
              <p className="text-sm text-slate-600 text-center">
                Your categories and subcategories have been saved to your account.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          {step !== 'success' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
          {step === 'review' && (
            <button
              onClick={() => void confirmMut.mutate(selectedRows)}
              disabled={confirmMut.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {confirmMut.isPending ? 'Importing...' : 'Import'}
            </button>
          )}
          {step === 'success' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
