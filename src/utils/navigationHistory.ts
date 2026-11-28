import { AppRoute } from '../types';
import { ReportDisplayMode, ReportType } from '../components/reports/ReportsView';
import { SupportTab } from '../components/support/SupportView';
import { HelpSectionId } from '../components/help/helpContent';

export interface HistoryEntry {
  route: AppRoute;
  /** Explicit logical parent reference recorded when entering this screen */
  parentRoute: AppRoute | null;
  projectId?: string;
  supportTab?: SupportTab;
  helpSection?: HelpSectionId | null;
  reportType?: ReportType;
  reportDisplayMode?: ReportDisplayMode;
  subTab?: string;
}

export type HistoryStack = HistoryEntry[];

export type NavigationMode = 'drill' | 'sidebar' | 'replace';

export interface NavigateOptions {
  projectId?: string;
  supportTab?: SupportTab;
  helpSection?: HelpSectionId | null;
  reportType?: ReportType;
  reportDisplayMode?: ReportDisplayMode;
  subTab?: string;
  /** Optional explicit parent override when drilling into a detail or report screen */
  parentRoute?: AppRoute | null;
  mode?: NavigationMode;
  scrollToTop?: boolean;
}

interface RouteParentRule {
  /** Default logical parent when no contextual parent exists in HistoryStack */
  defaultParent: AppRoute | null;
  /** Valid contextual parent routes allowed to serve as logical parent for this screen */
  allowedParents: AppRoute[];
}

/**
 * Default parent map kept as fallback metadata for single-entry stacks.
 * Actual back navigation always follows the real step-by-step HistoryStack.
 */
export const PAGE_PARENT_MAP: Record<AppRoute, RouteParentRule> = {
  dashboard: { defaultParent: null, allowedParents: [] },
  home: { defaultParent: null, allowedParents: [] },
  projects: { defaultParent: 'dashboard', allowedParents: ['dashboard'] },
  'project-detail': {
    defaultParent: 'projects',
    allowedParents: ['projects', 'budget', 'dashboard', 'reports'],
  },
  budget: {
    defaultParent: 'dashboard',
    allowedParents: ['project-detail', 'dashboard'],
  },
  actions: {
    defaultParent: 'dashboard',
    allowedParents: ['project-detail', 'dashboard'],
  },
  documents: {
    defaultParent: 'dashboard',
    allowedParents: ['project-detail', 'dashboard'],
  },
  reports: {
    defaultParent: 'dashboard',
    allowedParents: ['project-detail', 'projects', 'budget', 'actions', 'documents', 'dashboard'],
  },
  support: {
    defaultParent: 'dashboard',
    allowedParents: ['dashboard', 'projects', 'project-detail', 'budget', 'actions', 'documents', 'reports'],
  },
};

const MAX_HISTORY_ENTRIES = 50;

export function createInitialHistoryStack(): HistoryStack {
  return [{ route: 'dashboard', parentRoute: null }];
}

function normalizeRoute(route: AppRoute): AppRoute {
  return route === 'home' ? 'dashboard' : route;
}

function buildEntry(
  route: AppRoute,
  parentRoute: AppRoute | null,
  options?: NavigateOptions
): HistoryEntry {
  const normalized = normalizeRoute(route);
  return {
    route: normalized,
    parentRoute: normalized === 'dashboard' ? null : parentRoute,
    projectId: normalized === 'project-detail' ? options?.projectId : undefined,
    supportTab: normalized === 'support' ? (options?.supportTab ?? 'settings') : undefined,
    helpSection: normalized === 'support' ? (options?.helpSection ?? null) : undefined,
    reportType: normalized === 'reports' ? (options?.reportType ?? 'projects') : undefined,
    reportDisplayMode:
      normalized === 'reports' ? (options?.reportDisplayMode ?? 'table') : undefined,
    subTab: options?.subTab,
  };
}

function isSameScreen(a: HistoryEntry, b: HistoryEntry): boolean {
  const routeA = normalizeRoute(a.route);
  const routeB = normalizeRoute(b.route);
  if (routeA !== routeB) return false;
  if (routeA === 'project-detail') {
    return a.projectId === b.projectId && (a.subTab ?? 'overview') === (b.subTab ?? 'overview');
  }
  if (routeA === 'budget') {
    return (a.subTab ?? 'credits') === (b.subTab ?? 'credits');
  }
  if (routeA === 'documents') {
    return (a.subTab ?? 'archive') === (b.subTab ?? 'archive');
  }
  if (routeA === 'reports') {
    return (
      (a.reportType ?? 'projects') === (b.reportType ?? 'projects') &&
      (a.reportDisplayMode ?? 'table') === (b.reportDisplayMode ?? 'table')
    );
  }
  if (routeA === 'support') {
    return (a.supportTab ?? 'settings') === (b.supportTab ?? 'settings');
  }
  return true;
}

