import { useState, useEffect } from 'react';
import { Zap, Key, Activity, ArrowUpRight, Sparkles } from 'lucide-react';
import { api } from '../api';
import { translate as t } from '../i18n';
import type { Language } from '../i18n';

interface DashboardProps {
  lang: Language;
}

export default function Dashboard({ lang }: DashboardProps) {
  const [stats, setStats] = useState<any>({ totalRequests: 0, interceptedRequests: 0, tokens: 0, totalTokens: 0, totalCost: 0 });

  useEffect(() => {
    api.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
    // Poll every 5s
    const interval = setInterval(() => {
      api.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    { label: t('dashboard.stats.total', lang), value: (stats.totalRequests || 0).toLocaleString(), trend: '+0%', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('dashboard.stats.tokens', lang), value: (((stats.tokens || stats.totalTokens || 0) / 1000).toFixed(1)) + 'k', trend: '+0%', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: lang === 'en' ? 'Estimated Cost' : '估算费用 (USD)', value: '$' + (stats.totalCost || 0).toFixed(4), trend: 'USD', icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: t('dashboard.stats.cache', lang), value: (stats.interceptedRequests || 0).toLocaleString(), trend: '0%', icon: Key, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{t('dashboard.title', lang)}</h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">{t('dashboard.desc', lang)}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg shadow-[var(--color-primary)]/20 transition-all cursor-pointer">
          <ArrowUpRight className="w-4 h-4" /> {t('dashboard.export', lang)}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 hover:border-[var(--color-primary)]/30 transition-all duration-300 relative overflow-hidden group">
            <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity ${stat.bg.replace('/10', '')}`}></div>
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold px-2 py-1 bg-[var(--color-bg-base)] border border-[var(--color-border-base)] rounded-lg text-[var(--color-text-secondary)]">
                {stat.trend}
              </span>
            </div>
            
            <div className="relative z-10">
              <div className="text-[28px] font-extrabold text-[var(--color-text-primary)] mb-1 tracking-tight">{stat.value}</div>
              <div className="text-sm font-medium text-[var(--color-text-muted)]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold">{t('dashboard.chart.title', lang)}</h3>
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> OpenAI</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Anthropic</span>
            </div>
          </div>
          <div className="h-[250px] w-full flex items-end justify-between gap-2 opacity-80">
            {[40, 70, 45, 90, 65, 85, 120, 50, 80, 110, 60, 95].map((h, i) => (
              <div key={i} className="w-full flex flex-col gap-1 justify-end h-full group">
                <div className="w-full bg-purple-500/20 group-hover:bg-purple-500/40 transition-colors rounded-t-sm" style={{ height: `${h * 0.4}%` }}></div>
                <div className="w-full bg-blue-500/40 group-hover:bg-blue-500/60 transition-colors rounded-sm" style={{ height: `${h * 0.6}%` }}></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-4">{t('dashboard.logs.title', lang)}</h3>
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
             <p className="text-sm">{t('dashboard.logs.empty', lang)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
