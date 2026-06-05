import { useState, useEffect, useRef } from 'react';
import { ArrowUp, ChevronDown, Sparkles, Bot, User, Settings2, Trash2, FileText, X, Square, Terminal, Loader, CheckCircle, Check, CornerUpLeft, Copy, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, fetchEventSource } from '../api';
import { translate as t } from '../i18n';
import type { Language } from '../i18n';

interface Message {
  role: string;
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: string;
  workspaceId?: string;
  title: string;
  preset: string; // 'standard' | 'code' | 'bug' | 'translate'
  quality: string; // 'high' | 'medium' | 'low' | 'creative'
  model: string;
  messages: Message[];
}

function PenSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      style={props.style}
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 1 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

export default function Chat({ lang }: { lang: Language }) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [input, setInput] = useState('');
  const [models, setModels] = useState<{ id: string; name: string; providerName: string }[]>([]);
  const [loadingChats, setLoadingChats] = useState<Record<string, boolean>>({});
  const [activeDropdown, setActiveDropdown] = useState<'none' | 'preset' | 'model' | 'quality' | 'readyTools' | 'buildPlan'>('none');
  const abortControllersRef = useRef<Record<string, AbortController>>({});

  const handleStop = (chatId?: string) => {
    const id = chatId || activeId;
    const controller = abortControllersRef.current[id];
    if (controller) {
      controller.abort();
      delete abortControllersRef.current[id];
    }
    setLoadingChats(prev => ({ ...prev, [id]: false }));
  };

  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach(controller => controller.abort());
    };
  }, []);
  
  // Agent mode & skills state
  const [useAgent, setUseAgent] = useState(true);
  const activeSkillId = '';
  const [skills, setSkills] = useState<any[]>([]);
  const [mcpTools, setMcpTools] = useState<any[]>([]);

  // Workspace selector state
  interface Workspace {
    id: string;
    name: string;
    path: string;
    initial: string;
  }
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [historySidebarWidth, setHistorySidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('orca_chat_history_width') || '220');
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = historySidebarWidth;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(160, Math.min(400, startWidth + deltaX));
      setHistorySidebarWidth(newWidth);
      localStorage.setItem('orca_chat_history_width', String(newWidth));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const filteredConversations = conversations.filter(c => 
    !activeWorkspaceId || c.workspaceId === activeWorkspaceId
  );

  // Switch conversation when active workspace changes
  useEffect(() => {
    if (!activeWorkspaceId || conversations.length === 0 || models.length === 0) return;
    
    // Check if current activeId belongs to current active workspace
    const hasActiveForWs = conversations.some(c => c.id === activeId && c.workspaceId === activeWorkspaceId);
    if (hasActiveForWs) return;

    // Try to find any conversation for this workspace
    const wsChats = conversations.filter(c => c.workspaceId === activeWorkspaceId);
    if (wsChats.length > 0) {
      setActiveId(wsChats[0].id);
    } else {
      // Create a default one for this workspace
      const defaultId = 'chat_' + Date.now();
      const defaultChat: Conversation = {
        id: defaultId,
        workspaceId: activeWorkspaceId,
        title: lang === 'en' ? 'New Chat' : '新会话',
        preset: 'standard',
        quality: 'high',
        model: (conversations.find(c => c.id === activeId)?.model) || models[0]?.id || 'deepseek-chat',
        messages: [{ role: 'system', content: presets.standard.systemPrompt }]
      };
      const updated = [defaultChat, ...conversations];
      setActiveId(defaultId);
      saveChatsToStorage(updated);
    }
  }, [activeWorkspaceId, conversations.length, models.length]);

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
      systemPrompt: lang === 'en' ? 'You are Orca, a premium AI agent assistant. Help the user with their queries, tasks, and software engineering needs.' : '你是一个专业的 AI 智能助手。你可以协助用户解答日常提问、提供编程方案、审计系统并执行多步骤任务。'
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
    low: { name: 'Low', temp: 0.1 },
    medium: { name: 'Medium', temp: 0.5 },
    high: { name: 'High', temp: 0.9 }
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
      let loadedConversations: Conversation[] = [];
      if (savedChats) {
        try {
          const parsed = JSON.parse(savedChats);
          if (Array.isArray(parsed)) {
            loadedConversations = parsed.map(c => ({
              ...c,
              workspaceId: c.workspaceId || 'ws_default'
            }));
          }
        } catch (e) {}
      }
      
      if (loadedConversations.length > 0) {
        setConversations(loadedConversations);
        setActiveId(loadedConversations[0].id);
      } else {
        // If no saved conversations, create a default one
        const defaultId = 'chat_' + Date.now();
        const defaultChat: Conversation = {
          id: defaultId,
          workspaceId: 'ws_default',
          title: lang === 'en' ? 'New Chat' : '新会话',
          preset: 'standard',
          quality: 'high',
          model: activeModels[0]?.id || 'deepseek-chat',
          messages: [{ role: 'system', content: presets.standard.systemPrompt }]
        };
        setConversations([defaultChat]);
        setActiveId(defaultId);
        localStorage.setItem('orca_conversations', JSON.stringify([defaultChat]));
      }
    }).catch(console.error);
  }, []);

  // Load workspaces and skills lists on mount
  useEffect(() => {
    api.get('/api/config').then(configRes => {
      const savedWorkspaces = localStorage.getItem('orca_workspaces');
      let wsList: Workspace[] = [];
      if (savedWorkspaces) {
        try { wsList = JSON.parse(savedWorkspaces); } catch (e) {}
      }
      
      if (wsList.length === 0) {
        const defaultPath = configRes.data?.projectDir || 'E:\\工作\\SDA配置\\orca';
        const defaultName = defaultPath.split(/[\\/]/).pop() || 'orca';
        const defaultWs = {
          id: 'ws_default',
          name: defaultName,
          path: defaultPath,
          initial: defaultName.charAt(0).toUpperCase()
        };
        wsList = [defaultWs];
        localStorage.setItem('orca_workspaces', JSON.stringify(wsList));
      }
      setWorkspaces(wsList);
      
      const savedActiveWs = localStorage.getItem('orca_active_ws');
      if (savedActiveWs && wsList.some(w => w.id === savedActiveWs)) {
        setActiveWorkspaceId(savedActiveWs);
      } else {
        setActiveWorkspaceId(wsList[0].id);
      }

      api.get('/api/skills').then(skillsRes => {
        setSkills(skillsRes.data || []);
      }).catch(err => console.error("Failed to load skills:", err));

      api.get('/api/mcp/tools').then(mcpRes => {
        setMcpTools(mcpRes.data || []);
      }).catch(err => console.error("Failed to load MCP tools:", err));
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem('orca_active_ws', activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  const handleChooseDirectory = (workspaceIdToEdit?: string) => {
    api.post('/api/choose-directory').then(res => {
      if (res.data && res.data.path) {
        const dirPath = res.data.path;
        const separator = dirPath.includes('\\') ? '\\' : '/';
        const parts = dirPath.split(separator);
        const dirName = parts.pop() || 'folder';

        if (workspaceIdToEdit) {
          const updated = workspaces.map(w => {
            if (w.id === workspaceIdToEdit) {
              return {
                ...w,
                name: dirName,
                path: dirPath,
                initial: dirName.charAt(0).toUpperCase()
              };
            }
            return w;
          });
          setWorkspaces(updated);
          localStorage.setItem('orca_workspaces', JSON.stringify(updated));
        } else {
          if (workspaces.some(w => w.path === dirPath)) {
            const existing = workspaces.find(w => w.path === dirPath);
            if (existing) setActiveWorkspaceId(existing.id);
            return;
          }

          const newWs: Workspace = {
            id: 'ws_' + Date.now(),
            name: dirName,
            path: dirPath,
            initial: dirName.charAt(0).toUpperCase()
          };
          
          const updated = [...workspaces, newWs];
          setWorkspaces(updated);
          setActiveWorkspaceId(newWs.id);
          localStorage.setItem('orca_workspaces', JSON.stringify(updated));
        }
      }
    }).catch(err => {
      console.error("Failed to choose directory:", err);
    });
  };

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
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const modelsByProvider = models.reduce((acc, m) => {
    const provider = m.providerName || 'Unknown';
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(m);
    return acc;
  }, {} as Record<string, typeof models>);

  const getWorkspaceStyles = (name: string, isActive: boolean) => {
    const char = name.charAt(0).toUpperCase();
    const code = char.charCodeAt(0) % 4;
    
    if (isActive) {
      return 'w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold transition-all relative cursor-pointer border-[2px] border-[#1a3a4b] text-[#24818d] bg-[#e2f3f5] font-extrabold shadow-sm';
    }
    
    const palettes = [
      'w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold transition-all relative cursor-pointer border border-transparent text-[#9c5a9c] bg-[#f6eaf6] hover:opacity-90',
      'w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold transition-all relative cursor-pointer border border-transparent text-[#5c8a5c] bg-[#eaf6ea] hover:opacity-90',
      'w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold transition-all relative cursor-pointer border border-transparent text-[#5c6ea3] bg-[#eaeaf6] hover:opacity-90',
      'w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold transition-all relative cursor-pointer border border-transparent text-[#a35c5c] bg-[#f6eaea] hover:opacity-90',
    ];
    return palettes[code];
  };

  function saveChatsToStorage(updated: Conversation[]) {
    setConversations(updated);
    localStorage.setItem('orca_conversations', JSON.stringify(updated));
  }

  const handleNewChat = () => {
    const newId = 'chat_' + Date.now();
    const newChat: Conversation = {
      id: newId,
      workspaceId: activeWorkspaceId,
      title: (lang === 'en' ? 'New Chat ' : '新会话 ') + (filteredConversations.length + 1),
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
    const chatId = activeId;
    if ((!input.trim() && !attachedFile) || loadingChats[chatId] || !activeChat) return;

    let userPrompt = input;
    // Embed attached file if exists
    if (attachedFile) {
      userPrompt = lang === 'en' 
        ? `[Attached File: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n${userPrompt}`
        : `[附带文件: ${attachedFile.name}]\n\`\`\`\n${attachedFile.content}\n\`\`\`\n${userPrompt}`;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessages = [...activeChat.messages, { role: 'user', content: userPrompt, timestamp: timeStr }];
    
    // Clear input & attachments
    setInput('');
    setAttachedFile(null);
    setLoadingChats(prev => ({ ...prev, [chatId]: true }));

    // Update conversation state temporarily
    const assistantIndex = newMessages.length;
    const initialAssistantMessages = [...newMessages, { role: 'assistant', content: '', timestamp: timeStr }];
    
    // Update local state and memory
    const tempUpdated = conversations.map(c => {
      if (c.id === chatId) {
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
    const tempValue = (qualities[activeChat.quality] || qualities.high).temp;
    const body = {
      model: activeChat.model,
      messages: newMessages.filter(m => m.role !== 'system'),
      temperature: tempValue,
      stream: true,
      useAgent,
      activeSkillId,
      workspacePath: activeWorkspace?.path || ''
    };

    const controller = new AbortController();
    abortControllersRef.current[chatId] = controller;

    let accumulatedContent = '';
    let lastRenderTime = Date.now();
    let renderTimeout: any = null;

    const flushRender = (force = false) => {
      const now = Date.now();
      if (!force && now - lastRenderTime < 80) {
        if (!renderTimeout) {
          renderTimeout = setTimeout(() => {
            renderTimeout = null;
            flushRender(true);
          }, 80 - (now - lastRenderTime));
        }
        return;
      }

      if (renderTimeout) {
        clearTimeout(renderTimeout);
        renderTimeout = null;
      }

      lastRenderTime = now;
      
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id === chatId) {
            const msgs = [...c.messages];
            if (msgs[assistantIndex]) {
              msgs[assistantIndex] = {
                role: 'assistant',
                content: accumulatedContent,
                timestamp: msgs[assistantIndex].timestamp || timeStr
              };
            }
            return { ...c, messages: msgs };
          }
          return c;
        });
        localStorage.setItem('orca_conversations', JSON.stringify(updated));
        return updated;
      });
    };

    await fetchEventSource('/v1/chat/completions', body, 
      (data) => {
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulatedContent += delta;
            flushRender();
          }
        } catch(e) {}
      },
      () => {
        flushRender(true);
        setLoadingChats(prev => ({ ...prev, [chatId]: false }));
        delete abortControllersRef.current[chatId];
      },
      (err) => {
        flushRender(true);
        if (err.name === 'AbortError') {
          console.log('Request aborted by user');
          setLoadingChats(prev => ({ ...prev, [chatId]: false }));
          delete abortControllersRef.current[chatId];
          return;
        }
        console.error(err);
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === chatId) {
              const msgs = [...c.messages];
              if (msgs[assistantIndex]) {
                msgs[assistantIndex] = {
                  role: 'assistant',
                  content: msgs[assistantIndex].content + '\n\n[Error: Failed to fetch response from proxy]',
                  timestamp: msgs[assistantIndex].timestamp || timeStr
                };
              }
              return { ...c, messages: msgs };
            }
            return c;
          });
          localStorage.setItem('orca_conversations', JSON.stringify(updated));
          return updated;
        });
        setLoadingChats(prev => ({ ...prev, [chatId]: false }));
        delete abortControllersRef.current[chatId];
      },
      controller.signal
    );
  };



  const rollbackTo = (idx: number) => {
    if (!activeChat || idx < 0 || idx >= activeChat.messages.length) return;
    const msgs = [...activeChat.messages];
    let targetUserMsgIdx = -1;
    if (msgs[idx].role === 'user') {
      targetUserMsgIdx = idx;
    } else if (msgs[idx].role === 'assistant' && idx > 0 && msgs[idx - 1].role === 'user') {
      targetUserMsgIdx = idx - 1;
    }

    if (targetUserMsgIdx === -1) return;

    let targetUserPrompt = msgs[targetUserMsgIdx].content;
    // Strip attached file wrapper if present
    if (targetUserPrompt.startsWith('[Attached File:') || targetUserPrompt.startsWith('[附带文件:')) {
      const lines = targetUserPrompt.split('\n');
      let codeBlockEnd = -1;
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim() === '```') {
          codeBlockEnd = j;
        }
      }
      if (codeBlockEnd !== -1 && codeBlockEnd < lines.length - 1) {
        targetUserPrompt = lines.slice(codeBlockEnd + 1).join('\n');
      }
    }

    const updatedMsgs = msgs.slice(0, targetUserMsgIdx);

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
    setInput(targetUserPrompt);
    // Autofocus textarea
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
    <div className="flex h-full gap-6 animate-in fade-in duration-500 w-full overflow-hidden p-6">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
        accept=".txt,.js,.json,.ts,.tsx,.css,.html,.md,.py,.go,.java,.cpp,.c,.rs"
      />

      {/* Left Workspace Sidebar */}
      <div className="w-14 flex flex-col items-center gap-3 border-r border-[var(--color-border-base)] pr-3 h-full shrink-0 pt-1">
        {workspaces.map(ws => {
          const isActive = ws.id === activeWorkspaceId;
          return (
            <button 
              key={ws.id}
              onClick={() => setActiveWorkspaceId(ws.id)}
              className={getWorkspaceStyles(ws.name, isActive)}
              title={`${ws.name} (${ws.path})`}
            >
              {ws.initial}
            </button>
          );
        })}
        <button 
          onClick={() => handleChooseDirectory()}
          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-xl font-light transition-all cursor-pointer border border-[var(--color-border-base)] text-gray-400 dark:text-gray-500 hover:text-[var(--color-text-primary)] hover:border-gray-400 bg-[var(--color-bg-card)] shadow-sm select-none"
          title={lang === 'en' ? 'Choose directory' : '选择目录'}
        >
          +
        </button>
      </div>

      {/* Middle conversation sidebar */}
      <div 
        style={{ width: `${historySidebarWidth}px` }}
        className="relative flex flex-col gap-3.5 border-r border-[var(--color-border-base)] pr-4 h-full shrink-0 pt-1"
      >
        {/* Resize Handle */}
        <div 
          onMouseDown={handleMouseDown}
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--color-primary)]/40 active:bg-[var(--color-primary)]/60 transition-colors z-30"
          title="Drag to resize / 拖动调整大小"
        />
        {activeWorkspace && (
          <div className="px-2 select-none flex flex-col gap-0.5 relative">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[var(--color-text-primary)] truncate">
                {activeWorkspace.name}
              </span>
              <button 
                onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                title={lang === 'en' ? 'Workspace Menu' : '工作区菜单'}
              >
                <span className="text-lg font-bold leading-none">...</span>
              </button>
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] truncate font-mono" title={activeWorkspace.path}>
              {activeWorkspace.path}
            </div>

            {workspaceMenuOpen && (
              <div 
                className="absolute top-8 right-0 bg-white dark:bg-slate-900 border border-[var(--color-border-base)] rounded-xl shadow-lg z-50 w-36 py-1 text-left"
                onMouseLeave={() => setWorkspaceMenuOpen(false)}
              >
                <div 
                  onClick={() => {
                    handleChooseDirectory(activeWorkspaceId);
                    setWorkspaceMenuOpen(false);
                  }}
                  className="px-4 py-2 text-xs hover:bg-[var(--color-bg-hover)] text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {lang === 'en' ? 'Edit' : '编辑'}
                </div>
                <div 
                  onClick={() => {
                    setWorkspaceMenuOpen(false);
                  }}
                  className="px-4 py-2 text-xs hover:bg-[var(--color-bg-hover)] text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {lang === 'en' ? 'Enable Workspace' : '启用工作区'}
                </div>
                <div 
                  onClick={() => {
                    if (activeChat) {
                      const systemMsg = activeChat.messages.find(m => m.role === 'system');
                      const updated = conversations.map(c => {
                        if (c.id === activeId) {
                          return { ...c, messages: systemMsg ? [systemMsg] : [{ role: 'system', content: presets.standard.systemPrompt }] };
                        }
                        return c;
                      });
                      saveChatsToStorage(updated);
                    }
                    setWorkspaceMenuOpen(false);
                  }}
                  className="px-4 py-2 text-xs hover:bg-[var(--color-bg-hover)] text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  {lang === 'en' ? 'Clear Notifications' : '清除通知'}
                </div>
                <div className="border-t border-[var(--color-border-base)] my-1" />
                <div 
                  onClick={() => {
                    setWorkspaces(prev => {
                      const updated = prev.filter(w => w.id !== activeWorkspaceId);
                      localStorage.setItem('orca_workspaces', JSON.stringify(updated));
                      if (updated.length > 0) {
                        setActiveWorkspaceId(updated[0].id);
                      } else {
                        setActiveWorkspaceId('');
                      }
                      return updated;
                    });
                    setWorkspaceMenuOpen(false);
                  }}
                  className="px-4 py-2 text-xs hover:bg-[var(--color-bg-hover)] text-red-500 cursor-pointer"
                >
                  {lang === 'en' ? 'Close' : '关闭'}
                </div>
              </div>
            )}
          </div>
        )}
        
        <button 
          onClick={handleNewChat}
          className="flex items-center justify-center gap-1.5 w-full py-2 bg-white dark:bg-slate-900 border border-[var(--color-border-base)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer mt-1"
        >
          <PenSquareIcon className="w-4 h-4 text-gray-500" />
          <span>{lang === 'en' ? 'New Chat' : '新建会话'}</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 mt-2">
          {filteredConversations.map(chat => {
            const isActive = chat.id === activeId;
            const isChatLoading = loadingChats[chat.id];
            return (
              <div 
                key={chat.id}
                onClick={() => setActiveId(chat.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-[#eaeff2] dark:bg-slate-800 text-[var(--color-text-primary)] font-semibold' 
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                <div className="truncate flex-1 pr-2 text-[13px] flex items-center gap-1.5">
                  {isChatLoading && <Loader className="w-3 h-3 animate-spin text-[#24818d] shrink-0" />}
                  <span className="truncate">{chat.title}</span>
                </div>
                <button 
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-gray-400 transition-opacity p-0.5"
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
              <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--color-text-secondary)] select-none">
                <span className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-md font-medium text-[10.5px]">
                  {useAgent 
                    ? (lang === 'en' ? 'Agent Assistant (Build)' : '智能体助手 (Build)') 
                    : (presets[activeChat.preset]?.name ? presets[activeChat.preset]?.name.split(' (')[0] + ' (Plan)' : 'Plan')
                  }
                </span>
                <span className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-md font-medium text-[10.5px]">
                  {(qualities[activeChat.quality] || qualities.high).name}
                </span>
                <span className="font-mono text-gray-400 dark:text-gray-500 text-[10.5px] truncate max-w-[200px]">
                  {activeChat.model}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/providers')}
                className="p-1.5 rounded-lg border border-[var(--color-border-base)] bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-500 shadow-sm cursor-pointer"
                title={lang === 'en' ? 'Provider & Model Settings' : '模型供应商设置'}
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Loading Bar at the top of chat interface */}
        {loadingChats[activeId] && (
          <div className="w-full h-1 relative overflow-hidden bg-gray-100 dark:bg-slate-800/50 shrink-0 mb-3 rounded-full">
            <div className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-blue-500 via-emerald-500 to-indigo-500 animate-loading-bar rounded-full"></div>
          </div>
        )}

        {/* Message history */}
        <div className="flex-1 overflow-y-auto mb-4 bg-[var(--color-bg-base)] rounded-xl pr-2 space-y-6">
          {activeChat?.messages.filter(msg => msg.role !== 'system').map((msg, i) => (
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
                    {cleanThinkTags(msg.content)}
                  </div>
                ) : (
                  <div className={`p-4 rounded-2xl shadow-sm text-[14px] leading-relaxed ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm whitespace-pre-wrap' : 'bg-[var(--color-bg-card)] border border-[var(--color-border-base)] text-[var(--color-text-primary)] rounded-tl-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      cleanThinkTags(msg.content)
                    ) : (
                      <div className="space-y-4">
                        {parseAssistantMessage(msg.content).map((block, idx) => {
                          if (block.type === 'text') {
                            return (
                              <div key={idx} className="space-y-1">
                                {parseTextWithCodeBlocksAndTasks(block.content).map((subBlock, sIdx) => {
                                  if (subBlock.type === 'text') {
                                    return (
                                      <div key={sIdx} className="whitespace-pre-wrap">
                                        {subBlock.content}
                                      </div>
                                    );
                                  } else if (subBlock.type === 'tasks' && subBlock.tasks) {
                                    return (
                                      <TaskListWidget 
                                        key={sIdx}
                                        tasks={subBlock.tasks}
                                      />
                                    );
                                  } else {
                                    return (
                                      <CodeBlock 
                                        key={sIdx} 
                                        content={subBlock.content} 
                                        language={subBlock.language} 
                                      />
                                    );
                                  }
                                })}
                              </div>
                            );
                          } else if (block.type === 'think') {
                            return (
                              <ThinkingBlock 
                                key={idx} 
                                content={block.content} 
                                status={block.status} 
                                lang={lang}
                              />
                            );
                          } else {
                            return (
                              <ToolExecutionBlock 
                                key={idx} 
                                block={block} 
                                lang={lang} 
                              />
                            );
                          }
                        })}
                      </div>
                    )}
                  </div>
                )}
                {msg.role !== 'system' && (
                  <div className={`flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mt-1.5 px-1 select-none w-full gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-1 font-medium">
                      <span>{useAgent ? 'Build' : 'Plan'}</span>
                      <span>·</span>
                      <span className="truncate max-w-[150px]">{activeChat.model}</span>
                      <span>·</span>
                      <span>{msg.timestamp || '22:29'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                      <button 
                        onClick={(e) => { e.stopPropagation(); rollbackTo(i); }}
                        className="hover:text-red-500 transition-colors p-0.5 cursor-pointer"
                        title={lang === 'en' ? 'Rollback to this point' : '回滚/编辑'}
                      >
                        <CornerUpLeft className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(msg.content);
                        }}
                        className="hover:text-[var(--color-text-primary)] transition-colors p-0.5 cursor-pointer"
                        title={lang === 'en' ? 'Copy content' : '复制内容'}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

          <div 
            onClick={(e) => {
              if (e.target !== textareaRef.current) {
                textareaRef.current?.focus();
              }
            }}
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
              <button 
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 transition-colors cursor-pointer text-xl font-light"
                title={t('chat.file.tooltip', lang)}
              >
                +
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (loadingChats[activeId]) {
                    handleStop(); 
                  } else {
                    handleSend(); 
                  }
                }}
                disabled={!loadingChats[activeId] && ((!input.trim() && !attachedFile) || !activeChat)}
                className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-250 cursor-pointer ${
                  loadingChats[activeId] 
                    ? 'bg-red-500 text-white shadow-md shadow-red-500/20 animate-pulse' 
                    : (!input.trim() && !attachedFile) || !activeChat
                      ? 'bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                }`}
                title={loadingChats[activeId] ? (lang === 'en' ? 'Stop' : '停止运行') : (lang === 'en' ? 'Send' : '发送')}
              >
                {loadingChats[activeId] ? (
                  <Square className="w-4 h-4 fill-white" />
                ) : (
                  <ArrowUp className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
          
          {/* Bottom Dropdowns */}
          {activeChat && (
            <div ref={dropdownsRef} className="flex items-center gap-2 px-2 select-none relative z-30">
              
              {/* Dropdown 1: Build / Plan */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'buildPlan' ? 'none' : 'buildPlan');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-hover)] px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  <span>{useAgent ? 'Build' : 'Plan'}</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                {activeDropdown === 'buildPlan' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-36 py-1 overflow-hidden"
                  >
                    <div 
                      onClick={() => {
                        setUseAgent(true);
                        setActiveDropdown('none');
                      }} 
                      className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer flex justify-between items-center ${useAgent ? 'bg-[var(--color-bg-hover)] font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}
                    >
                      <span>Build</span>
                      {useAgent && <Check className="w-3.5 h-3.5" />}
                    </div>
                    <div 
                      onClick={() => {
                        setUseAgent(false);
                        setActiveDropdown('none');
                      }} 
                      className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer flex justify-between items-center ${!useAgent ? 'bg-[var(--color-bg-hover)] font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}
                    >
                      <span>Plan</span>
                      {!useAgent && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                )}
              </div>

              {/* Dropdown 2: Model Selector */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'model' ? 'none' : 'model');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-hover)] px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500/20 animate-pulse" />
                  <span className="truncate max-w-[150px]">{activeChat.model}</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                {activeDropdown === 'model' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-72 py-2 max-h-80 overflow-y-auto"
                  >
                    {models.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-[var(--color-text-muted)] italic">{t('chat.models.empty', lang)}</div>
                    ) : (
                      Object.entries(modelsByProvider).map(([providerName, providerModels]) => (
                        <div key={providerName} className="mb-2 last:mb-0">
                          <div className="px-3 py-1.5 text-[11px] font-semibold text-[#a06a55] select-none bg-slate-50/50 dark:bg-slate-800/30">
                            {providerName}
                          </div>
                          {providerModels.map(m => {
                            const isSelected = activeChat.model === m.id;
                            return (
                              <div 
                                key={m.id} 
                                onClick={() => {
                                  handleModelChange(m.id);
                                  setActiveDropdown('none');
                                }} 
                                className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer flex justify-between items-center transition-colors ${isSelected ? 'bg-[var(--color-bg-hover)] font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}
                              >
                                <span className="truncate flex-1 pr-2">{m.name || m.id}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Dropdown 3: Quality Selector */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'quality' ? 'none' : 'quality');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-hover)] px-3 py-1.5 rounded-lg shadow-sm cursor-pointer"
                >
                  <span>{(qualities[activeChat.quality] || qualities.high).name}</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                {activeDropdown === 'quality' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-36 py-1 overflow-hidden"
                  >
                    {Object.entries(qualities).map(([key, val]) => {
                      const isSelected = activeChat.quality === key;
                      return (
                        <div 
                          key={key} 
                          onClick={() => {
                            handleQualityChange(key);
                            setActiveDropdown('none');
                          }} 
                          className={`px-3 py-2 text-xs hover:bg-[var(--color-bg-hover)] cursor-pointer flex justify-between items-center transition-colors ${isSelected ? 'bg-[var(--color-bg-hover)] font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-primary)]'}`}
                        >
                          <span>{val.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Dropdown 4: Ready Tools Indicator */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === 'readyTools' ? 'none' : 'readyTools');
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors bg-[var(--color-bg-hover)] px-3 py-1.5 rounded-lg shadow-sm cursor-pointer border border-[#a6e3a1]/25 hover:border-[#a6e3a1]/50"
                >
                  <span className="w-2 h-2 rounded-full bg-[#a6e3a1] animate-pulse"></span>
                  <span>{lang === 'en' ? `Tools (${skills.length + mcpTools.length})` : `就绪工具 (${skills.length + mcpTools.length})`}</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                {activeDropdown === 'readyTools' && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full left-0 mb-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border-base)] rounded-xl shadow-lg z-30 w-80 py-3 px-4 max-h-[350px] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border-base)]">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">{lang === 'en' ? 'Active Tools & Skills' : '已就绪智能体工具'}</span>
                      <span className="text-[10px] text-emerald-500 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">ONLINE</span>
                    </div>

                    {/* Section 1: Skills */}
                    <div className="mb-3">
                      <div className="text-[10.5px] font-bold text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {lang === 'en' ? `Skills (${skills.length})` : `本地技能库 (${skills.length})`}
                      </div>
                      {skills.length === 0 ? (
                        <div className="text-[11px] text-[var(--color-text-muted)] italic pl-2.5">{lang === 'en' ? 'No local skills loaded.' : '暂无加载本地技能'}</div>
                      ) : (
                        <div className="flex flex-col gap-1 pl-2">
                          {skills.slice(0, 15).map((s: any) => (
                            <div key={s.id} className="group flex flex-col p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors">
                              <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">{s.name}</span>
                              <span className="text-[10.5px] text-[var(--color-text-muted)] line-clamp-1 group-hover:line-clamp-none transition-all duration-200">{s.description || 'No description'}</span>
                            </div>
                          ))}
                          {skills.length > 15 && (
                            <div className="text-[10px] text-[var(--color-text-muted)] italic pl-1 pt-1">
                              {lang === 'en' ? `... and ${skills.length - 15} more skills` : `... 以及另外 ${skills.length - 15} 个技能`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Section 2: MCP Tools */}
                    <div>
                      <div className="text-[10.5px] font-bold text-sky-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                        {lang === 'en' ? `MCP Tools (${mcpTools.length})` : `MCP 外部工具 (${mcpTools.length})`}
                      </div>
                      {mcpTools.length === 0 ? (
                        <div className="text-[11px] text-[var(--color-text-muted)] italic pl-2.5">{lang === 'en' ? 'No MCP tools connected.' : '未连接 MCP 外部工具'}</div>
                      ) : (
                        <div className="flex flex-col gap-1.5 pl-2 max-h-[150px] overflow-y-auto">
                          {mcpTools.map((t: any) => (
                            <div key={`${t.serverName}_${t.name}`} className="group flex flex-col p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors border-l-2 border-sky-500/30 pl-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-[var(--color-text-primary)]">{t.name}</span>
                                <span className="text-[9px] text-sky-500 font-bold bg-sky-500/10 px-1 py-0.2 rounded border border-sky-500/15">{t.serverName}</span>
                              </div>
                              <span className="text-[10.5px] text-[var(--color-text-muted)] line-clamp-1 group-hover:line-clamp-none transition-all duration-200">{t.description || 'No description'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseAssistantMessage(content: string) {
  const parts: { type: 'text' | 'tool' | 'think'; content: string; toolName?: string; status?: 'done' | 'running' }[] = [];
  
  // Parse think blocks first
  const thinkStart = content.indexOf('<think>');
  if (thinkStart >= 0) {
    const textBefore = content.substring(0, thinkStart);
    if (textBefore.trim()) {
      parts.push(...parseToolsAndText(textBefore));
    }
    
    const thinkEnd = content.indexOf('</think>', thinkStart);
    if (thinkEnd >= 0) {
      const thinkContent = content.substring(thinkStart + 7, thinkEnd);
      parts.push({ type: 'think', content: thinkContent, status: 'done' });
      
      const textAfter = content.substring(thinkEnd + 8);
      if (textAfter.trim()) {
        parts.push(...parseToolsAndText(textAfter));
      }
    } else {
      const thinkContent = content.substring(thinkStart + 7);
      parts.push({ type: 'think', content: thinkContent, status: 'running' });
    }
  } else {
    parts.push(...parseToolsAndText(content));
  }
  
  return parts;
}

function parseToolsAndText(content: string) {
  const parts: { type: 'text' | 'tool'; content: string; toolName?: string; status?: 'done' | 'running' }[] = [];
  const toolSplitter = /> 🔧 \*\*Agent Executing Tool:\*\* `(.*?)`\.\.\./g;
  let lastIndex = 0;
  let match;
  
  while ((match = toolSplitter.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      parts.push({ type: 'text', content: textBefore });
    }
    
    const toolName = match[1];
    const rest = content.substring(toolSplitter.lastIndex);
    const codeBlockMatch = rest.match(/^\n*```\n([\s\S]*?)\n```/);
    
    if (codeBlockMatch) {
      parts.push({
        type: 'tool',
        toolName,
        content: codeBlockMatch[1],
        status: 'done'
      });
      toolSplitter.lastIndex += codeBlockMatch[0].length;
    } else {
      const codeBlockStartMatch = rest.match(/^\n*```\n([\s\S]*)$/);
      const toolOutput = codeBlockStartMatch ? codeBlockStartMatch[1] : '';
      parts.push({
        type: 'tool',
        toolName,
        content: toolOutput,
        status: 'running'
      });
      toolSplitter.lastIndex = content.length;
    }
    
    lastIndex = toolSplitter.lastIndex;
  }
  
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    if (textAfter.trim() || parts.length === 0) {
      parts.push({ type: 'text', content: textAfter });
    }
  }
  
  return parts;
}

function cleanThinkTags(text: string): string {
  if (!text) return '';
  return text
    .replace(/<think>/gi, '')
    .replace(/<\/think>/gi, '')
    .replace(/<thinking>/gi, '')
    .replace(/<\/thinking>/gi, '')
    .trim();
}

function ThinkingBlock({ content, status, lang }: { content: string; status?: 'done' | 'running'; lang: Language }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const cleanedContent = cleanThinkTags(content);
  
  return (
    <div className="my-3 border border-[var(--color-border-base)] rounded-xl overflow-hidden shadow-sm bg-gray-50/50 dark:bg-slate-900/30">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-2.5 bg-gray-100/70 dark:bg-slate-800/40 text-gray-500 dark:text-gray-400 text-xs border-b border-[var(--color-border-base)] select-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/60 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Brain className={`w-4 h-4 text-purple-500 ${status === 'running' ? 'animate-pulse' : ''}`} />
          <span>{lang === 'en' ? 'Thinking Process' : '思考过程'}</span>
          {status === 'running' && <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-purple-500"></span></span>}
        </div>
        <button className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          {isExpanded ? (lang === 'en' ? 'Collapse' : '收起') : (lang === 'en' ? 'Expand' : '展开')}
        </button>
      </div>
      {isExpanded && (
        <div className="p-4 text-xs font-mono whitespace-pre-wrap text-gray-600 dark:text-gray-300 leading-relaxed max-h-[300px] overflow-y-auto bg-white/30 dark:bg-slate-950/20 italic">
          {cleanedContent || (lang === 'en' ? 'Thinking...' : '正在思考...')}
        </div>
      )}
    </div>
  );
}

function CodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 border border-[var(--color-border-base)] rounded-xl overflow-hidden shadow-sm bg-gray-50 dark:bg-slate-900 font-mono text-[13px] leading-relaxed">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-xs border-b border-[var(--color-border-base)] select-none">
        <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-slate-800 text-[11px] font-semibold cursor-pointer text-gray-600 dark:text-gray-300"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto max-h-[500px] whitespace-pre text-[var(--color-text-primary)]">
        <code>{content}</code>
      </pre>
    </div>
  );
}

interface TaskItem {
  status: 'pending' | 'running' | 'completed';
  description: string;
}

interface TaskBlock {
  type: 'text' | 'code' | 'tasks';
  content: string;
  language?: string;
  tasks?: TaskItem[];
}

function parseTextWithCodeBlocksAndTasks(text: string): TaskBlock[] {
  const parts: TaskBlock[] = [];
  const lines = text.split('\n');
  let currentBlock: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let currentTasks: TaskItem[] = [];

  const flushCurrentTextOrTasks = () => {
    if (currentTasks.length > 0) {
      parts.push({
        type: 'tasks',
        content: '',
        tasks: currentTasks
      });
      currentTasks = [];
    } else if (currentBlock.length > 0) {
      parts.push({
        type: 'text',
        content: currentBlock.join('\n')
      });
      currentBlock = [];
    }
  };

  const taskRegex = /^\s*[-*+]\s+\[([ xX/])\]\s+(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        parts.push({
          type: 'code',
          content: currentBlock.join('\n'),
          language: codeLanguage
        });
        currentBlock = [];
        inCodeBlock = false;
        codeLanguage = '';
      } else {
        // Start of code block
        flushCurrentTextOrTasks();
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3).trim();
      }
    } else if (inCodeBlock) {
      currentBlock.push(line);
    } else {
      const match = line.match(taskRegex);
      if (match) {
        if (currentBlock.length > 0) {
          parts.push({
            type: 'text',
            content: currentBlock.join('\n')
          });
          currentBlock = [];
        }
        
        const statusChar = match[1].toLowerCase();
        let status: 'pending' | 'running' | 'completed' = 'pending';
        if (statusChar === 'x') status = 'completed';
        else if (statusChar === '/') status = 'running';
        
        currentTasks.push({
          status,
          description: match[2].trim()
        });
      } else if (line.trim() === '' && currentTasks.length > 0) {
        continue;
      } else {
        if (currentTasks.length > 0) {
          parts.push({
            type: 'tasks',
            content: '',
            tasks: currentTasks
          });
          currentTasks = [];
        }
        currentBlock.push(line);
      }
    }
  }

  if (inCodeBlock) {
    parts.push({
      type: 'code',
      content: currentBlock.join('\n'),
      language: codeLanguage
    });
  } else {
    flushCurrentTextOrTasks();
  }

  return parts;
}

function TaskListWidget({ tasks }: { tasks: TaskItem[] }) {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const running = tasks.filter(t => t.status === 'running').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="my-4 p-4 border border-[var(--color-border-base)] rounded-xl bg-gray-50/50 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm max-w-xl animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
          {running > 0 ? '⚡ 任务执行中...' : (completed === total ? '✅ 任务已完成' : '📋 任务清单')}
        </span>
        <span className="text-xs font-mono text-[var(--color-text-muted)] font-medium">
          {completed}/{total} ({percent}%)
        </span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-gray-200 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" 
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {tasks.map((task, idx) => {
          const isCompleted = task.status === 'completed';
          const isRunning = task.status === 'running';

          return (
            <div 
              key={idx} 
              className={`flex items-start gap-3 p-2 rounded-lg transition-all duration-300 ${
                isRunning 
                  ? 'bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 shadow-sm' 
                  : 'border border-transparent'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted && (
                  <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold select-none shadow-sm">
                    ✓
                  </span>
                )}
                {isRunning && (
                  <span className="w-4 h-4 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-[10px] font-bold select-none animate-spin shadow-sm">
                    ↻
                  </span>
                )}
                {!isCompleted && !isRunning && (
                  <span className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-transparent flex items-center justify-center select-none" />
                )}
              </div>
              <div className={`text-xs leading-relaxed ${
                isCompleted 
                  ? 'text-[var(--color-text-muted)] line-through decoration-gray-400 dark:decoration-gray-600' 
                  : (isRunning ? 'text-[var(--color-text-primary)] font-semibold animate-pulse' : 'text-[var(--color-text-secondary)]')
              }`}>
                {task.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderDiffContent(content: string, isRunning: boolean) {
  if (!content) {
    return <span className="text-slate-500 italic">{isRunning ? 'Establishing pipeline with agent daemon...' : 'Output was empty'}</span>;
  }

  const lines = content.split('\n');
  const hasDiffIndicators = lines.some(l => l.startsWith('+') || l.startsWith('-') || l.startsWith('@@'));
  
  if (!hasDiffIndicators) {
    return <span className="text-[#a6e3a1] whitespace-pre">{content}</span>;
  }

  return (
    <div className="flex flex-col font-mono text-[11px] leading-relaxed">
      {lines.map((line, idx) => {
        let className = "text-slate-300";
        let bgStyle = "";
        
        if (line.startsWith('+')) {
          className = "text-[#a6e3a1] font-semibold";
          bgStyle = "bg-emerald-500/10 border-l-2 border-emerald-500 pl-1.5";
        } else if (line.startsWith('-')) {
          className = "text-[#f38ba8] font-semibold";
          bgStyle = "bg-red-500/10 border-l-2 border-red-500 pl-1.5";
        } else if (line.startsWith('@@')) {
          className = "text-[#89b4fa] font-bold";
          bgStyle = "bg-[#89b4fa]/5 pl-1.5";
        } else {
          className = "text-slate-300 pl-2";
        }
        
        return (
          <div key={idx} className={`${bgStyle} min-h-[18px] py-0.5 whitespace-pre-wrap select-text`}>
            <span className={className}>{line}</span>
          </div>
        );
      })}
    </div>
  );
}

function ToolExecutionBlock({ block, lang }: { block: any; lang: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isRunning = block.status === 'running';

  return (
    <div className="my-4 border border-slate-200/80 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-lg bg-[#181825] text-slate-200 transition-all duration-300">
      {/* Terminal Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-[#11111b]/90 hover:bg-[#1e1e2e] text-slate-300 text-xs font-mono select-none cursor-pointer border-b border-[#313244]/50 transition-colors"
      >
        {/* Left: macOS dots & Title */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 shrink-0 select-none">
            <span className="w-3 h-3 rounded-full bg-[#f38ba8] opacity-90"></span>
            <span className="w-3 h-3 rounded-full bg-[#f9e2af] opacity-90"></span>
            <span className="w-3 h-3 rounded-full bg-[#a6e3a1] opacity-90"></span>
          </div>
          <span className="text-[11px] text-slate-400 font-bold border-l border-slate-700/50 pl-3 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-[#89b4fa]" />
            <span>
              {lang === 'en' ? 'Subprocess Terminal:' : '子进程终端:'} 
              <span className="text-white ml-1 font-bold">{block.toolName}</span>
            </span>
          </span>
        </div>
        
        {/* Right: Status badge & Toggle */}
        <div className="flex items-center gap-3">
          {isRunning ? (
            <span className="flex items-center gap-1.5 text-[#f9e2af] font-bold bg-[#f9e2af]/10 px-2 py-0.5 rounded-full text-[10.5px] border border-[#f9e2af]/25 animate-pulse">
              <Loader className="w-3.5 h-3.5 animate-spin" /> 
              <span>{lang === 'en' ? 'Running' : '执行中'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#a6e3a1] font-bold bg-[#a6e3a1]/10 px-2 py-0.5 rounded-full text-[10.5px] border border-[#a6e3a1]/25">
              <CheckCircle className="w-3.5 h-3.5 text-[#a6e3a1]" /> 
              <span>{lang === 'en' ? 'Success' : '已完成'}</span>
            </span>
          )}
          
          <span className="text-[10px] text-slate-400 font-semibold bg-[#11111b] px-2 py-0.5 rounded border border-[#313244] flex items-center gap-1 hover:text-white transition-colors">
            {isExpanded ? (lang === 'en' ? 'Hide' : '显示') : (lang === 'en' ? 'Show' : '展开')}
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </span>
        </div>
      </div>

      {/* Terminal Content Panel */}
      {isExpanded && (
        <div className="p-4 bg-[#11111b]/95 font-mono text-[12px] leading-relaxed text-[#cdd6f4] overflow-x-auto max-h-80 border-t border-[#11111b] animate-in slide-in-from-top-2 duration-200">
          {/* Shell line */}
          <div className="flex items-center gap-2 text-slate-500 mb-2 select-none">
            <span className="text-[#a6e3a1]">orca-agent</span>
            <span className="text-slate-400">@</span>
            <span className="text-[#89b4fa]">powershell</span>
            <span className="text-[#cdd6f4]">$</span>
            <span className="text-[#89dceb]">{block.toolName} --exec</span>
          </div>
          
          {/* Code output console wrapper */}
          <div className="overflow-x-auto bg-[#1e1e2e]/50 p-3 rounded-lg border border-[#313244]/40 font-mono select-text">
            {renderDiffContent(block.content, isRunning)}
          </div>
        </div>
      )}
    </div>
  );
}