/**
 * Updates the in-app step-by-step HistoryStack:
 * - Navigating to 'dashboard' resets to the root dashboard entry.
 * - 'replace' (or navigating to the exact same screen already on top) updates in-place
 *   while preserving the previous screen reference.
 * - 'drill' and 'sidebar' push a new step onto the stack so Back always returns one step
 *   to the immediately preceding screen rather than jumping back to the home page.
 */
export function pushNavigationHistory(
  stack: HistoryStack,
  route: AppRoute,
  options?: NavigateOptions
): HistoryStack {
  const normalized = normalizeRoute(route);
  const mode: NavigationMode = options?.mode ?? 'drill';
  const safeStack = stack.length > 0 ? stack : createInitialHistoryStack();
  const top = safeStack[safeStack.length - 1];
  const topRoute = normalizeRoute(top.route);

  // Navigating explicitly to root dashboard resets to a clean root stack
  if (normalized === 'dashboard') {
    return createInitialHistoryStack();
  }

  const resolvedParent: AppRoute | null =
    options?.parentRoute !== undefined ? options.parentRoute : topRoute;

  const nextEntry = buildEntry(normalized, resolvedParent, options);

  // In-place updates or re-selecting the exact active screen/tab replace top in-place
  if (mode === 'replace' || isSameScreen(top, nextEntry)) {
    return [
      ...safeStack.slice(0, -1),
      { ...top, ...nextEntry, parentRoute: top.parentRoute },
    ];
  }

  const nextStack = [...safeStack, nextEntry];
  if (nextStack.length > MAX_HISTORY_ENTRIES) {
    // Always preserve the root dashboard entry at index 0
    return [nextStack[0], ...nextStack.slice(nextStack.length - (MAX_HISTORY_ENTRIES - 1))];
  }

  return nextStack;
}

/**
 * Steps back exactly one screen in HistoryStack instead of jumping straight to dashboard.
 */
export function resolveLogicalBackHistory(stack: HistoryStack): HistoryStack {
  if (stack.length === 0) {
    return createInitialHistoryStack();
  }

  if (stack.length > 1) {
    return stack.slice(0, -1);
  }

  const current = stack[0];
  const currentRoute = normalizeRoute(current.route);
  if (currentRoute === 'dashboard') {
    return stack;
  }

  const fallbackParent =
    current.parentRoute ?? PAGE_PARENT_MAP[currentRoute]?.defaultParent ?? 'dashboard';
  const normalizedParent = normalizeRoute(fallbackParent);

  if (normalizedParent === 'dashboard') {
    return createInitialHistoryStack();
  }

  return [
    { route: 'dashboard', parentRoute: null },
    { route: normalizedParent, parentRoute: 'dashboard' },
  ];
}

export function getLogicalParentEntry(stack: HistoryStack): HistoryEntry | null {
  if (stack.length <= 1) return null;
  return stack[stack.length - 2] ?? null;
}

export function getParentLabel(stack: HistoryStack): string {
  const target = getLogicalParentEntry(stack);
  if (!target) return 'داشبورد';

  const current = stack[stack.length - 1];
  const sameRoute = current && normalizeRoute(current.route) === normalizeRoute(target.route);

  switch (normalizeRoute(target.route)) {
    case 'dashboard':
      return 'داشبورد';
    case 'projects':
      return 'پرونده پروژه‌ها';
    case 'project-detail':
      if (sameRoute && target.projectId === current?.projectId) {
        if (target.subTab === 'stages') return 'مراحل ۱۸گانه پروژه';
        if (target.subTab === 'contracts') return 'قرارداد و صورت‌وضعیت‌ها';
        if (target.subTab === 'minutes') return 'صورتجلسات پروژه';
        if (target.subTab === 'actions') return 'اقدامات پروژه';
        if (target.subTab === 'correspondence') return 'مکاتبات پروژه';
        if (target.subTab === 'attachments') return 'پیوست‌های پروژه';
        return 'نمای کلی پروژه';
      }
      return 'پرونده پروژه';
    case 'budget':
      if (sameRoute) {
        if (target.subTab === 'payments') return 'سوابق پرداخت‌ها';
        if (target.subTab === 'proposals') return 'پیشنهاد بودجه سال آینده';
        return 'وضعیت اعتبارات پروژه‌ها';
      }
      return 'بودجه و اعتبارات';
    case 'actions':
      return 'اقدامات و پیگیری‌ها';
    case 'documents':
      if (sameRoute) {
        return target.subTab === 'forms' ? 'فرم‌ساز سازمانی' : 'بایگانی اسناد و مکاتبات';
      }
      return 'اسناد و مکاتبات';
    case 'reports':
      return 'گزارش‌ها';
    case 'support':
      if (target.supportTab === 'guide') return 'راهنما';
      if (target.supportTab === 'media') return 'تصاویر و آرم رسمی';
      if (target.supportTab === 'transfer') return 'ورودی و خروجی JSON';
      if (target.supportTab === 'backup') return 'پشتیبان و بازیابی';
      if (target.supportTab === 'people') return 'اشخاص و امضاها';
      return 'تنظیمات';
    default:
      return 'صفحه قبل';
  }
}
