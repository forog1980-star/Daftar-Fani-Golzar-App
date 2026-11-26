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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B3033]/35 p-4">
      <div className="w-full max-w-md border border-[#CEC7B6] bg-[#FAF8F3] p-6">
        <h3 className="text-base font-semibold text-[#2B3033]">{title}</h3>
        <p className="mt-2.5 text-sm leading-7 text-[#5B6268]">{message}</p>
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#CEC7B6] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#2B3033] hover:bg-[#F3EFE6] cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`border px-4 py-2 text-sm font-medium text-[#FAF8F3] cursor-pointer ${
              danger
                ? 'border-[#B43E3E] bg-[#B43E3E] hover:bg-[#963232]'
                : 'border-[#2D5A63] bg-[#2D5A63] hover:bg-[#234850]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
