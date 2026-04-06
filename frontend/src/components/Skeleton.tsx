import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, className = '' }: SkeletonProps) {
  return (
    <div 
      className={`skeleton-shimmer ${className}`} 
      style={{ width, height, borderRadius }} 
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white dark:bg-[#FFFFFF] border border-slate-200 dark:border-[#F4C4B0] rounded-xl p-5 shadow-sm space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={14} />
      ))}
    </div>
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-white dark:bg-[#FFFFFF] rounded-xl border border-slate-200 dark:border-[#F4C4B0] p-5 shadow-sm chart-card">
      <Skeleton width={40} height={40} borderRadius="50%" className="mb-3" />
      <Skeleton width={60} height={28} className="mb-2" />
      <Skeleton width={120} height={12} />
    </div>
  );
}

export function SkeletonChart({ height = 180 }: { height?: number }) {
  return (
    <div className="bg-white dark:bg-[#FFFFFF] rounded-xl border border-slate-200 dark:border-[#F4C4B0] p-5 shadow-sm flex flex-col h-full w-full">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton width={14} height={14} borderRadius="50%" />
        <Skeleton width={120} height={14} />
      </div>
      <div className="flex-1 rounded-lg overflow-hidden">
        <Skeleton width="100%" height={height} borderRadius={8} />
      </div>
    </div>
  );
}

export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-[#FFF2EC] px-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} width={`${100 / cols}%`} height={12} />
      ))}
    </div>
  );
}
