import { useState, useEffect, useRef } from 'react';
import { Zap, Key, Activity, Sparkles, BarChart2, List, Calendar, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { api } from '../api';
import { translate as t } from '../i18n';
import type { Language } from '../i18n';
import * as echarts from 'echarts';

const getTokenValue = (val: any): number => {
  if (typeof val === 'number') return val;
  if (val && typeof val === 'object') return val.total || 0;
  return 0;
};

interface DashboardProps {
  lang: Language;
}

export default function Dashboard({ lang }: DashboardProps) {
  const [stats, setStats] = useState<any>({ totalRequests: 0, interceptedRequests: 0, tokens: 0, totalTokens: 0, totalCost: 0 });
  const [billingData, setBillingData] = useState<any>({});
  const [viewType, setViewType] = useState<'chart' | 'list'>('chart');
  const [timeUnit, setTimeUnit] = useState<'year' | 'month'>('month');
  const [displayMode, setDisplayMode] = useState<'total' | 'single'>('total');
  const [selectedMonth, setSelectedMonth] = useState('2026-06');
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [themeChanged, setThemeChanged] = useState(0);
  const [activeModelIds, setActiveModelIds] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const chartRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, timeUnit]);

  const getTableData = () => {
    const rows: { date: string; model: string; total: number; cached: number; uncached: number }[] = [];
    Object.entries(billingData).forEach(([dateStr, dayData]: any) => {
      const matchesPeriod = timeUnit === 'year'
        ? dateStr.startsWith(selectedMonth.slice(0, 4))
        : dateStr.startsWith(selectedMonth);

      if (matchesPeriod) {
        Object.entries(dayData).forEach(([model, val]: any) => {
          if (activeModelIds.size === 0 || activeModelIds.has(model)) {
            let total = 0;
            let cached = 0;
            let uncached = 0;

            if (typeof val === 'number') {
              total = val;
              cached = 0;
              uncached = val;
            } else if (val && typeof val === 'object') {
              total = val.total || 0;
              cached = val.cached || 0;
              uncached = val.uncached || 0;
            }

            rows.push({ date: dateStr, model, total, cached, uncached });
          }
        });
      }
    });
    return rows;
  };

  const rawTableRows = getTableData();

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const sortedTableRows = [...rawTableRows].sort((a: any, b: any) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
  });

  const totalCount = sortedTableRows.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedRows = sortedTableRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Poll stats and logs
  useEffect(() => {
    const fetchData = () => {
      api.get('/api/stats').then(res => setStats(res.data)).catch(console.error);
      api.get('/api/billing-history').then(res => setBillingData(res.data)).catch(console.error);
      api.get('/api/providers').then(res => {
        const activeIds = new Set<string>();
        res.data.forEach((p: any) => {
          if (p.configured) {
            p.models.forEach((m: any) => {
              activeIds.add(m.id);
            });
          }
        });
        setActiveModelIds(activeIds);
      }).catch(console.error);
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

  // Listen for clicks outside the calendar dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setMonthMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 动态获取有数据的期间列表（月份或年份）
  const getAvailablePeriods = () => {
    const periods = new Set<string>();
    const today = new Date();
    
    if (timeUnit === 'year') {
      periods.add(String(today.getFullYear()));
      periods.add('2026'); // 默认必须有的年份
      Object.keys(billingData).forEach(dateStr => {
        const y = dateStr.slice(0, 4);
        if (y.match(/^\d{4}$/)) {
          periods.add(y);
        }
      });
    } else {
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      periods.add(currentMonthStr);
      periods.add('2026-06'); // 默认必须有的月份
      Object.keys(billingData).forEach(dateStr => {
        const m = dateStr.slice(0, 7);
        if (m.match(/^\d{4}-\d{2}$/)) {
          periods.add(m);
        }
      });
    }
    return Array.from(periods).sort().reverse();
  };

  const handlePeriodSelect = (p: string) => {
    if (timeUnit === 'year') {
      const currentMonthPart = selectedMonth.slice(5, 7) || '06';
      setSelectedMonth(`${p}-${currentMonthPart}`);
    } else {
      setSelectedMonth(p);
    }
    setMonthMenuOpen(false);
  };

  // 根据“年”或“月”维度准备 X 轴数据
  const [yearStr, monthStr] = selectedMonth.split('-');
  const selectedYear = parseInt(yearStr);
  const selectedMonthNum = parseInt(monthStr);

  const getChartXAxis = () => {
    if (timeUnit === 'year') {
      // 显示该年份的 12 个月
      return Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
    } else {
      // 显示该月份的每日日期
      return getDaysInMonth(selectedYear, selectedMonthNum);
    }
  };

  const days = getChartXAxis();

  // Extract all models from data to build series (filtered by active model IDs)
  const allModelsSet = new Set<string>();
  Object.values(billingData).forEach((dayData: any) => {
    Object.keys(dayData).forEach(model => {
      if (activeModelIds.has(model)) {
        allModelsSet.add(model);
      }
    });
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
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#475569';

    if (viewType === 'chart' && chartRef.current) {
      const gridBorderColor = isDark ? '#1f2333' : '#f1f5f9';
      const splitLineColor = isDark ? '#1f2333' : '#f1f5f9';
      const myChart = echarts.init(chartRef.current);

      // Build series data
      const lineSeriesList = modelsList.map((model, idx) => {
        const data = days.map(day => {
          if (timeUnit === 'year') {
            let sum = 0;
            Object.entries(billingData).forEach(([dateStr, dayData]: any) => {
              if (dateStr.startsWith(day)) {
                sum += getTokenValue(dayData[model]);
              }
            });
            return sum;
          } else {
            return getTokenValue(billingData[day]?.[model]);
          }
        });

        const color = getModelColor(model, idx);
        return {
          name: model,
          type: 'line' as const,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          showSymbol: true,
          itemStyle: {
            color: color,
            borderColor: '#ffffff',
            borderWidth: 1.5
          },
          lineStyle: {
            width: 2.5,
            color: color
          },
          data
        };
      });

      const lineData = days.map(day => {
        let sum = 0;
        modelsList.forEach(model => {
          if (timeUnit === 'year') {
            Object.entries(billingData).forEach(([dateStr, dayData]: any) => {
              if (dateStr.startsWith(day)) {
                sum += getTokenValue(dayData[model]);
              }
            });
          } else {
            sum += getTokenValue(billingData[day]?.[model]);
          }
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

      const series = displayMode === 'total' ? [...lineSeriesList, lineSeries] : lineSeriesList;

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
          show: false,
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
            interval: timeUnit === 'year' ? 0 : 2
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
    }
  }, [viewType, billingData, days, displayMode, themeChanged, timeUnit]);

  const handleExport = () => {
    let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 Chinese compatibility
    if (timeUnit === 'year') {
      csvContent += '月份,模型,Tokens\n';
      days.forEach(day => {
        modelsList.forEach(model => {
          let sum = 0;
          Object.entries(billingData).forEach(([dateStr, dayData]: any) => {
            if (dateStr.startsWith(day)) {
              sum += getTokenValue(dayData[model]);
            }
          });
          if (sum > 0) {
            csvContent += `${day},${model},${sum}\n`;
          }
        });
      });
    } else {
      csvContent += '日期,模型,Tokens\n';
      days.forEach(day => {
        modelsList.forEach(model => {
          const val = getTokenValue(billingData[day]?.[model]);
          if (val > 0) {
            csvContent += `${day},${model},${val}\n`;
          }
        });
      });
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orca_billing_${timeUnit === 'year' ? selectedYear : selectedMonth}.csv`);
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
    return acc + Object.values(dayData).reduce((sum: number, val: any) => sum + getTokenValue(val), 0);
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

      <div className="w-full">
        
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl p-6 flex flex-col w-full">
          
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

              <div 
                ref={calendarRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setMonthMenuOpen(!monthMenuOpen);
                }}
                className="flex items-center gap-1.5 bg-[var(--color-bg-sidebar)] border border-[var(--color-border-base)] px-3 py-2 rounded-lg text-xs font-bold text-[var(--color-text-primary)] shadow-sm select-none cursor-pointer relative"
              >
                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                <span>{timeUnit === 'year' ? selectedMonth.slice(0, 4) : selectedMonth}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />

                {monthMenuOpen && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-full right-0 mt-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-50 w-36 py-1 max-h-48 overflow-y-auto"
                  >
                    {getAvailablePeriods().map(p => {
                      const isSelected = (timeUnit === 'year' ? selectedMonth.startsWith(p) : selectedMonth === p);
                      return (
                        <div 
                          key={p}
                          onClick={() => handlePeriodSelect(p)}
                          className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer flex justify-between items-center transition-colors ${
                            isSelected ? 'bg-[var(--color-bg-hover)] font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'
                          }`}
                        >
                          <span>{p}</span>
                          {isSelected && <span className="text-[var(--color-primary)] font-bold">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
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

          <div className="w-full relative mt-4">
            {viewType === 'chart' ? (
              <div ref={chartRef} className="w-full h-[400px]" />
            ) : (
              <div className="w-full flex flex-col">
                <div className="overflow-x-auto border border-[var(--color-border-base)] rounded-xl bg-[var(--color-bg-card)] max-h-[400px] overflow-y-auto relative">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xs font-bold text-[var(--color-text-secondary)] select-none">
                        <th className="p-4 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors sticky top-0 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-base)] z-10" onClick={() => handleSort('date')}>
                          <div className="flex items-center gap-1">
                            日期
                            <span className="text-gray-400">
                              {sortField === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors sticky top-0 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-base)] z-10" onClick={() => handleSort('model')}>
                          <div className="flex items-center gap-1">
                            模型
                            <span className="text-gray-400">
                              {sortField === 'model' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors sticky top-0 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-base)] z-10" onClick={() => handleSort('total')}>
                          <div className="flex items-center gap-1">
                            总 Token 数
                            <span className="text-gray-400">
                              {sortField === 'total' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors sticky top-0 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-base)] z-10" onClick={() => handleSort('cached')}>
                          <div className="flex items-center gap-1">
                            输入 (命中缓存) Token 数
                            <span className="text-gray-400">
                              {sortField === 'cached' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                        <th className="p-4 cursor-pointer hover:bg-[var(--color-bg-hover)] transition-colors sticky top-0 bg-[var(--color-bg-sidebar)] border-b border-[var(--color-border-base)] z-10" onClick={() => handleSort('uncached')}>
                          <div className="flex items-center gap-1">
                            输入 (未命中缓存) Token 数
                            <span className="text-gray-400">
                              {sortField === 'uncached' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </span>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border-base)]/50 text-[13px] font-medium text-[var(--color-text-primary)]">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-[var(--color-text-muted)]">
                            暂无消耗记录
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[var(--color-bg-hover)]/30 transition-colors">
                            <td className="p-4 font-mono">{row.date}</td>
                            <td className="p-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--color-bg-sidebar)] border border-[var(--color-border-base)]">
                                {row.model}
                              </span>
                            </td>
                            <td className="p-4 font-mono font-bold text-blue-600 dark:text-blue-400">{row.total.toLocaleString()}</td>
                            <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400">{row.cached.toLocaleString()}</td>
                            <td className="p-4 font-mono text-amber-600 dark:text-amber-400">{row.uncached.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
 
                {/* 分页控制栏 */}
                {totalCount > 0 && (
                  <div className="flex items-center justify-between mt-4 px-1 select-none text-xs font-bold text-[var(--color-text-secondary)] font-sans">
                    <div>
                      共 {totalCount} 条
                    </div>
                    <div className="flex items-center gap-4">
                      {/* 页码选择 */}
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          className="p-1.5 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-base)] disabled:hover:text-[var(--color-text-secondary)] cursor-pointer"
                        >
                          &lt;
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`w-7 h-7 rounded-lg border text-center flex items-center justify-center cursor-pointer transition-all ${
                              currentPage === p
                                ? 'bg-blue-500 border-blue-500 text-white shadow-sm font-bold'
                                : 'border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          className="p-1.5 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border-base)] disabled:hover:text-[var(--color-text-secondary)] cursor-pointer"
                        >
                          &gt;
                        </button>
                      </div>
 
                      {/* 每页数量选择 */}
                      <div className="relative flex items-center">
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="appearance-none bg-[var(--color-bg-card)] dark:bg-slate-900 border border-[var(--color-border-base)] rounded-lg pl-3 pr-8 py-1.5 font-bold text-[var(--color-text-primary)] cursor-pointer focus:outline-none hover:border-[var(--color-primary)] transition-all"
                        >
                          <option value={5} className="dark:bg-slate-900">5 条/页</option>
                          <option value={10} className="dark:bg-slate-900">10 条/页</option>
                          <option value={20} className="dark:bg-slate-900">20 条/页</option>
                          <option value={50} className="dark:bg-slate-900">50 条/页</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
