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
 * Explicit parent reference rules for every route in the application.
 * Ensures Back always returns to the exact logical parent page prior to entering
 * a detail/report screen rather than replaying linear browser history clicks.
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
  if (normalizeRoute(a.route) !== normalizeRoute(b.route)) return false;
  if (a.route === 'project-detail') {
    return a.projectId === b.projectId;
  }
  return true;
}

/**
 * Updates the in-app hierarchical HistoryStack cleanly:
 * - 'replace': updates in-page tabs/filters/report modes in-place while preserving parentRoute.
 * - 'sidebar': switches top-level section cleanly to [dashboard, section(parent: dashboard)].
 * - 'drill': navigates to a child/contextual page and records the exact origin screen as its parentRoute.
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

  // Navigating to root dashboard always resets to a clean root stack
  if (normalized === 'dashboard') {
    return createInitialHistoryStack();
  }

  const rule = PAGE_PARENT_MAP[normalized];
  const resolvedParent: AppRoute | null =
    options?.parentRoute !== undefined
      ? options.parentRoute
      : mode === 'sidebar'
        ? 'dashboard'
        : rule.allowedParents.includes(topRoute)
          ? topRoute
          : rule.defaultParent;

  const nextEntry = buildEntry(normalized, resolvedParent, options);

  // Same-screen updates (tabs, filters, report types, display modes) replace top in-place
  // while strictly preserving the original parentRoute reference
  if (mode === 'replace' || isSameScreen(top, nextEntry)) {
    return [
      ...safeStack.slice(0, -1),
      { ...top, ...nextEntry, parentRoute: top.parentRoute },
    ];
  }

  // Sidebar navigation jumps cleanly to a Level-1 branch under Dashboard
  if (mode === 'sidebar') {
    return [
      { route: 'dashboard', parentRoute: null },
      { ...nextEntry, parentRoute: 'dashboard' },
    ];
  }

  // Prevent circular loops if the target screen is already an ancestor in HistoryStack
  const existingIndex = safeStack.findIndex((item) => isSameScreen(item, nextEntry));
  if (existingIndex !== -1) {
    const existing = safeStack[existingIndex];
    return [
      ...safeStack.slice(0, existingIndex),
      { ...existing, ...nextEntry, parentRoute: existing.parentRoute },
    ];
  }

  return [...safeStack, nextEntry];
}

/**
 * Resolves the exact logical parent state from the HistoryStack using each entry's
 * parentRoute reference and PAGE_PARENT_MAP. Never relies on linear browser history.
 */
export function resolveLogicalBackHistory(stack: HistoryStack): HistoryStack {
  if (stack.length === 0) {
    return createInitialHistoryStack();
  }

  const current = stack[stack.length - 1];
  const currentRoute = normalizeRoute(current.route);
  const rule = PAGE_PARENT_MAP[currentRoute];

  if (!rule || (!current.parentRoute && !rule.defaultParent)) {
    return createInitialHistoryStack();
  }

  const preferredParent = normalizeRoute(
    (current.parentRoute ?? rule.defaultParent) as AppRoute
  );

  // 1. Exact match for the recorded logical parent in HistoryStack
  //    (restores exact projectId, subTab, reportType, displayMode, etc.)
  for (let i = stack.length - 2; i >= 0; i--) {
    if (normalizeRoute(stack[i].route) === preferredParent) {
      return stack.slice(0, i + 1);
    }
  }

  // 2. Nearest valid ancestor allowed by PAGE_PARENT_MAP
  for (let i = stack.length - 2; i >= 0; i--) {
    if (rule.allowedParents.includes(normalizeRoute(stack[i].route))) {
      return stack.slice(0, i + 1);
    }
  }

  // 3. Canonical fallback chain to the logical parent
  if (preferredParent === 'dashboard') {
    return createInitialHistoryStack();
  }

  return [
    { route: 'dashboard', parentRoute: null },
    { route: preferredParent, parentRoute: 'dashboard' },
  ];
}

export function getLogicalParentEntry(stack: HistoryStack): HistoryEntry | null {
  if (stack.length === 0) return null;
  const current = stack[stack.length - 1];
  if (normalizeRoute(current.route) === 'dashboard') return null;

  const resolved = resolveLogicalBackHistory(stack);
  return resolved[resolved.length - 1] ?? null;
}

export function getParentLabel(stack: HistoryStack): string {
  const target = getLogicalParentEntry(stack);
  if (!target) return 'داشبورد';

  switch (normalizeRoute(target.route)) {
    case 'dashboard':
      return 'داشبورد';
    case 'projects':
      return 'پرونده پروژه‌ها';
    case 'project-detail':
      return 'پرونده پروژه';
    case 'budget':
      return 'بودجه و اعتبارات';
    case 'actions':
      return 'اقدامات و پیگیری‌ها';
    case 'documents':
      return 'اسناد و مکاتبات';
    case 'reports':
      return 'گزارش‌ها';
    case 'support':
      return target.supportTab === 'guide' ? 'راهنما' : 'تنظیمات';
    default:
      return 'صفحه قبل';
  }
}
