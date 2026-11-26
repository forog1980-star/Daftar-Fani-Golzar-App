import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#243B5A]/30 p-4">
      <div className="w-full max-w-md rounded-[var(--app-radius)] border border-[#D7D2C6] bg-[#FFFFFF] p-6">
        <h3 className="text-base font-semibold text-[#243B5A]">{title}</h3>
        <p className="mt-2.5 text-sm leading-7 text-[#5B6573]">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-4 py-2 text-sm font-medium text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg border px-4 py-2 text-sm font-medium text-[#FAF8F3] cursor-pointer ${
              danger
                ? 'border-[#9E3B3B] bg-[#9E3B3B] hover:bg-[#822E2E]'
                : 'border-[#243B5A] bg-[#243B5A] hover:bg-[#354F73]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
