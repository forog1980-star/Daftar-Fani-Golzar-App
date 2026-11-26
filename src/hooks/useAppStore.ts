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
  PaymentRecord,
  Person,
  Project,
  ProjectBudget,
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
    activities: [],
    settings: createDefaultSettings(),
    snapshots: [],
  });

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

  const deviceId = state.settings.deviceId;

  const saveProject = useCallback(
    async (project: Project, isNew: boolean) => {
      const now = new Date().toISOString();
      const record: Project = {
        ...project,
        createdAt: isNew ? now : project.createdAt,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      await putEntity('projects', record);

      // Ensure a matching budget ledger exists for every project
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

      await addActivity({
        entityType: 'project',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت پروژه جدید' : 'به‌روزرسانی پروژه'}: ${record.title}`,
        deviceId,
      });
      await refresh();
      return record;
    },
    [deviceId, refresh, state.budgets]
  );

  const deleteProject = useCallback(
    async (project: Project) => {
      await deleteEntity('projects', project.id);
      await addActivity({
        entityType: 'project',
        entityId: project.id,
        action: 'حذف',
        summary: `حذف پرونده پروژه: ${project.title}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const saveBudget = useCallback(
    async (budget: ProjectBudget, projectTitle: string) => {
      const now = new Date().toISOString();
      const record: ProjectBudget = {
        ...budget,
        updatedAt: now,
        updatedByDevice: deviceId,
      };
      await putEntity('budgets', record);
      await addActivity({
        entityType: 'budget',
        entityId: record.id,
        action: 'ویرایش',
        summary: `به‌روزرسانی اطلاعات بودجه و اعتبارات پروژه: ${projectTitle}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('payments', record);
      await addActivity({
        entityType: 'payment',
        entityId: record.id,
        action: 'پرداخت',
        summary: `ثبت پرداخت (${record.voucherNumber || 'بدون شماره سند'}) برای پروژه ${projectTitle}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const deletePayment = useCallback(
    async (payment: PaymentRecord) => {
      await deleteEntity('payments', payment.id);
      await addActivity({
        entityType: 'payment',
        entityId: payment.id,
        action: 'حذف',
        summary: `حذف رکورد پرداخت ${payment.voucherNumber || payment.id}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('proposals', record);
      await addActivity({
        entityType: 'proposal',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت پیشنهاد بودجه' : 'ویرایش پیشنهاد بودجه'}: ${record.title}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const deleteProposal = useCallback(
    async (proposal: BudgetProposal) => {
      await deleteEntity('proposals', proposal.id);
      await addActivity({
        entityType: 'proposal',
        entityId: proposal.id,
        action: 'حذف',
        summary: `حذف پیشنهاد بودجه: ${proposal.title}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('actions', record);
      await addActivity({
        entityType: 'action',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت اقدام جدید' : 'به‌روزرسانی اقدام'}: ${record.title}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const deleteAction = useCallback(
    async (action: ActionItem) => {
      await deleteEntity('actions', action.id);
      await addActivity({
        entityType: 'action',
        entityId: action.id,
        action: 'حذف',
        summary: `حذف اقدام: ${action.title}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('documents', record);
      await addActivity({
        entityType: 'document',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ثبت سند' : 'ویرایش سند'} (${record.category}): ${record.subject}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const deleteDocument = useCallback(
    async (doc: DocumentItem) => {
      await deleteEntity('documents', doc.id);
      await addActivity({
        entityType: 'document',
        entityId: doc.id,
        action: 'حذف',
        summary: `حذف سند: ${doc.subject}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('attachments', record);
      await addActivity({
        entityType: 'document',
        entityId: record.id,
        action: 'ثبت',
        summary: `ذخیره فایل پیوست محلی: ${file.name}`,
        deviceId,
      });
      await refresh();
      return record;
    },
    [deviceId, refresh]
  );

  const deleteAttachment = useCallback(
    async (att: AttachmentRecord) => {
      await deleteEntity('attachments', att.id);
      await addActivity({
        entityType: 'document',
        entityId: att.id,
        action: 'حذف',
        summary: `حذف پیوست: ${att.fileName}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('people', record);
      await addActivity({
        entityType: 'person',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'افزودن شخص' : 'ویرایش مشخصات شخص'}: ${record.fullName} (${record.roleTitle})`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('formTemplates', record);
      await addActivity({
        entityType: 'form',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'ایجاد قالب فرم' : 'ثبت نسخه جدید فرم'}: ${record.title} (نسخه ${record.version})`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const deleteFormTemplate = useCallback(
    async (template: FormTemplate) => {
      await deleteEntity('formTemplates', template.id);
      await addActivity({
        entityType: 'form',
        entityId: template.id,
        action: 'حذف',
        summary: `حذف قالب فرم: ${template.title}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
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
      await putEntity('formSubmissions', record);
      await addActivity({
        entityType: 'form',
        entityId: record.id,
        action: isNew ? 'ثبت' : 'ویرایش',
        summary: `${isNew ? 'تکمیل فرم سازمانی' : 'ویرایش فرم تکمیل‌شده'}: ${record.templateTitle}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const deleteFormSubmission = useCallback(
    async (submission: FormSubmission) => {
      await deleteEntity('formSubmissions', submission.id);
      await addActivity({
        entityType: 'form',
        entityId: submission.id,
        action: 'حذف',
        summary: `حذف فرم تکمیل‌شده: ${submission.templateTitle}`,
        deviceId,
      });
      await refresh();
    },
    [deviceId, refresh]
  );

  const saveSettings = useCallback(
    async (next: AppSettings) => {
      const updated: AppSettings = {
        ...next,
        updatedAt: new Date().toISOString(),
      };
      await putEntity('settings', updated);
      await refresh();
    },
    [refresh]
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
      return ok;
    },
    [deviceId, refresh]
  );

  const hasSampleData =
    state.projects.some((p) => p.isSample) ||
    state.actions.some((a) => a.isSample) ||
    state.documents.some((d) => d.isSample);

  return {
    ...state,
    hasSampleData,
    refresh,
    saveProject,
    deleteProject,
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
    loadSampleDataNow,
    removeSampleDataNow,
    rollbackToSnapshot,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
