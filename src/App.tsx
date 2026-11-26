import { useCallback, useState } from 'react';
import { AppRoute, Project } from './types';
import { useAppStore } from './hooks/useAppStore';
import { SplashIntro } from './components/layout/SplashIntro';
import { AppHeader } from './components/layout/AppHeader';
import { HomeGrid } from './components/layout/HomeGrid';
import { OfflineBanner } from './components/layout/PWAInstallButton';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProjectsView } from './components/projects/ProjectsView';
import { ProjectDetailView } from './components/projects/ProjectDetailView';
import { BudgetView } from './components/budget/BudgetView';
import { ActionsView } from './components/actions/ActionsView';
import { DocumentsView } from './components/documents/DocumentsView';
import { ReportsView } from './components/reports/ReportsView';
import { SupportView } from './components/support/SupportView';
import { ExitAuthOverlay } from './components/support/ExitAuthOverlay';

interface HistoryEntry {
  route: AppRoute;
  projectId?: string;
}

const ROUTE_TITLES: Record<AppRoute, string> = {
  home: 'دفتر فنی اداره گلزار شهدا',
  dashboard: 'داشبورد مدیریتی',
  projects: 'پرونده پروژه‌ها',
  'project-detail': 'جزئیات پرونده پروژه',
  budget: 'بودجه و اعتبارات',
  actions: 'اقدامات و پیگیری‌ها',
  documents: 'اسناد، مکاتبات و فرم‌ساز سازمانی',
  reports: 'گزارش‌ها و خروجی‌ها',
  support: 'پشتیبانی، تنظیمات و همگام‌سازی',
};

export default function App() {
  const store = useAppStore();
  const [showSplash, setShowSplash] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([{ route: 'home' }]);
  const [sessionState, setSessionState] = useState<'active' | 'exited'>('active');
  const [authUnlocked, setAuthUnlocked] = useState(false);

  const current = history[history.length - 1];

  const navigate = useCallback((route: AppRoute, projectId?: string) => {
    setHistory((prev) => {
      const top = prev[prev.length - 1];
      if (top.route === route && top.projectId === projectId) return prev;
      return [...prev, { route, projectId }];
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = useCallback(() => {
    setHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : [{ route: 'home' }]));
  }, []);

  const handleHome = useCallback(() => {
    setHistory([{ route: 'home' }]);
  }, []);

  const handleOpenProject = useCallback(
    (project: Project) => {
      navigate('project-detail', project.id);
    },
    [navigate]
  );

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashIntro onComplete={handleSplashComplete} />;
  }

  if (store.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] text-sm text-[#5B6268]">
        در حال بارگذاری پایگاه داده محلی...
      </div>
    );
  }

  if (store.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] p-6">
        <div className="max-w-md border border-[#DFC0C0] bg-[#FFFFFF] p-6 text-center space-y-3">
          <div className="text-sm font-semibold text-[#B43E3E]">خطا در دسترسی به حافظه محلی</div>
          <p className="text-xs text-[#5B6268]">{store.error}</p>
          <button
            type="button"
            onClick={() => store.refresh()}
            className="border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs text-[#FAF8F3] cursor-pointer"
          >
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  // Auth architecture (auth.enabled = false by default -> opens directly)
  if (sessionState === 'exited') {
    return (
      <ExitAuthOverlay
        mode="exited"
        settings={store.settings}
        onEnterApp={() => {
          setSessionState('active');
          setHistory([{ route: 'home' }]);
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

  const activeProject =
    current.route === 'project-detail' && current.projectId
      ? store.projects.find((p) => p.id === current.projectId)
      : undefined;

  const headerTitle =
    current.route === 'project-detail' && activeProject
      ? `پرونده پروژه: ${activeProject.code}`
      : ROUTE_TITLES[current.route];

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#2B3033]">
      <OfflineBanner />
      <AppHeader
        route={current.route}
        title={headerTitle}
        onBack={handleBack}
        onHome={handleHome}
      />

      <main className="pb-12">
        {current.route === 'home' && (
          <HomeGrid
            onNavigate={(r) => navigate(r)}
            onExit={() => {
              setAuthUnlocked(false);
              setSessionState('exited');
            }}
            hasSampleData={store.hasSampleData}
          />
        )}

        {current.route === 'dashboard' && (
          <DashboardView
            store={store}
            onNavigate={(r) => navigate(r)}
            onOpenProject={handleOpenProject}
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

        {current.route === 'reports' && <ReportsView store={store} />}

        {current.route === 'support' && <SupportView store={store} />}
      </main>
    </div>
  );
}
