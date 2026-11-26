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
  PaymentRecord,
  Person,
  Project,
  ProjectBudget,
  SyncEntityStore,
} from '../types';
import {
  createDefaultSettings,
  createReferenceFormTemplates,
  createSampleDataset,
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
    people: Person[];
    formTemplates: FormTemplate[];
    formSubmissions: FormSubmission[];
    attachments: AttachmentRecord[];
  };
}

interface DaftarFaniDB extends DBSchema {
  projects: { key: string; value: Project };
  budgets: { key: string; value: ProjectBudget };
  payments: { key: string; value: PaymentRecord };
  proposals: { key: string; value: BudgetProposal };
  actions: { key: string; value: ActionItem };
  documents: { key: string; value: DocumentItem };
  attachments: { key: string; value: AttachmentRecord };
  people: { key: string; value: Person };
  formTemplates: { key: string; value: FormTemplate };
  formSubmissions: { key: string; value: FormSubmission };
  activities: { key: string; value: ActivityLog };
  settings: { key: string; value: AppSettings };
  snapshots: { key: string; value: RollbackSnapshot };
}

const DB_NAME = 'daftar-fani-golzar-db';
const DB_VERSION = 1;

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
          'attachments',
          'people',
          'formTemplates',
          'formSubmissions',
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

  // Seed clearly-labeled sample dataset once on first run so all modules are immediately testable
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
      'activities',
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

  await tx.objectStore('activities').put({
    id: generateId('actlog'),
    timestamp: new Date().toISOString(),
    entityType: 'project',
    entityId: 'sample_init',
    action: 'ثبت',
    summary: 'بارگذاری داده‌های آزمایشی نمونه جهت ارزیابی نرم‌افزار (غیرسازمانی)',
    deviceId,
  });

  await tx.done;
}

export async function clearSampleRecords(deviceId: string): Promise<number> {
  const db = await getDB();
  const entityStores: SyncEntityStore[] = [
    'projects',
    'budgets',
    'payments',
    'proposals',
    'actions',
    'documents',
    'people',
    'formSubmissions',
  ];
  let removed = 0;

  for (const storeName of entityStores) {
    const all = await db.getAll(storeName);
    const tx = db.transaction(storeName, 'readwrite');
    for (const rec of all) {
      if ((rec as { isSample?: boolean }).isSample) {
        await tx.store.delete(rec.id);
        removed++;
      }
    }
    await tx.done;
  }

  await addActivity({
    entityType: 'backup',
    entityId: 'sample_clear',
    action: 'حذف',
    summary: `حذف ${removed} رکورد آزمایشی نمونه (اطلاعات ثبت‌شده کاربر حفظ شدند)`,
    deviceId,
  });

  return removed;
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
    attachments,
    people,
    formTemplates,
    formSubmissions,
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
    db.getAll('attachments'),
    db.getAll('people'),
    db.getAll('formTemplates'),
    db.getAll('formSubmissions'),
    db.getAll('activities'),
    db.get('settings', 'app-settings'),
    db.getAll('snapshots'),
  ]);

  activities.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    projects,
    budgets,
    payments,
    proposals,
    actions,
    documents,
    attachments,
    people,
    formTemplates,
    formSubmissions,
    activities: activities.slice(0, 120),
    settings: settings ?? createDefaultSettings(),
    snapshots,
  };
}

export async function putEntity<K extends StoreNames<DaftarFaniDB>>(
  store: K,
  value: DaftarFaniDB[K]['value']
): Promise<void> {
  const db = await getDB();
  await db.put(store, value);
}

export async function deleteEntity<K extends StoreNames<DaftarFaniDB>>(
  store: K,
  id: string
): Promise<void> {
  const db = await getDB();
  await db.delete(store, id);
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
    people,
    formTemplates,
    formSubmissions,
    attachments,
  ] = await Promise.all([
    db.getAll('projects'),
    db.getAll('budgets'),
    db.getAll('payments'),
    db.getAll('proposals'),
    db.getAll('actions'),
    db.getAll('documents'),
    db.getAll('people'),
    db.getAll('formTemplates'),
    db.getAll('formSubmissions'),
    db.getAll('attachments'),
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
      people,
      formTemplates,
      formSubmissions,
      attachments,
    },
  };

  await db.put('snapshots', snapshot);

  // Keep only last 5 rollback snapshots to keep local storage lightweight
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
    'people',
    'formTemplates',
    'formSubmissions',
    'attachments',
  ];

  const tx = db.transaction(stores, 'readwrite');
  for (const storeName of stores) {
    const store = tx.objectStore(storeName);
    await store.clear();
    const items = snap.data[storeName];
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
  // Always snapshot current state first so user can roll back (Section 14)
  const preSnap = await createRollbackSnapshot(reason);

  const db = await getDB();
  const stores: Array<keyof RollbackSnapshot['data']> = [
    'projects',
    'budgets',
    'payments',
    'proposals',
    'actions',
    'documents',
    'people',
    'formTemplates',
    'formSubmissions',
    'attachments',
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
    summary: 'بازیابی نسخه پشتیبان کامل انجام شد (نسخه بازگشت قبلی ذخیره شد)',
    deviceId,
  });

  return preSnap;
}
