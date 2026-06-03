import { useState, useEffect, useRef } from 'react';
import { ArrowUp, ChevronDown, Sparkles, Bot, User, Settings2, Paperclip, Mic, Plus, Trash2, FileText, X, Square, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, fetchEventSource } from '../api';
import { translate as t } from '../i18n';
import type { Language } from '../i18n';

interface Message {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  preset: string; // 'standard' | 'code' | 'bug' | 'translate'
  quality: string; // 'high' | 'medium' | 'low' | 'creative'
  model: string;
  messages: Message[];
}

export default function Chat({ lang }: { lang: Language }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [models, setModels] = useState<{ id: string; name: string; providerName: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'none' | 'preset' | 'model' | 'quality'>('none');
  
  // File upload state
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  
  // Audio record simulation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownsRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const presets: Record<string, { name: string; systemPrompt: string }> = {
    standard: {
      name: lang === 'en' ? 'Standard Assistant' : '标准助手 (Standard)',
      systemPrompt: lang === 'en' ? 'You are connected to Orca Smart Gateway. Ready to test model connectivity.' : '您已连接至 Orca 智能网关。可以开始测试模型连通性。'
    },
    code: {
      name: lang === 'en' ? 'Code Expert' : '代码专家 (Code Architect)',
      systemPrompt: lang === 'en' ? 'You are an expert software architect and senior developer advisor. Provide professional, clean, and well-designed solutions.' : '你是一个资深的软件架构师和高级开发顾问。请以专业、严谨、高内聚低耦合以及符合设计模式的视角来分析和解答编程问题。'
    },
    bug: {
      name: lang === 'en' ? 'Code Auditor' : '代码审计 (Bug Finder)',
      systemPrompt: lang === 'en' ? 'You are a code review and security audit expert. Focus on analyzing user code, finding logical bugs, security flaws, performance bottlenecks, and provide optimized code.' : '你是一个资深的代码审查与安全审计专家。请专注于分析用户提交的代码，找出其中的逻辑错误、潜在的安全隐患、性能瓶颈，并提供优化的重构代码。'
    },
    translate: {
      name: lang === 'en' ? 'Translation Expert' : '翻译专家 (Translator)',
      systemPrompt: lang === 'en' ? 'You are a professional interpreter and translator. Translate non-English input text to natural English, and English text to natural Chinese.' : '你是一个专业的同声传译与翻译官。请将用户输入的所有非英语文本翻译为地道的英语，或将英语文本翻译成流畅、信达雅的中文。'
    }
  };

  const qualities: Record<string, { name: string; temp: number }> = {
    high: { name: lang === 'en' ? 'High Quality (T=0.7)' : '高品质 (T=0.7)', temp: 0.7 },
    medium: { name: lang === 'en' ? 'Balanced (T=0.5)' : '中等均衡 (T=0.5)', temp: 0.5 },
    low: { name: lang === 'en' ? 'Deterministic (T=0.0)' : '精确输出 (T=0.0)', temp: 0.0 },
    creative: { name: lang === 'en' ? 'Creative (T=0.9)' : '创意脑暴 (T=0.9)', temp: 0.9 }
  };

  // Load configured models from backend
  useEffect(() => {
    api.get('/api/providers').then(res => {
      const activeModels: any[] = [];
      res.data.forEach((p: any) => {
        // Only list models if provider is configured
        if (p.configured) {
          p.models.forEach((m: any) => {
            activeModels.push({
              id: m.id,
              name: m.name,
              providerName: p.name
            });
          });
        }
      });
      setModels(activeModels);
      
      // Load conversations from local storage
      const savedChats = localStorage.getItem('orca_conversations');
      if (savedChats) {
        try {
          const parsed = JSON.parse(savedChats);
          if (parsed.length > 0) {
            setConversations(parsed);
            setActiveId(parsed[0].id);
            return;
          }
        } catch (e) {}
      }
      
      // If no saved conversations, create a default one
      const defaultId = 'chat_' + Date.now();
      const defaultChat: Conversation = {
        id: defaultId,
        title: lang === 'en' ? 'New Chat' : '新会话',
        preset: 'standard',
        quality: 'high',
        model: activeModels[0]?.id || 'deepseek-chat',
        messages: [{ role: 'system', content: presets.standard.systemPrompt }]
      };
      setConversations([defaultChat]);
      setActiveId(defaultId);
      localStorage.setItem('orca_conversations', JSON.stringify([defaultChat]));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeId]);

  // Audio recording timer simulation
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } else {
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
        recordingTimer.current = null;
      }
    }
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
    };
  }, [isRecording]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownsRef.current && !dropdownsRef.current.contains(event.target as Node)) {
        setActiveDropdown('none');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const activeChat = conversations.find(c => c.id === activeId);

  const saveChatsToStorage = (updated: Conversation[]) => {
    setConversations(updated);
    localStorage.setItem('orca_conversations', JSON.stringify(updated));
  };

  const handleNewChat = () => {
    const newId = 'chat_' + Date.now();
    const newChat: Conversation = {
      id: newId,
      title: (lang === 'en' ? 'New Chat ' : '新会话 ') + (conversations.length + 1),
      preset: 'standard',
      quality: 'high',
      model: activeChat?.model || models[0]?.id || 'deepseek-chat',
      messages: [{ role: 'system', content: presets.standard.systemPrompt }]
    };
    const updated = [newChat, ...conversations];
    setActiveId(newId);
    saveChatsToStorage(updated);
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length === 1) {
      alert(t('chat.delete.confirm', lang));
      return;
    }
    const updated = conversations.filter(c => c.id !== id);
    if (activeId === id) {
      setActiveId(updated[0].id);
    }
    saveChatsToStorage(updated);
  };

  // Change active model
  const handleModelChange = (modelId: string) => {
    if (!activeChat) return;
    const updated = conversations.map(c => {
      if (c.id === activeId) {
        return { ...c, model: modelId };
      }
      return c;
    });
    saveChatsToStorage(updated);
  };

  // Change preset (Build)
  const handlePresetChange = (presetKey: string) => {
    if (!activeChat) return;
    const updated = conversations.map(c => {
      if (c.id === activeId) {
        // Replace system prompt
        const msgs = [...c.messages];
        if (msgs[0] && msgs[0].role === 'system') {
          msgs[0] = { role: 'system', content: presets[presetKey].systemPrompt };
        } else {
          msgs.unshift({ role: 'system', content: presets[presetKey].systemPrompt });
        }
        return { ...c, preset: presetKey, messages: msgs };
      }
      return c;
    });
    saveChatsToStorage(updated);
  };

  // Change quality (Temperature)
  const handleQualityChange = (qualityKey: string) => {
    if (!activeChat) return;
    const updated = conversations.map(c => {
      if (c.id === activeId) {
        return { ...c, quality: qualityKey };
      }
      return c;
    });
    saveChatsToStorage(updated);
  };

  // File attach handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (limit to 5MB for text reading)
    if (file.size > 5 * 1024 * 1024) {
      alert(t('chat.file.large', lang));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachedFile({
        name: file.name,
        content: content
      });
    };
    reader.readAsText(file);
    // Reset file input value
    e.target.value = '';
  };

  // Mock audio transcription helper
  const handleStopRecording = () => {
    setIsRecording(false);
    const audioPrompts = lang === 'en' ? [
      "How to optimize garbage collection and memory overhead in this code?",
      "How to implement a high-concurrency streaming API supporting resuming?",
      "How to avoid split-brain and deadlock when using Redis distributed locks?",
      "Help me write a beautiful CSS glassmorphism card layout."
    ] : [
      "如何优化这段代码的垃圾回收机制与内存开销？",
      "如何实现一个高并发且支持断点续传的流式 API？",
      "使用 Redis 分布式锁时如何避免脑裂和死锁问题？",
      "帮我写一个高颜值的 CSS 玻璃拟态卡片布局样式。"
    ];
    const randomPrompt = audioPrompts[Math.floor(Math.random() * audioPrompts.length)];
    setInput(prev => (prev ? prev + ' ' : '') + randomPrompt);
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachedFile) || isLoading || !activeChat) return;

    let userPrompt = input;
    // Embed attached file if exists
    if (attachedFile) {
      userPrompt = lang === 'en' 
        ? `[Attached File: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n${userPrompt}`
        : `[附带文件: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n${userPrompt}`;
    }

    const newMessages = [...activeChat.messages, { role: 'user', content: userPrompt }];
    
    // Clear input & attachments
    setInput('');
    setAttachedFile(null);
    setIsLoading(true);

    // Update conversation state temporarily
    const assistantIndex = newMessages.length;
    const initialAssistantMessages = [...newMessages, { role: 'assistant', content: '' }];
    
    // Update local state and memory
    const tempUpdated = conversations.map(c => {
      if (c.id === activeId) {
        const rawTitle = input.trim().slice(0, 15);
        const isDefaultTitle = c.title === '新会话' || c.title.startsWith('新会话 ') || c.title === 'New Chat' || c.title.startsWith('New Chat ');
        const fileTitle = lang === 'en' ? 'File Chat' : '文件对话';
        const title = isDefaultTitle ? (rawTitle || fileTitle) : c.title;
        return { ...c, title, messages: initialAssistantMessages };
      }
      return c;
    });
    setConversations(tempUpdated);

    // Prepare API body parameters
    const tempValue = qualities[activeChat.quality]?.temp ?? 0.7;
    const body = {
      model: activeChat.model,
      messages: newMessages.filter(m => m.role !== 'system'),
      temperature: tempValue,
      stream: true
    };

    await fetchEventSource('/v1/chat/completions', body, 
      (data) => {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            setConversations(prev => {
              const updated = prev.map(c => {
                if (c.id === activeId) {
                  const msgs = [...c.messages];
                  if (msgs[assistantIndex]) {
                    msgs[assistantIndex] = {
                      role: 'assistant',
                      content: msgs[assistantIndex].content + delta
                    };
                  }
                  return { ...c, messages: msgs };
                }
                return c;
              });
              // Sync to local storage
              localStorage.setItem('orca_conversations', JSON.stringify(updated));
              return updated;
            });
          }
        } catch(e) {}
      },
      () => setIsLoading(false),
      (err) => {
        console.error(err);
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === activeId) {
              const msgs = [...c.messages];
              if (msgs[assistantIndex]) {
                msgs[assistantIndex] = {
                  role: 'assistant',
                  content: msgs[assistantIndex].content + '\n\n[Error: Failed to fetch response from proxy]'
                };
              }
              return { ...c, messages: msgs };
            }
            return c;
          });
          localStorage.setItem('orca_conversations', JSON.stringify(updated));
          return updated;
        });
        setIsLoading(false);
      }
    );
  };

  const handleRollback = () => {
    if (!activeChat || activeChat.messages.length <= 1) return;
    
    let lastUserPrompt = '';
    const msgs = [...activeChat.messages];
    
    // Find last user message
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        lastUserPrompt = msgs[i].content;
        // Strip attached file wrapper if present
        if (lastUserPrompt.startsWith('[Attached File:') || lastUserPrompt.startsWith('[附带文件:')) {
          const lines = lastUserPrompt.split('\n');
          let codeBlockEnd = -1;
          for (let j = 0; j < lines.length; j++) {
            if (lines[j].trim() === '```') {
              codeBlockEnd = j;
            }
          }
          if (codeBlockEnd !== -1 && codeBlockEnd < lines.length - 1) {
            lastUserPrompt = lines.slice(codeBlockEnd + 1).join('\n');
          }
        }
        break;
      }
    }

    const lastMsg = msgs[msgs.length - 1];
    let updatedMsgs = msgs;
    if (lastMsg.role === 'assistant') {
      updatedMsgs = msgs.slice(0, -2); // remove both user and assistant
    } else if (lastMsg.role === 'user') {
      updatedMsgs = msgs.slice(0, -1); // remove user
    }

    // Force system prompt to stay
    if (updatedMsgs.length === 0 || updatedMsgs[0].role !== 'system') {
      updatedMsgs.unshift({ role: 'system', content: presets[activeChat.preset]?.systemPrompt || presets.standard.systemPrompt });
    }

    const updated = conversations.map(c => {
      if (c.id === activeId) {
        return { ...c, messages: updatedMsgs };
      }
      return c;
    });

    setConversations(updated);
    localStorage.setItem('orca_conversations', JSON.stringify(updated));
    setInput(lastUserPrompt);
    // Autofocus textarea after rollback
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex h-[calc(100vh-64px)] gap-6 animate-in fade-in duration-500 max-w-6xl mx-auto overflow-hidden">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".txt,.js,.json,.ts,.tsx,.css,.html,.md,.py,.go,.java,.cpp,.c,.rs"
      />

      {/* Left conversation sidebar */}
      <div className="w-[200px] flex flex-col gap-4 border-r border-[var(--color-border-base)] pr-4 h-full shrink-0">
        <button 
          onClick={handleNewChat}
          className="flex items-center justify-center gap-2 w-full py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" /> {t('chat.new', lang)}
        </button>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          <div className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-2 mb-2">{t('chat.history', lang)}</div>
          {conversations.map(chat => {
            const isActive = chat.id === activeId;
            return (
              <div 
                key={chat.id}
                onClick={() => setActiveId(chat.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' 
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <div className="truncate flex-1 pr-2">{chat.title}</div>
                <button 
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-0.5"
                  title={t('chat.delete.tooltip', lang)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right chat window */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Chat window Header details */}
        {activeChat && (
          <div className="mb-4 flex items-center justify-between shrink-0 bg-[var(--color-bg-base)] border-b border-[var(--color-border-base)]/50 pb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">{activeChat.title}</h2>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-text-secondary)]">
                <span className="bg-[var(--color-bg-hover)] px-2 py-0.5 rounded border border-[var(--color-border-base)] font-bold text-[10px]">
                  {presets[activeChat.preset]?.name}
                </span>
                <span className="bg-[var(--color-bg-hover)] px-2 py-0.5 rounded border border-[var(--color-border-base)] font-bold text-[10px]">
                  {qualities[activeChat.quality]?.name}
                </span>
                <span className="truncate max-w-[200px] font-mono text-[var(--color-text-muted)]">
                  {activeChat.model}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeChat.messages.length > 1 && (
                <button 
                  onClick={handleRollback}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer"
                  title={lang === 'en' ? 'Rollback last turn' : '回滚上一次对话'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'en' ? 'Rollback' : '回滚'}</span>
                </button>
              )}
              <button 
                onClick={() => navigate('/providers')}
                className="p-2 rounded-xl border border-[var(--color-border-base)] bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] cursor-pointer"
                title={lang === 'en' ? 'Provider & Model Settings' : '模型供应商设置'}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Message history */}
        <div className="flex-1 overflow-y-auto mb-4 bg-[var(--color-bg-base)] rounded-xl pr-2 space-y-6">
          {activeChat?.messages.map((msg, i) => (
            <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role !== 'system' && (
                <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center shadow-sm ${
                  msg.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-[var(--color-bg-card)] border border-[var(--color-border-base)] text-[var(--color-primary)]'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
              )}
              <div className={`max-w-[85%] ${msg.role === 'system' ? 'w-full flex justify-center' : ''}`}>
                {msg.role === 'system' ? (
                  <div className="px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-full text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-2 shadow-sm animate-in slide-in-from-top-2 duration-300">
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
                {!isLoading && msg.role !== 'system' && i === activeChat.messages.length - 1 && (
                  <div className={`flex mt-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRollback();
                      }}
                      className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-red-500 font-semibold transition-colors bg-transparent border-0 cursor-pointer select-none"
                      title={lang === 'en' ? 'Rollback last message' : '回退并重新编辑'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === 'en' ? 'Rollback' : '回退/编辑'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input box section */}
        <div className="shrink-0 flex flex-col gap-3">
          
          {/* File attach chip */}
          {attachedFile && (
            <div className="flex items-center gap-2 bg-[var(--color-bg-hover)] border border-[var(--color-border-base)] px-3 py-1.5 rounded-xl self-start text-xs font-semibold animate-in slide-in-from-bottom-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="max-w-xs truncate text-[var(--color-text-primary)]">{attachedFile.name}</span>
              <button 
                onClick={() => setAttachedFile(null)}
                className="hover:text-red-500 transition-colors p-0.5"
                title={t('chat.file.delete', lang)}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Voice recording simulation overlay */}
          <div 
            onClick={() => textareaRef.current?.focus()}
            className="relative bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-[var(--color-primary)]/50 focus-within:border-[var(--color-primary)] transition-all flex flex-col overflow-hidden cursor-text"
          >
            
            {isRecording ? (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 bg-[var(--color-bg-card)] z-20 flex items-center justify-between px-6 py-4 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full bg-red-500 animate-ping"></div>
                  <span className="text-sm font-semibold text-red-500">{t('chat.voice.recording', lang)} {formatSeconds(recordingSeconds)}</span>
                </div>
                
                {/* Audio wave mock animation */}
                <div className="flex items-end gap-1 h-6">
                  <div className="w-1 bg-red-500 rounded-full animate-[pulse_0.8s_infinite] h-4"></div>
                  <div className="w-1 bg-red-500 rounded-full animate-[pulse_0.4s_infinite] h-6"></div>
                  <div className="w-1 bg-red-500 rounded-full animate-[pulse_0.6s_infinite] h-2"></div>
                  <div className="w-1 bg-red-500 rounded-full animate-[pulse_0.5s_infinite] h-5"></div>
                  <div className="w-1 bg-red-500 rounded-full animate-[pulse_0.7s_infinite] h-3"></div>
                </div>

                <button 
                  onClick={(e) => { e.stopPropagation(); handleStopRecording(); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" /> {t('chat.voice.stop', lang)}
                </button>
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('chat.input.placeholder', lang)}
              className="w-full bg-transparent text-[var(--color-text-primary)] p-4 pb-2 resize-none outline-none text-[15px] min-h-[80px]"
              rows={1}
            />
            
            <div className="flex items-center justify-between p-3 pt-1">
              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                  title={t('chat.file.tooltip', lang)}
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsRecording(true); }}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                  title={t('chat.voice.tooltip', lang)}
                >
                  <Mic className="w-5 h-5" />
                </button>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleSend(); }}
                disabled={(!input.trim() && !attachedFile) || isLoading || !activeChat}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-50 transition-all duration-200 cursor-pointer"
              >
                <ArrowUp className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Bottom Dropdowns */}
          {activeChat && (
            <div ref={dropdownsRef} className="flex items-center gap-4 px-2 select-none relative z-30">
              
              {/* Build Dropdown (Presets) */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'preset' ? 'none' : 'preset');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-card)] border border-[var(--color-border-base)] px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  Build: {presets[activeChat.preset]?.name}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-52 py-1 ${activeDropdown === 'preset' ? 'block' : 'hidden'}`}
                >
                  {Object.entries(presets).map(([key, val]) => (
                    <div 
                      key={key} 
                      onClick={() => {
                        handlePresetChange(key);
                        setActiveDropdown('none');
                      }} 
                      className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer truncate ${activeChat.preset === key ? 'text-[var(--color-primary)] font-bold' : ''}`}
                    >
                      {val.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Model Select Dropdown */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'model' ? 'none' : 'model');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-card)] border border-[var(--color-border-base)] px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[var(--color-primary)]" />
                  {activeChat.model}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-64 py-1 max-h-60 overflow-y-auto ${activeDropdown === 'model' ? 'block' : 'hidden'}`}
                >
                  {models.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] italic">{t('chat.models.empty', lang)}</div>
                  ) : (
                    models.map(m => (
                      <div 
                        key={m.id} 
                        onClick={() => {
                          handleModelChange(m.id);
                          setActiveDropdown('none');
                        }} 
                        className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer truncate flex flex-col gap-0.5 ${activeChat.model === m.id ? 'text-[var(--color-primary)] font-bold' : ''}`}
                      >
                        <span className="font-semibold">{m.id}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)]">{t('chat.model.provider', lang)}: {m.providerName}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quality Dropdown (Temperature) */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'quality' ? 'none' : 'quality');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-card)] border border-[var(--color-border-base)] px-2.5 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  Quality: {qualities[activeChat.quality]?.name}
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className={`absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-44 py-1 ${activeDropdown === 'quality' ? 'block' : 'hidden'}`}
                >
                  {Object.entries(qualities).map(([key, val]) => (
                    <div 
                      key={key} 
                      onClick={() => {
                        handleQualityChange(key);
                        setActiveDropdown('none');
                      }} 
                      className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer truncate ${activeChat.quality === key ? 'text-[var(--color-primary)] font-bold' : ''}`}
                    >
                      {val.name}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
