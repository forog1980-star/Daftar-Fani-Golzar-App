import { useCallback, useEffect, useState } from 'react';
import {
  ActionItem,
  ActivityLog,
  AppSettings,
  AttachmentRecord,
  BudgetProposal,
  DocumentItem,
  FormSubmission,
  FormTemplate,
  GolzarImageRecord,
  PaymentRecord,
  Person,
  Project,
  ProjectBudget,
  ProjectImageRecord,
} from '../types';
import {
  addActivity,
  clearSampleRecords,
  deleteEntity,
  initializeDatabase,
  loadAllData,
  putEntity,
  restoreFromSnapshot,
  RollbackSnapshot,
  seedSampleRecords,
} from '../db/database';
import { createDefaultSettings } from '../db/seedData';
import { generateId } from '../utils/format';
import { applyAppearanceToDocument } from '../utils/themeEngine';

export interface SaveToast {
  id: string;
  message: string;
  savedAt: string;
  tone: 'success' | 'error';
}

export interface AppStoreState {
  loading: boolean;
  error: string | null;
  projects: Project[];
  budgets: ProjectBudget[];
  payments: PaymentRecord[];
  proposals: BudgetProposal[];
  actions: ActionItem[];
  documents: DocumentItem[];
  attachments: AttachmentRecord[];
  people: Person[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  golzarImages: GolzarImageRecord[];
  projectImages: ProjectImageRecord[];
  activities: ActivityLog[];
  settings: AppSettings;
  snapshots: RollbackSnapshot[];
}

export function useAppStore() {
  const [state, setState] = useState<AppStoreState>({
    loading: true,
    error: null,
    projects: [],
    budgets: [],
    payments: [],
    proposals: [],
    actions: [],
    documents: [],
    attachments: [],
    people: [],
    formTemplates: [],
    formSubmissions: [],
    golzarImages: [],
    projectImages: [],
    activities: [],
    settings: createDefaultSettings(),
    snapshots: [],
  });

  const [toast, setToast] = useState<SaveToast | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const notifySave = useCallback((message: string, ok: boolean) => {
    const savedAt = new Date().toISOString();
    setToast({
      id: generateId('toast'),
      message,
      savedAt,
      tone: ok ? 'success' : 'error',
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    try {
      const data = await loadAllData();
      setState({
        loading: false,
        error: null,
        ...data,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'خطا در خواندن پایگاه داده محلی',
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    initializeDatabase()
      .then(() => {
        if (active) return refresh();
      })
      .catch((err) => {
        if (active) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'خطا در راه‌اندازی حافظه محلی',
          }));
        }
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  // Apply dynamic appearance tokens from settings to CSS custom properties
  useEffect(() => {
    applyAppearanceToDocument(state.settings.appearance);
  }, [state.settings.appearance]);

  const deviceId = state.settings.deviceId;

  const touchLastSaved = useCallback(
    async (now: string) => {
      await putEntity('settings', {
        ...state.settings,
        lastSavedAt: now,
        updatedAt: now,
      });
    },
    [state.settings]
  );

  const saveProject = useCallback(
    async (project: Project, isNew: boolean) => {
      const now = new Date().toISOString();
      const prev = state.projects.find((p) => p.id === project.id);
      const record: Project = {
        ...project,
        createdAt: isNew ? now : project.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('projects', record);
      if (!ok) {
        notifySave('ذخیره‌سازی پرونده پروژه در حافظه محلی ناموفق بود.', false);
        throw new Error('IndexedDB write verification failed');
      }

      const existingBudget = state.budgets.find((b) => b.projectId === record.id);
      if (!existingBudget) {
        await putEntity('budgets', {
          id: `bud_${record.id}`,
          projectId: record.id,
          approvedCredit: record.contractAmount || 0,
          notifiedCredit: record.contractAmount || 0,
          allocatedCredit: 0,
          fundedCredit: 0,
          committedAmount: record.contractAmount || 0,
          submittedStatementAmount: 0,
          approvedStatementAmount: 0,
          notes: '',
          createdAt: now,
          updatedAt: now,
          updatedByDevice: deviceId,
        });
      }

      const statusChanged = !isNew && prev && prev.status !== record.status;
      await addActivity({
        entityType: 'project',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: isNew
          ? `ایجاد پرونده پروژه: ${record.title}`
          : statusChanged
            ? `تغییر وضعیت پروژه «${record.title}» به «${record.status}»`
            : `اصلاح اطلاعات پروژه: ${record.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave(isNew ? 'پرونده پروژه با موفقیت ذخیره شد.' : 'تغییرات پروژه با موفقیت ذخیره شد.', true);
      return record;
    },
    [deviceId, notifySave, refresh, state.budgets, state.projects, touchLastSaved]
  );

  const deleteProject = useCallback(
    async (project: Project) => {
      const ok = await deleteEntity('projects', project.id);
      if (!ok) {
        notifySave('حذف پرونده پروژه ناموفق بود.', false);
        return;
      }
      await deleteEntity('projectImages', `pimg_${project.id}`);
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'project',
        entityId: project.id,
        action: 'حذف',
        summary: `حذف پرونده پروژه: ${project.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('پرونده پروژه با موفقیت حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveProjectImage = useCallback(
    async (projectId: string, projectTitle: string, img: Omit<ProjectImageRecord, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'updatedByDevice'>) => {
      const now = new Date().toISOString();
      const record: ProjectImageRecord = {
        id: `pimg_${projectId}`,
        projectId,
        ...img,
        createdAt: now,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('projectImages', record);
      if (!ok) {
        notifySave('ذخیره تصویر پروژه ناموفق بود.', false);
        return false;
      }
      await addActivity({
        entityType: 'project',
        entityId: projectId,
        action: 'ویرایش',
        summary: `ثبت/تعویض تصویر اختصاصی پروژه: ${projectTitle}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('تصویر اختصاصی پروژه ذخیره شد.', true);
      return true;
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteProjectImage = useCallback(
    async (projectId: string, projectTitle: string) => {
      const ok = await deleteEntity('projectImages', `pimg_${projectId}`);
      if (!ok) {
        notifySave('حذف تصویر پروژه ناموفق بود.', false);
        return;
      }
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'project',
        entityId: projectId,
        action: 'حذف',
        summary: `حذف تصویر اختصاصی پروژه: ${projectTitle}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('تصویر پروژه حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveGolzarImage = useCallback(
    async (img: GolzarImageRecord, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: GolzarImageRecord = {
        ...img,
        createdAt: isNew ? now : img.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('golzarImages', record);
      if (!ok) {
        notifySave('ذخیره تصویر گلزار شهدا ناموفق بود.', false);
        return false;
      }
      const cleanCaption =
        record.caption && !/\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(record.caption.trim())
          ? record.caption.trim()
          : 'تصویر گلزار شهدا';
      await addActivity({
        entityType: 'document',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'افزودن تصویر جدید گلزار شهدا' : 'جایگزینی تصویر گلزار شهدا'}: ${cleanCaption}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('تصویر گلزار شهدا ذخیره شد.', true);
      return true;
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteGolzarImage = useCallback(
    async (img: GolzarImageRecord) => {
      const ok = await deleteEntity('golzarImages', img.id);
      if (!ok) {
        notifySave('حذف تصویر ناموفق بود.', false);
        return;
      }
      const now = new Date().toISOString();
      const cleanCaption =
        img.caption && !/\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(img.caption.trim())
          ? img.caption.trim()
          : 'تصویر گلزار شهدا';
      await addActivity({
        entityType: 'document',
        entityId: img.id,
        action: 'حذف',
        summary: `حذف تصویر گلزار شهدا: ${cleanCaption}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('تصویر گلزار شهدا حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveBudget = useCallback(
    async (budget: ProjectBudget, projectTitle: string) => {
      const now = new Date().toISOString();
      const record: ProjectBudget = {
        ...budget,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('budgets', record);
      if (!ok) {
        notifySave('ذخیره اطلاعات بودجه ناموفق بود.', false);
        return;
      }
      await addActivity({
        entityType: 'budget',
        entityId: record.id,
        action: 'ویرایش',
        summary: `تغییر اطلاعات بودجه و اعتبارات پروژه: ${projectTitle}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('اطلاعات بودجه با موفقیت ذخیره شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const savePayment = useCallback(
    async (payment: PaymentRecord, isNew: boolean, projectTitle: string) => {
      const now = new Date().toISOString();
      const record: PaymentRecord = {
        ...payment,
        createdAt: isNew ? now : payment.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('payments', record);
      if (!ok) {
        notifySave('ثبت پرداخت در حافظه محلی ناموفق بود.', false);
        return;
      }
      await addActivity({
        entityType: 'payment',
        entityId: record.id,
        action: 'پرداخت',
        summary: `ثبت پرداخت (${record.voucherNumber || 'بدون شماره سند'}) برای پروژه ${projectTitle}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('سند پرداخت با موفقیت ثبت شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deletePayment = useCallback(
    async (payment: PaymentRecord) => {
      const ok = await deleteEntity('payments', payment.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'payment',
        entityId: payment.id,
        action: 'حذف',
        summary: `حذف رکورد پرداخت ${payment.voucherNumber || payment.id}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('رکورد پرداخت حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveProposal = useCallback(
    async (proposal: BudgetProposal, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: BudgetProposal = {
        ...proposal,
        createdAt: isNew ? now : proposal.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('proposals', record);
      if (!ok) return;
      await addActivity({
        entityType: 'proposal',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت پیشنهاد بودجه' : 'ویرایش پیشنهاد بودجه'}: ${record.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('پیشنهاد بودجه ذخیره شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteProposal = useCallback(
    async (proposal: BudgetProposal) => {
      const ok = await deleteEntity('proposals', proposal.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'proposal',
        entityId: proposal.id,
        action: 'حذف',
        summary: `حذف پیشنهاد بودجه: ${proposal.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('پیشنهاد بودجه حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveAction = useCallback(
    async (action: ActionItem, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: ActionItem = {
        ...action,
        createdAt: isNew ? now : action.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('actions', record);
      if (!ok) {
        notifySave('ثبت اقدام ناموفق بود.', false);
        return;
      }
      await addActivity({
        entityType: 'action',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت اقدام جدید' : 'به‌روزرسانی اقدام'}: ${record.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave(isNew ? 'اقدام جدید با موفقیت ثبت شد.' : 'تغییرات اقدام ذخیره شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteAction = useCallback(
    async (action: ActionItem) => {
      const ok = await deleteEntity('actions', action.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'action',
        entityId: action.id,
        action: 'حذف',
        summary: `حذف اقدام: ${action.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('اقدام حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveDocument = useCallback(
    async (doc: DocumentItem, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: DocumentItem = {
        ...doc,
        createdAt: isNew ? now : doc.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('documents', record);
      if (!ok) {
        notifySave('ذخیره سند ناموفق بود.', false);
        return;
      }
      await addActivity({
        entityType: 'document',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت' : 'اصلاح'} ${record.category}: ${record.subject}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave(`${record.category} با موفقیت ذخیره شد.`, true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteDocument = useCallback(
    async (doc: DocumentItem) => {
      const ok = await deleteEntity('documents', doc.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'document',
        entityId: doc.id,
        action: 'حذف',
        summary: `حذف سند: ${doc.subject}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('سند حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const addAttachment = useCallback(
    async (file: File, refs: { projectId?: string; documentId?: string }): Promise<AttachmentRecord> => {
      const now = new Date().toISOString();
      const record: AttachmentRecord = {
        id: generateId('att'),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        data: file,
        projectId: refs.projectId,
        documentId: refs.documentId,
        createdAt: now,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('attachments', record);
      if (!ok) {
        notifySave('ذخیره فایل پیوست ناموفق بود.', false);
        throw new Error('Attachment save failed');
      }
      await addActivity({
        entityType: 'document',
        entityId: record.id,
        action: 'ثبت',
        summary: `ذخیره پیوست محلی: ${file.name}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('فایل پیوست در حافظه محلی ذخیره شد.', true);
      return record;
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteAttachment = useCallback(
    async (att: AttachmentRecord) => {
      const ok = await deleteEntity('attachments', att.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'document',
        entityId: att.id,
        action: 'حذف',
        summary: `حذف پیوست: ${att.fileName}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('پیوست حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const savePerson = useCallback(
    async (person: Person, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: Person = {
        ...person,
        createdAt: isNew ? now : person.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('people', record);
      if (!ok) return;
      await addActivity({
        entityType: 'person',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'افزودن شخص' : 'ویرایش شخص'}: ${record.fullName} (${record.roleTitle})`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('اطلاعات شخص ذخیره شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveFormTemplate = useCallback(
    async (template: FormTemplate, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: FormTemplate = {
        ...template,
        createdAt: isNew ? now : template.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('formTemplates', record);
      if (!ok) return;
      await addActivity({
        entityType: 'form',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ایجاد قالب فرم' : 'ثبت نسخه جدید فرم'}: ${record.title} (نسخه ${record.version})`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('قالب فرم ذخیره شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteFormTemplate = useCallback(
    async (template: FormTemplate) => {
      const ok = await deleteEntity('formTemplates', template.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'form',
        entityId: template.id,
        action: 'حذف',
        summary: `حذف قالب فرم: ${template.title}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('قالب فرم حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveFormSubmission = useCallback(
    async (submission: FormSubmission, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: FormSubmission = {
        ...submission,
        createdAt: isNew ? now : submission.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      const ok = await putEntity('formSubmissions', record);
      if (!ok) return;
      await addActivity({
        entityType: 'form',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت فرم' : 'اصلاح فرم'}: ${record.templateTitle}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('فرم تکمیل‌شده با موفقیت ذخیره شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const deleteFormSubmission = useCallback(
    async (submission: FormSubmission) => {
      const ok = await deleteEntity('formSubmissions', submission.id);
      if (!ok) return;
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'form',
        entityId: submission.id,
        action: 'حذف',
        summary: `حذف فرم تکمیل‌شده: ${submission.templateTitle}`,
        deviceId,
      });
      await touchLastSaved(now);
      await refresh();
      notifySave('فرم حذف شد.', true);
    },
    [deviceId, notifySave, refresh, touchLastSaved]
  );

  const saveSettings = useCallback(
    async (next: AppSettings) => {
      const now = new Date().toISOString();
      const updated: AppSettings = {
        ...next,
        lastSavedAt: now,
        updatedAt: now,
      };
      const ok = await putEntity('settings', updated);
      await refresh();
      if (ok) notifySave('تنظیمات در حافظه محلی ذخیره شد.', true);
    },
    [notifySave, refresh]
  );

  const recordImportActivity = useCallback(
    async (summary: string) => {
      const now = new Date().toISOString();
      await addActivity({
        entityType: 'sync',
        entityId: generateId('jsonimp'),
        action: 'همگام‌سازی',
        summary,
        deviceId,
      });
      await touchLastSaved(now);
      notifySave('اطلاعات تأییدشده از فایل JSON در دستگاه ذخیره شد.', true);
    },
    [deviceId, notifySave, touchLastSaved]
  );

  const loadSampleDataNow = useCallback(async () => {
    await seedSampleRecords(deviceId);
    await refresh();
  }, [deviceId, refresh]);

  const removeSampleDataNow = useCallback(async () => {
    const count = await clearSampleRecords(deviceId);
    await refresh();
    return count;
  }, [deviceId, refresh]);

  const rollbackToSnapshot = useCallback(
    async (snapshotId: string) => {
      const ok = await restoreFromSnapshot(snapshotId, deviceId);
      await refresh();
      if (ok) notifySave('بازگشت به وضعیت قبلی با موفقیت انجام شد.', true);
      return ok;
    },
    [deviceId, notifySave, refresh]
  );

  const hasSampleData =
    state.projects.some((p) => p.isSample) ||
    state.actions.some((a) => a.isSample) ||
    state.documents.some((d) => d.isSample);

  return {
    ...state,
    toast,
    dismissToast: () => setToast(null),
    hasUnsavedChanges,
    setHasUnsavedChanges,
    hasSampleData,
    refresh,
    saveProject,
    deleteProject,
    saveProjectImage,
    deleteProjectImage,
    saveGolzarImage,
    deleteGolzarImage,
    saveBudget,
    savePayment,
    deletePayment,
    saveProposal,
    deleteProposal,
    saveAction,
    deleteAction,
    saveDocument,
    deleteDocument,
    addAttachment,
    deleteAttachment,
    savePerson,
    saveFormTemplate,
    deleteFormTemplate,
    saveFormSubmission,
    deleteFormSubmission,
    saveSettings,
    recordImportActivity,
    loadSampleDataNow,
    removeSampleDataNow,
    rollbackToSnapshot,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
