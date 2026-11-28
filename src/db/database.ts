import { openDB, DBSchema, IDBPDatabase, StoreNames } from 'idb';
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
  ProgressStatement,
  Project,
  ProjectBudget,
  ProjectImageRecord,
  SyncEntityStore,
} from '../types';
import {
  createDefaultSettings,
  createReferenceFormTemplates,
  createSampleDataset,
  DEFAULT_APPEARANCE,
} from './seedData';
import { generateId } from '../utils/format';

export interface RollbackSnapshot {
  id: string;
  createdAt: string;
  reason: string;
  data: {
    projects: Project[];
    budgets: ProjectBudget[];
    payments: PaymentRecord[];
    proposals: BudgetProposal[];
    actions: ActionItem[];
    documents: DocumentItem[];
    progressStatements?: ProgressStatement[];
    people: Person[];
    formTemplates: FormTemplate[];
    formSubmissions: FormSubmission[];
    attachments: AttachmentRecord[];
    golzarImages?: GolzarImageRecord[];
    projectImages?: ProjectImageRecord[];
  };
}

interface DaftarFaniDB extends DBSchema {
  projects: { key: string; value: Project };
  budgets: { key: string; value: ProjectBudget };
  payments: { key: string; value: PaymentRecord };
  proposals: { key: string; value: BudgetProposal };
  actions: { key: string; value: ActionItem };
  documents: { key: string; value: DocumentItem };
  progressStatements: { key: string; value: ProgressStatement };
  attachments: { key: string; value: AttachmentRecord };
  people: { key: string; value: Person };
  formTemplates: { key: string; value: FormTemplate };
  formSubmissions: { key: string; value: FormSubmission };
  golzarImages: { key: string; value: GolzarImageRecord };
  projectImages: { key: string; value: ProjectImageRecord };
  activities: { key: string; value: ActivityLog };
  settings: { key: string; value: AppSettings };
  snapshots: { key: string; value: RollbackSnapshot };
}

