import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Person, SignatureSnapshot } from '../../types';
import { generateId, todayIsoDate } from '../../utils/format';

interface SignatureBlockEditorProps {
  signatures: SignatureSnapshot[];
  people: Person[];
  onChange: (next: SignatureSnapshot[]) => void;
}

export const SignatureBlockEditor: React.FC<SignatureBlockEditorProps> = ({
  signatures,
  people,
  onChange,
}) => {
  const activePeople = people.filter((p) => p.active);

  const addSlot = () => {
    onChange([
      ...signatures,
      {
        id: generateId('sig'),
        snapshotFullName: '',
        snapshotRoleTitle: '',
        signedDate: todayIsoDate(),
        comment: '',
        isSignedConfirmed: false,
      },
    ]);
  };

  const removeSlot = (id: string) => {
    onChange(signatures.filter((s) => s.id !== id));
  };

  const updateSlot = (id: string, patch: Partial<SignatureSnapshot>) => {
    onChange(signatures.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const assignPersonToSlot = (slotId: string, personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (!person) return;
    // Historical snapshot: copy fullName, roleTitle, and signature image verbatim at this moment
    updateSlot(slotId, {
      personId: person.id,
      snapshotFullName: person.fullName,
      snapshotRoleTitle: person.roleTitle,
      snapshotSignatureImage: person.signatureImageDataUrl,
    });
  };

  return (
    <div className="space-y-3 border border-[#E2DDD0] bg-[#FAF8F3] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[#2B3033]">
            اشخاص امضاکننده، تاریخ و نظر (ثبت تاریخی)
          </h4>
          <p className="mt-0.5 text-[11px] text-[#7C8287]">
            تغییر یا غیرفعال‌سازی اشخاص در آینده، نام و سمت ثبت‌شده در این سند را تغییر نخواهد داد. ثبت نام شخص به‌تنهایی به معنی امضای معتبر نیست.
          </p>
        </div>
        <button
          type="button"
          onClick={addSlot}
          className="inline-flex items-center gap-1 border border-[#2D5A63] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>افزودن ردیف امضاکننده</span>
        </button>
      </div>

      {signatures.length === 0 ? (
        <div className="border border-dashed border-[#CEC7B6] bg-[#FFFFFF] p-4 text-center text-xs text-[#7C8287]">
          امضاکننده‌ای تعیین نشده است. برای افزودن، دکمه «افزودن ردیف امضاکننده» را بزنید.
        </div>
      ) : (
        <div className="space-y-3">
          {signatures.map((sig, idx) => (
            <div key={sig.id} className="border border-[#E2DDD0] bg-[#FFFFFF] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#2D5A63]">
                  امضاکننده شماره {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSlot(sig.id)}
                  className="inline-flex items-center gap-1 text-xs text-[#B43E3E] hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف ردیف</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6268]">
                    انتخاب از فهرست اشخاص فعال
                  </label>
                  <select
                    value={sig.personId ?? ''}
                    onChange={(e) => assignPersonToSlot(sig.id, e.target.value)}
                    className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                  >
                    <option value="">— انتخاب شخص —</option>
                    {activePeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName} ({p.roleTitle})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6268]">
                    نام ثبت‌شده در سند (تصویر تاریخی)
                  </label>
                  <input
                    type="text"
                    value={sig.snapshotFullName}
                    onChange={(e) => updateSlot(sig.id, { snapshotFullName: e.target.value })}
                    className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6268]">سمت در زمان ثبت</label>
                  <input
                    type="text"
                    value={sig.snapshotRoleTitle}
                    onChange={(e) => updateSlot(sig.id, { snapshotRoleTitle: e.target.value })}
                    className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6268]">تاریخ امضا / اظهارنظر</label>
                  <input
                    type="date"
                    value={sig.signedDate ?? ''}
                    onChange={(e) => updateSlot(sig.id, { signedDate: e.target.value })}
                    className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] text-[#5B6268]">نظر / هامش امضاکننده</label>
                  <input
                    type="text"
                    value={sig.comment}
                    onChange={(e) => updateSlot(sig.id, { comment: e.target.value })}
                    placeholder="ثبت نظر فنی، مالی یا مدیریتی..."
                    className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECE7DA] pt-2.5">
                <label className="flex items-center gap-2 text-xs text-[#2B3033] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sig.isSignedConfirmed}
                    onChange={(e) => updateSlot(sig.id, { isSignedConfirmed: e.target.checked })}
                    className="h-4 w-4 accent-[#2D5A63]"
                  />
                  <span>
                    امضا و تأیید رسمی این شخص انجام شده است (درج نام به‌تنهایی امضا محسوب نمی‌شود)
                  </span>
                </label>

                {sig.snapshotSignatureImage && (
                  <img
                    src={sig.snapshotSignatureImage}
                    alt={`تصویر امضای ${sig.snapshotFullName}`}
                    className="h-10 max-w-[120px] border border-[#E2DDD0] bg-[#FAF8F3] object-contain p-1"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
