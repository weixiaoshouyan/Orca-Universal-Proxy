import { useState, useEffect } from 'react';
import { Save, RefreshCw, Check } from 'lucide-react';
import { api } from '../api';

export default function Settings() {
  const [config, setConfig] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/api/config').then(res => setConfig(res.data)).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await api.post('/api/config', config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) return <div className="p-8 text-[var(--color-text-muted)] animate-pulse">正在加载配置...</div>;

  return (
    <div className="animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">设置</h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">配置 Orca 代理服务器的全局运行参数。</p>
      </div>

      <div className="space-y-6">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-[var(--color-border-base)] bg-[var(--color-bg-base)]/50">
            <h3 className="text-lg font-bold">基础设置 (General)</h3>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">本地监听端口 (Port)</label>
              <input 
                type="number" 
                value={config.port}
                onChange={e => setConfig({...config, port: parseInt(e.target.value)})}
                className="w-full max-w-xs px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <p className="text-xs text-[var(--color-text-muted)] mt-2">Orca 后台代理服务所监听的本地端口，默认 18080。修改后需重启应用。</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-2">日志级别 (Log Level)</label>
              <select 
                value={config.logLevel}
                onChange={e => setConfig({...config, logLevel: e.target.value})}
                className="w-full max-w-xs px-4 py-2 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-xl outline-none focus:border-[var(--color-primary)] transition-colors appearance-none"
              >
                <option value="debug">Debug (调试，非常详细)</option>
                <option value="info">Info (常规，推荐)</option>
                <option value="warn">Warn (警告)</option>
                <option value="error">Error (仅错误)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border-base)]">
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={config.autoStart || false}
                  onChange={e => setConfig({...config, autoStart: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:bg-gray-700 peer-checked:bg-[var(--color-primary)]"></div>
              </label>
              <span className="text-sm font-semibold">开机自动启动 (未实现)</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <button 
            onClick={() => api.get('/api/config').then(res => setConfig(res.data))}
            className="px-6 py-2.5 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-sm font-bold text-[var(--color-text-secondary)] transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> 撤销更改
          </button>
          
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2 shadow-sm ${
              saved ? 'bg-green-600 shadow-green-600/20' : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] shadow-[var(--color-primary)]/20'
            } disabled:opacity-50`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? '保存成功' : (isSaving ? '保存中...' : '保存配置')}
          </button>
        </div>
      </div>
    </div>
  );
}
