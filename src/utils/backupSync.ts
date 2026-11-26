import JSZip from 'jszip';
import {
  AttachmentRecord,
  SyncConflict,
  SyncEntityStore,
  SyncPackage,
} from '../types';
import { getDB, replaceAllDataFromBackup, RollbackSnapshot } from '../db/database';
import { computeRecordFingerprint, generateId, todayIsoDate } from './format';

const SYNC_STORES: SyncEntityStore[] = [
  'projects',
  'budgets',
  'payments',
  'proposals',
  'actions',
  'documents',
  'people',
  'formTemplates',
  'formSubmissions',
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const idx = res.indexOf(',');
      resolve(idx >= 0 ? res.slice(idx + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

export async function createFullZipBackup(deviceId: string, deviceName: string): Promise<void> {
  const db = await getDB();
  const zip = new JSZip();

  const dataPayload: Record<string, unknown> = {};
  for (const store of SYNC_STORES) {
    dataPayload[store] = await db.getAll(store);
  }

  const attachments = await db.getAll('attachments');
  const attachmentsManifest = [];
  const filesFolder = zip.folder('attachments');

  for (const att of attachments) {
    const safeName = `${att.id}_${att.fileName.replace(/[/\\]/g, '_')}`;
    filesFolder?.file(safeName, att.data);
    attachmentsManifest.push({
      id: att.id,
      fileName: att.fileName,
      zipEntry: safeName,
      mimeType: att.mimeType,
      size: att.size,
      projectId: att.projectId,
      documentId: att.documentId,
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      updatedByDevice: att.updatedByDevice,
    });
  }

  const manifest = {
    schemaVersion: 1,
    backupType: 'daftar-fani-full-backup',
    exportedAt: new Date().toISOString(),
    sourceDeviceId: deviceId,
    sourceDeviceName: deviceName,
    data: dataPayload,
    attachments: attachmentsManifest,
  };

  zip.file('backup-data.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daftar-fani-backup-${todayIsoDate()}.zip`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

export async function restoreFullZipBackup(
  file: File,
  deviceId: string
): Promise<{ snapshot: RollbackSnapshot; restoredCounts: Record<string, number> }> {
  const zip = await JSZip.loadAsync(file);
  const jsonStr = await zip.file('backup-data.json')?.async('string');
  if (!jsonStr) {
    throw new Error('فایل پشتیبان معتبر نیست (backup-data.json یافت نشد).');
  }
  const parsed = JSON.parse(jsonStr);
  if (parsed.backupType !== 'daftar-fani-full-backup' || !parsed.data) {
    throw new Error('ساختار فایل پشتیبان با نرم‌افزار دفتر فنی همخوانی ندارد.');
  }

  const restoredAttachments: AttachmentRecord[] = [];
  for (const meta of parsed.attachments ?? []) {
    const entry = zip.file(`attachments/${meta.zipEntry}`);
    if (entry) {
      const arrayBuf = await entry.async('arraybuffer');
      restoredAttachments.push({
        id: meta.id,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: meta.size,
        data: new Blob([arrayBuf], { type: meta.mimeType }),
        projectId: meta.projectId,
        documentId: meta.documentId,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        updatedByDevice: meta.updatedByDevice,
      });
    }
  }

  const restoreData: RollbackSnapshot['data'] = {
    projects: parsed.data.projects ?? [],
    budgets: parsed.data.budgets ?? [],
    payments: parsed.data.payments ?? [],
    proposals: parsed.data.proposals ?? [],
    actions: parsed.data.actions ?? [],
    documents: parsed.data.documents ?? [],
    people: parsed.data.people ?? [],
    formTemplates: parsed.data.formTemplates ?? [],
    formSubmissions: parsed.data.formSubmissions ?? [],
    attachments: restoredAttachments,
  };

  const snapshot = await replaceAllDataFromBackup(
    restoreData,
    deviceId,
    `نسخه خودکار پیش از بازیابی ${file.name}`
  );

  return {
    snapshot,
    restoredCounts: {
      projects: restoreData.projects.length,
      documents: restoreData.documents.length,
      actions: restoreData.actions.length,
      attachments: restoreData.attachments.length,
    },
  };
}

// Equal-Peer Sync Package (for USB transfer or Direct Wireless WebRTC transfer)
export async function buildSyncPackage(
  deviceId: string,
  deviceName: string,
  includeAttachments = true
): Promise<SyncPackage> {
  const db = await getDB();
  const records = {} as Record<SyncEntityStore, Record<string, unknown>[]>;
  for (const store of SYNC_STORES) {
    records[store] = (await db.getAll(store)) as unknown as Record<string, unknown>[];
  }

  const attachments = await db.getAll('attachments');
  const attachmentsMeta = [];
  for (const att of attachments) {
    attachmentsMeta.push({
      id: att.id,
      fileName: att.fileName,
      mimeType: att.mimeType,
      size: att.size,
      projectId: att.projectId,
      documentId: att.documentId,
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      updatedByDevice: att.updatedByDevice,
      base64Data: includeAttachments ? await blobToBase64(att.data) : undefined,
    });
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sourceDeviceId: deviceId,
    sourceDeviceName: deviceName,
    records,
    attachmentsMeta,
  };
}

export async function exportUsbSyncPackage(deviceId: string, deviceName: string): Promise<void> {
  const pkg = await buildSyncPackage(deviceId, deviceName, true);
  const blob = new Blob([JSON.stringify(pkg)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daftar-fani-sync-${todayIsoDate()}.dfsync.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

export interface SyncAnalysisResult {
  sourceDeviceName: string;
  sourceDeviceId: string;
  newRecords: Array<{ store: SyncEntityStore; record: Record<string, unknown> }>;
  identicalCount: number;
  conflicts: SyncConflict[];
  newAttachments: AttachmentRecord[];
}

function getRecordDisplayLabel(store: SyncEntityStore, rec: Record<string, unknown>): string {
  return String(
    rec.title ||
      rec.subject ||
      rec.fullName ||
      rec.templateTitle ||
      rec.voucherNumber ||
      rec.code ||
      rec.id ||
      store
  );
}

// Strict Conflict Detection: NEVER overwrites or deletes silently!
export async function analyzeIncomingSyncPackage(pkg: SyncPackage): Promise<SyncAnalysisResult> {
  if (!pkg || !pkg.records) {
    throw new Error('بسته همگام‌سازی معتبر نیست.');
  }

  const db = await getDB();
  const newRecords: Array<{ store: SyncEntityStore; record: Record<string, unknown> }> = [];
  const conflicts: SyncConflict[] = [];
  let identicalCount = 0;

  for (const store of SYNC_STORES) {
    const localList = (await db.getAll(store)) as unknown as Record<string, unknown>[];
    const localMap = new Map(localList.map((r) => [String(r.id), r]));
    const remoteList = pkg.records[store] ?? [];

    for (const remoteRec of remoteList) {
      const id = String(remoteRec.id);
      const localRec = localMap.get(id);

      if (!localRec) {
        newRecords.push({ store, record: remoteRec });
      } else {
        const localFp = computeRecordFingerprint(localRec);
        const remoteFp = computeRecordFingerprint(remoteRec);
        if (localFp === remoteFp) {
          identicalCount++;
        } else {
          // Any differing content on same ID is flagged as conflict for user decision
          conflicts.push({
            id: generateId('conf'),
            store,
            recordId: id,
            recordLabel: getRecordDisplayLabel(store, localRec),
            localRecord: localRec,
            remoteRecord: remoteRec,
            localUpdatedAt: String(localRec.updatedAt || ''),
            remoteUpdatedAt: String(remoteRec.updatedAt || ''),
            remoteDeviceName: pkg.sourceDeviceName || 'دستگاه مقابل',
          });
        }
      }
    }
  }

  const localAttachments = await db.getAll('attachments');
  const localAttIds = new Set(localAttachments.map((a) => a.id));
  const newAttachments: AttachmentRecord[] = [];
  for (const attMeta of pkg.attachmentsMeta ?? []) {
    if (!localAttIds.has(attMeta.id) && attMeta.base64Data) {
      newAttachments.push({
        id: attMeta.id,
        fileName: attMeta.fileName,
        mimeType: attMeta.mimeType,
        size: attMeta.size,
        data: base64ToBlob(attMeta.base64Data, attMeta.mimeType),
        projectId: attMeta.projectId,
        documentId: attMeta.documentId,
        createdAt: attMeta.createdAt,
        updatedAt: attMeta.updatedAt,
        updatedByDevice: attMeta.updatedByDevice,
      });
    }
  }

  return {
    sourceDeviceName: pkg.sourceDeviceName || 'دستگاه مقابل',
    sourceDeviceId: pkg.sourceDeviceId || 'unknown',
    newRecords,
    identicalCount,
    conflicts,
    newAttachments,
  };
}

// Applies ONLY explicitly approved new items & user-resolved conflict decisions
export async function applyApprovedSyncDecisions(
  analysis: SyncAnalysisResult,
  resolvedConflicts: SyncConflict[],
  importNewRecords: boolean,
  deviceId: string
): Promise<{ added: number; updated: number; duplicated: number; keptLocal: number }> {
  const db = await getDB();
  let added = 0;
  let updated = 0;
  let duplicated = 0;
  let keptLocal = 0;

  if (importNewRecords) {
    for (const item of analysis.newRecords) {
      await db.put(item.store, item.record as never);
      added++;
    }
    for (const att of analysis.newAttachments) {
      await db.put('attachments', att);
    }
  }

  for (const conf of resolvedConflicts) {
    if (conf.resolution === 'accept-remote') {
      await db.put(conf.store, conf.remoteRecord as never);
      updated++;
    } else if (conf.resolution === 'keep-both') {
      const cloned: Record<string, unknown> = {
        ...conf.remoteRecord,
        id: generateId('copy'),
        updatedAt: new Date().toISOString(),
        updatedByDevice: deviceId,
      };
      if (typeof cloned.title === 'string') {
        cloned.title = `${cloned.title} (نسخه دستگاه مقابل)`;
      } else if (typeof cloned.subject === 'string') {
        cloned.subject = `${cloned.subject} (نسخه دستگاه مقابل)`;
      }
      await db.put(conf.store, cloned as never);
      duplicated++;
    } else {
      keptLocal++;
    }
  }

  return { added, updated, duplicated, keptLocal };
}
