import React, { useState } from 'react';
import { Project, ProjectStatus } from '../../types';
import { buildStagesForProjectType } from '../../db/seedData';
import { generateId, todayIsoDate } from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';

interface ProjectFormModalProps {
  initial?: Project | null;
  processTemplates: Record<string, string[]>;
  deviceId: string;
  onSave: (project: Project, isNew: boolean) => Promise<void>;
  onClose: () => void;
}

const PROJECT_STATUSES: ProjectStatus[] = [
  'شروع‌نشده',
  'در حال اجرا',
  'دارای مشکل',
  'متوقف',
  'تکمیل‌شده',
];

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  initial,
  processTemplates,
  deviceId,
  onSave,
  onClose,
}) => {
  const isNew = !initial;
  const availableTypes = Array.from(
    new Set(['فرهنگی', 'عمرانی', 'بهسازی', 'مرمت', ...Object.keys(processTemplates)])
  );

  const [code, setCode] = useState(initial?.code ?? `TF-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 89)}`);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [type, setType] = useState(initial?.type ?? 'عمرانی');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [responsibleDepartment, setResponsibleDepartment] = useState(
    initial?.responsibleDepartment ?? 'دفتر فنی اداره گلزار شهدا'
  );
  const [client, setClient] = useState(initial?.client ?? 'اداره گلزار شهدا');
  const [contractor, setContractor] = useState(initial?.contractor ?? '');
  const [contractNumber, setContractNumber] = useState(initial?.contractNumber ?? '');
  const [contractDate, setContractDate] = useState(initial?.contractDate ?? '');
  const [contractAmount, setContractAmount] = useState(String(initial?.contractAmount ?? 0));
  const [contractDuration, setContractDuration] = useState(initial?.contractDuration ?? '');
  const [notificationDate, setNotificationDate] = useState(initial?.notificationDate ?? todayIsoDate());
  const [ceoOrderNumber, setCeoOrderNumber] = useState(initial?.ceoOrderNumber ?? '');
  const [ceoOrderDate, setCeoOrderDate] = useState(initial?.ceoOrderDate ?? '');
  const [ceoOrderNotes, setCeoOrderNotes] = useState(initial?.ceoOrderNotes ?? '');
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? 'شروع‌نشده');
  const [physicalProgress, setPhysicalProgress] = useState(String(initial?.physicalProgress ?? 0));
  const [description, setDescription] = useState(initial?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErr('لطفاً نام و موضوع پروژه را وارد کنید.');
      return;
    }
    setSaving(true);
    try {
      const stages =
        initial?.stages && initial.type === type
          ? initial.stages
          : buildStagesForProjectType(type, processTemplates);

      const now = new Date().toISOString();
      const project: Project = {
        id: initial?.id ?? generateId('proj'),
        code: code.trim() || generateId('TF'),
        title: title.trim(),
        type,
        location: location.trim(),
        responsibleDepartment: responsibleDepartment.trim(),
        client: client.trim(),
        contractor: contractor.trim(),
        contractNumber: contractNumber.trim(),
        contractDate,
        contractAmount: Number(contractAmount) || 0,
        contractDuration: contractDuration.trim(),
        notificationDate,
        ceoOrderNumber: ceoOrderNumber.trim(),
        ceoOrderDate,
        ceoOrderNotes: ceoOrderNotes.trim(),
        status,
        physicalProgress: Math.max(0, Math.min(100, Number(physicalProgress) || 0)),
        description: description.trim(),
        stages,
        isSample: false,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      await onSave(project, isNew);
      onClose();
    } catch {
      setErr('ذخیره‌سازی پروژه با خطا مواجه شد.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FloatingWindow
      title={isNew ? 'ثبت پرونده پروژه جدید' : `ویرایش پروژه: ${initial?.title}`}
      onClose={onClose}
      width={780}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {err && (
          <div className="border border-[#DFC0C0] bg-[#FAF0F0] px-3 py-2 text-xs text-[#B43E3E]">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">
              نام و موضوع پروژه *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              placeholder="مثال: بهسازی و روشنایی قطعه ۱۶"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">کد پروژه</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">نوع پروژه</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">وضعیت پروژه</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">
              پیشرفت فیزیکی (درصد)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={physicalProgress}
              onChange={(e) => setPhysicalProgress(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">محل اجرا</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">
              حوزه یا معاونت متولی
            </label>
            <input
              type="text"
              value={responsibleDepartment}
              onChange={(e) => setResponsibleDepartment(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">کارفرما</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#5B6268]">پیمانکار یا مجری</label>
            <input
              type="text"
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>
        </div>

        <div className="border-t border-[#E2DDD0] pt-4">
          <div className="mb-3 text-xs font-semibold text-[#2D5A63]">اطلاعات قرارداد و ابلاغ</div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">شماره قرارداد</label>
              <input
                type="text"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">تاریخ قرارداد</label>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">
                مبلغ قرارداد (ریال)
              </label>
              <input
                type="number"
                min={0}
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">مدت قرارداد</label>
              <input
                type="text"
                value={contractDuration}
                onChange={(e) => setContractDuration(e.target.value)}
                placeholder="مثال: ۶ ماه شمسی"
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">تاریخ ابلاغ</label>
              <input
                type="date"
                value={notificationDate}
                onChange={(e) => setNotificationDate(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[#E2DDD0] pt-4">
          <div className="mb-3 text-xs font-semibold text-[#2D5A63]">
            اطلاعات دستور ابلاغ مدیرعامل
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">
                شماره دستور مدیرعامل
              </label>
              <input
                type="text"
                value={ceoOrderNumber}
                onChange={(e) => setCeoOrderNumber(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">
                تاریخ دستور مدیرعامل
              </label>
              <input
                type="date"
                value={ceoOrderDate}
                onChange={(e) => setCeoOrderDate(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5B6268]">
                ملاحظات دستور ابلاغ
              </label>
              <input
                type="text"
                value={ceoOrderNotes}
                onChange={(e) => setCeoOrderNotes(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#5B6268]">توضیحات و سوابق</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-[#E2DDD0] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] bg-[#FFFFFF] px-4 py-2 text-sm text-[#2B3033] hover:bg-[#F3EFE6] cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={saving}
            className="border border-[#2D5A63] bg-[#2D5A63] px-5 py-2 text-sm font-medium text-[#FAF8F3] hover:bg-[#234850] disabled:opacity-60 cursor-pointer"
          >
            {saving ? 'در حال ذخیره...' : isNew ? 'ثبت پروژه' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
