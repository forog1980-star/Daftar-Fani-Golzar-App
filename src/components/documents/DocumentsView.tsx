import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Edit2,
  Eye,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { AttachmentRecord, DocumentCategory, DocumentItem } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatFileSize,
  formatJalaliDate,
  generateId,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { SectionReportExportBar } from '../layout/SectionReportExportBar';
import { FormBuilderView } from './FormBuilderView';
import { HelpSectionId } from '../help/helpContent';
import { SectionHelpLink } from '../help/SectionHelpLink';
import { JalaliDateInput } from '../common/JalaliDateInput';

export type DocumentsSectionTab = 'archive' | 'forms';

interface DocumentsViewProps {
  store: AppStore;
  activeTab?: DocumentsSectionTab;
  onTabChange?: (tab: DocumentsSectionTab) => void;
  onOpenHelp?: (sectionId: HelpSectionId) => void;
}

const DOC_CATEGORIES: DocumentCategory[] = [
  'نامه وارده',
  'نامه صادره',
  'مکاتبه داخلی',
  'صورتجلسه',
  'قرارداد',
  'دستورکار',
  'صورت‌وضعیت',
  'پیوست',
];

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  store,
  activeTab,
  onTabChange,
  onOpenHelp,
}) => {
  const [sectionTab, setSectionTab] = useState<DocumentsSectionTab>(activeTab ?? 'archive');

  useEffect(() => {
    setSectionTab(activeTab ?? 'archive');
  }, [activeTab]);

  const handleSelectSection = (next: DocumentsSectionTab) => {
    setSectionTab(next);
    onTabChange?.(next);
  };
  const [categoryFilter, setCategoryFilter] = useState<string>('همه');
  const [projectFilter, setProjectFilter] = useState<string>('همه');
  const [search, setSearch] = useState('');
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null | undefined>(undefined);
  const [deletingDoc, setDeletingDoc] = useState<DocumentItem | null>(null);
  const [previewAtt, setPreviewAtt] = useState<{ att: AttachmentRecord; url: string } | null>(null);

  const projectMap = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p.title])),
    [store.projects]
  );

  const projectCodeMap = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p.code])),
    [store.projects]
  );

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.documents.filter((d) => {
      if (categoryFilter !== 'همه' && d.category !== categoryFilter) return false;
      if (projectFilter !== 'همه' && d.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        d.subject.toLowerCase().includes(q) ||
        d.documentNumber.toLowerCase().includes(q) ||
        d.senderOrReceiver.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q)
      );
    });
  }, [store.documents, categoryFilter, projectFilter, search]);

  const downloadAttachment = (att: AttachmentRecord) => {
    const url = URL.createObjectURL(att.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  };

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-5">
      {/* Top Section Switch: Correspondence Archive vs Organizational Form Builder */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-3.5 shadow-[0_2px_8px_rgba(29,50,80,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <button
            type="button"
            onClick={() => handleSelectSection('archive')}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              sectionTab === 'archive'
                ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#F3EFE6]'
            }`}
          >
            ثبت و بایگانی اسناد و مکاتبات ({toPersianDigits(store.documents.length)})
          </button>
          <button
            type="button"
            onClick={() => handleSelectSection('forms')}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-4 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              sectionTab === 'forms'
                ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#F3EFE6]'
            }`}
          >
            فرم‌ساز سازمانی و فرم‌های مرجع ({toPersianDigits(store.formSubmissions.length)})
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          {sectionTab === 'archive' && (
            <button
              type="button"
              onClick={() => setEditingDoc(null)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap lg:flex-none"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>ثبت سند یا مکاتبه جدید</span>
            </button>
          )}
          {onOpenHelp && <SectionHelpLink sectionId="documents" onOpenHelp={onOpenHelp} />}
        </div>
      </div>

      {sectionTab === 'forms' ? (
        <FormBuilderView store={store} />
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)] lg:flex-row lg:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#7C8287]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جست‌وجو در موضوع، شماره سند، فرستنده/گیرنده یا خلاصه..."
                className="h-10 w-full rounded-xl border border-[#CEC7B6] bg-[#FAF8F3] pr-9 pl-3 text-sm text-[#2B3033] focus:border-[#243B5A] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:items-center">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#CEC7B6] bg-[#FAF8F3] px-3 text-xs text-[#2B3033] lg:w-auto"
              >
                <option value="همه">همه انواع اسناد</option>
                {DOC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#CEC7B6] bg-[#FAF8F3] px-3 text-xs text-[#2B3033] lg:w-auto"
              >
                <option value="همه">همه پروژه‌ها</option>
                {store.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Documents Table */}
          <div className="overflow-x-auto rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#7C8287]">
                سند یا مکاتبه‌ای با فیلتر انتخاب‌شده ثبت نشده است.
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                    <th className="px-4 py-3 font-medium">نوع و شماره سند</th>
                    <th className="px-4 py-3 font-medium">موضوع و خلاصه</th>
                    <th className="px-4 py-3 font-medium">پروژه مرتبط</th>
                    <th className="px-4 py-3 font-medium">تاریخ / وضعیت</th>
                    <th className="px-4 py-3 font-medium">پیوست‌ها</th>
                    <th className="px-4 py-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DA]">
                  {filteredDocs.map((doc) => {
                    const docAttachments = store.attachments.filter(
                      (a) => a.documentId === doc.id || doc.attachmentIds.includes(a.id)
                    );
                    return (
                      <tr key={doc.id} className="hover:bg-[#FAF8F3]">
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <div className="font-medium text-[#243B5A]">{doc.category}</div>
                          <div className="mt-0.5 text-[#5B6268]">{doc.documentNumber || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#2B3033]">{doc.subject}</div>
                          <div className="mt-0.5 text-xs text-[#5B6268]">
                            {doc.senderOrReceiver ? `طرف مکاتبه: ${doc.senderOrReceiver}` : ''}
                          </div>
                          {doc.summary && (
                            <div className="mt-0.5 text-xs text-[#7C8287] line-clamp-2">
                              {doc.summary}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#5B6268]">
                          {doc.projectId ? projectMap.get(doc.projectId) ?? '—' : 'عمومی دفتر فنی'}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <div className="tabular-nums text-[#2B3033]">
                            {formatJalaliDate(doc.date)}
                          </div>
                          <div className="mt-0.5 text-[#5B6268]">{doc.status}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {docAttachments.length === 0 ? (
                            <span className="text-[#7C8287]">—</span>
                          ) : (
                            <div className="space-y-1">
                              {docAttachments.map((att) => (
                                <div key={att.id} className="flex items-center gap-1.5">
                                  <Paperclip className="h-3 w-3 text-[#243B5A]" />
                                  <span className="max-w-[140px] truncate">{att.fileName}</span>
                                  {(att.mimeType.startsWith('image/') ||
                                    att.mimeType === 'application/pdf') && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewAtt({ att, url: URL.createObjectURL(att.data) })
                                      }
                                      className="text-[#243B5A] hover:underline cursor-pointer"
                                      title="مشاهده"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => downloadAttachment(att)}
                                    className="text-[#5B6268] hover:text-[#2B3033] cursor-pointer"
                                    title="دانلود"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingDoc(doc)}
                              className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:text-[#243B5A] cursor-pointer"
                              title="ویرایش و پیوست"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDoc(doc)}
                              className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                              title="حذف سند"
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
          {/* Bottom Page Section: Documents Report Export (Word & Excel) */}
          <SectionReportExportBar
            buildExport={() => {
              const followUpCount = filteredDocs.filter((d) => d.status === 'نیازمند پیگیری').length;
              const archivedCount = filteredDocs.filter((d) => d.status === 'بایگانی‌شده').length;
              return {
                slug: `documents-report-${todayIsoDate()}`,
                payload: {
                  title:
                    categoryFilter === 'همه'
                      ? 'گزارش اسناد، مکاتبات و صورتجلسات دفتر فنی'
                      : `گزارش اسناد و مکاتبات (${categoryFilter})`,
                  documentNumber: `مک-${Math.floor(100 + Math.random() * 899)}`,
                  date: todayIsoDate(),
                  letterhead: {
                    ...store.settings.letterhead,
                    showDateAndNumber: true,
                  },
                  narrativeParagraphs: [
                    `این گزارش فهرست ${toPersianDigits(filteredDocs.length)} سند و مکاتبه ثبت‌شده در بایگانی دفتر فنی اداره گلزار شهدا را به تفکیک شماره سند، نوع، موضوع، کد پروژه مرتبط و وضعیت ارائه می‌دهد.`,
                  ],
                  summaryRows: [
                    { label: 'تعداد کل اسناد و مکاتبات', value: `${toPersianDigits(filteredDocs.length)} سند` },
                    { label: 'نیازمند پیگیری', value: `${toPersianDigits(followUpCount)} مورد` },
                    { label: 'بایگانی‌شده', value: `${toPersianDigits(archivedCount)} مورد` },
                    { label: 'تعداد پیوست‌های محلی', value: `${toPersianDigits(store.attachments.length)} فایل` },
                  ],
                  headers: [
                    'شماره سند',
                    'نوع سند',
                    'موضوع',
                    'کد پروژه',
                    'پروژه مرتبط',
                    'طرف مکاتبه',
                    'تاریخ',
                    'وضعیت',
                  ],
                  rows: filteredDocs.map((d) => [
                    d.documentNumber || '—',
                    d.category,
                    d.subject,
                    d.projectId ? projectCodeMap.get(d.projectId) ?? '—' : 'عمومی',
                    d.projectId ? projectMap.get(d.projectId) ?? '—' : 'عمومی دفتر فنی',
                    d.senderOrReceiver || '—',
                    formatJalaliDate(d.date),
                    d.status,
                  ]),
                },
              };
            }}
          />
        </>
      )}

      {editingDoc !== undefined && (
        <DocumentEditorWindow
          initial={editingDoc}
          store={store}
          onClose={() => setEditingDoc(undefined)}
        />
      )}

      {previewAtt && (
        <FloatingWindow
          title={`پیش‌نمایش: ${previewAtt.att.fileName}`}
          onClose={() => {
            URL.revokeObjectURL(previewAtt.url);
            setPreviewAtt(null);
          }}
          width={760}
        >
          {previewAtt.att.mimeType.startsWith('image/') ? (
            <img
              src={previewAtt.url}
              alt={previewAtt.att.fileName}
              className="max-h-[65vh] w-full object-contain border border-[#E2DDD0]"
            />
          ) : (
            <iframe
              src={previewAtt.url}
              title={previewAtt.att.fileName}
              className="h-[65vh] w-full border border-[#E2DDD0]"
            />
          )}
        </FloatingWindow>
      )}

      <ConfirmDialog
        open={Boolean(deletingDoc)}
        title="حذف سند یا مکاتبه"
        message={`آیا از حذف سند «${deletingDoc?.subject ?? ''}» اطمینان دارید؟`}
        confirmLabel="حذف سند"
        danger
        onCancel={() => setDeletingDoc(null)}
        onConfirm={async () => {
          if (deletingDoc) {
            await store.deleteDocument(deletingDoc);
            setDeletingDoc(null);
          }
        }}
      />
    </div>
  );
};

const DocumentEditorWindow: React.FC<{
  initial: DocumentItem | null;
  store: AppStore;
  onClose: () => void;
}> = ({ initial, store, onClose }) => {
  const isNew = !initial;
  const docId = useMemo(() => initial?.id ?? generateId('doc'), [initial]);

  const [category, setCategory] = useState<DocumentCategory>(initial?.category ?? 'نامه وارده');
  const [documentNumber, setDocumentNumber] = useState(initial?.documentNumber ?? '');
  const [date, setDate] = useState(initial?.date ?? todayIsoDate());
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [senderOrReceiver, setSenderOrReceiver] = useState(initial?.senderOrReceiver ?? '');
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [status, setStatus] = useState<DocumentItem['status']>(initial?.status ?? 'جاری');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(initial?.attachmentIds ?? []);

  const linkedAttachments = store.attachments.filter(
    (a) => a.documentId === docId || attachmentIds.includes(a.id)
  );

  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const addedIds: string[] = [];
    for (const file of Array.from(files)) {
      const rec = await store.addAttachment(file, {
        documentId: docId,
        projectId: projectId || undefined,
      });
      addedIds.push(rec.id);
    }
    setAttachmentIds((prev) => Array.from(new Set([...prev, ...addedIds])));
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    const now = new Date().toISOString();
    await store.saveDocument(
      {
        id: docId,
        category,
        documentNumber: documentNumber.trim(),
        date,
        subject: subject.trim(),
        senderOrReceiver: senderOrReceiver.trim(),
        projectId: projectId || undefined,
        summary: summary.trim(),
        status,
        attachmentIds,
        isSample: false,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        updatedByDevice: store.settings.deviceId,
      },
      isNew
    );
    onClose();
  };

  return (
    <FloatingWindow
      title={isNew ? 'ثبت سند یا مکاتبه جدید' : `ویرایش سند: ${initial?.subject}`}
      onClose={onClose}
      width={680}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">نوع سند</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            >
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">شماره نامه / سند</label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">تاریخ</label>
            <JalaliDateInput
              value={date}
              onChange={setDate}
              required
              ariaLabel="تاریخ سند یا مکاتبه شمسی"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">موضوع سند / مکاتبه *</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">فرستنده / گیرنده</label>
            <input
              type="text"
              value={senderOrReceiver}
              onChange={(e) => setSenderOrReceiver(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">اتصال به پرونده پروژه</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            >
              <option value="">بدون اتصال به پروژه خاص</option>
              {store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">وضعیت</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as DocumentItem['status'])}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            >
              <option value="جاری">جاری</option>
              <option value="نیازمند پیگیری">نیازمند پیگیری</option>
              <option value="بایگانی‌شده">بایگانی‌شده</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">خلاصه و متن کلیدی</label>
          <textarea
            rows={3}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>

        <div className="border border-[#E2DDD0] bg-[#FAF8F3] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#2B3033]">
              پیوست‌های محلی (PDF، Word، Excel، تصویر)
            </span>
            <label className="inline-flex items-center gap-1 border border-[#243B5A] bg-[#FFFFFF] px-3 py-1 text-xs text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>افزودن فایل</span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                onChange={handleFileAdd}
                className="hidden"
              />
            </label>
          </div>
          {linkedAttachments.length === 0 ? (
            <div className="text-xs text-[#7C8287]">فایلی پیوست نشده است.</div>
          ) : (
            <div className="divide-y divide-[#E2DDD0]">
              {linkedAttachments.map((att) => (
                <div key={att.id} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="truncate">{att.fileName}</span>
                  <span className="text-[#7C8287]">{formatFileSize(att.size)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] px-4 py-2 text-xs"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="border border-[#243B5A] bg-[#243B5A] px-5 py-2 text-xs font-medium text-[#FAF8F3]"
          >
            {isNew ? 'ثبت سند' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
