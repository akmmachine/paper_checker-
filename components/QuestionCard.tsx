
import React, { useState } from 'react';
import { QuestionData, QuestionStatus } from '../types';
import { renderMathHtml, renderTrackedMathHtml } from '../services/latexRenderer';
import { resolvedCorrectOptionIndexSet } from '../services/mcqCorrectIndices';

interface QuestionCardProps {
  data: QuestionData;
  index: number; 
  onAudit: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isAuditing: boolean;
  showQCControls?: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ 
  data, 
  index,
  onAudit, 
  onApprove, 
  onReject,
  isAuditing, 
  showQCControls 
}) => {
  const [viewMode, setViewMode] = useState<'AUDIT' | 'CLEAN'>('AUDIT');

  const getStatusStyle = (status: QuestionStatus) => {
    switch (status) {
      case QuestionStatus.APPROVED: return 'bg-green-100 text-green-700 border-green-200';
      case QuestionStatus.NEEDS_CORRECTION: return 'bg-amber-100 text-amber-700 border-amber-200';
      case QuestionStatus.REJECTED: return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const renderRedlined = (html: any) => {
    const safeHtml = typeof html === 'string' ? html : '';
    if (!safeHtml) return <span className="text-slate-400 italic">No content available</span>;

    return (
      <div 
        className="prose-sm max-w-none dark:text-slate-200"
        dangerouslySetInnerHTML={{ 
          __html: renderTrackedMathHtml(safeHtml)
            .replace(/<del>/g, '<del class="bg-red-100 text-red-800 line-through px-1 rounded mx-0.5">')
            .replace(/<\/del>/g, '</del>')
            .replace(/<ins>/g, '<ins class="bg-green-100 text-green-800 font-medium px-1 rounded mx-0.5">')
            .replace(/<\/ins>/g, '</ins>')
        }} 
      />
    );
  };

  const isUnreadableRedline = (value: string): boolean => {
    if (!value) return true;
    const commandCount = (value.match(/\\[a-zA-Z]+/g) || []).length;
    const tagCount = (value.match(/<\/?(ins|del)>/g) || []).length;
    const plainText = value.replace(/<\/?(ins|del)>/g, '').replace(/\\[a-zA-Z]+/g, '').trim();
    // Fallback when content is mostly noisy command/tag artifacts.
    return commandCount > 20 || tagCount > 20 || plainText.length < 8;
  };

  const renderMathText = (value: any, className = 'text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed') => {
    const safe = typeof value === 'string' ? value : '';
    if (!safe) return <span className="text-slate-400 italic">No content available</span>;
    return <div className={className} dangerouslySetInnerHTML={{ __html: renderMathHtml(safe) }} />;
  };

  const redlineOptsList = data.audit?.redlines?.options;
  const cleanOptsList = data.audit?.clean?.options;
  const displayOptions =
    Array.isArray(redlineOptsList) && redlineOptsList.length > 0
      ? redlineOptsList
      : (data.original?.options ?? []);
  const cleanOptions =
    Array.isArray(cleanOptsList) && cleanOptsList.length > 0 ? cleanOptsList : (data.original?.options ?? []);
  const hasImageHtml = (value: string) => /<img\b[^>]*>/i.test(value);
  const originalOptions = data.original?.options || [];
  const redlineOptions = data.audit?.redlines?.options || [];
  const cleanOptionValues = data.audit?.clean?.options || [];
  const originalHasImages = originalOptions.some((opt) => hasImageHtml(opt));
  const redlineHasImages = redlineOptions.some((opt) => hasImageHtml(opt));
  const cleanHasImages = cleanOptionValues.some((opt) => hasImageHtml(opt));
  const effectiveDisplayOptions = originalHasImages && !redlineHasImages ? originalOptions : displayOptions;
  const effectiveCleanOptions = originalHasImages && !cleanHasImages ? originalOptions : cleanOptions;
  const nDisplay = effectiveDisplayOptions.length;
  const nClean = effectiveCleanOptions.length;
  const correctSet = resolvedCorrectOptionIndexSet({ original: data.original, audit: data.audit });
  const isOptionCorrect = (i: number, n: number) => n > 0 && i >= 0 && i < n && correctSet.has(i);
  const isNumerical = !(data.original?.options && data.original.options.length > 0);
  const redlineQuestion = data.audit?.redlines?.question || '';
  const redlineSolution = data.audit?.redlines?.solution || '';
  const preferCleanQuestion = isUnreadableRedline(redlineQuestion) && !!data.audit?.clean?.question;
  const preferCleanSolution = isUnreadableRedline(redlineSolution) && !!data.audit?.clean?.solution;

  return (
    <div id={`question-${data.id}`} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6 group transition-all">
      {/* Header */}
      <div className="px-5 py-3.5 flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 gap-3">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs shadow-sm">
            {index}
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Entry</span>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black border uppercase ${getStatusStyle(data.audit?.status || QuestionStatus.PENDING)}`}>
              {data.audit?.status || 'UNAUDITED'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          {!data.audit && !isAuditing && (
            <button 
              onClick={() => onAudit(data.id)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg shadow-sm transition active:scale-95 uppercase tracking-wider"
            >
              Start AI Audit
            </button>
          )}
          {isAuditing && <span className="text-[10px] text-indigo-500 animate-pulse font-black uppercase">Verifying...</span>}
          
          {data.audit && (
            <div className="inline-flex rounded-xl bg-slate-200 dark:bg-slate-700 p-1">
              <button 
                onClick={() => setViewMode('AUDIT')}
                className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewMode === 'AUDIT' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`}
              >
                AUDIT
              </button>
              <button 
                onClick={() => setViewMode('CLEAN')}
                className={`px-3 py-1.5 text-[9px] font-black rounded-lg transition-all ${viewMode === 'CLEAN' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-50' : 'text-slate-500 dark:text-slate-400'}`}
              >
                CLEAN
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {viewMode === 'AUDIT' || !data.audit ? (
          <div className="space-y-5">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Question Workspace</p>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                {data.audit?.redlines?.question ? (
                  preferCleanQuestion
                    ? renderMathText(data.audit?.clean?.question, 'text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed')
                    : renderRedlined(data.audit.redlines.question)
                ) : (
                  renderMathText(data.original?.question || 'Empty question body.')
                )}
              </div>
            </div>

            {isNumerical ? (
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 rounded-xl">
                <p className="text-[9px] font-black text-indigo-500 uppercase mb-2 tracking-widest">Key Answer</p>
                <div className="text-sm font-black text-slate-700 dark:text-slate-100">
                  {data.audit?.redlines?.correctAnswer && !isUnreadableRedline(data.audit.redlines.correctAnswer)
                    ? renderRedlined(data.audit.redlines.correctAnswer)
                    : renderMathText(data.audit?.clean?.correctAnswer || data.original?.correctAnswer || 'N/A', 'text-sm font-black text-slate-700 dark:text-slate-100')}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {effectiveDisplayOptions.map((opt, i) => (
                  <div key={i} className={`p-3 rounded-xl border-2 flex items-start gap-3 transition-colors ${isOptionCorrect(i, nDisplay) ? 'bg-green-50/50 border-green-500/30' : 'border-slate-50 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30'}`}>
                    <span className="font-black text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{String.fromCharCode(65+i)}</span>
                    {data.audit?.redlines?.options &&
                    !(originalHasImages && !redlineHasImages) &&
                    !isUnreadableRedline(opt)
                      ? renderRedlined(opt)
                      : renderMathText(opt, 'text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug')}
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-widest">Audit Logs</p>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed">
                {data.audit?.redlines?.solution
                  ? (preferCleanSolution
                      ? renderMathText(data.audit?.clean?.solution, 'text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed')
                      : renderRedlined(data.audit.redlines.solution))
                  : renderMathText(data.original?.solution, 'text-xs italic text-slate-600 dark:text-slate-400 leading-relaxed')}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[9px] font-black text-green-500 uppercase mb-2 tracking-widest">Final Version</p>
              {renderMathText(data.audit?.clean?.question, 'text-base font-bold text-slate-900 dark:text-slate-50 leading-relaxed')}
            </div>
            
            {isNumerical ? (
              <div className="p-5 bg-green-50/50 dark:bg-green-900/10 border-2 border-green-500/20 rounded-2xl">
                <p className="text-[9px] font-black text-green-600 uppercase mb-2 tracking-widest">Verified Result</p>
                {renderMathText(data.audit?.clean?.correctAnswer, 'text-2xl font-black text-slate-900 dark:text-slate-50')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {effectiveCleanOptions.map((opt, i) => (
                  <div key={i} className={`p-4 rounded-2xl border-2 transition-all ${isOptionCorrect(i, nClean) ? 'border-green-500 bg-green-50/50 shadow-sm' : 'border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-slate-400 text-[10px]">{String.fromCharCode(65+i)}</span>
                      {isOptionCorrect(i, nClean) && <span className="bg-green-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Correct</span>}
                    </div>
                    {renderMathText(opt, 'text-sm font-bold text-slate-800 dark:text-slate-100')}
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
               <p className="text-[9px] font-black text-indigo-500 uppercase mb-2 tracking-widest">Solution Reference</p>
               {renderMathText(data.audit?.clean?.solution, 'text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed')}
            </div>
          </div>
        )}
      </div>

      {/* QC Actions (Mobile Friendly Footer) */}
      {showQCControls && data.audit && (
        <div className="px-5 py-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] hidden sm:block">Administrative QC Queue</p>
          <div className="flex w-full sm:w-auto gap-3">
             <button 
              onClick={() => onApprove?.(data.id)}
              className="flex-1 sm:px-6 py-3 bg-green-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              Approve
            </button>
            <button 
              onClick={() => onReject?.(data.id)}
              className="flex-1 sm:px-6 py-3 border border-red-500/50 text-red-400 bg-red-950/20 text-[10px] font-black rounded-xl uppercase tracking-widest active:scale-95 transition-all"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
