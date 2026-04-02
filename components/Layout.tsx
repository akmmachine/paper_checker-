import React, { useState, useEffect } from 'react';
import { UserRole, Paper, UserProfile } from '../types';

const STORAGE_SIDEBAR_EXPANDED = 'papercloud_sidebar_expanded_desktop_v1';

const MenuIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const PanelLeftIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

interface ProfileMenuPanelProps {
  users: UserProfile[];
  currentUser: UserProfile;
  onUserSwitch: (u: UserProfile) => void;
  onLogout: () => void;
  onClose: () => void;
  placement: 'above' | 'below';
}

const ProfileMenuPanel: React.FC<ProfileMenuPanelProps> = ({
  users,
  currentUser,
  onUserSwitch,
  onLogout,
  onClose,
  placement,
}) => (
  <div
    className={`absolute z-[80] bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200 min-w-[240px] max-w-[min(280px,calc(100vw-2rem))] ${
      placement === 'above'
        ? 'bottom-full left-2 right-2 mb-2'
        : 'top-full right-0 mt-2'
    }`}
  >
    <div className="p-1.5 space-y-1">
      <p className="px-3 py-2 text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-700/50 mb-1">
        Switch User
      </p>
      {users.map((u) => (
        <button
          key={u.id}
          type="button"
          onClick={() => {
            onUserSwitch(u);
            onClose();
          }}
          className={`w-full text-left px-3 py-3 text-xs font-bold hover:bg-slate-700 transition flex items-center justify-between gap-2 rounded-xl ${
            currentUser.id === u.id ? 'text-indigo-400 bg-slate-700/50' : 'text-slate-300'
          }`}
        >
          <span className="truncate">{u.name}</span>
          <span
            className={`shrink-0 text-[7px] px-1.5 py-0.5 rounded-md border font-black uppercase ${
              u.role === UserRole.AUDITOR ? 'border-indigo-500 text-indigo-400' : 'border-rose-500 text-rose-400'
            }`}
          >
            {u.role === UserRole.AUDITOR ? 'Auditor' : 'QC'}
          </span>
        </button>
      ))}
      <div className="h-px bg-slate-700 my-1.5 mx-2" />
      <button
        type="button"
        onClick={() => {
          onClose();
          onLogout();
        }}
        className="w-full text-left px-3 py-3 text-xs font-black text-rose-400 hover:bg-rose-900/20 transition flex items-center gap-3 rounded-xl"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Sign Out
      </button>
    </div>
  </div>
);

