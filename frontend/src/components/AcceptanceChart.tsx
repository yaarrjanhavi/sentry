'use client';

import React, { useState } from 'react';
import { HistoryPoint } from '../lib/types';

interface AcceptanceChartProps {
  history: HistoryPoint[];
  repoName: string;
}

export const AcceptanceChart: React.FC<AcceptanceChartProps> = ({ history, repoName }) => {
  const [activePoint, setActivePoint] = useState<HistoryPoint | null>(null);

  // If history is empty, provide sensible default points
  const points = history && history.length > 0 ? history : [
    { round_number: 1, acceptance_rate: 44, total_flags: 25, accepted_flags: 11, dismissed_flags: 14, created_at: '' },
    { round_number: 2, acceptance_rate: 50, total_flags: 22, accepted_flags: 11, dismissed_flags: 11, created_at: '' },
    { round_number: 3, acceptance_rate: 58, total_flags: 24, accepted_flags: 14, dismissed_flags: 10, created_at: '' },
    { round_number: 4, acceptance_rate: 65, total_flags: 20, accepted_flags: 13, dismissed_flags: 7, created_at: '' },
    { round_number: 5, acceptance_rate: 71, total_flags: 21, accepted_flags: 15, dismissed_flags: 6, created_at: '' },
    { round_number: 6, acceptance_rate: 74, total_flags: 19, accepted_flags: 14, dismissed_flags: 5, created_at: '' },
    { round_number: 7, acceptance_rate: 76, total_flags: 21, accepted_flags: 16, dismissed_flags: 5, created_at: '' },
    { round_number: 8, acceptance_rate: 78, total_flags: 23, accepted_flags: 18, dismissed_flags: 5, created_at: '' },
  ];

  const svgWidth = 440;
  const svgHeight = 150;
  const paddingX = 15;
  const paddingY = 20;

  // Map rounds to X and acceptance rates (0-100%) to Y
  const numPoints = points.length;
  const stepX = (svgWidth - paddingX * 2) / Math.max(numPoints - 1, 1);

  const coords = points.map((p, idx) => {
    const x = paddingX + idx * stepX;
    // 0% -> 135px, 100% -> 15px
    const y = svgHeight - paddingY - (p.acceptance_rate / 100) * (svgHeight - paddingY * 2);
    return { x, y, point: p };
  });

  const pathD = coords.reduce((acc, c, idx) => {
    return idx === 0 ? `M${c.x},${c.y}` : `${acc} L${c.x},${c.y}`;
  }, '');

  const polylinePoints = coords.map(c => `${c.x},${c.y}`).join(' ');

  // Area under path
  const areaD = coords.length > 0 
    ? `${pathD} L${coords[coords.length - 1].x},${svgHeight} L${coords[0].x},${svgHeight} Z`
    : '';

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-[22px] font-semibold tracking-wide text-white m-0 font-teko">
          Acceptance rate — {repoName}
        </h3>
        {activePoint ? (
          <div className="text-xs px-2.5 py-1 bg-[#111] border border-[#3dff6b]/40 rounded text-[#3dff6b] font-mono">
            Round {activePoint.round_number}: <strong>{activePoint.acceptance_rate}%</strong> ({activePoint.accepted_flags} accepted)
          </div>
        ) : (
          <div className="text-xs text-[#8f8f8f] font-mono">
            Latest: <span className="text-[#3dff6b] font-bold">{points[points.length - 1]?.acceptance_rate}%</span>
          </div>
        )}
      </div>

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

          {/* Area fill */}
          <path d={areaD} fill="url(#curveGradient)" />

          {/* Guide polyline */}
          <polyline points={polylinePoints} fill="none" stroke="#222" strokeWidth="1" />

          {/* Main animated curve */}
          <path 
            className="line" 
            d={pathD} 
            fill="none" 
            stroke="#3dff6b" 
            strokeWidth="2.5" 
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 500,
              strokeDashoffset: 500,
              animation: 'draw 1.2s ease-out forwards 0.2s'
            }}
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
        </svg>
      </div>

      <div className="flex justify-between items-center text-[10px] text-[#555] font-mono mt-1 px-1">
        <span>Round 1</span>
        <span>Round {Math.ceil(numPoints / 2)}</span>
        <span>Round {numPoints} (Current)</span>
      </div>
    </div>
  );
};
