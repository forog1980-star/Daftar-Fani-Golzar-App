import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { AppRoute, Project } from './types';
import { useAppStore } from './hooks/useAppStore';
import { SplashIntro } from './components/layout/SplashIntro';
import { AppHeader } from './components/layout/AppHeader';
import { SidebarNav } from './components/layout/SidebarNav';
import { OfflineBanner } from './components/layout/PWAInstallButton';
import { ConfirmDialog } from './components/layout/ConfirmDialog';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProjectsView } from './components/projects/ProjectsView';
import { ProjectDetailTab, ProjectDetailView } from './components/projects/ProjectDetailView';
import { BudgetSubTab, BudgetView } from './components/budget/BudgetView';
import { ActionsView } from './components/actions/ActionsView';
import { DocumentsSectionTab, DocumentsView } from './components/documents/DocumentsView';
import { ReportDisplayMode, ReportType, ReportsView } from './components/reports/ReportsView';
import { SupportTab, SupportView } from './components/support/SupportView';
import { ExitAuthOverlay } from './components/support/ExitAuthOverlay';
import { formatJalaliDateTime } from './utils/format';
import {
  createInitialHistory,
  getParentLabel,
  HistoryEntry,
  NavigateOptions,
  pushNavigationHistory,
  resolveLogicalBackHistory,
} from './utils/navigationHistory';

const REPORT_TITLES: Record<ReportType, string> = {
  projects: 'گزارش جامع پروژه‌ها',
  budget: 'گزارش بودجه و اعتبارات',
  proposals: 'گزارش پیشنهاد بودجه سالانه',
  actions: 'گزارش اقدامات و پیگیری‌ها',
  documents: 'گزارش اسناد و مکاتبات',
  'single-project': 'گزارش تفصیلی پروژه',
};

