import { useCallback, useState } from 'react';
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
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { BudgetView } from './components/budget/BudgetView';
import { ActionsView } from './components/actions/ActionsView';
import { DocumentsView } from './components/documents/DocumentsView';
import { ReportType, ReportsView } from './components/reports/ReportsView';
import { SupportTab, SupportView } from './components/support/SupportView';
import { ExitAuthOverlay } from './components/support/ExitAuthOverlay';
import { formatJalaliDateTime } from './utils/format';

interface HistoryEntry {
  route: AppRoute;
  projectId?: string;
  supportTab?: SupportTab;
  reportType?: ReportType;
}

export default function App() {
  const store = useAppStore();
  const [showSplash, setShowSplash] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([{ route: 'dashboard' }]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionState, setSessionState] = useState<'active' | 'exited'>('active');
  const [authUnlocked, setAuthUnlocked] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const current = history[history.length - 1];

  const navigate = useCallback(
    (
      route: AppRoute,
      options?: { projectId?: string; supportTab?: SupportTab; reportType?: ReportType }
    ) => {
      const normalizedRoute: AppRoute = route === 'home' ? 'dashboard' : route;
      setHistory((prev) => {
        const top = prev[prev.length - 1];
        if (
          top.route === normalizedRoute &&
          top.projectId === options?.projectId &&
          top.supportTab === options?.supportTab &&
          top.reportType === options?.reportType
        ) {
          return prev;
        }
        return [
          ...prev,
          {
            route: normalizedRoute,
            projectId: options?.projectId,
            supportTab: options?.supportTab,
            reportType: options?.reportType,
          },
        ];
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ route: 'dashboard' }]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleOpenProject = useCallback(
    (project: Project) => {
      navigate('project-detail', { projectId: project.id });
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
    setSessionState('exited');
  }, [store]);

  const handleRequestExit = useCallback(() => {
    setConfirmExitOpen(true);
  }, []);

  if (showSplash) {
    return <SplashIntro onComplete={handleSplashComplete} />;
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
          setHistory([{ route: 'dashboard' }]);
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
        canGoBack={history.length > 1}
        officialLogoDataUrl={store.settings.officialLogoDataUrl}
        onBack={handleBack}
        onOpenSettings={() => navigate('support', { supportTab: 'settings' })}
        onOpenGuide={() => navigate('support', { supportTab: 'guide' })}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      {/* Main Approved Shell: Persistent Right Sidebar + Active Workspace */}
      <div className="mx-auto flex max-w-[1440px]">
        <SidebarNav
          currentRoute={current.route}
          mobileOpen={mobileMenuOpen}
          golzarImages={store.golzarImages}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onNavigate={(r) => navigate(r)}
          onOpenGolzarManager={() => navigate('support', { supportTab: 'media' })}
          onExit={handleRequestExit}
        />

        <main className="min-w-0 flex-1 pb-10">
          {(current.route === 'dashboard' || current.route === 'home') && (
            <DashboardView
              store={store}
              onNavigate={(r) => navigate(r)}
              onOpenProject={handleOpenProject}
              onOpenGolzarManager={() => navigate('support', { supportTab: 'media' })}
              onOpenReport={(reportType) => navigate('reports', { reportType })}
            />
          )}

          {current.route === 'projects' && (
            <ProjectsView store={store} onOpenProject={handleOpenProject} />
          )}

          {current.route === 'project-detail' && current.projectId && (
            <ProjectDetailView
              projectId={current.projectId}
              store={store}
              onNavigate={(r) => navigate(r)}
            />
          )}

          {current.route === 'budget' && (
            <BudgetView store={store} onOpenProject={handleOpenProject} />
          )}

          {current.route === 'actions' && <ActionsView store={store} />}

          {current.route === 'documents' && <DocumentsView store={store} />}

          {current.route === 'reports' && (
            <ReportsView store={store} initialReportType={current.reportType ?? 'projects'} />
          )}

          {current.route === 'support' && (
            <SupportView store={store} initialTab={current.supportTab ?? 'settings'} />
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
