import { useState, useEffect, useRef } from 'react';
import { Zap, Key, Activity, Sparkles, BarChart2, List, Calendar, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { api } from '../api';
import { translate as t } from '../i18n';
import type { Language } from '../i18n';
import * as echarts from 'echarts';

interface DashboardProps {
  lang: Language;
}

export default function Dashboard({ lang }: DashboardProps) {
  const [stats, setStats] = useState<any>({ totalRequests: 0, interceptedRequests: 0, tokens: 0, totalTokens: 0, totalCost: 0 });
  const [billingData, setBillingData] = useState<any>({});
  const [viewType, setViewType] = useState<'chart' | 'list'>('chart');
  const [timeUnit, setTimeUnit] = useState<'year' | 'month'>('month');
  const [displayMode, setDisplayMode] = useState<'total' | 'single'>('total');
  const [selectedMonth] = useState('2026-06');
  const [logs, setLogs] = useState<any[]>([]);
  const [themeChanged, setThemeChanged] = useState(0);

  const chartRef = useRef<HTMLDivElement>(null);

  // Poll stats and logs
  useEffect(() => {
    const fetchData = () => {
      api.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
      api.get('/api/billing-history').then(res => setBillingData(res.data)).catch(console.error);
      api.get('/api/logs?limit=5').then(res => setLogs(res.data)).catch(console.error);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen to theme changes to redraw ECharts
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeChanged(prev => prev + 1);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Prepare chart data
  const [yearStr, monthStr] = selectedMonth.split('-');
  const days = getDaysInMonth(parseInt(yearStr), parseInt(monthStr));

  // Extract all models from data to build series
  const allModelsSet = new Set<string>();
  Object.values(billingData).forEach((dayData: any) => {
    Object.keys(dayData).forEach(model => allModelsSet.add(model));
  });
  const modelsList = Array.from(allModelsSet);

  // Default color palette for models (sleek HSL hues)
  const modelColors: Record<string, string> = {
    'mimo-v2.5': '#14b8a6', // Teal
    'mimo-v2.5-pro': '#3b82f6', // Blue
    'mimo-v2-omni': '#06b6d4', // Cyan
    'deepseek-chat': '#8b5cf6', // Violet
    'deepseek-coder': '#ec4899', // Pink
    'gpt-4o': '#f59e0b', // Amber
    'claude-3-5-sonnet': '#ef4444', // Red
  };

  const getModelColor = (model: string, index: number) => {
    if (modelColors[model]) return modelColors[model];
    // fallback color based on index
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#38bdf8', '#a855f7'];
    return colors[index % colors.length];
  };

  useEffect(() => {
    if (viewType !== 'chart' || !chartRef.current) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#475569';
    const gridBorderColor = isDark ? '#1f2333' : '#f1f5f9';
    const splitLineColor = isDark ? '#1f2333' : '#f1f5f9';

    const myChart = echarts.init(chartRef.current);

    // Build series data
    const barSeries = modelsList.map((model, idx) => {
      const data = days.map(day => {
        return billingData[day]?.[model] || 0;
      });
      return {
        name: model,
        type: 'bar' as const,
        barWidth: '35%',
        itemStyle: {
          color: getModelColor(model, idx),
          borderRadius: [4, 4, 0, 0]
        },
        data
      };
    });

    const lineData = days.map(day => {
      let sum = 0;
      modelsList.forEach(model => {
        sum += (billingData[day]?.[model] || 0);
      });
      return sum;
    });

    const lineSeries = {
      name: 'Token 总消耗',
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 8,
      showSymbol: true,
      itemStyle: {
        color: '#3b82f6',
        borderColor: '#ffffff',
        borderWidth: 2
      },
      lineStyle: {
        width: 3,
        color: '#3b82f6',
        shadowColor: 'rgba(59, 130, 246, 0.3)',
        shadowBlur: 8,
        shadowOffsetY: 4
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(59, 130, 246, 0.15)' },
          { offset: 1, color: 'rgba(59, 130, 246, 0)' }
        ])
      },
      data: lineData
    };

    const series = displayMode === 'total' ? [...barSeries, lineSeries] : barSeries;

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        backgroundColor: isDark ? '#151824' : '#ffffff',
        borderColor: isDark ? '#1f2333' : '#e2e8f0',
        borderWidth: 1,
        textStyle: {
          color: isDark ? '#f8fafc' : '#0f172a',
          fontFamily: 'system-ui',
          fontSize: 12
        },
        formatter: (params: any) => {
          let date = params[0].axisValue;
          let tooltipHtml = `<div style="font-weight: 700; margin-bottom: 8px; font-size: 13px; color: ${isDark ? '#f8fafc' : '#0f172a'};">${date}</div>`;
          
          const lineItem = params.find((p: any) => p.seriesName === 'Token 总消耗');
          const barItems = params.filter((p: any) => p.seriesName !== 'Token 总消耗');
          
          const sortedParams = [];
          if (lineItem && displayMode === 'total') {
            sortedParams.push(lineItem);
          }
          sortedParams.push(...barItems);
          
          sortedParams.forEach((item: any) => {
            const val = item.value || 0;
            const color = item.color;
            tooltipHtml += `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 4px; font-size: 12px;">
                <span style="display: flex; align-items: center; gap: 6px; color: ${isDark ? '#94a3b8' : '#475569'};">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${color};"></span>
                  ${item.seriesName}
                </span>
                <span style="font-weight: 700; color: ${isDark ? '#f8fafc' : '#0f172a'}; font-family: monospace;">${val.toLocaleString()}</span>
              </div>
            `;
          });
          
          return tooltipHtml;
        }
      },
      legend: {
        show: true,
        top: '2%',
        left: 'center',
        textStyle: {
          color: textColor,
          fontSize: 11,
          fontFamily: 'system-ui'
        },
        itemGap: 16
      },
      grid: {
        top: '15%',
        left: '2%',
        right: '2%',
        bottom: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: days,
        axisLine: {
          lineStyle: {
            color: gridBorderColor
          }
        },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'monospace',
          interval: 2
        },
        axisTick: {
          show: false
        }
      },
      yAxis: {
        type: 'value',
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed'
          }
        },
        axisLabel: {
          color: textColor,
          fontSize: 10,
          fontFamily: 'monospace',
          formatter: (value: number) => {
            if (value === 0) return '0';
            return (value / 1000) + 'k';
          }
        }
      },
      series
    };

    myChart.setOption(option);

    const handleResize = () => myChart.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      myChart.dispose();
    };
  }, [viewType, billingData, days, displayMode, themeChanged]);

  const handleExport = () => {
    let csvContent = 'data:text/csv;charset=utf-8,Date,Model,Tokens\n';
    Object.entries(billingData).forEach(([date, dayData]: any) => {
      Object.entries(dayData).forEach(([model, val]: any) => {
        csvContent += `${date},${model},${val}\n`;
      });
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `orca_billing_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function getDaysInMonth(year: number, month: number) {
    const date = new Date(year, month - 1, 1);
    const daysList: string[] = [];
    while (date.getMonth() === month - 1) {
      const dStr = `${year}-${String(month).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      daysList.push(dStr);
      date.setDate(date.getDate() + 1);
    }
    return daysList;
  }

  const overallTotalTokens = Object.values(billingData).reduce((acc: number, dayData: any) => {
    return acc + Object.values(dayData).reduce((sum: number, val: any) => sum + (val || 0), 0);
  }, 0);

  const statCards = [
    { label: t('dashboard.stats.total', lang), value: (stats.totalRequests || 0).toLocaleString(), trend: '+0%', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('dashboard.stats.tokens', lang), value: (overallTotalTokens || stats.totalTokens || 0).toLocaleString() + ' Tokens', trend: 'Total', icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { label: lang === 'en' ? 'Estimated Cost' : '估算费用 (USD)', value: '$' + (stats.totalCost || 0).toFixed(4), trend: 'USD', icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: t('dashboard.stats.cache', lang), value: (stats.interceptedRequests || 0).toLocaleString(), trend: '0%', icon: Key, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out max-w-6xl mx-auto p-1">
      
      <div className="flex items-end justify-between mb-8 select-none">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{t('dashboard.title', lang)}</h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">{t('dashboard.desc', lang)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 select-none">
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
              <div className="text-[22px] font-extrabold text-[var(--color-text-primary)] mb-1 tracking-tight truncate" title={stat.value}>{stat.value}</div>
              <div className="text-xs font-medium text-[var(--color-text-muted)]">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl p-6 flex flex-col">
          
          <div className="flex items-center justify-between mb-4 select-none">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-[var(--color-text-primary)]">
                {displayMode === 'total' ? 'Token 总消耗' : '单模型 Token 消耗'}
              </span>
              <span className="text-gray-300 dark:text-gray-700 text-sm">|</span>
              <span className="text-[14px] font-semibold text-gray-500 dark:text-gray-400">
                {(overallTotalTokens || stats.totalTokens || 0).toLocaleString()} Tokens
              </span>
            </div>

            <div className="flex items-center gap-3">
              
              <div className="flex bg-[var(--color-bg-sidebar)] p-1 rounded-lg border border-[var(--color-border-base)] text-xs font-bold">
                <button 
                  onClick={() => setTimeUnit('year')}
                  className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${timeUnit === 'year' ? 'bg-white dark:bg-slate-900 shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                >
                  年
                </button>
                <button 
                  onClick={() => setTimeUnit('month')}
                  className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${timeUnit === 'month' ? 'bg-white dark:bg-slate-900 shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                >
                  月
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-base)] px-3 py-2 rounded-lg text-xs font-bold text-[var(--color-text-primary)] shadow-sm select-none cursor-pointer">
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                <span>{selectedMonth}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </div>

              <div className="flex bg-[var(--color-bg-sidebar)] p-1 rounded-lg border border-[var(--color-border-base)] text-xs font-bold">
                <button 
                  onClick={() => setViewType('chart')}
                  className={`p-1.5 rounded-md cursor-pointer transition-all ${viewType === 'chart' ? 'bg-white dark:bg-slate-900 shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                  title="图表视图"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setViewType('list')}
                  className={`p-1.5 rounded-md cursor-pointer transition-all ${viewType === 'list' ? 'bg-white dark:bg-slate-900 shadow-sm text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                  title="列表视图"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              <button 
                onClick={handleExport}
                className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-[var(--color-border-base)] px-3 py-2 rounded-lg text-xs font-bold text-[var(--color-text-primary)] shadow-sm hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer"
                title="导出数据为 CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>导出</span>
              </button>

            </div>
          </div>

          <div className="flex items-center gap-2 mb-6 select-none border-b border-[var(--color-border-base)]/55 pb-3">
            <button 
              onClick={() => setDisplayMode('total')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all border cursor-pointer ${
                displayMode === 'total' 
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' 
                  : 'bg-transparent border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Token 总消耗
            </button>
            <button 
              onClick={() => setDisplayMode('single')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all border cursor-pointer ${
                displayMode === 'single' 
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' 
                  : 'bg-transparent border-[var(--color-border-base)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              单模型 Token 消耗
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-[var(--color-text-secondary)] mb-6 select-none">
            {displayMode === 'total' && (
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Token 总消耗</span>
            )}
            {modelsList.map((model, idx) => (
              <span key={model} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getModelColor(model, idx) }}></span>
                {model}
              </span>
            ))}
          </div>

          <div className="flex-1 min-h-[300px] w-full relative">
            {viewType === 'chart' ? (
              <div ref={chartRef} className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="absolute inset-0 w-full h-full overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border-base)] text-[var(--color-text-muted)] font-bold">
                      <th className="py-2.5 px-3">日期</th>
                      {modelsList.map(model => (
                        <th key={model} className="py-2.5 px-3">{model}</th>
                      ))}
                      {displayMode === 'total' && <th className="py-2.5 px-3 text-right">总计</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {days.map(day => {
                      let dayTotal = 0;
                      let hasData = false;
                      const modelVals = modelsList.map(model => {
                        const val = billingData[day]?.[model] || 0;
                        if (val > 0) hasData = true;
                        dayTotal += val;
                        return val;
                      });

                      if (!hasData) return null;

                      return (
                        <tr key={day} className="border-b border-[var(--color-border-base)]/50 hover:bg-[var(--color-bg-hover)]/30 text-[var(--color-text-primary)] font-medium">
                          <td className="py-2.5 px-3 font-mono">{day}</td>
                          {modelVals.map((val, idx) => (
                            <td key={idx} className="py-2.5 px-3">{val > 0 ? val.toLocaleString() : '-'}</td>
                          ))}
                          {displayMode === 'total' && <td className="py-2.5 px-3 text-right font-extrabold text-blue-600 dark:text-blue-400">{dayTotal.toLocaleString()}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl p-6 flex flex-col min-h-[400px]">
          <h3 className="text-lg font-bold mb-4 select-none">{t('dashboard.logs.title', lang)}</h3>
          
          {logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-muted)] select-none">
              <p className="text-sm">{t('dashboard.logs.empty', lang)}</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
              {logs.map((logItem, idx) => (
                <div key={idx} className="p-3 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-base)] rounded-xl flex flex-col gap-1 shadow-sm font-mono text-[11px]">
                  <div className="flex justify-between items-center text-[var(--color-text-muted)]">
                    <span className="font-bold">{logItem.time?.slice(11, 19) || ''}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      logItem.level === 'error' ? 'bg-red-500/10 text-red-500' : (logItem.level === 'warn' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500')
                    }`}>{logItem.level}</span>
                  </div>
                  <div className="text-[var(--color-text-primary)] leading-normal break-all font-medium">{logItem.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
