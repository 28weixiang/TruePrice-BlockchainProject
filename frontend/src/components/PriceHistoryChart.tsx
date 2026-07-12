'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, LineChart } from 'lucide-react';
import { PriceHistoryEntry } from '@/lib/web3';
import {
  buildPriceChartGeometry,
  formatShortDate,
} from '@/lib/priceHistoryChart';

interface PriceHistoryChartProps {
  history: PriceHistoryEntry[];
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 120;

/**
 * Renders the complete, chronological on-chain price history of a
 * product as a lightweight, dependency-free responsive SVG line
 * chart (X-axis: date, Y-axis: price). Every price recorded on-chain
 * is plotted — nothing is summarized or dropped — so the chart is a
 * faithful, unalterable visual representation of the immutable price
 * history stored in the smart contract.
 */
export default function PriceHistoryChart({ history }: PriceHistoryChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (history.length === 0) return null;

  const numericHistory = history.map((h) => ({
    price: Number(h.price),
    timestamp: Number(h.timestamp),
  }));

  const geometry = buildPriceChartGeometry(
    numericHistory,
    CHART_WIDTH,
    CHART_HEIGHT,
  );

  const first = numericHistory[0].price;
  const last = numericHistory[numericHistory.length - 1].price;
  const isUp = last >= first;
  const percentChange =
    first === 0 ? 0 : (((last - first) / first) * 100).toFixed(1);

  const hovered =
    hoveredIndex !== null ? geometry.points[hoveredIndex] : undefined;

  const accentClass = isUp ? 'emerald' : 'rose';

  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
      {/* Ambient glow accent behind the chart, colored by trend direction. */}
      <div
        className={`pointer-events-none absolute -bottom-8 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full blur-2xl ${
          isUp ? 'bg-emerald-500/10' : 'bg-rose-500/10'
        }`}
      />

      <div className="relative flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-slate-400">
          <LineChart size={13} className="text-indigo-400" />
          Chronological Price History
        </span>
        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            isUp
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {isUp ? (
            <TrendingUp size={13} strokeWidth={2.5} />
          ) : (
            <TrendingDown size={13} strokeWidth={2.5} />
          )}
          {percentChange}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="relative h-28 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity={0.35}
              className={`text-${accentClass}-500`}
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity={0}
              className={`text-${accentClass}-500`}
            />
          </linearGradient>
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          d={geometry.areaPath}
          fill="url(#priceAreaGradient)"
          stroke="none"
        />

        <polyline
          points={geometry.polylinePoints}
          fill="none"
          strokeWidth={2}
          className={isUp ? 'stroke-emerald-400' : 'stroke-rose-400'}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#lineGlow)"
        />

        {geometry.points.map((point, idx) => (
          <circle
            key={idx}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === idx ? 4.5 : 3}
            className={`cursor-pointer stroke-slate-950 transition-all ${
              isUp ? 'fill-emerald-400' : 'fill-rose-400'
            }`}
            strokeWidth={1.5}
            onMouseEnter={() => setHoveredIndex(idx)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
      </svg>

      <div className="relative flex items-center justify-between text-[11px] text-slate-500">
        <span>{formatShortDate(numericHistory[0].timestamp)}</span>
        {hovered ? (
          <span className="font-semibold text-slate-200">
            {hovered.price} on {formatShortDate(hovered.timestamp)}
          </span>
        ) : (
          <span>
            Min {geometry.minPrice} &middot; Max {geometry.maxPrice}
          </span>
        )}
        <span>
          {formatShortDate(numericHistory[numericHistory.length - 1].timestamp)}
        </span>
      </div>
    </div>
  );
}
