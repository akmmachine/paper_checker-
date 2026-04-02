
import React, { useState, useRef, useEffect } from 'react';
import { QuestionData } from '../types';
import { auditRawQuestion, auditQuestion } from '../services/auditService';
import { tryExtractOriginalsFromQuizExport } from '../services/quizApiImport';

interface QuestionInputProps {
  onAdd: (q: QuestionData) => void;
  onAddBulk: (qs: QuestionData[]) => void;
}

const STORAGE_KEYS = {
  RAW_INPUT: 'paperchecker_draft_raw_input',
  STAGED_SNIPPETS: 'paperchecker_draft_staged_snippets'
};

const LOADING_MESSAGES = [
  "Detecting question components...",
  "Parsing options A, B, C, D...",
  "Extracting solution logic...",
  "Verifying academic accuracy...",
  "OCR in progress...",
];

const QuestionInput: React.FC<QuestionInputProps> = ({ onAdd, onAddBulk }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [rawInput, setRawInput] = useState('');
  const [stagedSnippets, setStagedSnippets] = useState<string[]>([]);

  // Load drafts on mount
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(STORAGE_KEYS.RAW_INPUT);
      const savedStaged = localStorage.getItem(STORAGE_KEYS.STAGED_SNIPPETS);
      
      if (savedRaw) setRawInput(savedRaw);
      if (savedStaged) {
        const parsed = JSON.parse(savedStaged);
        if (Array.isArray(parsed)) setStagedSnippets(parsed);
      }
    } catch (e) {
      console.warn("Failed to load draft from storage", e);
    }
  }, []);

  // Auto-save drafts whenever they change
  useEffect(() => {
    if (!isProcessing) {
      localStorage.setItem(STORAGE_KEYS.RAW_INPUT, rawInput);
      localStorage.setItem(STORAGE_KEYS.STAGED_SNIPPETS, JSON.stringify(stagedSnippets));
    }
  }, [rawInput, stagedSnippets, isProcessing]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      let idx = 0;
      interval = setInterval(() => {
        idx = (idx + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[idx]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const handleStageSnippet = () => {
    if (!rawInput.trim()) return;
    setStagedSnippets(prev => [...prev, rawInput.trim()]);
    setRawInput('');
  };

  const removeStagedSnippet = (index: number) => {
    setStagedSnippets(prev => prev.filter((_, i) => i !== index));
  };

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEYS.RAW_INPUT);
    localStorage.removeItem(STORAGE_KEYS.STAGED_SNIPPETS);
    setRawInput('');
    setStagedSnippets([]);
  };

  const handleSmartPasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalQueue = [...stagedSnippets];
    if (rawInput.trim()) finalQueue.push(rawInput.trim());

    if (finalQueue.length === 0) return;

    setIsProcessing(true);
    setProgress(10);
    try {
      const combinedInput = finalQueue.join('\n\n---NEXT QUESTION---\n\n');
      const quizOriginals = tryExtractOriginalsFromQuizExport(combinedInput);
      const results =
        quizOriginals && quizOriginals.length > 0
          ? await Promise.all(quizOriginals.map((o) => auditQuestion(o)))
          : await auditRawQuestion(combinedInput);

      const mappedQuestions: QuestionData[] = results.map((result: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        topic: result.topic || 'Pasted Content',
        original: result.originalParsed,
        audit: {
          status: result.status,
          logs: result.auditLogs,
          redlines: result.redlines,
          clean: result.clean
        },
        version: 2,
        lastModified: Date.now()
      }));

      setProgress(100);
      setTimeout(() => {
        onAddBulk(mappedQuestions);
        clearDraft(); // Successful submission clears the draft
        setIsProcessing(false);
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(err);
      alert(`AI failed to parse the questions.\n\n${msg}`);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl lg:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-8 transition-all">
      {/* Mobile-Friendly Segmented Controller */}
      <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl bg-white dark:bg-slate-800 text-indigo-600 shadow-sm text-center">
          Question Input {stagedSnippets.length > 0 && `(${stagedSnippets.length})`}
        </div>
      </div>

      <div className="p-5 lg:p-8 relative min-h-[400px]">
        {isProcessing && (
          <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10 flex flex-col items-center justify-center space-y-8 px-6 text-center">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">Processing</h3>
              <p className="text-xs font-bold text-indigo-600 animate-pulse mt-2 h-4">{loadingMessage}</p>
              <div className="mt-8 w-64 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-indigo-600 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Raw Content Entry</label>
            {(rawInput || stagedSnippets.length > 0) && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-green-500 uppercase tracking-widest animate-pulse">Draft Saved</span>
                <button 
                  onClick={clearDraft}
                  className="text-[8px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
          <div>
            <textarea 
              rows={10}
              className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 dark:border-slate-700 focus:border-indigo-500 focus:ring-0 transition-all bg-slate-50/50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 font-medium text-base lg:text-sm leading-relaxed shadow-inner"
              placeholder="Type or paste questions here. You can include MCQs or numerical problems..."
              value={rawInput}
              onChange={e => setRawInput(e.target.value)}
            />
          </div>

          {stagedSnippets.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
              {stagedSnippets.map((snippet, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100/50 dark:border-indigo-800/50 rounded-xl group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="w-5 h-5 flex items-center justify-center bg-indigo-600 text-white rounded-lg text-[10px] font-black shrink-0">{idx + 1}</span>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{snippet.slice(0, 30)}...</p>
                  </div>
                  <button onClick={() => removeStagedSnippet(idx)} className="text-red-400 p-2 active:scale-90 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
             <button 
              type="button"
              onClick={handleStageSnippet}
              disabled={!rawInput.trim() || isProcessing}
              className="w-full py-4 border-2 border-indigo-600 text-indigo-600 font-black rounded-2xl transition active:scale-[0.98] text-xs uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
              Stage Batch
            </button>
            <button 
              type="button"
              onClick={handleSmartPasteSubmit}
              disabled={(stagedSnippets.length === 0 && !rawInput.trim()) || isProcessing}
              className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black rounded-2xl shadow-xl transition active:scale-[0.98] text-xs uppercase tracking-widest"
            >
              Submit for Audit ({stagedSnippets.length + (rawInput.trim() ? 1 : 0)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionInput;
