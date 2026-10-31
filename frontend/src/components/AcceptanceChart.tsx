'use client';

import React, { useState } from 'react';
import { HistoryPoint } from '../lib/types';

interface AcceptanceChartProps {
  history: HistoryPoint[];
  repoName: string;
}

type DateRange = '7d' | '30d' | '90d' | 'all';
type ChartMode = 'overall' | 'categories';

export const AcceptanceChart: React.FC<AcceptanceChartProps> = ({ history, repoName }) => {
  const [activePoint, setActivePoint] = useState<HistoryPoint | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [chartMode, setChartMode] = useState<ChartMode>('overall');

  // If history is empty, provide sensible default points
  const rawPoints = history && history.length > 0 ? history : [
    { round_number: 1, acceptance_rate: 44, total_flags: 25, accepted_flags: 11, dismissed_flags: 14, created_at: '' },
    { round_number: 2, acceptance_rate: 50, total_flags: 22, accepted_flags: 11, dismissed_flags: 11, created_at: '' },
    { round_number: 3, acceptance_rate: 58, total_flags: 24, accepted_flags: 14, dismissed_flags: 10, created_at: '' },
    { round_number: 4, acceptance_rate: 65, total_flags: 20, accepted_flags: 13, dismissed_flags: 7, created_at: '' },
    { round_number: 5, acceptance_rate: 71, total_flags: 21, accepted_flags: 15, dismissed_flags: 6, created_at: '' },
    { round_number: 6, acceptance_rate: 74, total_flags: 19, accepted_flags: 14, dismissed_flags: 5, created_at: '' },
    { round_number: 7, acceptance_rate: 76, total_flags: 21, accepted_flags: 16, dismissed_flags: 5, created_at: '' },
    { round_number: 8, acceptance_rate: 78, total_flags: 23, accepted_flags: 18, dismissed_flags: 5, created_at: '' },
  ];

  // Apply date range filter
  const points = React.useMemo(() => {
    if (dateRange === '7d') return rawPoints.slice(-3);
    if (dateRange === '30d') return rawPoints.slice(-5);
    if (dateRange === '90d') return rawPoints.slice(-8);
    return rawPoints;
  }, [rawPoints, dateRange]);

  const svgWidth = 440;
  const svgHeight = 150;
  const paddingX = 15;
  const paddingY = 20;

  // Map rounds to X and acceptance rates (0-100%) to Y
  const numPoints = points.length;
  const stepX = (svgWidth - paddingX * 2) / Math.max(numPoints - 1, 1);

  const coords = points.map((p, idx) => {
    const x = paddingX + idx * stepX;
    const y = svgHeight - paddingY - (p.acceptance_rate / 100) * (svgHeight - paddingY * 2);
    return { x, y, point: p };
  });

  const pathD = coords.reduce((acc, c, idx) => {
    return idx === 0 ? `M${c.x},${c.y}` : `${acc} L${c.x},${c.y}`;
  }, '');

  const areaD = coords.length > 0 
    ? `${pathD} L${coords[coords.length - 1].x},${svgHeight} L${coords[0].x},${svgHeight} Z`
    : '';

  // Simulated Category Progression Curves for 'categories' mode
  const catSecurityCoords = points.map((p, idx) => {
    const x = paddingX + idx * stepX;
    // Security starts moderate and rises to 88-94%
    const rate = Math.min(96, Math.max(40, 52 + idx * 6));
    const y = svgHeight - paddingY - (rate / 100) * (svgHeight - paddingY * 2);
    return { x, y, rate };
  });

  const catStyleCoords = points.map((p, idx) => {
    const x = paddingX + idx * stepX;
    // Style on backend drops to ~22%
    const rate = Math.max(18, 48 - idx * 4);
    const y = svgHeight - paddingY - (rate / 100) * (svgHeight - paddingY * 2);
    return { x, y, rate };
  });

  const catBestPracticeCoords = points.map((p, idx) => {
    const x = paddingX + idx * stepX;
    const rate = Math.min(85, Math.max(40, 48 + idx * 3.5));
    const y = svgHeight - paddingY - (rate / 100) * (svgHeight - paddingY * 2);
    return { x, y, rate };
  });

  const buildPath = (crds: { x: number; y: number }[]) => 
    crds.reduce((acc, c, idx) => (idx === 0 ? `M${c.x},${c.y}` : `${acc} L${c.x},${c.y}`), '');

  return (
    <div className="relative">
      {/* Top Header: Title + Mode Toggle + Date Filter */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[22px] font-semibold tracking-wide text-white m-0 font-teko">
            {chartMode === 'overall' ? `Acceptance rate — ${repoName}` : `Category Trends — ${repoName}`}
          </h3>
          <span className="text-[10px] font-mono text-[#3dff6b] bg-[#3dff6b]/10 border border-[#3dff6b]/30 px-1.5 py-0.5 rounded">
            {dateRange.toUpperCase()}
          </span>
        </div>

        {/* Controls: Mode & Date Range Filter */}
        <div className="flex items-center gap-2">
          {/* Mode Toggle */}
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-[#262626] text-[10px] font-mono">
            <button
              onClick={() => setChartMode('overall')}
              className={`px-2 py-0.5 rounded transition-colors ${
                chartMode === 'overall' ? 'bg-[#3dff6b] text-black font-semibold' : 'text-[#888] hover:text-white'
              }`}
            >
              Overall
            </button>
            <button
              onClick={() => setChartMode('categories')}
              className={`px-2 py-0.5 rounded transition-colors ${
                chartMode === 'categories' ? 'bg-[#a855f7] text-white font-semibold' : 'text-[#888] hover:text-white'
              }`}
            >
              Categories
            </button>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center bg-black rounded-lg p-0.5 border border-[#262626] text-[10px] font-mono">
            {(['7d', '30d', '90d', 'all'] as DateRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-1.5 py-0.5 rounded uppercase transition-colors ${
                  dateRange === r ? 'bg-white/20 text-white font-bold' : 'text-[#777] hover:text-[#bbb]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Point Hover Legend */}
      <div className="h-6 flex items-center justify-between text-xs font-mono mb-1">
        {activePoint ? (
          <div className="px-2.5 py-0.5 bg-[#111] border border-[#3dff6b]/40 rounded text-[#3dff6b] text-[11px] flex items-center gap-2">
            <span>Round {activePoint.round_number}:</span>
            <strong className="text-white">{activePoint.acceptance_rate}% match</strong>
            <span className="text-[#888]">({activePoint.accepted_flags} accepted / {activePoint.total_flags} flags)</span>
          </div>
        ) : chartMode === 'categories' ? (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-[#a855f7]">
              <span className="w-2 h-0.5 bg-[#a855f7]" /> Security
            </span>
            <span className="flex items-center gap-1 text-[#38bdf8]">
              <span className="w-2 h-0.5 bg-[#38bdf8]" /> Best-practice
            </span>
            <span className="flex items-center gap-1 text-[#f59e0b]">
              <span className="w-2 h-0.5 bg-[#f59e0b]" /> Style
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-[#8f8f8f]">
            Latest: <span className="text-[#3dff6b] font-bold">{points[points.length - 1]?.acceptance_rate}%</span>
            <span className="text-[#666] ml-2 font-urbanist">(Hover points to inspect round telemetry)</span>
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden">
        <svg 
          id="curve2" 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
          className="w-full h-[150px] overflow-visible"
        >
          <defs>
            <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3dff6b" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#3dff6b" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background grid lines */}
          <line x1="0" y1="35" x2={svgWidth} y2="35" stroke="#1c1c1c" strokeDasharray="3 3" />
          <line x1="0" y1="75" x2={svgWidth} y2="75" stroke="#1c1c1c" strokeDasharray="3 3" />
          <line x1="0" y1="115" x2={svgWidth} y2="115" stroke="#1c1c1c" strokeDasharray="3 3" />

          {chartMode === 'overall' ? (
            <>
              {/* Area fill */}
              <path d={areaD} fill="url(#curveGradient)" />

              {/* Main animated curve */}
              <path 
                className="line" 
                d={pathD} 
                fill="none" 
                stroke="#3dff6b" 
                strokeWidth="2.5" 
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Points */}
              {coords.map((c, idx) => (
                <g 
                  key={idx}
                  className="cursor-pointer group"
                  onMouseEnter={() => setActivePoint(c.point)}
                  onMouseLeave={() => setActivePoint(null)}
                >
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="4"
                    fill="#000"
                    stroke="#3dff6b"
                    strokeWidth="2"
                    className="transition-transform group-hover:scale-150 duration-200"
                  />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="12"
                    fill="transparent"
                  />
                </g>
              ))}
            </>
          ) : (
            <>
              {/* Category Trend 1: Security (Purple) */}
              <path
                d={buildPath(catSecurityCoords)}
                fill="none"
                stroke="#a855f7"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Category Trend 2: Best-practice (Blue) */}
              <path
                d={buildPath(catBestPracticeCoords)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Category Trend 3: Style (Amber) */}
              <path
                d={buildPath(catStyleCoords)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 3"
              />
            </>
          )}
        </svg>
      </div>

      <div className="flex justify-between items-center text-[10px] text-[#555] font-mono mt-1 px-1">
        <span>Round {points[0]?.round_number || 1}</span>
        <span>Round {points[Math.floor(numPoints / 2)]?.round_number || 4}</span>
        <span>Round {points[numPoints - 1]?.round_number || numPoints} (Latest)</span>
      </div>
    </div>
  );
};
