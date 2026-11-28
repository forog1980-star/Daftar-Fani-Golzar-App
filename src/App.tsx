import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, CloudDownload, X } from 'lucide-react';
import { AppRoute, Project } from './types';
import { useAppStore } from './hooks/useAppStore';
import { useAppUpdater } from './utils/appUpdater';
import { SplashIntro } from './components/layout/SplashIntro';
import { AppHeader } from './components/layout/AppHeader';
import { SidebarNav } from './components/layout/SidebarNav';
import { ScrollToTopButton } from './components/layout/ScrollToTopButton';
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
import { HelpSectionId } from './components/help/helpContent';
import { formatJalaliDateTime, toPersianDigits } from './utils/format';
import {
  createInitialHistoryStack,
  getParentLabel,
  HistoryStack,
  NavigateOptions,
  pushNavigationHistory,
  resolveLogicalBackHistory,
} from './utils/navigationHistory';

const REPORT_TITLES: Record<ReportType, string> = {
  projects: 'گزارش جامع پروژه‌ها',
  budget: 'گزارش بودجه و اعتبارات',
  statements: 'گزارش وضعیت صورت‌وضعیت‌ها',
  proposals: 'گزارش پیشنهاد بودجه سالانه',
  actions: 'گزارش اقدامات و پیگیری‌ها',
  documents: 'گزارش اسناد و مکاتبات',
  'single-project': 'گزارش تفصیلی پروژه',
};

export default function App() {
  const store = useAppStore();
  const updater = useAppUpdater();
  const [showSplash, setShowSplash] = useState(true);
  const [historyStack, setHistoryStack] = useState<HistoryStack>(createInitialHistoryStack);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionState, setSessionState] = useState<'active' | 'exited'>('active');
  const [authUnlocked, setAuthUnlocked] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [dismissUpdateBanner, setDismissUpdateBanner] = useState(false);

  const current = historyStack[historyStack.length - 1];

  const navigate = useCallback((route: AppRoute, options?: NavigateOptions) => {
    setHistoryStack((prev) => pushNavigationHistory(prev, route, options));

    if (options?.scrollToTop !== false) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Always restores the logical parent page based on each screen's parentRoute in HistoryStack
  const handleBack = useCallback(() => {
    setHistoryStack((prev) => resolveLogicalBackHistory(prev));
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

  const handleOpenHelp = useCallback(
    (sectionId?: HelpSectionId | null) => {
      navigate('support', {
        supportTab: 'guide',
        helpSection: sectionId ?? null,
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
    setHistoryStack(createInitialHistoryStack());
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
          title:
            current.supportTab === 'guide'
              ? 'راهنمای نرم‌افزار و شرح بخش‌ها'
              : 'تنظیمات',
        };
      default:
        return { title: 'دفتر فنی اداره گلزار شهدا' };
    }
  }, [current, store.projects]);

  const backTooltip = useMemo(() => `بازگشت به ${getParentLabel(historyStack)}`, [historyStack]);

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
          setHistoryStack(createInitialHistoryStack());
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
          {/* Palette-Matched Post-Update Confirmation Banner — positioned slightly below the top header bar */}
          {updater.updateCompletedNotice && (
            <div className="mx-auto max-w-[1280px] px-4 pt-4 sm:px-6">
              <div
                role="status"
                aria-live="polite"
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius)] border border-[#D5C39E] bg-[#E5EBF2] px-4 py-3 text-xs text-[#243B5A]"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#243B5A] text-[#FAF8F3]">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-bold text-[#243B5A]">
                      نرم‌افزار شما با موفقیت به‌روزرسانی شد
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#354F73]">
                      <span className="font-semibold tabular-nums">
                        نسخه {toPersianDigits(updater.updateCompletedNotice.version)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        تاریخ و ساعت به‌روزرسانی:{' '}
                        {formatJalaliDateTime(updater.updateCompletedNotice.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updater.dismissUpdateNotice()}
                  className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-[#243B5A]/30 bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#243B5A] transition-colors hover:bg-[#243B5A] hover:text-[#FAF8F3] whitespace-nowrap cursor-pointer"
                  aria-label="بستن پیام انجام به‌روزرسانی"
                >
                  <span>متوجه شدم</span>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Palette-Matched Update Available Notice — positioned slightly below the top header bar */}
          {updater.needRefresh && !dismissUpdateBanner && (
            <div className="mx-auto max-w-[1280px] px-4 pt-4 sm:px-6">
              <div
                role="status"
                aria-live="polite"
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius)] border border-[#D5C39E] bg-[#F2EEE6] px-4 py-3 text-xs text-[#243B5A]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CloudDownload className="h-4 w-4 shrink-0 text-[#243B5A]" />
                  <span className="font-medium">
                    نسخه جدید نرم‌افزار
                    {updater.remoteVersion
                      ? ` (${toPersianDigits(updater.remoteVersion)})`
                      : ''}{' '}
                    آماده اعمال است — تمامی اطلاعات محلی شما بدون تغییر حفظ می‌شود.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={updater.status === 'updating'}
                    onClick={() => void updater.runUnifiedUpdate()}
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-[#243B5A] bg-[#243B5A] px-3.5 py-1.5 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] disabled:opacity-60 whitespace-nowrap cursor-pointer"
                  >
                    {updater.status === 'updating' ? 'در حال به‌روزرسانی...' : 'اعمال به‌روزرسانی'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDismissUpdateBanner(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#5B6573] hover:bg-[#FFFFFF] hover:text-[#243B5A] cursor-pointer"
                    aria-label="بستن پیام به‌روزرسانی"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

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
              onOpenHelp={handleOpenHelp}
            />
          )}

          {current.route === 'projects' && (
            <ProjectsView
              store={store}
              onOpenProject={handleOpenProject}
              onOpenHelp={handleOpenHelp}
            />
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
              onOpenHelp={handleOpenHelp}
            />
          )}

          {current.route === 'actions' && (
            <ActionsView store={store} onOpenHelp={handleOpenHelp} />
          )}

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
              onOpenHelp={handleOpenHelp}
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
              onOpenHelp={handleOpenHelp}
            />
          )}

          {current.route === 'support' && (
            <SupportView
              store={store}
              initialTab={current.supportTab ?? 'settings'}
              initialHelpSection={current.helpSection ?? null}
              onTabChange={(tab) =>
                navigate('support', {
                  supportTab: tab,
                  helpSection: tab === 'guide' ? current.helpSection ?? null : null,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
              onHelpSectionChange={(sec) =>
                navigate('support', {
                  supportTab: 'guide',
                  helpSection: sec,
                  mode: 'replace',
                  scrollToTop: false,
                })
              }
            />
          )}
        </main>
      </div>

      {/* Centered Bottom Scroll-to-Top Button (activates after 420px scroll) */}
      <ScrollToTopButton threshold={420} />

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
