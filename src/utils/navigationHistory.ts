import { AppRoute } from '../types';
import { ReportDisplayMode, ReportType } from '../components/reports/ReportsView';
import { SupportTab } from '../components/support/SupportView';

export interface HistoryEntry {
  route: AppRoute;
  projectId?: string;
  supportTab?: SupportTab;
  reportType?: ReportType;
  reportDisplayMode?: ReportDisplayMode;
  subTab?: string;
}

export type NavigationMode = 'drill' | 'sidebar' | 'replace';

export interface NavigateOptions {
  projectId?: string;
  supportTab?: SupportTab;
  reportType?: ReportType;
  reportDisplayMode?: ReportDisplayMode;
  subTab?: string;
  mode?: NavigationMode;
  scrollToTop?: boolean;
}

interface RouteHierarchyRule {
  /** Default logical parent route when no contextual parent exists in the stack */
  defaultParent: AppRoute | null;
  /** Ancestor routes in the history stack that are valid logical parents for this route */
  allowedStackParents: AppRoute[];
}

/**
 * Explicit hierarchical parent definition for every page in the application.
 * Guarantees that Back navigation always resolves to the true logical parent
 * rather than replaying browser history clicks.
 */
const PAGE_HIERARCHY: Record<AppRoute, RouteHierarchyRule> = {
  dashboard: { defaultParent: null, allowedStackParents: [] },
  home: { defaultParent: null, allowedStackParents: [] },
  projects: { defaultParent: 'dashboard', allowedStackParents: ['dashboard'] },
  'project-detail': {
    defaultParent: 'projects',
    allowedStackParents: ['projects', 'budget'],
  },
  budget: {
    defaultParent: 'dashboard',
    allowedStackParents: ['project-detail', 'dashboard'],
  },
  actions: { defaultParent: 'dashboard', allowedStackParents: ['dashboard'] },
  documents: { defaultParent: 'dashboard', allowedStackParents: ['dashboard'] },
  reports: { defaultParent: 'dashboard', allowedStackParents: ['dashboard'] },
  support: { defaultParent: 'dashboard', allowedStackParents: ['dashboard'] },
};

export function createInitialHistory(): HistoryEntry[] {
  return [{ route: 'dashboard' }];
}

function normalizeRoute(route: AppRoute): AppRoute {
  return route === 'home' ? 'dashboard' : route;
}

function buildEntry(route: AppRoute, options?: NavigateOptions): HistoryEntry {
  const normalized = normalizeRoute(route);
  return {
    route: normalized,
    projectId: normalized === 'project-detail' ? options?.projectId : undefined,
    supportTab: normalized === 'support' ? (options?.supportTab ?? 'settings') : undefined,
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
 * Updates the in-app hierarchical History Stack cleanly:
 * - 'replace': updates tabs/filters/display modes in-place without adding stack frames.
 * - 'sidebar': switches top-level section cleanly to [dashboard, section].
 * - 'drill': navigates to a logical child or contextual screen while preserving hierarchy
 *   and preventing circular history loops.
 */
export function pushNavigationHistory(
  stack: HistoryEntry[],
  route: AppRoute,
  options?: NavigateOptions
): HistoryEntry[] {
  const normalized = normalizeRoute(route);
  const mode: NavigationMode = options?.mode ?? 'drill';
  const nextEntry = buildEntry(normalized, options);
  const safeStack = stack.length > 0 ? stack : createInitialHistory();
  const top = safeStack[safeStack.length - 1];

  // Navigating to root dashboard always resets to a clean root stack
  if (normalized === 'dashboard') {
    return createInitialHistory();
  }

  // Same-screen updates (tabs, filters, report types, display modes) replace top in-place
  if (mode === 'replace' || isSameScreen(top, nextEntry)) {
    return [...safeStack.slice(0, -1), { ...top, ...nextEntry }];
  }

  // Sidebar navigation jumps cleanly to a Level-1 branch under Dashboard
  if (mode === 'sidebar') {
    return [{ route: 'dashboard' }, nextEntry];
  }

  // Prevent circular loops if the target screen is already an ancestor in the stack
  const existingIndex = safeStack.findIndex((item) => isSameScreen(item, nextEntry));
  if (existingIndex !== -1) {
    return [
      ...safeStack.slice(0, existingIndex),
      { ...safeStack[existingIndex], ...nextEntry },
    ];
  }

  // If entering a project dossier directly from Dashboard, synthesize its logical parent (projects)
  if (normalized === 'project-detail' && normalizeRoute(top.route) === 'dashboard') {
    return [{ route: 'dashboard' }, { route: 'projects' }, nextEntry];
  }

  return [...safeStack, nextEntry];
}

/**
 * Resolves the exact logical parent state from the page hierarchy and History Stack.
 * Never replays arbitrary browser history or in-page tab switches.
 */
export function resolveLogicalBackHistory(stack: HistoryEntry[]): HistoryEntry[] {
  if (stack.length === 0) {
    return createInitialHistory();
  }

  const current = stack[stack.length - 1];
  const currentRoute = normalizeRoute(current.route);
  const rule = PAGE_HIERARCHY[currentRoute];

  if (!rule || !rule.defaultParent) {
    return createInitialHistory();
  }

  // 1. Prefer the nearest matching logical parent already preserved in the History Stack
  //    (retaining its exact projectId / subTab / reportType state).
  for (let i = stack.length - 2; i >= 0; i--) {
    const candidateRoute = normalizeRoute(stack[i].route);
    if (rule.allowedStackParents.includes(candidateRoute)) {
      return stack.slice(0, i + 1);
    }
  }

  // 2. Fallback to the canonical hierarchy chain for the default logical parent.
  if (rule.defaultParent === 'dashboard') {
    return createInitialHistory();
  }

  return [{ route: 'dashboard' }, { route: rule.defaultParent }];
}

export function getLogicalParentEntry(stack: HistoryEntry[]): HistoryEntry | null {
  if (stack.length === 0) return null;
  const current = stack[stack.length - 1];
  if (normalizeRoute(current.route) === 'dashboard') return null;

  const resolved = resolveLogicalBackHistory(stack);
  return resolved[resolved.length - 1] ?? null;
}

export function getParentLabel(stack: HistoryEntry[]): string {
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
