import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AuditLog, Paper } from '../types';

interface AnalyticsDashboardProps {
  logs: AuditLog[];
  papers: Paper[];
  onInspect: (paperId: string, questionId: string) => void;
  onSelectPaper?: (paperId: string) => void;
}

const truncateLabel = (s: string, max = 32) =>
  s.length <= max ? s : `${s.slice(0, max - 1)}…`;

/** Map messy model output (CRITICAL, MODERATE, …) onto three QC levels for charts and filters. */
function normalizeSeverity(raw: unknown): 'HIGH' | 'MEDIUM' | 'LOW' {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!u) return 'LOW';
  if (
    u === 'HIGH' ||
    u === 'CRITICAL' ||
    u === 'MAJOR' ||
    u === 'SEVERE' ||
    u.includes('CRITICAL') ||
    u.includes('SEVERE')
  )
    return 'HIGH';
  if (
    u === 'MEDIUM' ||
    u === 'MODERATE' ||
    u === 'NORMAL' ||
    u.includes('MODERATE')
  )
    return 'MEDIUM';
  if (
    u === 'LOW' ||
    u === 'MINOR' ||
    u === 'TRIVIAL' ||
    u === 'INFO' ||
    u === 'NONE' ||
    u === 'NEGLIGIBLE' ||
    u.includes('TRIVIAL') ||
    u.includes('NEGLIGIBLE')
  )
    return 'LOW';
  return 'LOW';
}

const CANONICAL_TYPES = ['CONCEPTUAL', 'NUMERICAL', 'LOGICAL', 'GRAMMATICAL'] as const;
type NormalizedIssueType = (typeof CANONICAL_TYPES)[number] | 'OTHER';

/** Map variant labels (LOGIC, Content Verification, …) to a small set for readable charts. */
function normalizeIssueType(raw: unknown): NormalizedIssueType {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!u) return 'OTHER';
  if ((CANONICAL_TYPES as readonly string[]).includes(u)) return u as NormalizedIssueType;
  if (u === 'LOGIC' || u.includes('LOGIC')) return 'LOGICAL';
  if (u.includes('NUMERIC') || u.includes('NUMBER') || u.includes('CALCUL')) return 'NUMERICAL';
  if (
    u.includes('GRAMMAR') ||
    u.includes('SPELL') ||
    u.includes('LANGUAGE') ||
    u.includes('CONTENT_VERIF') ||
    u.includes('CONTENTVERIF')
  )
    return 'GRAMMATICAL';
  if (u.includes('CONCEPT')) return 'CONCEPTUAL';
  return 'OTHER';
}

const SEVERITY_ORDER: Array<'HIGH' | 'MEDIUM' | 'LOW'> = ['HIGH', 'MEDIUM', 'LOW'];
const SEVERITY_COLORS: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#6366f1',
};

const TYPE_ORDER: NormalizedIssueType[] = [
  ...CANONICAL_TYPES,
  'OTHER',
];

const TYPE_COLORS: Record<NormalizedIssueType, string> = {
  CONCEPTUAL: '#8b5cf6',
  NUMERICAL: '#06b6d4',
  LOGICAL: '#6366f1',
  GRAMMATICAL: '#10b981',
  OTHER: '#94a3b8',
};

const analyticsFilterSelectClass =
  'w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 pl-4 pr-11 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer';

const TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All types' },
  { value: 'CONCEPTUAL', label: 'Conceptual' },
  { value: 'NUMERICAL', label: 'Numerical' },
  { value: 'LOGICAL', label: 'Logical' },
  { value: 'GRAMMATICAL', label: 'Grammatical' },
  { value: 'OTHER', label: 'Other' },
];

const SEVERITY_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All severities' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

