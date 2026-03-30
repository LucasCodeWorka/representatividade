'use client';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'rose';
  icon?: 'box' | 'chart' | 'money' | 'warning' | 'check';
  compact?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    light: 'bg-blue-50',
  },
  green: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-600',
    light: 'bg-emerald-50',
  },
  yellow: {
    bg: 'bg-amber-500',
    text: 'text-amber-600',
    light: 'bg-amber-50',
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    light: 'bg-red-50',
  },
  rose: {
    bg: 'bg-rose-500',
    text: 'text-rose-600',
    light: 'bg-rose-50',
  },
};

const icons = {
  box: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  money: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function MetricCard({ title, value, subtitle, color = 'blue', icon, compact = false }: MetricCardProps) {
  const colors = colorClasses[color];

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${compact ? 'p-2.5' : 'p-3'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-medium text-gray-500 uppercase tracking-wide leading-tight`}>{title}</p>
          <p className={`${compact ? 'text-base md:text-lg xl:text-xl' : 'text-lg md:text-xl xl:text-[22px]'} font-bold mt-1 leading-tight break-words ${colors.text}`}>{value}</p>
          {subtitle && <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-gray-400 mt-1 leading-snug break-words`}>{subtitle}</p>}
        </div>
        {icon && (
          <div className={`${colors.bg} ${compact ? 'p-1' : 'p-1.5'} rounded-lg text-white shrink-0`}>
            <div className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}>
              {icons[icon]}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
