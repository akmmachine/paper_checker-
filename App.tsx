
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './components/Layout';
import QuestionInput from './components/QuestionInput';
import QuestionCard from './components/QuestionCard';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LoginScreen from './components/LoginScreen';
import { UserRole, QuestionData, Paper, QuestionStatus, AuditLog, UserProfile } from './types';
import { auditQuestion } from './services/auditService';
import { dbService, MOCK_USERS } from './services/dbService';
import { generateAuditPDF } from './services/pdfService';

const STORAGE_KEY_DARK_MODE = 'paperchecker_dark_mode_v2';
const STORAGE_KEY_USER_ID = 'paperchecker_active_user_id';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const savedId = localStorage.getItem(STORAGE_KEY_USER_ID);
    return MOCK_USERS.find(u => u.id === savedId) || null;
  });
  
  const [activeTab, setActiveTab] = useState<string>('input');
  const [history, setHistory] = useState<Paper[]>([]);
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [isAuditingId, setIsAuditingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [targetQuestionId, setTargetQuestionId] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY_DARK_MODE);
      if (savedMode !== null) return JSON.parse(savedMode);
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const navigateToTab = (tab: string, paperId: string | null = null) => {
    setActiveTab(tab);
    setActivePaperId(paperId);
    // History API calls removed to prevent security errors in sandboxed/blob origins
  };

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const papers = await dbService.getPapers();
        setHistory(papers);
        if (papers.length > 0) {
          const firstPaper = papers[0];
          setActivePaperId(firstPaper.id);
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem(STORAGE_KEY_DARK_MODE, JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY_USER_ID, currentUser.id);
      const initialTab = currentUser.role === UserRole.QC ? 'approval' : 'input';
      setActiveTab(initialTab);
    } else {
      localStorage.removeItem(STORAGE_KEY_USER_ID);
    }
  }, [currentUser]);

  const currentPaper = useMemo(() => {
    return history.find(p => p.id === activePaperId) || null;
  }, [history, activePaperId]);

  const questions = useMemo(() => currentPaper?.questions || [], [currentPaper]);

  const createPaperFromQuestions = useCallback(async (qs: QuestionData[]) => {
    if (!currentUser) return;
    setIsSyncing(true);
    const paperName = qs[0]?.topic || 'New Submission';
    const newPaper: Paper = {
      id: Math.random().toString(36).substr(2, 9),
      title: paperName,
      subject: paperName,
      createdBy: currentUser.id,
      creatorName: currentUser.name,
      status: 'PENDING_QC',
      questions: qs,
      createdAt: Date.now()
    };
    
    await dbService.savePaper(newPaper);
    setHistory(prev => [newPaper, ...prev]);
    navigateToTab('review', newPaper.id);
    setIsSyncing(false);
  }, [currentUser]);

  const updateCurrentPaperQuestions = useCallback(async (newQuestions: QuestionData[]) => {
    if (!activePaperId || !currentPaper) return;
    setIsSyncing(true);
    const updatedPaper = { ...currentPaper, questions: newQuestions };
    await dbService.savePaper(updatedPaper);
    setHistory(prev => prev.map(p => p.id === activePaperId ? updatedPaper : p));
    setIsSyncing(false);
  }, [activePaperId, currentPaper]);

  const handleAuditRequest = async (id: string) => {
    const q = questions.find(item => item.id === id);
    if (!q || !q.original) return;

    setIsAuditingId(id);
    try {
      const result = await auditQuestion(q.original);
      const updatedQuestions = questions.map(item => {
        if (item.id !== id) return item;
        const op = result.originalParsed as QuestionData['original'] | undefined;
        const orig = item.original;
        const nextOriginal =
          op && orig
            ? {
                ...orig,
                question: op.question ?? orig.question,
                solution: op.solution ?? orig.solution,
                options:
                  Array.isArray(op.options) && op.options.length > 0 ? op.options : orig.options,
                correctOptionIndex:
                  result.clean?.correctOptionIndex ??
                  op.correctOptionIndex ??
                  orig.correctOptionIndex,
                correctOptionIndices:
                  Array.isArray(result.clean?.correctOptionIndices) && result.clean.correctOptionIndices.length > 0
                    ? result.clean.correctOptionIndices
                    : Array.isArray(op.correctOptionIndices) && op.correctOptionIndices.length > 0
                      ? op.correctOptionIndices
                      : orig.correctOptionIndices,
                correctAnswer: orig.correctAnswer,
              }
            : orig;
        return {
          ...item,
          topic: result.topic || item.topic,
          original: nextOriginal ?? orig,
          audit: {
            status: result.status,
            logs: result.auditLogs,
            redlines: result.redlines,
            clean: result.clean,
          },
          version: item.version + 1,
        };
      });
      await updateCurrentPaperQuestions(updatedQuestions);
    } catch (err) {
      alert("AI Audit failed.");
    } finally {
      setIsAuditingId(null);
    }
  };

  const handleApprove = async (id: string) => {
    const updated = questions.map(item => 
      item.id === id && item.audit
        ? { ...item, audit: { ...item.audit, status: QuestionStatus.APPROVED }, version: item.version + 1 }
        : item
    );
    await updateCurrentPaperQuestions(updated);
  };

  const handleReject = async (id: string) => {
    const updated = questions.map(item => 
      item.id === id && item.audit
        ? { ...item, audit: { ...item.audit, status: QuestionStatus.REJECTED }, version: item.version + 1 }
        : item
    );
    await updateCurrentPaperQuestions(updated);
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Delete this submission from cloud storage?")) {
      setIsSyncing(true);
      await dbService.deletePaper(id);
      setHistory(prev => prev.filter(p => p.id !== id));
      if (activePaperId === id) setActivePaperId(null);
      setIsSyncing(false);
    }
  };

  const allLogs: AuditLog[] = history.flatMap(p => 
    p.questions.flatMap(q => 
      (q.audit?.logs || []).map(log => ({
        ...log,
        questionId: q.id,
        paperId: p.id
      }))
    )
  );

  const handleInspect = (paperId: string, questionId: string) => {
    setTargetQuestionId(questionId);
    const targetTab = currentUser?.role === UserRole.QC ? 'approval' : 'review';
    navigateToTab(targetTab, paperId);
  };

  const formatDraftTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const paperStatusBadgeClass = (status: Paper['status']) => {
    switch (status) {
      case 'PENDING_QC':
        return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800';
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
    }
  };

  useEffect(() => {
    if (targetQuestionId && (activeTab === 'review' || activeTab === 'approval')) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`question-${targetQuestionId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-4', 'ring-indigo-500', 'ring-offset-4');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-indigo-500', 'ring-offset-4');
          }, 3000);
        }
        setTargetQuestionId(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [activeTab, activePaperId, targetQuestionId]);

  if (isLoading) {
    return (
      <div className="h-screen-dynamic w-full flex flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Initializing Workspace</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen users={MOCK_USERS} onLogin={setCurrentUser} isDarkMode={isDarkMode} toggleDarkMode={() => setIsDarkMode(!isDarkMode)} />;
  }

  return (
    <Layout 
      currentUser={currentUser}
      onUserSwitch={setCurrentUser}
      users={MOCK_USERS}
      activeTab={activeTab} 
      setActiveTab={navigateToTab}
      history={history} 
      onLoadHistory={(p) => navigateToTab('review', p.id)}
      activePaperId={activePaperId} 
      onDeleteHistory={handleDeleteHistory}
      isDarkMode={isDarkMode} 
      toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      isSyncing={isSyncing}
      onLogout={() => setCurrentUser(null)}
    >
      {activeTab === 'input' && <QuestionInput onAdd={() => {}} onAddBulk={createPaperFromQuestions} />}
      
      {activeTab === 'review' && (
        <div className="space-y-4 lg:space-y-6">
          <header className="mb-6 lg:mb-8 border-b border-slate-100 dark:border-slate-800 pb-5 flex justify-between items-end">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">
                {currentPaper ? currentPaper.title : 'Drafts'}
              </h1>
              <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Self-audit and prepare for submission.</p>
            </div>
            {currentPaper && (
              <button 
                onClick={() => generateAuditPDF(currentPaper)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export PDF
              </button>
            )}
          </header>
          {questions.length === 0 ? (
            <div className="space-y-10">
              <div className="text-center py-12 px-4 sm:px-10 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-slate-700 dark:text-slate-200 font-black text-lg tracking-tight">
                  {currentPaper ? 'This draft has no questions yet' : 'Nothing to review yet'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  {history.length > 0
                    ? currentPaper
                      ? 'Use New Submission to add questions to this paper, or open another draft from your cloud archive below.'
                      : 'Pick a saved paper below, or start a new submission.'
                    : 'Create your first paper with questions on the New Submission tab. It will sync to your cloud archive automatically.'}
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateToTab('input')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-[0.98]"
                  >
                    New submission
                  </button>
                  {history.some((p) => p.questions.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        const withQs = history.find((p) => p.questions.length > 0);
                        if (withQs) navigateToTab('review', withQs.id);
                      }}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all"
                    >
                      Open draft with content
                    </button>
                  )}
                </div>
              </div>

              {history.length > 0 && (
                <div>
                  <h2 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-4">
                    Cloud archive — open a draft
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {history.map((p) => {
                      const n = p.questions.length;
                      const isActive = p.id === activePaperId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigateToTab('review', p.id)}
                          className={`text-left p-4 rounded-2xl border transition-all active:scale-[0.99] ${
                            isActive
                              ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/40'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <div className={`text-sm font-bold truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>
                            {p.title}
                          </div>
                          <div className="flex items-center gap-2 mt-3 flex-wrap">
                            <span
                              className={`text-[8px] px-1.5 py-0.5 rounded-md font-black border uppercase tracking-tighter ${paperStatusBadgeClass(p.status)}`}
                            >
                              {p.status.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tabular-nums">
                              {n} {n === 1 ? 'question' : 'questions'}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">
                              {formatDraftTime(p.createdAt)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            questions.map((q, idx) => (
              <QuestionCard key={q.id} index={idx + 1} data={q} onAudit={handleAuditRequest} isAuditing={isAuditingId === q.id} />
            ))
          )}
        </div>
      )}

      {activeTab === 'approval' && (
        <div className="space-y-4 lg:space-y-6">
           <header className="mb-6 lg:mb-8 flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Approval Queue</h1>
              <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Final review of submitted content.</p>
            </div>
            {currentPaper && (
              <button 
                onClick={() => generateAuditPDF(currentPaper)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export PDF
              </button>
            )}
          </header>
          {questions.length === 0 ? (
             <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Queue Clear</p>
             </div>
          ) : (
            questions.map((q, idx) => (
              <QuestionCard 
                key={q.id} 
                index={idx + 1} 
                data={q} 
                onAudit={handleAuditRequest} 
                onApprove={handleApprove} 
                onReject={handleReject} 
                isAuditing={isAuditingId === q.id} 
                showQCControls 
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <AnalyticsDashboard
          logs={allLogs}
          papers={history}
          onInspect={handleInspect}
          onSelectPaper={(paperId) =>
            navigateToTab(currentUser.role === UserRole.QC ? 'approval' : 'review', paperId)
          }
        />
      )}
    </Layout>
  );
};

export default App;
