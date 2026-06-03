import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, MonitorPlay, Box, Settings, Activity, Sun, Moon } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Apps from './pages/Apps';
import Providers from './pages/Providers';
import SettingsPage from './pages/Settings';
import Logs from './pages/Logs';

function Sidebar({ isDark, toggleTheme }: { isDark: boolean, toggleTheme: () => void }) {
  const navItems = [
    { name: '仪表盘', path: '/dashboard', icon: LayoutDashboard },
    { name: '聊天', path: '/chat', icon: MessageSquare },
    { name: '应用管理', path: '/apps', icon: MonitorPlay },
    { name: '模型提供商', path: '/providers', icon: Box },
    { name: '设置', path: '/settings', icon: Settings },
    { name: '请求日志', path: '/logs', icon: Activity },
  ];

  return (
    <div className="w-[240px] h-screen bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border-base)] flex flex-col fixed left-0 top-0 transition-colors duration-300 z-50">
      {/* Header */}
      <div className="p-6 pb-5 border-b border-[var(--color-border-base)]">
        <h1 className="text-xl font-extrabold text-[var(--color-primary)] flex items-center gap-2 tracking-tight">
          <Box className="w-6 h-6" /> Orca
        </h1>
        <div className="text-xs text-[var(--color-text-muted)] mt-1.5 font-medium">Universal Proxy v2.1.0</div>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-bold px-3 mb-3">Menu</div>
        {navItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive 
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-semibold shadow-sm' 
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            {item.name}
          </NavLink>
        ))}
      </div>
      
      {/* Bottom Settings & Status */}
      <div className="p-4 border-t border-[var(--color-border-base)] space-y-3">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
            <span>外观模式</span>
          </div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-bg-base)] px-2 py-0.5 rounded-md border border-[var(--color-border-base)]">
            {isDark ? 'DARK' : 'LIGHT'}
          </div>
        </button>

        <div className="px-3 py-2 flex items-center gap-2.5 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border-base)]">
          <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse"></span>
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">服务运行中</span>
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

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-[var(--color-bg-base)] transition-colors duration-300">
        <Sidebar isDark={isDark} toggleTheme={() => setIsDark(!isDark)} />
        <main className="ml-[240px] flex-1 px-10 py-8 text-[var(--color-text-primary)] min-h-screen max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/providers" element={<Providers />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/logs" element={<Logs />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
