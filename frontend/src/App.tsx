import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { api } from './api';
import { LayoutDashboard, MessageSquare, MonitorPlay, Box, Settings, Activity, Sun, Moon, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { translate as t, getLanguage } from './i18n';
import type { Language } from './i18n';

import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Apps from './pages/Apps';
import Providers from './pages/Providers';
import SettingsPage from './pages/Settings';
import Logs from './pages/Logs';

function Sidebar({ 
  isDark, 
  toggleTheme, 
  lang,
  isCollapsed,
  toggleCollapse
}: { 
  isDark: boolean, 
  toggleTheme: () => void, 
  lang: Language,
  isCollapsed: boolean,
  toggleCollapse: () => void
}) {
  const navItems = [
    { name: t('menu.dashboard', lang), path: '/dashboard', icon: LayoutDashboard },
    { name: t('menu.chat', lang), path: '/chat', icon: MessageSquare },
    { name: t('menu.apps', lang), path: '/apps', icon: MonitorPlay },
    { name: t('menu.providers', lang), path: '/providers', icon: Box },
    { name: t('menu.settings', lang), path: '/settings', icon: Settings },
    { name: t('menu.logs', lang), path: '/logs', icon: Activity },
  ];

  return (
    <div className={`h-screen bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-base)] flex flex-col fixed left-0 top-0 transition-all duration-300 z-50 ${
      isCollapsed ? 'w-[72px]' : 'w-[240px]'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b border-[var(--color-border-base)] flex items-center justify-between gap-2 ${
        isCollapsed ? 'flex-col py-6' : 'flex-row'
      }`}>
        {!isCollapsed ? (
          <div>
            <h1 className="text-xl font-extrabold text-[var(--color-primary)] flex items-center gap-2 tracking-tight">
              <Box className="w-6 h-6 shrink-0" /> Orca
            </h1>
            <div className="text-xs text-[var(--color-text-muted)] mt-1.5 font-medium">Universal Proxy v2.1.0</div>
          </div>
        ) : (
          <Box className="w-6 h-6 text-[var(--color-primary)]" />
        )}
        <button 
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg border border-[var(--color-border-base)] bg-[var(--color-bg-base)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all cursor-pointer ${
            isCollapsed ? 'mt-2' : ''
          }`}
          title={isCollapsed ? (lang === 'en' ? 'Expand' : '展开') : (lang === 'en' ? 'Collapse' : '收起')}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold px-3 mb-3">
            Menu
          </div>
        )}
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isCollapsed ? 'justify-center p-2.5 w-10 h-10 mx-auto' : 'gap-3 px-3 py-2.5'
              } ${
                isActive 
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold shadow-sm' 
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`
            }
            title={isCollapsed ? item.name : undefined}
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </div>
      
      {/* Bottom Settings & Status */}
      <div className="p-4 border-t border-[var(--color-border-base)] space-y-3">
        <button 
          onClick={toggleTheme}
          className={`flex items-center rounded-xl text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-all duration-200 ${
            isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'w-full justify-between px-3 py-2.5'
          }`}
          title={isCollapsed ? (lang === 'en' ? 'Toggle theme' : '切换主题') : undefined}
        >
          {isCollapsed ? (
            isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
                <span>{t('sidebar.appearance', lang)}</span>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-base)] px-2 py-0.5 rounded-md border border-[var(--color-border-base)]">
                {isDark ? 'DARK' : 'LIGHT'}
              </div>
            </>
          )}
        </button>

        <div 
          className={`flex items-center rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border-base)] ${
            isCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'px-3 py-2 gap-2.5'
          }`}
          title={isCollapsed ? (lang === 'en' ? 'Service Running' : '服务运行中') : undefined}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse shrink-0"></span>
          {!isCollapsed && (
            <span className="text-xs font-semibold text-green-600 dark:text-green-400">
              {t('sidebar.running', lang)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [lang, setLang] = useState<Language>(getLanguage);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('orca_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('orca_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      api.post('/api/theme', { theme: 'dark' }).catch(() => {});
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      api.post('/api/theme', { theme: 'light' }).catch(() => {});
    }
  }, [isDark]);

  useEffect(() => {
    api.get('/api/config').then(res => {
      if (res.data && res.data.language) {
        const backendLang = res.data.language;
        if (backendLang === 'en' || backendLang === 'zh') {
          setLang(backendLang);
          localStorage.setItem('language', backendLang);
        }
      }
    }).catch(console.error);
  }, []);

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-[var(--color-bg-base)] transition-colors duration-300">
        <Sidebar 
          isDark={isDark} 
          toggleTheme={() => setIsDark(!isDark)} 
          lang={lang} 
          isCollapsed={isCollapsed}
          toggleCollapse={toggleCollapse}
        />
        <main className={`flex-1 px-10 py-8 text-[var(--color-text-primary)] min-h-screen transition-all duration-300 ${
          isCollapsed ? 'ml-[72px]' : 'ml-[240px]'
        }`}>
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/dashboard" element={<Dashboard lang={lang} />} />
            <Route path="/chat" element={<Chat lang={lang} />} />
            <Route path="/apps" element={<Apps lang={lang} />} />
            <Route path="/providers" element={<Providers lang={lang} />} />
            <Route path="/settings" element={<SettingsPage lang={lang} setLang={setLang} />} />
            <Route path="/logs" element={<Logs lang={lang} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