export default function App() {
  const store = useAppStore();
  const [showSplash, setShowSplash] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>(createInitialHistory);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionState, setSessionState] = useState<'active' | 'exited'>('active');
  const [authUnlocked, setAuthUnlocked] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const current = history[history.length - 1];

  const navigate = useCallback((route: AppRoute, options?: NavigateOptions) => {
    setHistory((prev) => pushNavigationHistory(prev, route, options));

    if (options?.scrollToTop !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Always restores the logical parent page based on the page hierarchy & History Stack
  const handleBack = useCallback(() => {
    setHistory((prev) => resolveLogicalBackHistory(prev));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenProject = useCallback(
    (project: Project) => {
      navigate('project-detail', {
        projectId: project.id,
        subTab: 'overview',
        mode: 'drill',
      });
    },
    [navigate]
  );

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const performExit = useCallback(() => {
    setConfirmExitOpen(false);
    setMobileMenuOpen(false);
    store.setHasUnsavedChanges(false);
    setAuthUnlocked(false);
    setHistory(createInitialHistory());
    setSessionState('exited');
  }, [store]);

  const handleRequestExit = useCallback(() => {
    setConfirmExitOpen(true);
  }, []);

  const headerMeta = useMemo((): { title: string; subtitle?: string } => {
    switch (current.route) {
      case 'dashboard':
      case 'home':
        return { title: 'داشبورد' };
      case 'projects':
        return { title: 'پرونده پروژه‌ها' };
      case 'project-detail': {
        const proj = store.projects.find((p) => p.id === current.projectId);
        return {
          title: proj ? proj.title : 'پرونده پروژه',
          subtitle: proj ? `پرونده پروژه · کد ${proj.code}` : undefined,
        };
      }
      case 'budget':
        return { title: 'بودجه و اعتبارات' };
      case 'actions':
        return { title: 'اقدامات و پیگیری‌ها' };
      case 'documents':
        return { title: 'اسناد و مکاتبات' };
      case 'reports':
        return {
          title: 'گزارش‌ها',
          subtitle: current.reportType ? REPORT_TITLES[current.reportType] : undefined,
        };
      case 'support':
        return {
          title: current.supportTab === 'guide' ? 'راهنما' : 'تنظیمات',
        };
      default:
        return { title: 'دفتر فنی اداره گلزار شهدا' };
    }
  }, [current, store.projects]);

  const backTooltip = useMemo(() => `بازگشت به ${getParentLabel(history)}`, [history]);

  if (showSplash) {
    return (
      <SplashIntro
        logoUrl={store.settings.officialLogoDataUrl}
        onComplete={handleSplashComplete}
      />
    );
  }

  if (store.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] text-sm text-[#5B6573]">
        در حال بارگذاری پایگاه داده محلی...
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] p-6">
        <div className="max-w-md rounded-xl border border-[#D8B4B4] bg-[#FFFFFF] p-6 text-center space-y-3">
          <div className="text-sm font-semibold text-[#9E3B3B]">خطا در دسترسی به حافظه محلی</div>
          <p className="text-xs text-[#5B6573]">{store.error}</p>
          <button
            type="button"
            onClick={() => store.refresh()}
            className="rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3] cursor-pointer"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  if (sessionState === 'exited') {
    return (
      <ExitAuthOverlay
        mode="exited"
        settings={store.settings}
        onEnterApp={() => {
          setSessionState('active');
          setHistory(createInitialHistory());
        }}
      />
    );
  }

  if (store.settings.auth.enabled && !authUnlocked) {
    return (
      <ExitAuthOverlay
        mode="login"
        settings={store.settings}
        onEnterApp={() => setAuthUnlocked(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#263448]">
      <OfflineBanner />

      <AppHeader
        route={current.route}
        pageTitle={headerMeta.title}
        pageSubtitle={headerMeta.subtitle}
        canGoBack={current.route !== 'dashboard' && current.route !== 'home'}
        backTooltip={backTooltip}
        officialLogoDataUrl={store.settings.officialLogoDataUrl}
        onBack={handleBack}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      {/* Main Approved Shell: Persistent Right Sidebar + Active Workspace */}
      <div className="mx-auto flex max-w-[1440px]">
        <SidebarNav
          currentRoute={current.route}
          currentSupportTab={current.supportTab}
          mobileOpen={mobileMenuOpen}
          golzarImages={store.golzarImages}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onNavigate={(r, opts) => navigate(r, { ...opts, mode: 'sidebar' })}
          onOpenGolzarManager={() =>
            navigate('support', { supportTab: 'media', mode: 'drill' })
          }
          onExit={handleRequestExit}
        />

        <main className="min-w-0 flex-1 pb-10">
          {(current.route === 'dashboard' || current.route === 'home') && (
            <DashboardView
              store={store}
              onNavigate={(r) => navigate(r, { mode: 'drill' })}
              onOpenProject={handleOpenProject}
              onOpenGolzarManager={() =>
                navigate('support', { supportTab: 'media', mode: 'drill' })
              }
              onOpenReport={(reportType) =>
                navigate('reports', {
                  reportType,
                  reportDisplayMode: 'table',
                  mode: 'drill',
                })
              }
            />
          )}

          {current.route === 'projects' && (
            <ProjectsView store={store} onOpenProject={handleOpenProject} />
          )}

          {current.route === 'project-detail' && current.projectId && (
            <ProjectDetailView
              projectId={current.projectId}
              store={store}
              activeTab={(current.subTab as ProjectDetailTab) ?? 'overview'}
              onTabChange={(tab) =>
                navigate('project-detail', {
                  projectId: current.projectId,
                  subTab: tab,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
              onNavigate={(r) => navigate(r, { mode: 'drill' })}
            />
          )}

          {current.route === 'budget' && (
            <BudgetView
              store={store}
              activeTab={(current.subTab as BudgetSubTab) ?? 'credits'}
              onTabChange={(tab) =>
                navigate('budget', {
                  subTab: tab,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
              onOpenProject={handleOpenProject}
            />
          )}

          {current.route === 'actions' && <ActionsView store={store} />}

          {current.route === 'documents' && (
            <DocumentsView
              store={store}
              activeTab={(current.subTab as DocumentsSectionTab) ?? 'archive'}
              onTabChange={(tab) =>
                navigate('documents', {
                  subTab: tab,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
            />
          )}

          {current.route === 'reports' && (
            <ReportsView
              store={store}
              initialReportType={current.reportType ?? 'projects'}
              initialDisplayMode={current.reportDisplayMode ?? 'table'}
              onReportTypeChange={(rt) =>
                navigate('reports', {
                  reportType: rt,
                  reportDisplayMode: current.reportDisplayMode ?? 'table',
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
              onDisplayModeChange={(mode) =>
                navigate('reports', {
                  reportType: current.reportType ?? 'projects',
                  reportDisplayMode: mode,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
            />
          )}

          {current.route === 'support' && (
            <SupportView
              store={store}
              initialTab={current.supportTab ?? 'settings'}
              onTabChange={(tab) =>
                navigate('support', {
                  supportTab: tab,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
            />
          )}
        </main>
      </div>

      {/* Verified Local IndexedDB Save Feedback Toast */}
      {store.toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 z-50 flex max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-xs ${
            store.toast.tone === 'success'
              ? 'border-[#C6D5C4] bg-[#FFFFFF] text-[#263448]'
              : 'border-[#D8B4B4] bg-[#FBF1F1] text-[#9E3B3B]'
          }`}
        >
          {store.toast.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3D6B59]" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9E3B3B]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium">{store.toast.message}</div>
            <div className="mt-0.5 text-[11px] tabular-nums text-[#788290]">
              ثبت محلی: {formatJalaliDateTime(store.toast.savedAt)}
            </div>
          </div>
          <button
            type="button"
            onClick={store.dismissToast}
            className="text-[#788290] hover:text-[#243B5A] cursor-pointer"
            aria-label="بستن اعلان"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Controlled Workspace Exit Dialog (Section 10) */}
      <ConfirmDialog
        open={confirmExitOpen}
        title="خروج از نشست کاری"
        message={
          store.hasUnsavedChanges
            ? 'هشدار: تغییرات ذخیره‌نشده‌ای در فرم باز فعلی وجود دارد. در صورت خروج اکنون، تغییرات ذخیره‌نشده از دست می‌روند. آیا از خروج مطمئن هستید؟'
            : 'آیا می‌خواهید نشست کاری فعلی را ببندید؟ تمامی اطلاعات ثبت‌شده شما پیش‌تر در حافظه محلی دستگاه (IndexedDB) ذخیره شده‌اند.'
        }
        confirmLabel="تأیید و خروج"
        cancelLabel="بازگشت به کار"
        danger={store.hasUnsavedChanges}
        onCancel={() => setConfirmExitOpen(false)}
        onConfirm={performExit}
      />
    </div>
  );
}