interface LayoutProps {
  children: React.ReactNode;
  currentUser: UserProfile;
  onUserSwitch: (user: UserProfile) => void;
  users: UserProfile[];
  activeTab: string;
  setActiveTab: (tab: string, paperId?: string | null) => void;
  history: Paper[];
  onLoadHistory: (paper: Paper) => void;
  onDeleteHistory: (e: React.MouseEvent, id: string) => void;
  activePaperId: string | null;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isSyncing: boolean;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser,
  onUserSwitch,
  users,
  activeTab, 
  setActiveTab,
  history,
  onLoadHistory,
  onDeleteHistory,
  activePaperId,
  isDarkMode,
  toggleDarkMode,
  isSyncing,
  onLogout
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerProfileMenu, setDrawerProfileMenu] = useState(false);
  const [desktopProfileMenu, setDesktopProfileMenu] = useState(false);
  const [sidebarExpandedDesktop, setSidebarExpandedDesktop] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_SIDEBAR_EXPANDED);
      if (s === '0') return false;
      if (s === '1') return true;
    } catch {
      /* ignore */
    }
    return true;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SIDEBAR_EXPANDED, sidebarExpandedDesktop ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarExpandedDesktop]);

  // Disable body scroll when drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [isDrawerOpen]);

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);
  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setDrawerProfileMenu(false);
  };
  const toggleDesktopSidebar = () => setSidebarExpandedDesktop((v) => !v);

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status: Paper['status']) => {
    switch(status) {
      case 'PENDING_QC': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800';
      case 'APPROVED': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'REJECTED': return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800';
      default: return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  const cloudArchiveBlock = (
    <>
      <div className={`px-3 flex items-center justify-between mb-3 ${!sidebarExpandedDesktop ? 'lg:hidden' : ''}`}>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cloud Archive</p>
      </div>

      {!sidebarExpandedDesktop ? (
        <div className="hidden lg:flex flex-col items-center gap-2 px-0">
          <button
            type="button"
            title="Expand to browse papers"
            onClick={() => setSidebarExpandedDesktop(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </button>
          {history.length > 0 && (
            <span className="text-[9px] font-black text-slate-500 tabular-nums leading-none">{history.length}</span>
          )}
        </div>
      ) : null}

      <div className={`space-y-2 ${!sidebarExpandedDesktop ? 'lg:hidden' : ''}`}>
        {history.length === 0 ? (
          <div className="px-4 py-6 text-center border border-dashed border-slate-800 rounded-2xl">
            <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest">No Cloud Data</p>
          </div>
        ) : (
          history.map((paper) => (
            <div key={paper.id} className="relative group px-1">
              <button
                onClick={() => {
                  onLoadHistory(paper);
                  closeDrawer();
                }}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.97] ${
                  activePaperId === paper.id ? 'bg-slate-800 border-indigo-600' : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className={`text-[11px] font-bold truncate ${activePaperId === paper.id ? 'text-indigo-400' : 'text-slate-200'}`}>
                  {paper.title}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black border uppercase tracking-tighter ${getStatusBadge(paper.status)}`}>
                    {paper.status.replace('_', ' ')}
                  </span>
                  <span className="text-[8px] text-slate-600 font-bold uppercase tracking-tight">{formatTime(paper.createdAt)}</span>
                </div>
              </button>
              <button
                onClick={(e) => onDeleteHistory(e, paper.id)}
                className="absolute top-2 right-3 p-1.5 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen-dynamic w-full bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50 transition-colors duration-300 overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/70 z-[60] lg:hidden transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}`}
        onClick={closeDrawer}
      />

      {/* Sidebar: mobile drawer; desktop = narrow rail (3-line) or full width */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] flex flex-col bg-slate-900 text-white shadow-2xl transition-[transform,width] duration-300 ease-out w-72 max-w-[min(18rem,100vw)] lg:max-w-none ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 lg:shrink-0 ${
          sidebarExpandedDesktop ? 'lg:w-72' : 'lg:w-[5.25rem]'
        }`}
      >
        <div
          className={`border-b border-slate-800 flex items-center gap-2 p-4 ${
            sidebarExpandedDesktop ? 'lg:flex-row lg:justify-between lg:items-center lg:p-5' : 'lg:flex-col lg:items-center lg:justify-center lg:gap-3 lg:px-2 lg:py-4'
          }`}
        >
          <div
            className={`flex items-center gap-2 min-w-0 ${
              sidebarExpandedDesktop ? 'flex-1' : 'lg:flex-col lg:flex-none lg:justify-center lg:w-full lg:max-w-full'
            }`}
          >
            <span className="bg-indigo-600 p-2 rounded-xl text-lg shrink-0 leading-none lg:shrink-0">🔍</span>
            <div className={`flex flex-col min-w-0 ${!sidebarExpandedDesktop ? 'lg:hidden' : 'flex-1'}`}>
              <h1 className="text-base font-black tracking-tight leading-none truncate">PAPER CLOUD</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSyncing ? 'bg-indigo-400 animate-pulse' : 'bg-green-400'}`} />
                <span className="text-[8px] uppercase tracking-widest text-slate-500 font-black truncate">
                  {isSyncing ? 'Syncing...' : 'Connected'}
                </span>
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-2 shrink-0 ${
              !sidebarExpandedDesktop ? 'lg:flex-col lg:w-full lg:max-w-[2.75rem] lg:mx-auto' : ''
            }`}
          >
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              title={sidebarExpandedDesktop ? 'Collapse sidebar' : 'Expand sidebar'}
              className="hidden lg:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors tap-target border border-slate-700/80"
            >
              {sidebarExpandedDesktop ? <PanelLeftIcon /> : <MenuIcon />}
            </button>
            <button
              type="button"
              onClick={toggleDarkMode}
              title="Toggle theme"
              className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors lg:hidden"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        <nav
          className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0 ${
            sidebarExpandedDesktop ? 'p-3 lg:p-5' : 'p-3 lg:p-2 lg:pt-3'
          }`}
        >
          <div className={`px-3 mb-3 ${!sidebarExpandedDesktop ? 'lg:hidden' : ''}`}>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Navigation</p>
          </div>

          <div className="space-y-1">
            {currentUser.role === UserRole.AUDITOR ? (
              <button
                onClick={() => {
                  setActiveTab('input');
                  closeDrawer();
                }}
                title="New Submission"
                className={`w-full text-left rounded-xl flex items-center gap-3 text-sm font-semibold transition-all ${
                  !sidebarExpandedDesktop
                    ? 'lg:h-11 lg:w-11 lg:min-h-[2.75rem] lg:max-w-[2.75rem] lg:shrink-0 lg:mx-auto lg:justify-center lg:p-0 px-3 py-3'
                    : 'px-3 py-3'
                } ${activeTab === 'input' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className={!sidebarExpandedDesktop ? 'lg:hidden' : ''}>New Submission</span>
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setActiveTab('approval');
                    closeDrawer();
                  }}
                  title="QC Queue"
                  className={`w-full text-left rounded-xl flex items-center gap-3 text-sm font-semibold transition-all ${
                    !sidebarExpandedDesktop
                      ? 'lg:h-11 lg:w-11 lg:min-h-[2.75rem] lg:max-w-[2.75rem] lg:shrink-0 lg:mx-auto lg:justify-center lg:p-0 px-3 py-3'
                      : 'px-3 py-3'
                  } ${activeTab === 'approval' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={!sidebarExpandedDesktop ? 'lg:hidden' : ''}>QC Queue</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('analytics');
                    closeDrawer();
                  }}
                  title="Analytics"
                  className={`w-full text-left rounded-xl flex items-center gap-3 text-sm font-semibold transition-all ${
                    !sidebarExpandedDesktop
                      ? 'lg:h-11 lg:w-11 lg:min-h-[2.75rem] lg:max-w-[2.75rem] lg:shrink-0 lg:mx-auto lg:justify-center lg:p-0 px-3 py-3'
                      : 'px-3 py-3'
                  } ${activeTab === 'analytics' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  <span className={!sidebarExpandedDesktop ? 'lg:hidden' : ''}>Analytics</span>
                </button>
              </>
            )}
          </div>

          {currentUser.role === UserRole.AUDITOR ? (
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/30 p-2.5 space-y-3 pb-4">
              <div className={`px-2 ${!sidebarExpandedDesktop ? 'lg:hidden' : ''}`}>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">My Draft</p>
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('review');
                    closeDrawer();
                  }}
                  title="My Draft"
                  className={`w-full text-left rounded-xl flex items-center gap-3 text-sm font-semibold transition-all ${
                    !sidebarExpandedDesktop
                      ? 'lg:h-11 lg:w-11 lg:min-h-[2.75rem] lg:max-w-[2.75rem] lg:shrink-0 lg:mx-auto lg:justify-center lg:p-0 px-3 py-3'
                      : 'px-3 py-3'
                  } ${activeTab === 'review' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span className={!sidebarExpandedDesktop ? 'lg:hidden' : ''}>My Draft</span>
                </button>
              </div>
              <div className="border-t border-slate-800/70 pt-3 space-y-2">{cloudArchiveBlock}</div>
            </div>
          ) : (
            <div className="pt-6 pb-4">{cloudArchiveBlock}</div>
          )}
        </nav>

        {/* User account — mobile / drawer only; desktop uses top bar */}
        <div className="p-3 border-t border-slate-800 relative bg-slate-900/80 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={() => {
              setDrawerProfileMenu((o) => !o);
              setDesktopProfileMenu(false);
            }}
            title={currentUser.name}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800 transition-all border border-slate-700/50 tap-target"
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-[10px] text-white shadow-lg shrink-0 ${
                currentUser.role === UserRole.AUDITOR ? 'bg-indigo-600' : 'bg-rose-600'
              }`}
            >
              {currentUser.avatar}
            </div>
            <div className="text-left overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{currentUser.name}</p>
              <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest truncate">{currentUser.department}</p>
            </div>
            <svg
              className={`w-3.5 h-3.5 text-slate-600 transition-transform shrink-0 ${drawerProfileMenu ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {drawerProfileMenu && (
            <ProfileMenuPanel
              users={users}
              currentUser={currentUser}
              onUserSwitch={onUserSwitch}
              onLogout={onLogout}
              onClose={() => setDrawerProfileMenu(false)}
              placement="above"
            />
          )}
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Desktop top bar — profile, theme, sync (avoids cramped rail) */}
        <header className="hidden lg:flex h-14 shrink-0 items-center justify-between gap-4 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl z-40">
          <div className="min-w-0 flex flex-col py-1">
            <span className="text-sm font-black text-slate-900 dark:text-slate-50 tracking-tight truncate">
              Paper Cloud
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
              {activeTab}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSyncing && (
              <div
                className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"
                title="Syncing"
                aria-label="Syncing"
              />
            )}
            <button
              type="button"
              onClick={toggleDarkMode}
              title="Toggle theme"
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <div className="relative pl-1">
              <button
                type="button"
                onClick={() => {
                  setDesktopProfileMenu((o) => !o);
                  setDrawerProfileMenu(false);
                }}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors tap-target max-w-[min(16rem,40vw)]"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-[10px] text-white shadow-md shrink-0 ${
                    currentUser.role === UserRole.AUDITOR ? 'bg-indigo-600' : 'bg-rose-600'
                  }`}
                >
                  {currentUser.avatar}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</p>
                  <p className="text-[8px] text-slate-500 dark:text-slate-400 uppercase font-black tracking-widest truncate">
                    {currentUser.department}
                  </p>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${desktopProfileMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              {desktopProfileMenu && (
                <ProfileMenuPanel
                  users={users}
                  currentUser={currentUser}
                  onUserSwitch={onUserSwitch}
                  onLogout={onLogout}
                  onClose={() => setDesktopProfileMenu(false)}
                  placement="below"
                />
              )}
            </div>
          </div>
        </header>

        {/* Mobile Header (Fixed Top) */}
        <header className="lg:hidden h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shrink-0 sticky top-0 z-50 transition-colors duration-300 safe-area-top">
          <div className="flex items-center gap-3">
            <button onClick={toggleDrawer} className="p-2 -ml-2 text-slate-600 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 rounded-2xl transition-all tap-target">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex flex-col">
              <span className="font-black text-slate-900 dark:text-slate-50 text-[10px] uppercase tracking-[0.2em] leading-none">Paper Cloud</span>
              <span className="text-[9px] text-indigo-500 font-black mt-1 uppercase tracking-tighter">{activeTab}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isSyncing && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[9px] text-white shadow-sm ${currentUser.role === UserRole.AUDITOR ? 'bg-indigo-600' : 'bg-rose-600'}`}>
              {currentUser.avatar}
            </div>
          </div>
        </header>

        {/* Content Container (Scrollable) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50 dark:bg-slate-900 lg:p-8 p-4 pt-4 lg:pt-8 scroll-smooth overscroll-none pb-24 lg:pb-8">
          <div className="max-w-4xl mx-auto w-full">
            {children}
          </div>
        </main>

        {/* Mobile Persistent Bottom Navigation (Thumb Focused) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 py-2 pb-[max(0.5rem,var(--sab))] z-50 transition-colors duration-300">
          {currentUser.role === UserRole.AUDITOR ? (
            <>
              <button onClick={() => setActiveTab('review')} className={`flex flex-col items-center gap-1.5 flex-1 py-1 transition-all tap-target ${activeTab === 'review' ? 'text-indigo-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'review' ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                  <svg className="w-6 h-6" fill={activeTab === 'review' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter">My Draft</span>
              </button>
              
              {/* Primary Central Action (FAB Style) */}
              <button 
                onClick={() => setActiveTab('input')} 
                className={`relative -top-5 w-15 h-15 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center shadow-[0_8px_24px_rgba(79,70,229,0.3)] ring-4 ring-slate-50 dark:ring-slate-900 transition-all active:scale-90 tap-target`}
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
              </button>

              <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center gap-1.5 flex-1 py-1 transition-all tap-target ${activeTab === 'analytics' ? 'text-indigo-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                  <svg className="w-6 h-6" fill={activeTab === 'analytics' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter">Stats</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setActiveTab('approval')} className={`flex flex-col items-center gap-1.5 flex-1 py-1 transition-all tap-target ${activeTab === 'approval' ? 'text-rose-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'approval' ? 'bg-rose-50 dark:bg-rose-900/30' : ''}`}>
                  <svg className="w-6 h-6" fill={activeTab === 'approval' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter">Queue</span>
              </button>

              <button onClick={() => setActiveTab('analytics')} className={`flex flex-col items-center gap-1.5 flex-1 py-1 transition-all tap-target ${activeTab === 'analytics' ? 'text-rose-600' : 'text-slate-400'}`}>
                <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'analytics' ? 'bg-rose-50 dark:bg-rose-900/30' : ''}`}>
                  <svg className="w-6 h-6" fill={activeTab === 'analytics' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-tighter">Insights</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
