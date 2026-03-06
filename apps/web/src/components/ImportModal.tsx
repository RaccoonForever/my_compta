'use client';

import { useState, useRef } from 'react';
import { ImportSummary } from '@/lib/api';
import { validateCsvImport } from '@/lib/api';

export interface ImportResult {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  transactionIds: string[];
  errors?: string[];
}

interface ImportModalProps {
  isOpen: boolean;
  accountId: string;
  onClose: () => void;
  onConfirm: (summary: ImportSummary) => Promise<ImportResult>;
}

/**
 * ImportModal component for CSV import workflow
 * Step 1: Upload/select CSV file
 * Step 2: Show validation summary
 * Step 3: User accepts or rejects
 */
export function ImportModal({
  isOpen,
  accountId,
  onClose,
  onConfirm,
}: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const result = await validateCsvImport(content);
      setSummary(result);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!summary) return;

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const result = await onConfirm(summary);
      
      // Store the actual import result
      setImportResult(result);
      setImporting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSummary(null);
    setImportResult(null);
    setError(null);
    setImporting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {step === 'upload' ? 'Import Transactions' : 'Review Import'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <UploadStep
              loading={loading}
              error={error}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
            />
          )}

          {step === 'review' && summary && (
            <>
              <ReviewStep summary={summary} />
              
              {importResult && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="font-medium text-blue-900 mb-2">Import Results:</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-green-700">✓ Successfully imported: <strong>{importResult.createdCount}</strong> transaction(s)</p>
                    {importResult.skippedCount > 0 && (
                      <p className="text-yellow-700">⊘ Skipped (duplicates): <strong>{importResult.skippedCount}</strong> transaction(s)</p>
                    )}
                    {importResult.failedCount > 0 && (
                      <p className="text-red-700">✗ Failed: <strong>{importResult.failedCount}</strong> transaction(s)</p>
                    )}
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-3 bg-red-50 rounded p-2">
                      <p className="font-medium text-red-900 text-xs mb-1">Error Details:</p>
                      <ul className="text-red-800 text-xs space-y-1">
                        {importResult.errors.map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  <p className="font-medium">Import Error:</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>

          {step === 'review' && (
            <>
              <button
                onClick={() => {
                  setStep('upload');
                  setSummary(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Change File
              </button>
              <button
                onClick={handleAccept}
                disabled={summary?.successCount === 0 || importing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Accept & Import'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface UploadStepProps {
  loading: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function UploadStep({ loading, error, fileInputRef, onFileSelect }: UploadStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <p className="text-gray-700 font-medium mb-4">
          Select a CSV file from your bank export
        </p>

        <div className="border-2 border-dashed border-blue-300 rounded-lg p-8">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={onFileSelect}
            disabled={loading}
            className="hidden"
            id="csv-file-input"
          />
          <label
            htmlFor="csv-file-input"
            className="cursor-pointer flex flex-col items-center gap-2"
          >
            <span className="text-3xl">📁</span>
            <span className="text-lg font-medium text-blue-600 hover:text-blue-700">
              {loading ? 'Processing...' : 'Click to select file or drag & drop'}
            </span>
            <span className="text-sm text-gray-600">CSV format (semicolon-delimited)</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-medium">Error processing file:</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          <strong>Supported formats:</strong> CSV files from French banks (semicolon-delimited with DD/MM/YYYY dates)
        </p>
      </div>
    </div>
  );
}

interface ReviewStepProps {
  summary: ImportSummary;
}

function ReviewStep({ summary }: ReviewStepProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (rowNum: number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(rowNum)) {
      newSet.delete(rowNum);
    } else {
      newSet.add(rowNum);
    }
    setExpandedRows(newSet);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Rows"
          value={summary.totalRows}
          color="gray"
        />
        <StatCard
          label="Success"
          value={summary.successCount}
          color="green"
        />
        <StatCard
          label="Errors"
          value={summary.errorCount}
          color="red"
        />
        <StatCard
          label="Warnings"
          value={summary.warningCount}
          color="yellow"
        />
      </div>

      {/* Issue Summary */}
      {summary.issueSummary && (
        Object.values(summary.issueSummary).some((v) => v > 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-medium text-yellow-900 mb-2">Issues found:</p>
            <ul className="text-sm text-yellow-800 space-y-1">
              {summary.issueSummary.invalidAmounts > 0 && (
                <li>• {summary.issueSummary.invalidAmounts} invalid amounts</li>
              )}
              {summary.issueSummary.invalidDates > 0 && (
                <li>• {summary.issueSummary.invalidDates} invalid dates</li>
              )}
              {summary.issueSummary.missingCategories > 0 && (
                <li>• {summary.issueSummary.missingCategories} missing/uncategorized</li>
              )}
              {summary.issueSummary.otherErrors > 0 && (
                <li>• {summary.issueSummary.otherErrors} other errors</li>
              )}
            </ul>
          </div>
        )
      )}

      {/* Detailed Results */}
      <div className="border rounded-lg">
        <div className="bg-gray-100 px-4 py-3 font-medium text-sm border-b">
          Detailed Import Results ({summary.results.length} rows)
        </div>

        <div className="divide-y max-h-96 overflow-y-auto">
          {summary.results.map((result) => (
            <ResultRow
              key={result.rowNumber}
              result={result}
              isExpanded={expandedRows.has(result.rowNumber)}
              onToggle={() => toggleRow(result.rowNumber)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: 'gray' | 'green' | 'red' | 'yellow';
}

function StatCard({ label, value, color }: StatCardProps) {
  const colorClasses = {
    gray: 'bg-gray-50 text-gray-900 border-gray-200',
    green: 'bg-green-50 text-green-900 border-green-200',
    red: 'bg-red-50 text-red-900 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  };

  return (
    <div className={`border rounded-lg p-4 text-center ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1">{label}</div>
    </div>
  );
}

interface ResultRowProps {
  result: ImportSummary['results'][0];
  isExpanded: boolean;
  onToggle: () => void;
}

function ResultRow({ result, isExpanded, onToggle }: ResultRowProps) {
  const statusColor = result.success
    ? result.warnings && result.warnings.length > 0
      ? 'bg-yellow-50 border-yellow-200'
      : 'bg-green-50 border-green-200'
    : 'bg-red-50 border-red-200';

  const statusIcon = result.success
    ? result.warnings && result.warnings.length > 0
      ? '⚠️'
      : '✓'
    : '✕';

  return (
    <div className={`border-l-4 ${statusColor}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-opacity-75 transition"
      >
        <span className="text-lg mt-0.5">{statusIcon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm">
              Row {result.rowNumber}
              {result.transaction?.label && (
                <span className="text-gray-600 font-normal ml-2">
                  {result.transaction.label}
                </span>
              )}
            </span>
            <span className="text-xs text-gray-500">
              {isExpanded ? '▼' : '▶'}
            </span>
          </div>

          {result.error && (
            <p className="text-red-700 text-xs mt-1">{result.error}</p>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <p className="text-yellow-700 text-xs mt-1">
              {result.warnings.length} warning{result.warnings.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 py-3 bg-opacity-50 border-t space-y-2 text-sm">
          {result.transaction && (
            <div className="space-y-1 text-gray-700">
              <p><span className="font-medium">Date:</span> {result.transaction.date}</p>
              <p><span className="font-medium">Amount:</span> {result.transaction.amount.toFixed(2)} €</p>
              <p><span className="font-medium">Type:</span> {result.transaction.type}</p>
              {result.transaction.category && (
                <p><span className="font-medium">Category:</span> {result.transaction.category}</p>
              )}
              {result.transaction.subcategory && (
                <p><span className="font-medium">Sub-category:</span> {result.transaction.subcategory}</p>
              )}
              {result.transaction.notes && (
                <p><span className="font-medium">Notes:</span> {result.transaction.notes}</p>
              )}
            </div>
          )}

          {result.warnings && result.warnings.length > 0 && (
            <div className="bg-yellow-50 rounded p-2 mt-2">
              <p className="font-medium text-yellow-900 text-xs mb-1">Warnings:</p>
              <ul className="text-yellow-800 text-xs space-y-1">
                {result.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.error && (
            <div className="bg-red-50 rounded p-2">
              <p className="font-medium text-red-900 text-xs mb-1">Error Details:</p>
              <p className="text-red-800 text-xs">{result.error}</p>
              {result.rawRow && (
                <p className="text-red-700 text-xs mt-1 font-mono">
                  Raw: {result.rawRow.join(' | ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
