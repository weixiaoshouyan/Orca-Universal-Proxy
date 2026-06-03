import { Network, Plus, Search, MoreHorizontal, AlertCircle } from 'lucide-react';

export default function Providers() {
  const providers = [
    { id: 'mimo', name: '小米 TokenPlan', type: 'OpenAI Compatible', status: 'Active', latency: '45ms' },
    { id: 'anthropic', name: 'Anthropic Official', type: 'Anthropic API', status: 'Standby', latency: '120ms' },
    { id: 'local', name: 'Ollama 本地', type: 'Local Runtime', status: 'Offline', latency: '-' },
  ];

  const rules = [
    { pattern: '^claude-*', provider: 'Anthropic Official', priority: 1, active: true },
    { pattern: '.*', provider: '小米 TokenPlan', priority: 100, active: true },
  ];

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">模型与路由 (Providers)</h2>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-1.5">配置上游 API 供应商及大模型智能分流规则。</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-sm font-medium rounded-xl hover:bg-[var(--color-primary-hover)] shadow-sm transition-all">
          <Plus className="w-4 h-4" /> 新增供应商
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Providers List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Network className="w-5 h-5 text-[var(--color-primary)]" />
            已配置的节点
          </h3>
          
          <div className="space-y-3">
            {providers.map((p, i) => (
              <div key={i} className={`p-4 rounded-2xl border transition-all ${
                p.status === 'Active' 
                  ? 'bg-[var(--color-bg-base)] border-[var(--color-primary)]/50 shadow-[0_0_15px_rgba(34,197,94,0.05)] relative overflow-hidden' 
                  : 'bg-[var(--color-bg-card)] border-[var(--color-border-base)] hover:border-[var(--color-text-muted)]'
              }`}>
                {p.status === 'Active' && <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-primary)]"></div>}
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-[var(--color-text-primary)]">{p.name}</h4>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                    p.status === 'Active' ? 'bg-green-500/10 text-green-500' :
                    p.status === 'Standby' ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-500'
                  }`}>
                    {p.status}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mb-3">{p.type}</div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border-base)] pt-3 mt-1">
                  <span>延迟: {p.latency}</span>
                  <button className="hover:text-[var(--color-primary)] transition-colors">编辑</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Routing Rules */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--color-border-base)] flex items-center justify-between bg-[var(--color-bg-base)]/50">
              <h3 className="text-lg font-bold">智能路由规则 (Routing Rules)</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input type="text" placeholder="搜索规则..." className="pl-9 pr-4 py-1.5 bg-[var(--color-bg-input)] border border-[var(--color-border-base)] rounded-lg text-sm outline-none focus:border-[var(--color-primary)] transition-colors w-48" />
              </div>
            </div>
            
            <div className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-bg-base)] text-[var(--color-text-muted)] text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-semibold">状态</th>
                    <th className="px-6 py-4 font-semibold">正则匹配 (Regex)</th>
                    <th className="px-6 py-4 font-semibold">目标节点</th>
                    <th className="px-6 py-4 font-semibold">优先级</th>
                    <th className="px-6 py-4 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-base)]">
                  {rules.map((rule, i) => (
                    <tr key={i} className="hover:bg-[var(--color-bg-hover)] transition-colors group">
                      <td className="px-6 py-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" defaultChecked={rule.active} />
                          <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-gray-700 peer-checked:bg-[var(--color-primary)]"></div>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <code className="bg-[var(--color-bg-base)] px-2 py-1 rounded text-[var(--color-primary)] border border-[var(--color-primary)]/20 font-mono text-xs">{rule.pattern}</code>
                      </td>
                      <td className="px-6 py-4 font-medium text-[var(--color-text-primary)]">
                        {rule.provider}
                      </td>
                      <td className="px-6 py-4 text-[var(--color-text-muted)]">
                        {rule.priority}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-base)] rounded-lg transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-[var(--color-border-base)] bg-[var(--color-bg-base)]/30 flex items-start gap-3 text-sm text-[var(--color-text-secondary)]">
              <AlertCircle className="w-5 h-5 shrink-0 text-blue-500" />
              <p>请求到来时，系统会按<strong>优先级数字从小到大</strong>的顺序依次匹配正则。若没有任何规则命中，将默认抛出 404 错误。请务必配置一条 `.*` 作为兜底路由。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
