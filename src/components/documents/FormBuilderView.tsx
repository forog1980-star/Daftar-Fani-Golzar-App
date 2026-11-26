import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Edit2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import {
  FormFieldType,
  FormSectionBlock,
  FormSubmission,
  FormTemplate,
  SignatureSnapshot,
} from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatJalaliDate,
  generateId,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { parseFormFile } from '../../utils/formParser';
import {
  exportToExcelXlsx,
  exportToJson,
  exportToPdfPrint,
  exportToWordDocx,
  ExportTablePayload,
} from '../../utils/exportEngine';
import { FloatingWindow } from '../layout/FloatingWindow';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { SignatureBlockEditor } from './SignatureBlockEditor';

interface FormBuilderViewProps {
  store: AppStore;
}

export const FormBuilderView: React.FC<FormBuilderViewProps> = ({ store }) => {
  const [viewMode, setViewMode] = useState<'templates' | 'submissions'>('templates');
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [fillingTarget, setFillingTarget] = useState<{
    template: FormTemplate;
    submission: FormSubmission | null;
  } | null>(null);
  const [importStatus, setImportStatus] = useState<string>('');
  const [importError, setImportError] = useState<string>('');
  const [deletingTemplate, setDeletingTemplate] = useState<FormTemplate | null>(null);
  const [deletingSubmission, setDeletingSubmission] = useState<FormSubmission | null>(null);

  const projectMap = new Map(store.projects.map((p) => [p.id, p.title]));

  const handleImportWordOrExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    setImportStatus('در حال تحلیل ساختار فایل و شناسایی عنوان‌ها، جدول‌ها، جداکننده‌ها و محل‌های خالی...');
    try {
      const parsed = await parseFormFile(file);
      const now = new Date().toISOString();
      const draftTemplate: FormTemplate = {
        id: generateId('frm'),
        code: `FRM-${Math.floor(100 + Math.random() * 899)}`,
        title: parsed.suggestedTitle,
        workflowPurpose: `استخراج‌شده از فایل ${parsed.sourceFileName}`,
        version: 1,
        sourceFileName: parsed.sourceFileName,
        blocks: parsed.blocks,
        defaultSignatoryCount: 2,
        createdAt: now,
        updatedAt: now,
        updatedByDevice: store.settings.deviceId,
      };
      setImportStatus(
        `فایل «${file.name}» تحلیل شد: ${toPersianDigits(parsed.stats.headings)} عنوان، ${toPersianDigits(parsed.stats.fields)} فیلد پیشنهادی، ${toPersianDigits(parsed.stats.tables)} جدول و ${toPersianDigits(parsed.stats.dividers)} جداکننده شناسایی گردید.`
      );
      setEditingTemplate(draftTemplate);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'خطا در تحلیل فایل قالب');
      setImportStatus('');
    } finally {
      e.target.value = '';
    }
  };

  const createBlankTemplate = () => {
    const now = new Date().toISOString();
    setEditingTemplate({
      id: generateId('frm'),
      code: `FRM-${Math.floor(100 + Math.random() * 899)}`,
      title: 'قالب فرم جدید دفتر فنی',
      workflowPurpose: '',
      version: 1,
      blocks: [
        { id: generateId('blk'), kind: 'heading', label: 'مشخصات اولیه' },
        {
          id: generateId('blk'),
          kind: 'field',
          fieldKey: 'subject',
          label: 'موضوع',
          fieldType: 'text',
          required: true,
        },
      ],
      defaultSignatoryCount: 2,
      createdAt: now,
      updatedAt: now,
      updatedByDevice: store.settings.deviceId,
    });
  };

  const buildSubmissionExportPayload = (sub: FormSubmission): ExportTablePayload => {
    const tpl = store.formTemplates.find((t) => t.id === sub.templateId);
    const summaryRows: Array<{ label: string; value: string }> = [
      { label: 'شماره فرم', value: sub.submissionNumber || '—' },
      { label: 'تاریخ ثبت', value: formatJalaliDate(sub.submissionDate) },
      { label: 'نسخه قالب', value: `نسخه ${toPersianDigits(sub.templateVersion)}` },
      { label: 'وضعیت', value: sub.status },
    ];
    if (sub.projectId && projectMap.get(sub.projectId)) {
      summaryRows.push({ label: 'پروژه مرتبط', value: projectMap.get(sub.projectId)! });
    }

    const headers: string[] = [];
    const rows: string[][] = [];
    let notes = '';

    if (tpl) {
      for (const blk of tpl.blocks) {
        if (blk.kind === 'field' && blk.fieldKey) {
          const val = sub.values[blk.fieldKey];
          if (blk.fieldType === 'textarea') {
            notes += `${blk.label}: ${String(val ?? '—')}\n`;
          } else if (blk.fieldType === 'checkbox') {
            summaryRows.push({ label: blk.label, value: val ? 'بله (تأییدشده)' : 'خیر' });
          } else {
            summaryRows.push({ label: blk.label, value: String(val ?? '—') });
          }
        } else if (blk.kind === 'table' && blk.fieldKey && blk.columns && headers.length === 0) {
          headers.push(...blk.columns.map((c) => c.label));
          const tableRows = (sub.values[blk.fieldKey] as Array<Record<string, string>>) ?? [];
          for (const tr of tableRows) {
            rows.push(blk.columns.map((c) => String(tr[c.key] ?? '—')));
          }
        }
      }
    }

    return {
      title: sub.templateTitle,
      documentNumber: sub.submissionNumber,
      date: sub.submissionDate,
      letterhead: store.settings.letterhead,
      summaryRows,
      headers,
      rows,
      notes: notes.trim() || undefined,
      signatures: sub.signatures,
    };
  };

  return (
    <div className="space-y-5">
      {/* Form Builder Header & Word/Excel Importer */}
      <div className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 space-y-3 shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
            <button
              type="button"
              onClick={() => setViewMode('templates')}
              className={`inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'templates'
                  ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                  : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#F3EFE6]'
              }`}
            >
              قالب‌های فرم و دو فرم مرجع ({toPersianDigits(store.formTemplates.length)})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('submissions')}
              className={`inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                viewMode === 'submissions'
                  ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                  : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#F3EFE6]'
              }`}
            >
              فرم‌های تکمیل‌شده ({toPersianDigits(store.formSubmissions.length)})
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center shrink-0">
            <label className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-3.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap">
              <FileUp className="h-3.5 w-3.5 shrink-0" />
              <span>ورود الگوی Word یا Excel</span>
              <input
                type="file"
                accept=".docx,.xlsx,.xls"
                onChange={handleImportWordOrExcel}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={createBlankTemplate}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#CEC7B6] bg-[#FAF8F3] px-3.5 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>طراحی قالب جدید</span>
            </button>
          </div>
        </div>

        <p className="text-xs leading-6 text-[#5B6268]">
          فرم‌ساز مستقل سازمانی: با بارگذاری فایل‌های Word (.docx) یا Excel (.xlsx)، عنوان‌ها، متن‌ها، جدول‌ها، خطوط جداکننده و محل‌های خالی/سه‌نقطه به‌عنوان فیلدهای پیشنهادی شناسایی و به قالب قابل تکمیل و نسخه‌بندی تبدیل می‌شوند. دو فرم مرجع سازمان به صورت مجزا با گردش‌کار متفاوت نگهداری شده‌اند.
        </p>

        {importStatus && (
          <div className="rounded-xl border border-[#D5DEC8] bg-[#F2F6EE] px-3 py-2 text-xs text-[#2D6A4F]">
            {importStatus}
          </div>
        )}
        {importError && (
          <div className="rounded-xl border border-[#DFC0C0] bg-[#FAF0F0] px-3 py-2 text-xs text-[#B43E3E]">
            {importError}
          </div>
        )}
      </div>

      {/* Templates List */}
      {viewMode === 'templates' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {store.formTemplates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex flex-col justify-between border border-[#E2DDD0] bg-[#FFFFFF] p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#5B6268]">
                  <span>
                    {tpl.code} · نسخه {toPersianDigits(tpl.version)}
                    {tpl.isReferenceForm ? ' · فرم مرجع مستقل' : ''}
                  </span>
                  <span>{toPersianDigits(tpl.blocks.length)} بخش/فیلد</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-[#2B3033]">{tpl.title}</h3>
                {tpl.workflowPurpose && (
                  <p className="mt-1.5 text-xs leading-6 text-[#5B6268]">{tpl.workflowPurpose}</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#ECE7DA] pt-3">
                <button
                  type="button"
                  onClick={() => setFillingTarget({ template: tpl, submission: null })}
                  className="inline-flex items-center gap-1.5 border border-[#243B5A] bg-[#243B5A] px-3.5 py-1.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>تکمیل فرم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTemplate(tpl)}
                  className="inline-flex items-center gap-1 border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-1.5 text-xs text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>ویرایش / نسخه جدید</span>
                </button>
                {!tpl.isReferenceForm && (
                  <button
                    type="button"
                    onClick={() => setDeletingTemplate(tpl)}
                    className="inline-flex h-8 w-8 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                    title="حذف قالب"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filled Submissions List */}
      {viewMode === 'submissions' && (
        <div className="border border-[#E2DDD0] bg-[#FFFFFF] overflow-x-auto">
          {store.formSubmissions.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#7C8287]">
              هنوز فرمی تکمیل و ثبت نشده است. از تب «قالب‌های فرم» یک فرم را تکمیل کنید.
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                  <th className="px-4 py-3 font-medium">عنوان فرم و شماره</th>
                  <th className="px-4 py-3 font-medium">پروژه مرتبط</th>
                  <th className="px-4 py-3 font-medium">تاریخ / نسخه</th>
                  <th className="px-4 py-3 font-medium">وضعیت و امضاها</th>
                  <th className="px-4 py-3 font-medium">خروجی و عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DA]">
                {store.formSubmissions.map((sub) => {
                  const tpl = store.formTemplates.find((t) => t.id === sub.templateId);
                  const confirmedSigs = sub.signatures.filter((s) => s.isSignedConfirmed).length;
                  return (
                    <tr key={sub.id} className="hover:bg-[#FAF8F3]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#2B3033]">{sub.templateTitle}</div>
                        <div className="mt-0.5 text-xs text-[#7C8287]">
                          شماره: {sub.submissionNumber || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5B6268]">
                        {sub.projectId ? projectMap.get(sub.projectId) ?? '—' : 'عمومی'}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#5B6268] whitespace-nowrap">
                        <div>{formatJalaliDate(sub.submissionDate)}</div>
                        <div className="text-[11px]">نسخه {toPersianDigits(sub.templateVersion)}</div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <div className="font-medium text-[#243B5A]">{sub.status}</div>
                        <div className="text-[11px] text-[#7C8287]">
                          {toPersianDigits(confirmedSigs)} امضای تأییدشده از{' '}
                          {toPersianDigits(sub.signatures.length)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tpl && (
                            <button
                              type="button"
                              onClick={() => setFillingTarget({ template: tpl, submission: sub })}
                              className="border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1 text-xs hover:bg-[#ECE7DA] cursor-pointer"
                            >
                              مشاهده / ویرایش
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              exportToWordDocx(
                                buildSubmissionExportPayload(sub),
                                `form-${sub.submissionNumber || sub.id}`
                              )
                            }
                            className="inline-flex items-center gap-1 border border-[#D4CEBF] bg-[#FFFFFF] px-2 py-1 text-xs text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                            title="خروجی Word (فونت Zar 14)"
                          >
                            <Download className="h-3 w-3" />
                            <span>Word</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportToExcelXlsx(
                                buildSubmissionExportPayload(sub),
                                `form-${sub.submissionNumber || sub.id}`
                              )
                            }
                            className="inline-flex items-center gap-1 border border-[#D4CEBF] bg-[#FFFFFF] px-2 py-1 text-xs text-[#2D6A4F] hover:bg-[#F2F6EE] cursor-pointer"
                            title="خروجی Excel (راست‌چین Zar 14)"
                          >
                            <FileSpreadsheet className="h-3 w-3" />
                            <span>Excel</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => exportToPdfPrint(buildSubmissionExportPayload(sub))}
                            className="inline-flex items-center gap-1 border border-[#D4CEBF] bg-[#FFFFFF] px-2 py-1 text-xs text-[#5B6268] hover:bg-[#F3EFE6] cursor-pointer"
                            title="چاپ / PDF"
                          >
                            <Printer className="h-3 w-3" />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportToJson(sub, `form-${sub.submissionNumber || sub.id}`)
                            }
                            className="border border-[#D4CEBF] bg-[#FFFFFF] px-2 py-1 text-xs text-[#5B6268] hover:bg-[#F3EFE6] cursor-pointer"
                          >
                            JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSubmission(sub)}
                            className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                            title="حذف فرم"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Template Designer / Version Editor Floating Window */}
      {editingTemplate && (
        <TemplateEditorWindow
          initial={editingTemplate}
          existingIds={new Set(store.formTemplates.map((t) => t.id))}
          deviceId={store.settings.deviceId}
          onClose={() => setEditingTemplate(null)}
          onSave={async (tpl, isNew) => {
            await store.saveFormTemplate(tpl, isNew);
            setEditingTemplate(null);
          }}
        />
      )}

      {/* Form Filler Floating Window */}
      {fillingTarget && (
        <FormFillerWindow
          template={fillingTarget.template}
          initialSubmission={fillingTarget.submission}
          store={store}
          onClose={() => setFillingTarget(null)}
          onSaved={() => {
            setFillingTarget(null);
            setViewMode('submissions');
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deletingTemplate)}
        title="حذف قالب فرم"
        message={`آیا از حذف قالب «${deletingTemplate?.title ?? ''}» اطمینان دارید؟ فرم‌های تکمیل‌شده قبلی حفظ خواهند شد.`}
        confirmLabel="حذف قالب"
        danger
        onCancel={() => setDeletingTemplate(null)}
        onConfirm={async () => {
          if (deletingTemplate) {
            await store.deleteFormTemplate(deletingTemplate);
            setDeletingTemplate(null);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingSubmission)}
        title="حذف فرم تکمیل‌شده"
        message={`آیا از حذف فرم «${deletingSubmission?.templateTitle ?? ''}» به شماره ${deletingSubmission?.submissionNumber ?? '—'} اطمینان دارید؟`}
        confirmLabel="حذف"
        danger
        onCancel={() => setDeletingSubmission(null)}
        onConfirm={async () => {
          if (deletingSubmission) {
            await store.deleteFormSubmission(deletingSubmission);
            setDeletingSubmission(null);
          }
        }}
      />
    </div>
  );
};

const TemplateEditorWindow: React.FC<{
  initial: FormTemplate;
  existingIds: Set<string>;
  deviceId: string;
  onSave: (tpl: FormTemplate, isNew: boolean) => Promise<void>;
  onClose: () => void;
}> = ({ initial, existingIds, deviceId, onSave, onClose }) => {
  const alreadySaved = existingIds.has(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [code, setCode] = useState(initial.code);
  const [workflowPurpose, setWorkflowPurpose] = useState(initial.workflowPurpose);
  const [blocks, setBlocks] = useState<FormSectionBlock[]>(initial.blocks);
  const [saveAsNewVersion, setSaveAsNewVersion] = useState(alreadySaved);

  const moveBlock = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const copy = [...blocks];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    setBlocks(copy);
  };

  const updateBlock = (id: string, patch: Partial<FormSectionBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const addBlock = (kind: FormSectionBlock['kind']) => {
    const idx = blocks.length + 1;
    const next: FormSectionBlock =
      kind === 'table'
        ? {
            id: generateId('blk'),
            kind: 'table',
            label: `جدول بخش ${idx}`,
            fieldKey: `tbl_${idx}`,
            columns: [
              { key: 'col_1', label: 'شرح', type: 'text' },
              { key: 'col_2', label: 'مقدار / مبلغ', type: 'currency' },
              { key: 'col_3', label: 'توضیحات', type: 'text' },
            ],
          }
        : kind === 'field'
          ? {
              id: generateId('blk'),
              kind: 'field',
              label: `فیلد جدید ${idx}`,
              fieldKey: `fld_${idx}`,
              fieldType: 'text',
            }
          : {
              id: generateId('blk'),
              kind,
              label: kind === 'heading' ? 'عنوان بخش جدید' : kind === 'divider' ? 'خط جداکننده' : 'متن توضیحی',
              content: kind === 'text' ? 'متن راهنما یا بند قراردادی...' : undefined,
            };
    setBlocks((prev) => [...prev, next]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const creatingNewVersion = alreadySaved && saveAsNewVersion;
    const nextTemplate: FormTemplate = {
      ...initial,
      id: creatingNewVersion ? generateId('frm') : initial.id,
      parentTemplateId: creatingNewVersion ? initial.id : initial.parentTemplateId,
      version: creatingNewVersion ? initial.version + 1 : initial.version,
      title: title.trim(),
      code: code.trim(),
      workflowPurpose: workflowPurpose.trim(),
      blocks,
      isReferenceForm: creatingNewVersion ? false : initial.isReferenceForm,
      createdAt: creatingNewVersion ? now : initial.createdAt,
      updatedAt: now,
      updatedByDevice: deviceId,
    };
    await onSave(nextTemplate, !alreadySaved || creatingNewVersion);
  };

  return (
    <FloatingWindow
      title={`طراحی و نسخه‌بندی قالب فرم: ${initial.title}`}
      onClose={onClose}
      width={820}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[#5B6268]">عنوان قالب فرم *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">کد فرم</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">کاربرد و گردش کاری فرم</label>
          <input
            type="text"
            value={workflowPurpose}
            onChange={(e) => setWorkflowPurpose(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>

        {alreadySaved && (
          <label className="flex items-center gap-2 border border-[#E2DDD0] bg-[#FAF8F3] px-3 py-2 text-xs text-[#2B3033] cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsNewVersion}
              onChange={(e) => setSaveAsNewVersion(e.target.checked)}
              className="h-4 w-4 accent-[#243B5A]"
            />
            <span>
              ذخیره به‌عنوان نسخه جدید (نسخه {toPersianDigits(initial.version + 1)}) تا نسخه قبلی و سوابق آن حفظ شوند
            </span>
          </label>
        )}

        <div className="space-y-2 border-t border-[#E2DDD0] pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#243B5A]">
              ساختار و ترتیب بخش‌های فرم ({toPersianDigits(blocks.length)} مورد)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { kind: 'heading', label: '+ عنوان' },
                  { kind: 'field', label: '+ فیلد' },
                  { kind: 'table', label: '+ جدول' },
                  { kind: 'text', label: '+ متن' },
                  { kind: 'divider', label: '+ جداکننده' },
                ] as const
              ).map((btn) => (
                <button
                  key={btn.kind}
                  type="button"
                  onClick={() => addBlock(btn.kind)}
                  className="border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {blocks.map((blk, idx) => (
              <div
                key={blk.id}
                className="flex flex-col gap-2 border border-[#E2DDD0] bg-[#FAF8F3] p-3 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, -1)}
                    className="border border-[#D4CEBF] bg-[#FFFFFF] p-1 text-[#5B6268] hover:text-[#243B5A] cursor-pointer"
                    title="انتقال به بالا"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(idx, 1)}
                    className="border border-[#D4CEBF] bg-[#FFFFFF] p-1 text-[#5B6268] hover:text-[#243B5A] cursor-pointer"
                    title="انتقال به پایین"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input
                    type="text"
                    value={blk.label}
                    onChange={(e) => updateBlock(blk.id, { label: e.target.value })}
                    className="border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1 text-xs sm:col-span-2"
                    placeholder="عنوان بخش یا فیلد"
                  />
                  {blk.kind === 'field' ? (
                    <select
                      value={blk.fieldType ?? 'text'}
                      onChange={(e) =>
                        updateBlock(blk.id, { fieldType: e.target.value as FormFieldType })
                      }
                      className="border border-[#CEC7B6] bg-[#FFFFFF] px-2 py-1 text-xs"
                    >
                      <option value="text">متن کوتاه</option>
                      <option value="textarea">متن چندخطی</option>
                      <option value="number">عدد</option>
                      <option value="currency">مبلغ (ریال)</option>
                      <option value="date">تاریخ</option>
                      <option value="checkbox">تیک تأیید</option>
                      <option value="select">فهرست انتخابی</option>
                    </select>
                  ) : (
                    <div className="flex items-center text-[11px] text-[#7C8287]">
                      نوع: {blk.kind === 'heading' ? 'عنوان بخش' : blk.kind === 'table' ? 'جدول قابل تکمیل' : blk.kind === 'divider' ? 'خط جداکننده' : 'متن ثابت'}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setBlocks((prev) => prev.filter((b) => b.id !== blk.id))}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-[#D4CEBF] bg-[#FFFFFF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#E2DDD0] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] px-4 py-2 text-xs"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="border border-[#243B5A] bg-[#243B5A] px-5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73]"
          >
            ذخیره قالب فرم
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};

const FormFillerWindow: React.FC<{
  template: FormTemplate;
  initialSubmission: FormSubmission | null;
  store: AppStore;
  onClose: () => void;
  onSaved: () => void;
}> = ({ template, initialSubmission, store, onClose, onSaved }) => {
  const isNew = !initialSubmission;
  const [projectId, setProjectId] = useState(initialSubmission?.projectId ?? '');
  const [submissionNumber, setSubmissionNumber] = useState(
    initialSubmission?.submissionNumber ?? `${template.code}-${Math.floor(10 + Math.random() * 89)}`
  );
  const [submissionDate, setSubmissionDate] = useState(
    initialSubmission?.submissionDate ?? todayIsoDate()
  );
  const [status, setStatus] = useState<FormSubmission['status']>(
    initialSubmission?.status ?? 'پیش‌نویس'
  );
  const [values, setValues] = useState<Record<string, unknown>>(initialSubmission?.values ?? {});
  const [signatures, setSignatures] = useState<SignatureSnapshot[]>(
    initialSubmission?.signatures ?? []
  );

  const setFieldValue = (key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const getTableRows = (key: string): Array<Record<string, string>> => {
    const existing = values[key];
    return Array.isArray(existing) ? (existing as Array<Record<string, string>>) : [];
  };

  const addTableRow = (key: string) => {
    setFieldValue(key, [...getTableRows(key), {}]);
  };

  const updateTableCell = (key: string, rowIdx: number, colKey: string, val: string) => {
    const rows = [...getTableRows(key)];
    rows[rowIdx] = { ...(rows[rowIdx] ?? {}), [colKey]: val };
    setFieldValue(key, rows);
  };

  const removeTableRow = (key: string, rowIdx: number) => {
    const rows = getTableRows(key).filter((_, idx) => idx !== rowIdx);
    setFieldValue(key, rows);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const sub: FormSubmission = {
      id: initialSubmission?.id ?? generateId('sub'),
      templateId: template.id,
      templateTitle: template.title,
      templateVersion: template.version,
      projectId: projectId || undefined,
      submissionNumber: submissionNumber.trim(),
      submissionDate,
      values,
      signatures,
      status,
      isSample: false,
      createdAt: initialSubmission?.createdAt ?? now,
      updatedAt: now,
      updatedByDevice: store.settings.deviceId,
    };
    await store.saveFormSubmission(sub, isNew);
    onSaved();
  };

  return (
    <FloatingWindow
      title={`تکمیل فرم: ${template.title} (نسخه ${toPersianDigits(template.version)})`}
      onClose={onClose}
      width={860}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 border border-[#E2DDD0] bg-[#FAF8F3] p-3.5 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">شماره فرم</label>
            <input
              type="text"
              value={submissionNumber}
              onChange={(e) => setSubmissionNumber(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">تاریخ</label>
            <input
              type="date"
              value={submissionDate}
              onChange={(e) => setSubmissionDate(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">پروژه مرتبط</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
            >
              <option value="">عمومی / بدون پروژه</option>
              {store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">وضعیت فرم</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FormSubmission['status'])}
              className="w-full border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
            >
              <option value="پیش‌نویس">پیش‌نویس</option>
              <option value="تکمیل‌شده">تکمیل‌شده</option>
              <option value="تأییدشده">تأییدشده</option>
            </select>
          </div>
        </div>

        {/* Dynamic Ordered Form Blocks */}
        <div className="space-y-3.5">
          {template.blocks.map((blk) => {
            if (blk.kind === 'heading') {
              return (
                <h4
                  key={blk.id}
                  className="border-b border-[#E2DDD0] pb-1.5 pt-2 text-sm font-semibold text-[#243B5A]"
                >
                  {blk.label}
                </h4>
              );
            }
            if (blk.kind === 'divider') {
              return (
                <div key={blk.id} className="border-t border-[#CEC7B6] pt-2 text-xs font-medium text-[#5B6268]">
                  {blk.label}
                </div>
              );
            }
            if (blk.kind === 'text') {
              return (
                <p key={blk.id} className="text-xs leading-6 text-[#5B6268]">
                  {blk.content || blk.label}
                </p>
              );
            }
            if (blk.kind === 'table' && blk.fieldKey && blk.columns) {
              const rows = getTableRows(blk.fieldKey);
              return (
                <div key={blk.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2B3033]">{blk.label}</span>
                    <button
                      type="button"
                      onClick={() => addTableRow(blk.fieldKey!)}
                      className="inline-flex items-center gap-1 border border-[#243B5A] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>افزودن ردیف</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-[#E2DDD0]">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-[#5B6268]">
                          {blk.columns.map((c) => (
                            <th key={c.key} className="px-2.5 py-2 font-medium">
                              {c.label}
                            </th>
                          ))}
                          <th className="w-10 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#ECE7DA]">
                        {rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={blk.columns.length + 1}
                              className="p-3 text-center text-[#7C8287]"
                            >
                              ردیفی ثبت نشده است. دکمه «افزودن ردیف» را بزنید.
                            </td>
                          </tr>
                        ) : (
                          rows.map((r, rIdx) => (
                            <tr key={rIdx}>
                              {blk.columns!.map((c) => (
                                <td key={c.key} className="p-1.5">
                                  <input
                                    type={c.type === 'number' || c.type === 'currency' ? 'number' : 'text'}
                                    value={r[c.key] ?? ''}
                                    onChange={(e) =>
                                      updateTableCell(blk.fieldKey!, rIdx, c.key, e.target.value)
                                    }
                                    className="w-full border border-[#D4CEBF] bg-[#FAF8F3] px-2 py-1 text-xs"
                                  />
                                </td>
                              ))}
                              <td className="p-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeTableRow(blk.fieldKey!, rIdx)}
                                  className="text-[#B43E3E] hover:underline cursor-pointer"
                                  title="حذف ردیف"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            }
            if (blk.kind === 'field' && blk.fieldKey) {
              const val = values[blk.fieldKey];
              if (blk.fieldType === 'checkbox') {
                return (
                  <label key={blk.id} className="flex items-center gap-2 text-xs text-[#2B3033] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(val)}
                      onChange={(e) => setFieldValue(blk.fieldKey!, e.target.checked)}
                      className="h-4 w-4 accent-[#243B5A]"
                    />
                    <span>{blk.label}</span>
                  </label>
                );
              }
              return (
                <div key={blk.id}>
                  <label className="mb-1 block text-xs text-[#5B6268]">
                    {blk.label} {blk.required ? '*' : ''}
                  </label>
                  {blk.fieldType === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={blk.required}
                      value={String(val ?? '')}
                      onChange={(e) => setFieldValue(blk.fieldKey!, e.target.value)}
                      className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                    />
                  ) : blk.fieldType === 'select' && blk.options ? (
                    <select
                      required={blk.required}
                      value={String(val ?? '')}
                      onChange={(e) => setFieldValue(blk.fieldKey!, e.target.value)}
                      className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                    >
                      <option value="">— انتخاب کنید —</option>
                      {blk.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={
                        blk.fieldType === 'date'
                          ? 'date'
                          : blk.fieldType === 'number' || blk.fieldType === 'currency'
                            ? 'number'
                            : 'text'
                      }
                      required={blk.required}
                      value={String(val ?? '')}
                      onChange={(e) => setFieldValue(blk.fieldKey!, e.target.value)}
                      className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                    />
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Historical Signatures Section */}
        <SignatureBlockEditor
          signatures={signatures}
          people={store.people}
          onChange={setSignatures}
        />

        <div className="flex justify-end gap-2 border-t border-[#E2DDD0] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] px-4 py-2 text-xs"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="border border-[#243B5A] bg-[#243B5A] px-5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73]"
          >
            {isNew ? 'ثبت فرم تکمیل‌شده' : 'ذخیره تغییرات فرم'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
