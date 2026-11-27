export type AppRoute =
  | 'home'
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'budget'
  | 'actions'
  | 'documents'
  | 'reports'
  | 'support';

export type ProjectType = 'فرهنگی' | 'عمرانی' | 'بهسازی' | 'مرمت' | string;

export type ProjectStatus =
  | 'شروع‌نشده'
  | 'در حال اجرا'
  | 'دارای مشکل'
  | 'متوقف'
  | 'تکمیل‌شده';

export interface ProjectStage {
  id: string;
  key: string;
  title: string;
  order: number;
  enabled: boolean;
  status: 'انجام‌نشده' | 'در حال انجام' | 'انجام‌شده';
  completedDate?: string;
  notes?: string;
}

export interface Project {
  id: string;
  code: string;
  title: string;
  type: ProjectType;
  location: string;
  responsibleDepartment: string;
  client: string;
  contractor: string;
  contractNumber: string;
  contractDate: string;
  contractAmount: number;
  contractDuration: string;
  notificationDate: string;
  ceoOrderNumber: string;
  ceoOrderDate: string;
  ceoOrderNotes: string;
  status: ProjectStatus;
  physicalProgress: number; // 0 to 100
  description: string;
  stages: ProjectStage[];
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface ProjectBudget {
  id: string; // same as projectId or unique
  projectId: string;
  approvedCredit: number; // اعتبار مصوب
  notifiedCredit: number; // اعتبار ابلاغی
  allocatedCredit: number; // اعتبار تخصیص‌یافته
  fundedCredit: number; // تأمین اعتبار
  committedAmount: number; // مبلغ تعهدشده
  submittedStatementAmount: number; // صورت‌وضعیت ارائه‌شده
  approvedStatementAmount: number; // صورت‌وضعیت تأییدشده
  notes: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface PaymentRecord {
  id: string;
  projectId: string;
  date: string;
  amount: number;
  voucherNumber: string;
  statementRef: string;
  description: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export type ProposalPriority = 'فوری' | 'بالا' | 'متوسط' | 'عادی';

export type ProposalStatus =
  | 'پیش‌نویس'
  | 'در حال بررسی'
  | 'ارسال‌شده'
  | 'مصوب'
  | 'نیاز به اصلاح';

export type ProposalEstimateBasis =
  | 'فهرست بها'
  | 'استعلام قیمت'
  | 'برآورد کارشناسی'
  | 'قرارداد مشابه'
  | 'ترکیبی';

export interface BudgetEstimateLine {
  id: string;
  title: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  note?: string;
}

export interface ProposalImageItem {
  id: string;
  dataUrl: string;
  caption: string;
  sizeBytes: number;
  addedAt: string;
}

export interface ProposalDocumentItem {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  addedAt: string;
}

export interface BudgetProposal {
  id: string;
  fiscalYear: string;
  projectCode?: string;
  title: string;
  projectType?: ProjectType;
  location?: string;
  responsiblePerson?: string;
  startDate?: string;
  endDate?: string;
  fundingSource?: string;
  proposalStatus?: ProposalStatus;
  estimateBasis?: ProposalEstimateBasis;
  estimateSummary?: string;
  estimateItems?: BudgetEstimateLine[];
  images?: ProposalImageItem[];
  estimateDocuments?: ProposalDocumentItem[];
  description: string;
  priority: ProposalPriority;
  estimatedAmount: number;
  department: string;
  relatedProjectId?: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export type ActionPriority = 'فوری' | 'عادی' | 'کم';
export type ActionStatus =
  | 'در انتظار'
  | 'در حال انجام'
  | 'عقب‌افتاده'
  | 'تکمیل‌شده'
  | 'لغوشده';

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  projectId?: string;
  registeredDate: string;
  dueDate: string;
  priority: ActionPriority;
  status: ActionStatus;
  completedDate?: string;
  followUpResult: string;
  notes: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export type DocumentCategory =
  | 'نامه وارده'
  | 'نامه صادره'
  | 'مکاتبه داخلی'
  | 'صورتجلسه'
  | 'قرارداد'
  | 'دستورکار'
  | 'صورت‌وضعیت'
  | 'پیوست';

export interface DocumentItem {
  id: string;
  category: DocumentCategory;
  documentNumber: string;
  date: string;
  subject: string;
  senderOrReceiver: string;
  projectId?: string;
  summary: string;
  status: 'جاری' | 'بایگانی‌شده' | 'نیازمند پیگیری';
  attachmentIds: string[];
  signatures?: SignatureSnapshot[];
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface AttachmentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  data: Blob;
  projectId?: string;
  documentId?: string;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

// Section 13: People & Signatures (with Historical Snapshots)
export interface Person {
  id: string;
  fullName: string;
  roleTitle: string;
  department: string;
  personnelCode?: string;
  active: boolean;
  replacedByPersonId?: string;
  replacedAt?: string;
  signatureImageDataUrl?: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface SignatureSnapshot {
  id: string;
  personId?: string; // Reference only; historical text never mutates if person is edited
  snapshotFullName: string;
  snapshotRoleTitle: string;
  snapshotSignatureImage?: string;
  signedDate?: string;
  comment: string;
  isSignedConfirmed: boolean; // Explicit confirmation; naming a person alone is NOT a valid signature
}

// Section 12: Organizational Form Builder
export type FormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'table';

export interface FormTableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency';
}

export interface FormSectionBlock {
  id: string;
  kind: 'heading' | 'text' | 'divider' | 'field' | 'table';
  label: string;
  content?: string;
  fieldKey?: string;
  fieldType?: FormFieldType;
  required?: boolean;
  options?: string[];
  columns?: FormTableColumn[];
  placeholder?: string;
  detectedFromPattern?: boolean;
}

export interface FormTemplate {
  id: string;
  code: string;
  title: string;
  workflowPurpose: string;
  version: number;
  parentTemplateId?: string;
  sourceFileName?: string;
  blocks: FormSectionBlock[];
  defaultSignatoryCount: number;
  isReferenceForm?: boolean;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface FormSubmission {
  id: string;
  templateId: string;
  templateTitle: string;
  templateVersion: number;
  projectId?: string;
  submissionNumber: string;
  submissionDate: string;
  values: Record<string, unknown>;
  signatures: SignatureSnapshot[];
  status: 'پیش‌نویس' | 'تکمیل‌شده' | 'تأییدشده';
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  entityType:
    | 'project'
    | 'budget'
    | 'payment'
    | 'proposal'
    | 'action'
    | 'document'
    | 'form'
    | 'person'
    | 'backup'
    | 'sync';
  entityId: string;
  action: 'ثبت' | 'ویرایش' | 'حذف' | 'پرداخت' | 'بازیابی' | 'همگام‌سازی';
  summary: string;
  deviceId: string;
}

export interface GolzarImageRecord {
  id: string;
  fileName: string;
  caption: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface ProjectImageRecord {
  id: string; // Strictly tied to projectId (`pimg_${projectId}`)
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  createdAt: string;
  updatedAt: string;
  updatedByDevice: string;
}

export interface AppearanceConfig {
  presetId?: string;
  primaryColor: string; // Default #243B5A
  headerColor: string; // Default #354F73
  accentColor?: string; // Default #B99A62
  canvasColor?: string; // Default #FAF8F3
  cardSurface: string; // Default #F2EEE6
  softTint?: string; // Default #E5EBF2
  radiusPx: number; // Default 12 (6 / 12 / 16)
}

export interface LetterheadConfig {
  organizationName: string;
  unitName: string;
  subtitle: string;
  showDateAndNumber: boolean;
  showSignaturesFooter: boolean;
}

export interface AppSettings {
  id: 'app-settings';
  deviceId: string;
  deviceName: string;
  appVersion?: string;
  officialLogoDataUrl?: string;
  appearance?: AppearanceConfig;
  auth: {
    enabled: boolean; // Defaults strictly to false per Section 16
    testUsername: string; // '000' strictly for internal testing
    testPassword: string; // '000' strictly for internal testing
  };
  letterhead: LetterheadConfig;
  processTemplates: Record<string, string[]>; // ProjectType -> enabled stage keys
  sampleDataInitialized: boolean;
  lastBackupAt?: string;
  lastSyncAt?: string;
  lastSavedAt?: string;
  updatedAt: string;
}

export type SyncEntityStore =
  | 'projects'
  | 'budgets'
  | 'payments'
  | 'proposals'
  | 'actions'
  | 'documents'
  | 'people'
  | 'formTemplates'
  | 'formSubmissions';

export interface SyncConflict {
  id: string;
  store: SyncEntityStore;
  recordId: string;
  recordLabel: string;
  localRecord: Record<string, unknown>;
  remoteRecord: Record<string, unknown>;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  remoteDeviceName: string;
  resolution?: 'keep-local' | 'accept-remote' | 'keep-both';
}

export interface SyncPackage {
  schemaVersion: number;
  exportedAt: string;
  sourceDeviceId: string;
  sourceDeviceName: string;
  records: Record<SyncEntityStore, Record<string, unknown>[]>;
  golzarImages?: GolzarImageRecord[];
  projectImages?: ProjectImageRecord[];
  officialLogoDataUrl?: string;
  attachmentsMeta: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    projectId?: string;
    documentId?: string;
    createdAt: string;
    updatedAt: string;
    updatedByDevice: string;
    base64Data?: string;
  }>;
}

export interface FloatingWindowItem {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  minimized: boolean;
  zIndex: number;
}