function AnalyticsSelectChevron() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  logs,
  papers,
  onInspect,
  onSelectPaper,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [paperFilter, setPaperFilter] = useState<string>('ALL');
  const [overviewTab, setOverviewTab] = useState<'types' | 'severity'>('types');

  const paperRows = useMemo(() => {
    const byId = new Map<
      string,
      { paperId: string; title: string; logs: AuditLog[] }
    >();
    for (const p of papers) {
      byId.set(p.id, { paperId: p.id, title: p.title || 'Untitled', logs: [] });
    }
    for (const log of logs) {
      const pid = log.paperId;
      if (!pid) continue;
      if (!byId.has(pid)) {
        byId.set(pid, { paperId: pid, title: 'Unknown paper', logs: [] });
      }
      byId.get(pid)!.logs.push(log);
    }
    return Array.from(byId.values())
      .map((row) => {
        const high = row.logs.filter((l) => normalizeSeverity(l.severity) === 'HIGH').length;
        const medium = row.logs.filter((l) => normalizeSeverity(l.severity) === 'MEDIUM').length;
        const low = row.logs.filter((l) => normalizeSeverity(l.severity) === 'LOW').length;
        const questionIds = new Set(
          row.logs.map((l) => l.questionId).filter(Boolean) as string[]
        );
        return {
          paperId: row.paperId,
          title: row.title,
          count: row.logs.length,
          high,
          medium,
          low,
          questionsFlagged: questionIds.size,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [papers, logs]);

  const paperBarData = useMemo(
    () =>
      paperRows
        .filter((r) => r.count > 0)
        .slice(0, 14)
        .map((r) => ({
          name: truncateLabel(r.title, 26),
          fullTitle: r.title,
          value: r.count,
          paperId: r.paperId,
        })),
    [paperRows]
  );

  const chartLogs = useMemo(
    () =>
      paperFilter === 'ALL'
        ? logs
        : logs.filter((l) => l.paperId === paperFilter),
    [logs, paperFilter]
  );

  const typeCount = chartLogs.reduce((acc: Record<NormalizedIssueType, number>, log) => {
    const k = normalizeIssueType(log.type);
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<NormalizedIssueType, number>);

  const barData = TYPE_ORDER.map((key) => ({
    name: key === 'OTHER' ? 'Other' : key,
    rawKey: key,
    value: typeCount[key] || 0,
  })).filter((d) => d.value > 0);

  const severityCount = chartLogs.reduce(
    (acc: Record<'HIGH' | 'MEDIUM' | 'LOW', number>, log) => {
      const k = normalizeSeverity(log.severity);
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    },
    { HIGH: 0, MEDIUM: 0, LOW: 0 }
  );

  const severityBarData = SEVERITY_ORDER.map((key) => ({
    name: key,
    value: severityCount[key],
  }));

  const filteredLogs = chartLogs.filter((log) => {
    const nt = normalizeIssueType(log.type);
    const ns = normalizeSeverity(log.severity);
    const matchesType = typeFilter === 'ALL' || nt === typeFilter;
    const matchesSeverity = severityFilter === 'ALL' || ns === severityFilter;
    return matchesType && matchesSeverity;
  });

  const isFiltered =
    typeFilter !== 'ALL' || severityFilter !== 'ALL' || paperFilter !== 'ALL';

  const handleResetFilters = () => {
    setTypeFilter('ALL');
    setSeverityFilter('ALL');
    setPaperFilter('ALL');
  };

  const papersWithActivity = paperRows.filter((r) => r.count > 0).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Paper Checker AI Analytics</h1>
        <p className="text-slate-500 dark:text-slate-300 font-medium">
          Tracking error patterns and quality trends across all verified sessions. Use paper-wise
          breakdown to focus one submission, or open it in the queue.
        </p>
      </header>

      <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-700/40">
          <h2 className="text-base font-black text-slate-900 dark:text-slate-50 uppercase tracking-wider">
            Paper-wise analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-300 font-medium mt-1">
            {papers.length} paper{papers.length === 1 ? '' : 's'} loaded · {papersWithActivity} with audit
            events
          </p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 p-8">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest mb-4">
              Events by paper (top {paperBarData.length || 0})
            </h3>
            {paperBarData.length > 0 ? (
              <div className="h-[min(360px,50vh)] min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={paperBarData}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal
                      vertical={false}
                      stroke="#f1f5f9"
                      className="dark:stroke-slate-700"
                    />
                    <XAxis type="number" fontSize={9} tick={{ fontWeight: 700 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={108}
                      fontSize={9}
                      tick={{ fontWeight: 700, fill: 'var(--tw-text-slate-500)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 600,
                      }}
                      formatter={(value: number) => [value, 'Events']}
                      labelFormatter={(_, payload) =>
                        (payload?.[0]?.payload?.fullTitle as string) || ''
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill="#a855f7"
                      radius={[0, 6, 6, 0]}
                      className="cursor-pointer"
                      onClick={(item) => {
                        const pid = item?.payload?.paperId as string | undefined;
                        if (pid) setPaperFilter(pid);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-12 text-center font-medium">
                No audit logs yet — run audits on questions to see per-paper stats.
              </p>
            )}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-medium">
              Tip: click a bar to filter charts and the feed below to that paper.
            </p>
          </div>
          <div className="overflow-x-auto max-h-[min(400px,55vh)] overflow-y-auto rounded-2xl border border-slate-100 dark:border-slate-600">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                <tr>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">
                    Paper
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase text-center">
                    Events
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase text-center">
                    High
                  </th>
                  <th className="px-3 py-3 text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase text-center">
                    Qs
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-500 dark:text-slate-300 uppercase text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {paperRows.map((row) => (
                  <tr
                    key={row.paperId}
                    className={`hover:bg-slate-50/90 dark:hover:bg-slate-700/50 transition-colors ${
                      paperFilter === row.paperId ? 'bg-indigo-50/80 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-xs leading-snug max-w-[200px]">
                        {row.title}
                      </p>
                      {row.count === 0 && (
                        <span className="text-[9px] text-slate-400 font-medium">No audit logs</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center font-black text-slate-700 dark:text-slate-200 text-xs">
                      {row.count}
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-black text-red-500">
                      {row.high || '—'}
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                      {row.questionsFlagged || '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.count > 0 && (
                          <button
                            type="button"
                            onClick={() => setPaperFilter(row.paperId)}
                            className="text-[9px] font-black uppercase tracking-tight text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Filter
                          </button>
                        )}
                        {onSelectPaper && (
                          <button
                            type="button"
                            onClick={() => onSelectPaper(row.paperId)}
                            className="text-[9px] font-black uppercase tracking-tight text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                          >
                            Open
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">
              Overview
            </h3>
            <div
              className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-700/80 border border-slate-200/80 dark:border-slate-600 gap-1"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'types'}
                onClick={() => setOverviewTab('types')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  overviewTab === 'types'
                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-200 shadow-sm border border-slate-200/80 dark:border-slate-500'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Error types
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={overviewTab === 'severity'}
                onClick={() => setOverviewTab('severity')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  overviewTab === 'severity'
                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-200 shadow-sm border border-slate-200/80 dark:border-slate-500'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Severity
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-4 -mt-2">
            {overviewTab === 'types'
              ? 'Grouped labels (e.g. LOGIC, content checks) are merged into standard categories.'
              : 'All severities are shown as High, Medium, or Low — duplicate labels from the model are combined.'}
          </p>
          <div className="h-[min(320px,40vh)] min-h-[240px]">
            {overviewTab === 'types' ? (
              barData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 4, bottom: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                      className="dark:stroke-slate-700"
                    />
                    <XAxis
                      dataKey="name"
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-28}
                      textAnchor="end"
                      height={56}
                      tick={{ fontWeight: 700, fill: 'var(--tw-text-slate-500)' }}
                    />
                    <YAxis
                      fontSize={9}
                      axisLine={false}
                      tickLine={false}
                      scale="sqrt"
                      domain={[0, 'auto']}
                      tick={{ fontWeight: 700, fill: 'var(--tw-text-slate-500)' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 600,
                      }}
                      cursor={{ fill: '#f8fafc', fillOpacity: 0.08 }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {barData.map((d) => (
                        <Cell key={d.rawKey} fill={TYPE_COLORS[d.rawKey]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400 font-medium">
                  No typed events in this view.
                </p>
              )
            ) : chartLogs.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={severityBarData}
                  margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal
                    vertical={false}
                    stroke="#f1f5f9"
                    className="dark:stroke-slate-700"
                  />
                  <XAxis type="number" fontSize={9} tick={{ fontWeight: 700 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={64}
                    fontSize={10}
                    tick={{ fontWeight: 800, fill: 'var(--tw-text-slate-500)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: 'none',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                    formatter={(value: number) => [value, 'Events']}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {severityBarData.map((d) => (
                      <Cell key={d.name} fill={SEVERITY_COLORS[d.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400 font-medium">
                No events in this view.
              </p>
            )}
          </div>
          {overviewTab === 'severity' && chartLogs.length > 0 && (
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-600">
              {SEVERITY_ORDER.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: SEVERITY_COLORS[s] }}
                  />
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">
                    {s}: {severityCount[s]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col justify-center text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <svg className="w-32 h-32 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.921l-1.157 2.016a1 1 0 01-.157.218l-1.782 1.782a1 1 0 01-.707.293H4a1 1 0 00-1 1v7a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1H9.414l1.293-1.293a1 1 0 011.688.84z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="relative z-10">
            <div className="text-6xl font-black text-indigo-400 tracking-tighter">
              {chartLogs.length}
            </div>
            <p className="text-slate-400 dark:text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] mt-4">Verification Events</p>
            <div className="mt-10 space-y-3">
               <div className="bg-slate-800/80 backdrop-blur px-5 py-4 rounded-2xl flex justify-between items-center border border-slate-700/50 dark:border-slate-600/50">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">High severity</span>
                  <span className="text-base font-black text-red-400">{severityCount.HIGH}</span>
               </div>
               <div className="bg-slate-800/80 backdrop-blur px-5 py-4 rounded-2xl flex justify-between items-center border border-slate-700/50 dark:border-slate-600/50">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Logic & reasoning</span>
                  <span className="text-base font-black text-indigo-400">{typeCount.LOGICAL ?? 0}</span>
               </div>
               <div className="bg-slate-800/80 backdrop-blur px-5 py-4 rounded-2xl flex justify-between items-center border border-slate-700/50 dark:border-slate-600/50">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Grammar / language</span>
                  <span className="text-base font-black text-emerald-400">{typeCount.GRAMMATICAL ?? 0}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="shrink-0">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-50 uppercase tracking-wider">Raw Verification Feed</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 font-medium mt-1">
              {paperFilter === 'ALL'
                ? 'Live stream of AI interventions across all papers.'
                : `Showing events for: ${papers.find((p) => p.id === paperFilter)?.title || 'selected paper'}.`}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
            <div className="space-y-2 w-full sm:w-auto sm:min-w-[220px] lg:min-w-[280px]">
              <label
                htmlFor="analytics-paper-filter"
                className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1"
              >
                Paper
              </label>
              <div className="relative">
                <select
                  id="analytics-paper-filter"
                  value={paperFilter}
                  onChange={(e) => setPaperFilter(e.target.value)}
                  className={analyticsFilterSelectClass}
                >
                  <option value="ALL">All papers ({papers.length})</option>
                  {paperRows.map((row) => (
                    <option key={row.paperId} value={row.paperId}>
                      {row.title}
                      {row.count > 0 ? ` — ${row.count} events` : ''}
                    </option>
                  ))}
                </select>
                <AnalyticsSelectChevron />
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-600 hidden xl:block mx-1" />
            <div className="space-y-2 w-full sm:w-auto sm:min-w-[200px] lg:min-w-[220px]">
              <label
                htmlFor="analytics-type-filter"
                className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1"
              >
                Filter by type
              </label>
              <div className="relative">
                <select
                  id="analytics-type-filter"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={analyticsFilterSelectClass}
                >
                  {TYPE_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'ALL'
                        ? `${opt.label} (${chartLogs.length})`
                        : `${opt.label} (${typeCount[opt.value as NormalizedIssueType] ?? 0})`}
                    </option>
                  ))}
                </select>
                <AnalyticsSelectChevron />
              </div>
            </div>
            <div className="w-px h-10 bg-slate-200 dark:bg-slate-600 hidden xl:block mx-1" />
            <div className="space-y-2 w-full sm:w-auto sm:min-w-[200px] lg:min-w-[220px]">
              <label
                htmlFor="analytics-severity-filter"
                className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1"
              >
                Filter severity
              </label>
              <div className="relative">
                <select
                  id="analytics-severity-filter"
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className={analyticsFilterSelectClass}
                >
                  {SEVERITY_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'ALL'
                        ? `${opt.label} (${chartLogs.length})`
                        : `${opt.label} (${severityCount[opt.value as 'HIGH' | 'MEDIUM' | 'LOW']})`}
                    </option>
                  ))}
                </select>
                <AnalyticsSelectChevron />
              </div>
            </div>
            
            {isFiltered && (
              <div className="sm:ml-4 sm:pt-4">
                <button 
                  onClick={handleResetFilters}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-red-100 hover:bg-red-100 transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredLogs.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">Classification</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">Auditor's Note</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest">Severity</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase tracking-widest text-right">Integrity Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                {filteredLogs.map((log, i) => {
                  const displayType = normalizeIssueType(log.type);
                  const displaySev = normalizeSeverity(log.severity);
                  const rawType = String(log.type ?? '');
                  const rawSev = String(log.severity ?? '');
                  return (
                  <tr key={i} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/80 transition-all duration-300">
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-600 text-[9px] font-black text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 uppercase tracking-tighter">
                        {displayType}
                      </span>
                      {rawType && rawType.toUpperCase() !== displayType && (
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 max-w-[14rem] truncate" title={rawType}>
                          Raw: {rawType}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed max-w-lg">{log.message}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest ${
                        displaySev === 'HIGH' ? 'bg-red-50 text-red-600 border border-red-100 dark:bg-red-900 dark:text-red-300 dark:border-red-800' : 
                        displaySev === 'MEDIUM' ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-800' : 
                        'bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800'
                      }`}>
                        {displaySev}
                      </span>
                      {rawSev && rawSev.toUpperCase() !== displaySev && (
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 truncate" title={rawSev}>
                          {rawSev}
                        </p>
                      )}
                    </td>
                    <td className="px-8 py-5 text-right">
                      {log.paperId && log.questionId && (
                        <button 
                          onClick={() => onInspect(log.paperId!, log.questionId!)}
                          className="text-indigo-600 font-black text-[9px] uppercase tracking-widest hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 shadow-sm opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all"
                        >
                          Inspect Logic
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-24 text-center">
              <div className="bg-slate-50 dark:bg-slate-700 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-600 shadow-inner">
                <svg className="w-8 h-8 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase">No Matching Records</h4>
              <p className="text-xs text-slate-500 dark:text-slate-300 mt-1">Try adjusting your filters to see more results.</p>
              <button 
                onClick={handleResetFilters}
                className="mt-6 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;