const DB_NAME = 'daftar-fani-golzar-db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<DaftarFaniDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<DaftarFaniDB>> {
  if (!dbPromise) {
    dbPromise = openDB<DaftarFaniDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const stores: Array<StoreNames<DaftarFaniDB>> = [
          'projects',
          'budgets',
          'payments',
          'proposals',
          'actions',
          'documents',
          'progressStatements',
          'attachments',
          'people',
          'formTemplates',
          'formSubmissions',
          'golzarImages',
          'projectImages',
          'activities',
          'settings',
          'snapshots',
        ];
        for (const storeName of stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function initializeDatabase(): Promise<AppSettings> {
  const db = await getDB();
  let settings = await db.get('settings', 'app-settings');
  if (!settings) {
    settings = createDefaultSettings();
    await db.put('settings', settings);
  } else if (!settings.appearance) {
    settings = {
      ...settings,
      appVersion: settings.appVersion || '1.2.0',
      appearance: { ...DEFAULT_APPEARANCE },
    };
    await db.put('settings', settings);
  }

  // Ensure the two distinct reference organizational forms exist (Section 12)
  const existingTemplates = await db.getAll('formTemplates');
  const existingIds = new Set(existingTemplates.map((t) => t.id));
  const refs = createReferenceFormTemplates(settings.deviceId);
  for (const ref of refs) {
    if (!existingIds.has(ref.id)) {
      await db.put('formTemplates', ref);
    }
  }

  // Clean up any legacy sample initialization activity logs so «آخرین تغییرات» contains ONLY real user events
  const allActivities = await db.getAll('activities');
  for (const log of allActivities) {
    if (log.entityId === 'sample_init') {
      await db.delete('activities', log.id);
    }
  }

  // Seed clearly-labeled sample dataset once on first run if empty (WITHOUT injecting fake activity logs)
  if (!settings.sampleDataInitialized) {
    const existingProjects = await db.getAll('projects');
    if (existingProjects.length === 0) {
      await seedSampleRecords(settings.deviceId);
    }
    settings = {
      ...settings,
      sampleDataInitialized: true,
      updatedAt: new Date().toISOString(),
    };
    await db.put('settings', settings);
  }

  return settings;
}

export async function seedSampleRecords(deviceId: string): Promise<void> {
  const db = await getDB();
  const sample = createSampleDataset(deviceId);

  const tx = db.transaction(
    [
      'projects',
      'budgets',
      'payments',
      'proposals',
      'actions',
      'documents',
      'people',
      'formSubmissions',
    ],
    'readwrite'
  );

  for (const p of sample.projects) await tx.objectStore('projects').put(p);
  for (const b of sample.budgets) await tx.objectStore('budgets').put(b);
  for (const pay of sample.payments) await tx.objectStore('payments').put(pay);
  for (const prop of sample.proposals) await tx.objectStore('proposals').put(prop);
  for (const act of sample.actions) await tx.objectStore('actions').put(act);
  for (const doc of sample.documents) await tx.objectStore('documents').put(doc);
  for (const per of sample.people) await tx.objectStore('people').put(per);
  for (const sub of sample.formSubmissions) await tx.objectStore('formSubmissions').put(sub);

  await tx.done;
}

export interface SampleCleanupInspection {
  counts: {
    projects: number;
    budgets: number;
    payments: number;
    proposals: number;
    actions: number;
    documents: number;
    progressStatements?: number;
    people: number;
    formSubmissions: number;
    attachments: number;
    projectImages: number;
  };
  totalRecords: number;
  sampleAttachmentIds: string[];
  sampleAttachmentNames: string[];
  sampleProjectImageIds: string[];
  sampleProjectImageNames: string[];
  preservedCounts: {
    realProjects: number;
    referenceFormTemplates: number;
    golzarImages: number;
  };
}

export interface FullWipeInspection {
  counts: {
    projects: number;
    budgets: number;
    payments: number;
    proposals: number;
    actions: number;
    documents: number;
    progressStatements?: number;
    attachments: number;
    people: number;
    formSubmissions: number;
    projectImages: number;
    activities: number;
  };
  totalRecords: number;
  referenceFormTemplatesCount: number;
}

export async function inspectSampleDataCleanup(): Promise<SampleCleanupInspection> {
  const db = await getDB();
  const [
    projects,
    budgets,
    payments,
    proposals,
    actions,
    documents,
    progressStatements,
    people,
    formSubmissions,
    attachments,
    projectImages,
    formTemplates,
    golzarImages,
  ] = await Promise.all([
    db.getAll('projects'),
    db.getAll('budgets'),
    db.getAll('payments'),
    db.getAll('proposals'),
    db.getAll('actions'),
    db.getAll('documents'),
    db.getAll('progressStatements'),
    db.getAll('people'),
    db.getAll('formSubmissions'),
    db.getAll('attachments'),
    db.getAll('projectImages'),
    db.getAll('formTemplates'),
    db.getAll('golzarImages'),
  ]);

  const sampleProjects = projects.filter((p) => p.isSample);
  const sampleProjectIds = new Set(sampleProjects.map((p) => p.id));
  const sampleBudgets = budgets.filter((b) => b.isSample || sampleProjectIds.has(b.projectId));
  const samplePayments = payments.filter((p) => p.isSample || sampleProjectIds.has(p.projectId));
  const sampleProposals = proposals.filter((p) => p.isSample);
  const sampleActions = actions.filter(
    (a) => a.isSample || (a.projectId ? sampleProjectIds.has(a.projectId) : false)
  );
  const sampleActionIds = new Set(sampleActions.map((a) => a.id));
  const sampleDocuments = documents.filter(
    (d) => d.isSample || (d.projectId ? sampleProjectIds.has(d.projectId) : false)
  );
  const sampleDocIds = new Set(sampleDocuments.map((d) => d.id));
  const sampleStatements = progressStatements.filter(
    (st) => st.isSample || sampleProjectIds.has(st.projectId)
  );
  const samplePeople = people.filter((p) => p.isSample);
  const sampleFormSubs = formSubmissions.filter((s) => s.isSample);

  const linkedAttachments = attachments.filter(
    (att) =>
      (att.projectId && sampleProjectIds.has(att.projectId)) ||
      (att.documentId && sampleDocIds.has(att.documentId)) ||
      (att.actionId && sampleActionIds.has(att.actionId))
  );
  const linkedProjectImages = projectImages.filter((img) => sampleProjectIds.has(img.projectId));

  const counts = {
    projects: sampleProjects.length,
    budgets: sampleBudgets.length,
    payments: samplePayments.length,
    proposals: sampleProposals.length,
    actions: sampleActions.length,
    documents: sampleDocuments.length,
    progressStatements: sampleStatements.length,
    people: samplePeople.length,
    formSubmissions: sampleFormSubs.length,
    attachments: linkedAttachments.length,
    projectImages: linkedProjectImages.length,
  };

  const totalRecords =
    counts.projects +
    counts.budgets +
    counts.payments +
    counts.proposals +
    counts.actions +
    counts.documents +
    counts.progressStatements +
    counts.people +
    counts.formSubmissions +
    counts.attachments +
    counts.projectImages;

  return {
    counts,
    totalRecords,
    sampleAttachmentIds: linkedAttachments.map((a) => a.id),
    sampleAttachmentNames: linkedAttachments.map((a) => a.fileName),
    sampleProjectImageIds: linkedProjectImages.map((i) => i.id),
    sampleProjectImageNames: linkedProjectImages.map((i) => i.fileName),
    preservedCounts: {
      realProjects: projects.length - sampleProjects.length,
      referenceFormTemplates: formTemplates.filter((t) => t.isReferenceForm).length,
      golzarImages: golzarImages.length,
    },
  };
}

export async function clearSampleRecordsSafe(
  deviceId: string,
  options: { includeLinkedAttachments?: boolean } = {}
): Promise<{ removed: number; removedAttachments: number; snapshotId: string }> {
  const includeLinkedAttachments = options.includeLinkedAttachments !== false;
  const inspection = await inspectSampleDataCleanup();
  const snap = await createRollbackSnapshot('نقطه بازگشت خودکار پیش از پاکسازی اطلاعات آزمایشی');

  const db = await getDB();
  const sampleProjects = (await db.getAll('projects')).filter((p) => p.isSample);
  const sampleProjectIds = new Set(sampleProjects.map((p) => p.id));

  let removed = 0;

  const deleteByPredicate = async (
    storeName: SyncEntityStore,
    predicate: (rec: Record<string, unknown>) => boolean
  ) => {
    const all = await db.getAll(storeName);
    const tx = db.transaction(storeName, 'readwrite');
    for (const rec of all) {
      if (predicate(rec as unknown as Record<string, unknown>)) {
        await tx.store.delete(rec.id);
        removed++;
      }
    }
    await tx.done;
  };

  await deleteByPredicate('projects', (r) => Boolean(r.isSample));
  await deleteByPredicate(
    'budgets',
    (r) => Boolean(r.isSample) || (typeof r.projectId === 'string' && sampleProjectIds.has(r.projectId))
  );
  await deleteByPredicate(
    'payments',
    (r) => Boolean(r.isSample) || (typeof r.projectId === 'string' && sampleProjectIds.has(r.projectId))
  );
  await deleteByPredicate('proposals', (r) => Boolean(r.isSample));
  await deleteByPredicate(
    'actions',
    (r) => Boolean(r.isSample) || (typeof r.projectId === 'string' && sampleProjectIds.has(r.projectId))
  );
  await deleteByPredicate(
    'documents',
    (r) => Boolean(r.isSample) || (typeof r.projectId === 'string' && sampleProjectIds.has(r.projectId))
  );
  await deleteByPredicate(
    'progressStatements',
    (r) => Boolean(r.isSample) || (typeof r.projectId === 'string' && sampleProjectIds.has(r.projectId))
  );
  await deleteByPredicate('people', (r) => Boolean(r.isSample));
  await deleteByPredicate('formSubmissions', (r) => Boolean(r.isSample));

  let removedAttachments = 0;
  if (includeLinkedAttachments && inspection.sampleAttachmentIds.length > 0) {
    const tx = db.transaction('attachments', 'readwrite');
    for (const id of inspection.sampleAttachmentIds) {
      await tx.store.delete(id);
      removedAttachments++;
    }
    await tx.done;
  }

  if (includeLinkedAttachments && inspection.sampleProjectImageIds.length > 0) {
    const tx = db.transaction('projectImages', 'readwrite');
    for (const id of inspection.sampleProjectImageIds) {
      await tx.store.delete(id);
      removedAttachments++;
    }
    await tx.done;
  }

  // Ensure sample data is marked initialized so it never re-seeds automatically on next launch
  const curSettings = await db.get('settings', 'app-settings');
  if (curSettings) {
    await db.put('settings', {
      ...curSettings,
      sampleDataInitialized: true,
      updatedAt: new Date().toISOString(),
    });
  }

  await addActivity({
    entityType: 'backup',
    entityId: 'sample_clear',
    action: 'حذف',
    summary: `پاکسازی ${removed} رکورد آزمایشی و ${removedAttachments} پیوست/تصویر مرتبط (با حفظ تنظیمات و فرم‌های مرجع)`,
    deviceId,
  });

  return { removed, removedAttachments, snapshotId: snap.id };
}

export async function clearSampleRecords(deviceId: string): Promise<number> {
  const res = await clearSampleRecordsSafe(deviceId, { includeLinkedAttachments: true });
  return res.removed + res.removedAttachments;
}

export async function inspectFullDataWipe(): Promise<FullWipeInspection> {
  const db = await getDB();
  const [
    projects,
    budgets,
    payments,
    proposals,
    actions,
    documents,
    progressStatements,
    attachments,
    people,
    formSubmissions,
    projectImages,
    activities,
    formTemplates,
  ] = await Promise.all([
    db.getAll('projects'),
    db.getAll('budgets'),
    db.getAll('payments'),
    db.getAll('proposals'),
    db.getAll('actions'),
    db.getAll('documents'),
    db.getAll('progressStatements'),
    db.getAll('attachments'),
    db.getAll('people'),
    db.getAll('formSubmissions'),
    db.getAll('projectImages'),
    db.getAll('activities'),
    db.getAll('formTemplates'),
  ]);

  const counts = {
    projects: projects.length,
    budgets: budgets.length,
    payments: payments.length,
    proposals: proposals.length,
    actions: actions.length,
    documents: documents.length,
    progressStatements: progressStatements.length,
    attachments: attachments.length,
    people: people.length,
    formSubmissions: formSubmissions.length,
    projectImages: projectImages.length,
    activities: activities.length,
  };

  const totalRecords = Object.values(counts).reduce((s, n) => s + n, 0);

  return {
    counts,
    totalRecords,
    referenceFormTemplatesCount: formTemplates.filter((t) => t.isReferenceForm).length,
  };
}

export async function wipeAllUserDataSafe(
  deviceId: string,
  options: { preserveReferenceTemplates?: boolean } = {}
): Promise<{ removedTotal: number; snapshotId: string }> {
  const preserveReferenceTemplates = options.preserveReferenceTemplates !== false;
  const before = await inspectFullDataWipe();
  const snap = await createRollbackSnapshot('نقطه بازگشت خودکار پیش از پاکسازی کامل اطلاعات');

  const db = await getDB();
  const storesToClear: Array<StoreNames<DaftarFaniDB>> = [
    'projects',
    'budgets',
    'payments',
    'proposals',
    'actions',
    'documents',
    'progressStatements',
    'attachments',
    'people',
    'formSubmissions',
    'projectImages',
    'activities',
  ];

  const tx = db.transaction(storesToClear, 'readwrite');
  for (const s of storesToClear) {
    await tx.objectStore(s).clear();
  }
  await tx.done;

  if (!preserveReferenceTemplates) {
    const allTemplates = await db.getAll('formTemplates');
    const tTx = db.transaction('formTemplates', 'readwrite');
    for (const t of allTemplates) {
      if (!t.isReferenceForm) {
        await tTx.store.delete(t.id);
      }
    }
    await tTx.done;
  }

  // Keep settings, auth config, appearance, letterhead, and mark sampleDataInitialized = true so app starts completely clean
  const curSettings = await db.get('settings', 'app-settings');
  if (curSettings) {
    await db.put('settings', {
      ...curSettings,
      sampleDataInitialized: true,
      updatedAt: new Date().toISOString(),
    });
  }

  await addActivity({
    entityType: 'backup',
    entityId: 'full_wipe',
    action: 'حذف',
    summary: `پاکسازی کامل ${before.totalRecords} رکورد عملیاتی (تنظیمات و قالب‌های مرجع حفظ شدند)`,
    deviceId,
  });

  return { removedTotal: before.totalRecords, snapshotId: snap.id };
}

export async function addActivity(
  entry: Omit<ActivityLog, 'id' | 'timestamp'>
): Promise<ActivityLog> {
  const db = await getDB();
  const log: ActivityLog = {
    id: generateId('log'),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  await db.put('activities', log);
  return log;
}

export async function loadAllData() {
  const db = await getDB();
  const [
    projects,
    budgets,
    payments,
    proposals,
    actions,
    documents,
    progressStatements,
    attachments,
    people,
    formTemplates,
    formSubmissions,
    golzarImages,
    projectImages,
    activities,
    settings,
    snapshots,
  ] = await Promise.all([
    db.getAll('projects'),
    db.getAll('budgets'),
    db.getAll('payments'),
    db.getAll('proposals'),
    db.getAll('actions'),
    db.getAll('documents'),
    db.getAll('progressStatements'),
    db.getAll('attachments'),
    db.getAll('people'),
    db.getAll('formTemplates'),
    db.getAll('formSubmissions'),
    db.getAll('golzarImages'),
    db.getAll('projectImages'),
    db.getAll('activities'),
    db.get('settings', 'app-settings'),
    db.getAll('snapshots'),
  ]);

  activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  golzarImages.sort((a, b) => a.order - b.order);

  return {
    projects,
    budgets,
    payments,
    proposals,
    actions,
    documents,
    progressStatements,
    attachments,
    people,
    formTemplates,
    formSubmissions,
    golzarImages,
    projectImages,
    activities: activities.slice(0, 150),
    settings: settings ?? createDefaultSettings(),
    snapshots,
  };
}

export async function putEntity<K extends StoreNames<DaftarFaniDB>>(
  store: K,
  value: DaftarFaniDB[K]['value']
): Promise<boolean> {
  const db = await getDB();
  await db.put(store, value);
  const key = (value as { id: string }).id;
  const verified = await db.get(store, key);
  return Boolean(verified);
}

export async function deleteEntity<K extends StoreNames<DaftarFaniDB>>(
  store: K,
  id: string
): Promise<boolean> {
  const db = await getDB();
  await db.delete(store, id);
  const check = await db.get(store, id);
  return !check;
}

export async function createRollbackSnapshot(reason: string): Promise<RollbackSnapshot> {
  const db = await getDB();
  const [
    projects,
    budgets,
    payments,
    proposals,
    actions,
    documents,
    progressStatements,
    people,
    formTemplates,
    formSubmissions,
    attachments,
    golzarImages,
    projectImages,
  ] = await Promise.all([
    db.getAll('projects'),
    db.getAll('budgets'),
    db.getAll('payments'),
    db.getAll('proposals'),
    db.getAll('actions'),
    db.getAll('documents'),
    db.getAll('progressStatements'),
    db.getAll('people'),
    db.getAll('formTemplates'),
    db.getAll('formSubmissions'),
    db.getAll('attachments'),
    db.getAll('golzarImages'),
    db.getAll('projectImages'),
  ]);

  const snapshot: RollbackSnapshot = {
    id: generateId('snap'),
    createdAt: new Date().toISOString(),
    reason,
    data: {
      projects,
      budgets,
      payments,
      proposals,
      actions,
      documents,
      progressStatements,
      people,
      formTemplates,
      formSubmissions,
      attachments,
      golzarImages,
      projectImages,
    },
  };

  await db.put('snapshots', snapshot);

  const allSnaps = await db.getAll('snapshots');
  allSnaps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const old of allSnaps.slice(5)) {
    await db.delete('snapshots', old.id);
  }

  return snapshot;
}

export async function restoreFromSnapshot(snapshotId: string, deviceId: string): Promise<boolean> {
  const db = await getDB();
  const snap = await db.get('snapshots', snapshotId);
  if (!snap) return false;

  const stores: Array<keyof RollbackSnapshot['data']> = [
    'projects',
    'budgets',
    'payments',
    'proposals',
    'actions',
    'documents',
    'progressStatements',
    'people',
    'formTemplates',
    'formSubmissions',
    'attachments',
    'golzarImages',
    'projectImages',
  ];

  const tx = db.transaction(stores, 'readwrite');
  for (const storeName of stores) {
    const store = tx.objectStore(storeName);
    await store.clear();
    const items = snap.data[storeName] ?? [];
    for (const item of items) {
      await store.put(item as never);
    }
  }
  await tx.done;

  await addActivity({
    entityType: 'backup',
    entityId: snapshotId,
    action: 'بازیابی',
    summary: `بازگشت به وضعیت قبلی (${snap.reason})`,
    deviceId,
  });

  return true;
}

export async function replaceAllDataFromBackup(
  payload: RollbackSnapshot['data'],
  deviceId: string,
  reason = 'پیش از بازیابی نسخه پشتیبان'
): Promise<RollbackSnapshot> {
  const preSnap = await createRollbackSnapshot(reason);

  const db = await getDB();
  const stores: Array<keyof RollbackSnapshot['data']> = [
    'projects',
    'budgets',
    'payments',
    'proposals',
    'actions',
    'documents',
    'progressStatements',
    'people',
    'formTemplates',
    'formSubmissions',
    'attachments',
    'golzarImages',
    'projectImages',
  ];

  const tx = db.transaction(stores, 'readwrite');
  for (const storeName of stores) {
    const store = tx.objectStore(storeName);
    await store.clear();
    const items = payload[storeName] ?? [];
    for (const item of items) {
      await store.put(item as never);
    }
  }
  await tx.done;

  await addActivity({
    entityType: 'backup',
    entityId: preSnap.id,
    action: 'بازیابی',
    summary: 'بازیابی نسخه پشتیبان کامل انجام شد',
    deviceId,
  });

  return preSnap;
}
