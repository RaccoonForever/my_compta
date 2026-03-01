'use client';

import { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  isDangerous = true,
  isLoading = false,
  children,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmBtnClass = isDangerous
    ? 'px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50'
    : 'px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        {/* Header */}
        <h3 className="text-base font-bold text-slate-800">{title}</h3>

        {/* Message */}
        <p className="text-sm text-slate-600">{message}</p>

        {/* Optional content area (e.g., conflicting transactions list) */}
        {children && <div className="border border-slate-200 rounded-lg overflow-hidden">{children}</div>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmBtnClass}
          >
            {isLoading ? 'Deleting…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
