import { useState, useEffect } from 'react';
import { Terminal, Monitor, Code2, CheckCircle2, PlayCircle, Settings, Power } from 'lucide-react';
import { api } from '../api';

export default function Apps() {
  const [apps, setApps] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/apps').then(res => {
      // res.data is an array of apps from the backend
      const mappedApps = res.data.map((app: any) => ({
        ...app,
        icon: app.id === 'claude' ? Monitor : (app.id === 'cursor' ? Code2 : Terminal),
        color: app.id === 'claude' ? 'bg-orange-500' : (app.id === 'cursor' ? 'bg-blue-600' : 'bg-green-500')
      }));
      setApps(mappedApps);
    }).catch(console.error);
  }, []);

  const handleLaunch = async (id: string) => {
    try {
      await api.post(`/api/apps/${id}/launch`);
      alert(`成功唤醒 ${id}！已自动注入代理环境。`);
    } catch (e: any) {
      alert(`唤醒失败: ${e.response?.data?.error || e.message}`);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">应用管理 (Apps)</h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">自动扫描并接管您电脑上的本地 AI 工具，实现真正的零配置使用。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps.map((app, i) => (
          <div key={i} className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl overflow-hidden group hover:border-[var(--color-primary)]/40 transition-colors flex flex-col">
            <div className="p-6 pb-5 flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${app.color}`}>
                  <app.icon className="w-6 h-6" />
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                  app.status === 'ready' 
                    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' 
                    : 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border-base)]'
                }`}>
                  {app.status === 'ready' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {app.status === 'ready' ? '已接管' : '未安装'}
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{app.name}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed h-[60px]">{app.description}</p>
              
              <div className="mt-4 p-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border-base)]/50">
                <div className="text-xs text-[var(--color-text-muted)] font-semibold mb-1">接管路径 / 配置项</div>
                <code className="text-[11px] font-mono text-[var(--color-text-primary)] break-all">{app.configTarget}</code>
              </div>
            </div>
            
            <div className="border-t border-[var(--color-border-base)] bg-[var(--color-bg-base)]/50 p-4 flex gap-3">
              <button 
                onClick={() => handleLaunch(app.id)}
                disabled={app.status !== 'ready'}
                className="flex-1 flex items-center justify-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-gray-500 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm shadow-[var(--color-primary)]/20"
              >
                <PlayCircle className="w-4 h-4" /> 启动应用
              </button>
              <button className="p-2 border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] rounded-xl text-[var(--color-text-secondary)] transition-colors" title="配置">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
