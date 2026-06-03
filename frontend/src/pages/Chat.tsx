import { useState, useEffect, useRef } from 'react';
import { ArrowUp, ChevronDown, Sparkles, Bot, User, Settings2, Paperclip, Mic } from 'lucide-react';
import { api, fetchEventSource } from '../api';

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'system', content: '您已连接至 Orca 智能网关。可以开始测试模型连通性。' }
  ]);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('mimo'); // default mock model
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch available providers/models
    api.get('/api/providers').then(res => {
      const builtIn = res.data;
      api.get('/api/custom-providers').then(res2 => {
        const custom = res2.data;
        const allModels = new Set<string>();
        // Very basic extraction of model names for UI demonstration
        Object.values(builtIn).forEach((p: any) => allModels.add(p.name));
        custom.forEach((p: any) => allModels.add(p.name));
        const modelList = Array.from(allModels);
        if (modelList.length > 0) {
          setModels(modelList);
          setSelectedModel(modelList[0]);
        }
      });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantMsgIndex = newMessages.length;
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    // Map all requests as OpenAI format via proxy
    const body = {
      model: selectedModel,
      messages: newMessages.filter(m => m.role !== 'system'),
      stream: true
    };

    await fetchEventSource('/v1/chat/completions', body, 
      (data) => {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            setMessages(prev => {
              const updated = [...prev];
              updated[assistantMsgIndex].content += delta;
              return updated;
            });
          }
        } catch(e) {}
      },
      () => setIsLoading(false),
      (err) => {
        console.error(err);
        setMessages(prev => {
          const updated = [...prev];
          updated[assistantMsgIndex].content += '\n\n[Error: Failed to fetch response from proxy]';
          return updated;
        });
        setIsLoading(false);
      }
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">聊天</h2>
          <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">使用代理进行实时对话测试，当前已劫持本地流量。</p>
        </div>
        <button className="p-2 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] transition-colors">
          <Settings2 className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 bg-[var(--color-bg-base)] rounded-xl pr-2 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {msg.role !== 'system' && (
              <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center shadow-sm ${
                msg.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-[var(--color-bg-card)] border border-[var(--color-border-base)] text-[var(--color-primary)]'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
            )}
            <div className={`max-w-[80%] ${msg.role === 'system' ? 'w-full flex justify-center' : ''}`}>
              {msg.role === 'system' ? (
                <div className="px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-full text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-2 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                  {msg.content}
                </div>
              ) : (
                <div className={`p-4 rounded-2xl shadow-sm text-[14px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-[var(--color-bg-card)] border border-[var(--color-border-base)] text-[var(--color-text-primary)] rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 flex flex-col gap-3">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-primary)]/50 focus-within:border-[var(--color-primary)] transition-all flex flex-col overflow-hidden">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="随便问点什么..."
            className="w-full bg-transparent text-[var(--color-text-primary)] p-4 pb-2 resize-none outline-none text-[15px] min-h-[80px]"
            rows={1}
          />
          <div className="flex items-center justify-between p-3 pt-1">
            <div className="flex items-center gap-1">
              <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"><Paperclip className="w-5 h-5" /></button>
              <button className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"><Mic className="w-5 h-5" /></button>
            </div>
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-50 transition-all duration-200"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 px-2">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            Build <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
          
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-card)] border border-[var(--color-border-base)] px-2 py-1 rounded-md shadow-sm">
              <Sparkles className="w-3 h-3 text-[var(--color-primary)]" />
              {selectedModel}
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>
            <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-lg shadow-lg z-10 w-48 py-1">
              {models.map(m => (
                <div key={m} onClick={() => setSelectedModel(m)} className="px-3 py-1.5 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer truncate">
                  {m}
                </div>
              ))}
            </div>
          </div>

          <button className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            High Quality <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      </div>
    </div>
  );
}
