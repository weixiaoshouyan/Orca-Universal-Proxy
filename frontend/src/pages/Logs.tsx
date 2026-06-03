import { useState, useEffect } from 'react';
import { TerminalSquare, RefreshCcw, Trash2 } from 'lucide-react';
import { api } from '../api';

export default function Logs() {
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = () => {
    api.get('/api/logs').then(res => setLogs(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchLogs();
    let interval: any;
    if (autoRefresh) {
      interval = setInterval(fetchLogs, 3000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const clearLogs = () => {
    api.delete('/api/logs').then(() => setLogs([])).catch(console.error);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-5xl mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="mb-6 flex items-end justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">请求日志 (Logs)</h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">实时监控 Orca 代理网关的所有 HTTP 请求流向及底层错误。</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] font-medium cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]" />
            自动刷新
          </label>
          <div className="w-px h-6 bg-[var(--color-border-base)] mx-1"></div>
          <button onClick={fetchLogs} className="p-2 border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] rounded-xl text-[var(--color-text-secondary)] transition-colors" title="刷新">
            <RefreshCcw className="w-4 h-4" />
          </button>
          <button onClick={clearLogs} className="p-2 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 rounded-xl text-red-500 transition-colors" title="清空日志">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#0d1117] dark:bg-[#090b10] border border-[var(--color-border-base)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#161b22] dark:bg-[#0d1117]">
          <TerminalSquare className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-mono text-gray-400">orca-gateway-v2.log</span>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed">
          {logs.length === 0 ? (
            <div className="text-gray-500 italic flex h-full items-center justify-center">暂无日志数据...</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => {
                let colorClass = 'text-gray-300';
                if (log.includes('[ERROR]')) colorClass = 'text-red-400 font-bold';
                else if (log.includes('[WARN]')) colorClass = 'text-yellow-400 font-bold';
                else if (log.includes('[INFO]')) colorClass = 'text-blue-300';
                
                return (
                  <div key={i} className={`whitespace-pre-wrap break-all ${colorClass}`}>
                    {log}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
