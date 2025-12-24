import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Send, Paperclip, Mic, Bot, User, Settings, X, Sparkles, RefreshCw, ChevronDown, ChevronRight, Check, RotateCcw, Square, Terminal, Code2, Plus, Save, Loader2, Bug, Copy } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachedFiles?: AttachedFile[];
}

interface ProviderConfig {
  apiKey: string;
  highSpeedTextModel: string;
  standardTextModel: string;
  longContextModel: string;
  highSpeedMultimodalModel: string;
  standardMultimodalModel: string;
  embeddingModel: string;
  rerankModel: string;
  baseUrl: string;
  temperature: number;
}

interface AISettings extends ProviderConfig {
  provider: string;
  providerConfigs: Record<string, ProviderConfig>;
}

interface ModelSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
}

const ModelSelect: React.FC<ModelSelectProps> = ({ label, value, onChange, options, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseOverRef = useRef(false);

  const handleMouseEnter = () => {
    isMouseOverRef.current = true;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    isMouseOverRef.current = false;
    if (document.activeElement === searchInputRef.current) return;
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  return (
    <div className="space-y-1 relative">
      <label className="text-gray-400 block text-xs">{label}</label>
      <div 
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div 
            className={`w-full bg-[#2b2b2b] border border-[#3e3e3e] rounded p-2 text-white flex justify-between items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <input
                type="text"
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Select or type model..."
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(true)}
            />
            <ChevronDown 
                size={14} 
                className={`transition-transform flex-shrink-0 cursor-pointer ${isOpen ? 'rotate-180' : ''}`} 
                onClick={() => !disabled && setIsOpen(!isOpen)}
            />
        </div>

        {isOpen && !disabled && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#252526] border border-[#3e3e3e] rounded shadow-xl z-50 max-h-60 flex flex-col">
                <div className="p-2 border-b border-[#3e3e3e] bg-[#252526] sticky top-0 z-10">
                    <input 
                        ref={searchInputRef}
                        type="text"
                        className="w-full bg-[#1e1e1e] border border-[#3e3e3e] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary placeholder-gray-500"
                        placeholder="Filter models..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => {
                            if (!isMouseOverRef.current) setIsOpen(false);
                        }}
                    />
                </div>
                <div className="overflow-y-auto max-h-40">
                    {options.filter(opt => opt.toLowerCase().includes(search.toLowerCase())).map(opt => (
                        <div 
                            key={opt}
                            className={`px-2 py-1.5 hover:bg-[#3e3e3e] cursor-pointer text-sm truncate ${opt === value ? 'text-primary' : 'text-gray-200'}`}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                        >
                            {opt}
                        </div>
                    ))}
                    {options.length === 0 && <div className="p-2 text-gray-500 text-xs">No models found</div>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

interface ChatInterfaceProps {
  workspacePath?: string | null;
}

interface AttachedFile {
  path: string;
  name: string;
  size?: number;
}

const CopyButton = ({ content, className = "" }: { content: string, className?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 ${className}`}
      title="Copy message"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
};

const ToolCallBlock = ({ content }: { content: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const funcMatch = /✿FUNCTION✿:\s*(.+)/.exec(content);
  const argsMatch = /✿ARGS✿:\s*(.+)/s.exec(content);
  
  const funcName = funcMatch ? funcMatch[1].trim() : 'Unknown Tool';
  let args = {};
  try {
    if (argsMatch) {
      args = JSON.parse(argsMatch[1].trim());
    }
  } catch (e) {
    args = { error: 'Invalid JSON args' };
  }

  return (
    <div className="my-2 border border-blue-500/30 bg-blue-500/10 rounded-md overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-blue-500/20 px-3 py-2 flex items-center gap-2 text-blue-300 text-xs font-mono border-b border-blue-500/20 hover:bg-blue-500/30 transition-colors text-left"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Terminal size={14} />
        <span>Tool Call: {funcName}</span>
      </button>
      {isOpen && (
        <div className="p-3 text-xs font-mono text-gray-300 overflow-x-auto">
          <pre>{JSON.stringify(args, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

const ToolResultBlock = ({ content, onSaveTool }: { content: string, onSaveTool?: (name: string, code: string, description: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  // Check if content is a temporary tool creation result
  let toolData = null;
  try {
    const parsed = JSON.parse(content);
    if (parsed.status === "temporary_tool_created") {
      toolData = parsed;
    }
  } catch (e) {
    // Not JSON or not our specific JSON
  }

  if (toolData) {
    return (
      <div className="my-2 border border-purple-500/30 bg-purple-500/10 rounded-md overflow-hidden">
        <div className="w-full bg-purple-500/20 px-3 py-2 flex items-center justify-between border-b border-purple-500/20">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-purple-300 text-xs font-mono hover:text-purple-200 transition-colors flex-1 text-left"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Code2 size={14} />
            <span>New Tool: {toolData.name}</span>
          </button>
          
          <div className="flex items-center gap-2">
             <span className="text-[10px] bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-200 border border-purple-500/30">Temp</span>
             <button 
                onClick={async (e) => {
                    e.stopPropagation();
                    if (onSaveTool && !isSaved) {
                        await onSaveTool(toolData.name, toolData.code, toolData.description);
                        setIsSaved(true);
                    }
                }}
                disabled={isSaved}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors shadow-sm ${
                  isSaved 
                    ? "bg-green-600 text-white cursor-default" 
                    : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}
                title={isSaved ? "Tool saved" : "Save this tool permanently"}
              >
                {isSaved ? <Check size={10} /> : <Save size={10} />}
                {isSaved ? "Saved" : "Save"}
              </button>
          </div>
        </div>
        
        {isOpen && (
          <div className="p-3 text-xs font-mono text-gray-300">
            <div className="mb-2 text-gray-400 italic">{toolData.description}</div>
            <div className="bg-[#1e1e1e] p-2 rounded border border-gray-700 overflow-x-auto">
              <pre className="text-blue-300">{toolData.usage}</pre>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="my-2 border border-green-500/30 bg-green-500/10 rounded-md overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-green-500/20 px-3 py-2 flex items-center gap-2 text-green-300 text-xs font-mono border-b border-green-500/20 hover:bg-green-500/30 transition-colors text-left"
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Check size={14} />
        <span>Tool Result</span>
      </button>
      {isOpen && (
        <div className="p-3 text-xs font-mono text-gray-300 overflow-x-auto max-h-60">
          <pre>{content.trim()}</pre>
        </div>
      )}
    </div>
  );
};

const ThinkingBlock = ({ content, subtitle, isFinished }: { content: string, subtitle?: string, isFinished: boolean }) => {
  const [isOpen, setIsOpen] = useState(!isFinished);

  useEffect(() => {
    if (isFinished) {
      setIsOpen(false);
    }
  }, [isFinished]);

  return (
    <div className="my-2 border border-gray-700 rounded-md overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#2b2b2b] px-3 py-2 flex items-center gap-2 text-gray-400 text-xs hover:bg-[#3e3e3e] transition-colors"
        title={isFinished ? "Finished" : "Thinking..."}
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {isFinished ? (
            <Check size={14} className="text-green-500" />
        ) : (
            <Loader2 size={14} className="animate-spin text-blue-400" />
        )}
        <span>{subtitle || "思考过程"}</span>
      </button>
      {isOpen && (
        <div className="p-3 text-gray-400 text-sm bg-[#1e1e1e] border-t border-gray-700">
          <ReactMarkdown
            components={{
              ul: ({node, children, ...props}) => <ul className="pl-0 space-y-2 my-2" {...props}>{children}</ul>,
              ol: ({node, children, ...props}) => <ol className="pl-0 space-y-2 my-2" {...props}>{children}</ol>,
              li: ({node, children, ...props}) => (
                <li className="flex items-center gap-2 list-none bg-[#2b2b2b]/50 px-2 py-1.5 rounded border border-gray-700/50">
                  <span className="shrink-0 text-green-500 bg-green-500/10 p-0.5 rounded-full">
                    <Check size={10} />
                  </span>
                  <span className="flex-1 font-medium text-gray-300 text-xs">{children}</span>
                </li>
              ),
              p: ({node, children, ...props}) => <p className="mb-2 last:mb-0" {...props}>{children}</p>
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

const MessageContent = ({ content, onSaveTool }: { content: string, onSaveTool?: (name: string, code: string, description: string) => void }) => {
  // Split content by tags. We use a more permissive regex for the subtitle to ensure we capture it even if there are newlines or spaces.
  const parts = content.split(/(<thinking>[\s\S]*?<\/thinking>(?:[\s\S]*?<subtitle>[\s\S]*?<\/subtitle>)?|<tool>[\s\S]*?<\/tool>|<tool_result>[\s\S]*?<\/tool_result>)/g);

  return (
    <div className="space-y-2">
      {parts.map((part, index) => {
        if (part.startsWith('<thinking>')) {
          const subtitleMatch = part.match(/<subtitle>([\s\S]*?)<\/subtitle>/);
          const subtitle = subtitleMatch ? subtitleMatch[1].trim() : undefined;
          // Check for closing tag to determine if finished
          const isFinished = part.includes('</thinking>');
          
          // Remove tags to get inner content
          let inner = part.replace(/<\/?thinking>/g, '');
          if (subtitleMatch) {
             inner = inner.replace(subtitleMatch[0], '');
          }
          // Also clean up any leading/trailing whitespace that might have been captured between tags
          inner = inner.trim();

          return <ThinkingBlock key={index} content={inner} subtitle={subtitle} isFinished={isFinished} />;
        }
        if (part.startsWith('<tool>')) {
          const inner = part.replace(/<\/?tool>/g, '');
          return <ToolCallBlock key={index} content={inner} />;
        }
        if (part.startsWith('<tool_result>')) {
          const inner = part.replace(/<\/?tool_result>/g, '');
          return <ToolResultBlock key={index} content={inner} onSaveTool={onSaveTool} />;
        }
        if (!part.trim()) return null;
        
        return (
          <ReactMarkdown 
            key={index}
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeRaw]}
            components={{
              pre: ({node, children, ...props}) => (
                <div className="overflow-x-auto w-full my-2 rounded bg-[#2b2b2b] max-w-full">
                  <pre className="p-2 min-w-full w-fit" {...props}>
                    {children}
                  </pre>
                </div>
              ),
              code({node, inline, className, children, ...props}: any) {
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={`${className} bg-white/10 rounded px-1 py-0.5`} {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {part}
          </ReactMarkdown>
        );
      })}
    </div>
  );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ workspacePath }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am Wand, your all-purpose AI assistant. How can I help you today?',
      timestamp: Date.now()
    }
  ]);
  const [showSettings, setShowSettings] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [settings, setSettings] = useState<AISettings>(() => {
    const saved = localStorage.getItem('wand_ai_settings');
    const defaultProviderConfig: ProviderConfig = {
      apiKey: '',
      highSpeedTextModel: '',
      standardTextModel: '',
      longContextModel: '',
      highSpeedMultimodalModel: '',
      standardMultimodalModel: '',
      embeddingModel: '',
      rerankModel: '',
      baseUrl: '',
      temperature: 0.3
    };

    const defaultSettings: AISettings = {
      provider: 'SiliconFlow (DeepSeek)',
      ...defaultProviderConfig,
      baseUrl: 'https://api.siliconflow.cn/v1',
      providerConfigs: {
        'SiliconFlow (DeepSeek)': {
          ...defaultProviderConfig,
          baseUrl: 'https://api.siliconflow.cn/v1'
        },
        'Aliyun Bailian (百炼)': {
          ...defaultProviderConfig,
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        },
        'OpenAI': {
          ...defaultProviderConfig,
          baseUrl: 'https://api.openai.com/v1'
        },
        'Custom': {
          ...defaultProviderConfig
        }
      }
    };
    
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure providerConfigs exists for migration
      if (!parsed.providerConfigs) {
        parsed.providerConfigs = defaultSettings.providerConfigs;
        // Save current flat settings to the current provider config
        if (parsed.provider) {
            parsed.providerConfigs[parsed.provider] = {
                apiKey: parsed.apiKey || '',
                highSpeedTextModel: parsed.highSpeedTextModel || '',
                standardTextModel: parsed.standardTextModel || '',
                longContextModel: parsed.longContextModel || '',
                highSpeedMultimodalModel: parsed.highSpeedMultimodalModel || '',
                standardMultimodalModel: parsed.standardMultimodalModel || '',
                embeddingModel: parsed.embeddingModel || '',
                rerankModel: parsed.rerankModel || '',
                baseUrl: parsed.baseUrl || '',
                temperature: parsed.temperature || 0.3
            };
        }
      }
      return { ...defaultSettings, ...parsed };
    }
    return defaultSettings;
  });
  const [availableModels, setAvailableModels] = useState<string[]>(() => {
    const savedProviderModels = localStorage.getItem('wand_provider_models');
    const providerModels = savedProviderModels ? JSON.parse(savedProviderModels) : {};
    
    // Migration for legacy single list (assuming it was SiliconFlow)
    const legacyModels = localStorage.getItem('wand_available_models');
    if (legacyModels && !providerModels['SiliconFlow (DeepSeek)']) {
        try {
            const parsedLegacy = JSON.parse(legacyModels);
            if (Array.isArray(parsedLegacy)) {
                providerModels['SiliconFlow (DeepSeek)'] = parsedLegacy;
                localStorage.setItem('wand_provider_models', JSON.stringify(providerModels));
            }
        } catch (e) {
            console.error('Failed to migrate legacy models', e);
        }
    }
    
    return providerModels[settings.provider] || [];
  });
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('wand_ai_settings', JSON.stringify(settings));
  }, [settings]);

  const handleSaveSettings = () => {
    setShowSettings(false);
  };

  const handleResetSettings = () => {
    if (confirm('确定要重置所有设置吗？这将清除 API Key 和自定义模型配置。')) {
      localStorage.removeItem('wand_ai_settings');
      localStorage.removeItem('wand_available_models');
      localStorage.removeItem('wand_provider_models');
      // Force reload to reset state
      window.location.reload();
    }
  };

  const handleProviderChange = (newProvider: string) => {
    // Save current settings to providerConfigs
    const currentConfig: ProviderConfig = {
      apiKey: settings.apiKey,
      highSpeedTextModel: settings.highSpeedTextModel,
      standardTextModel: settings.standardTextModel,
      longContextModel: settings.longContextModel,
      highSpeedMultimodalModel: settings.highSpeedMultimodalModel,
      standardMultimodalModel: settings.standardMultimodalModel,
      embeddingModel: settings.embeddingModel,
      rerankModel: settings.rerankModel,
      baseUrl: settings.baseUrl,
      temperature: settings.temperature
    };

    const updatedConfigs = {
      ...settings.providerConfigs,
      [settings.provider]: currentConfig
    };

    // Load new provider settings
    const newConfig = updatedConfigs[newProvider] || {
      apiKey: '',
      highSpeedTextModel: '',
      standardTextModel: '',
      longContextModel: '',
      highSpeedMultimodalModel: '',
      standardMultimodalModel: '',
      embeddingModel: '',
      rerankModel: '',
      baseUrl: '',
      temperature: 0.3
    };

    setSettings({
      ...settings,
      provider: newProvider,
      providerConfigs: updatedConfigs,
      ...newConfig
    });

    // Update available models for the new provider
    const allModels = JSON.parse(localStorage.getItem('wand_provider_models') || '{}');
    setAvailableModels(allModels[newProvider] || []);
  };

  const handleFetchModels = async () => {
    if (settings.provider !== 'SiliconFlow (DeepSeek)') {
      alert('当前服务商不支持自动获取模型列表，请手动填写模型名称。');
      return;
    }

    if (!settings.apiKey) {
      alert('Please enter an API Key first.');
      return;
    }
    setIsFetchingModels(true);
    try {
      const models = await window.api.fetchModels(settings);
      setAvailableModels(models);
      
      const allModels = JSON.parse(localStorage.getItem('wand_provider_models') || '{}');
      allModels[settings.provider] = models;
      localStorage.setItem('wand_provider_models', JSON.stringify(allModels));
    } catch (error) {
      console.error('Failed to fetch models:', error);
      alert('Failed to fetch models: ' + error);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleStop = () => {
    window.api.chatStop();
    setIsLoading(false);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Hello! I am Wand, your all-purpose AI assistant. How can I help you today?',
        timestamp: Date.now()
      }
    ]);
    setInput('');
    setAttachedFiles([]);
    setIsLoading(false);
    window.api.chatStop(); // Stop any ongoing generation
    window.api.clearTempTools().catch((err: any) => console.error("Failed to clear temp tools:", err));
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
      attachedFiles: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    const currentAttachedFiles = [...attachedFiles];
    setAttachedFiles([]); // Clear attachments after sending

    // Create a placeholder for the AI response
    const aiResponseId = (Date.now() + 1).toString();
    const aiResponse: Message = {
      id: aiResponseId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, aiResponse]);

    try {
      setIsLoading(true);
      // Call the AI service via IPC with streaming
      const config = { 
        ...settings, 
        workspacePath,
        files: currentAttachedFiles.map(f => f.path) // Pass attached files
      };
      
      // Prepare history: exclude the current new message (it's sent as 'message') and the placeholder
      // Actually, let's send the full history including the new message, but handle it in backend.
      // Or better: send previous messages as history, and current input as message.
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      window.api.chatStream(
        input, 
        history,
        config,
        (chunk: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === aiResponseId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
        },
        () => {
          console.log('Stream finished');
          setIsLoading(false);
        },
        (error: string) => {
          console.error('Stream error:', error);
          setIsLoading(false);
          setMessages(prev => prev.map(msg => 
            msg.id === aiResponseId 
              ? { ...msg, content: msg.content + `\n[Error: ${error}]` }
              : msg
          ));
        }
      );
    } catch (error) {
      console.error('Failed to start AI chat:', error);
    }
  };

  const handleFileSelect = async () => {
    try {
      const result = await window.api.showOpenDialog();
      if (!result.canceled && result.filePaths.length > 0) {
        const newFiles = result.filePaths.map((path: string) => ({
          path,
          name: path.split(/[\\/]/).pop() || path
        }));
        setAttachedFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Try to get file from custom drag data (from FileExplorer)
    const wandFileData = e.dataTransfer.getData('application/wand-file');
    if (wandFileData) {
      try {
        const node = JSON.parse(wandFileData);
        if (!attachedFiles.some(f => f.path === node.path)) {
          setAttachedFiles(prev => [...prev, { path: node.path, name: node.name }]);
        }
        return;
      } catch (e) {
        console.error('Failed to parse wand file data', e);
      }
    }

    // Fallback to standard file drop (from OS)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles: AttachedFile[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        // Note: 'path' property on File object is available in Electron renderer
        const path = (file as any).path; 
        if (path && !attachedFiles.some(f => f.path === path)) {
          newFiles.push({ path, name: file.name, size: file.size });
        }
      }
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className="flex flex-col h-full relative bg-[#1e1e1e]"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="p-4 border-b border-[#2b2b2b] flex justify-between items-center bg-[#252526]">
        <span className="font-medium text-sm text-white">Wand Assistant</span>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowDebug(true)}
            className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
            title="Debug Messages"
          >
            <Bug size={16} />
          </button>
          <button 
            onClick={handleNewChat}
            className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
            title="New Chat"
          >
            <Plus size={16} />
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
            title="AI Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Debug Modal */}
      {showDebug && (
        <div className="absolute inset-0 bg-[#1e1e1e] z-50 flex flex-col p-4 overflow-hidden">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <div className="flex items-center gap-2 text-yellow-500">
              <Bug size={18} />
              <span className="font-medium">Debug Messages</span>
            </div>
            <button 
              onClick={() => setShowDebug(false)}
              className="text-sm text-gray-400 hover:text-white"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-[#2b2b2b] p-4 rounded border border-[#3e3e3e] font-mono text-xs text-gray-300">
            <pre>{JSON.stringify(messages, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-[#1e1e1e] z-50 flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <span className="font-medium">AI 对话设置</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleResetSettings}
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                title="重置设置"
              >
                <RotateCcw size={14} />
                <span>重置</span>
              </button>
              <button 
                onClick={handleSaveSettings}
                className="text-sm text-gray-400 hover:text-white"
              >
                关闭
              </button>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Bot size={16} />
              <span className="font-medium">对话模型</span>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 block">服务商</label>
              <select 
                className="w-full bg-[#2b2b2b] border border-[#3e3e3e] rounded p-2 text-white focus:outline-none focus:border-primary"
                value={settings.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                <option>SiliconFlow (DeepSeek)</option>
                <option>Aliyun Bailian (百炼)</option>
                <option>OpenAI</option>
                <option>Custom</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 block">API Key</label>
              <input 
                type="password" 
                className="w-full bg-[#2b2b2b] border border-[#3e3e3e] rounded p-2 text-white focus:outline-none focus:border-primary"
                value={settings.apiKey}
                onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
                placeholder="sk-..."
              />
            </div>

            <div className="space-y-3 border-t border-[#3e3e3e] pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-300">Model Configuration</span>
                <button 
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="p-1.5 bg-[#2b2b2b] border border-[#3e3e3e] rounded hover:bg-[#3e3e3e] text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  title="Refresh Models"
                >
                  <RefreshCw size={14} className={isFetchingModels ? 'animate-spin' : ''} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <ModelSelect 
                  label="高速文本模型 (High-speed Text)" 
                  value={settings.highSpeedTextModel} 
                  onChange={(v) => setSettings({...settings, highSpeedTextModel: v})} 
                  options={availableModels}
                />
                <ModelSelect 
                  label="标准文本模型 (Standard Text)" 
                  value={settings.standardTextModel} 
                  onChange={(v) => setSettings({...settings, standardTextModel: v})} 
                  options={availableModels}
                />
                <ModelSelect 
                  label="长文本模型 (Long Context)" 
                  value={settings.longContextModel} 
                  onChange={(v) => setSettings({...settings, longContextModel: v})} 
                  options={availableModels}
                />
                <ModelSelect 
                  label="高速多模态模型 (High-speed Multimodal)" 
                  value={settings.highSpeedMultimodalModel} 
                  onChange={(v) => setSettings({...settings, highSpeedMultimodalModel: v})} 
                  options={availableModels}
                />
                <ModelSelect 
                  label="标准多模态模型 (Standard Multimodal)" 
                  value={settings.standardMultimodalModel} 
                  onChange={(v) => setSettings({...settings, standardMultimodalModel: v})} 
                  options={availableModels}
                />
                <ModelSelect 
                  label="Embedding 模型" 
                  value={settings.embeddingModel} 
                  onChange={(v) => setSettings({...settings, embeddingModel: v})} 
                  options={availableModels}
                />
                <ModelSelect 
                  label="Rerank 模型" 
                  value={settings.rerankModel} 
                  onChange={(v) => setSettings({...settings, rerankModel: v})} 
                  options={availableModels}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 block">Base URL (可选，用于第三方代理)</label>
              <input 
                type="text" 
                className="w-full bg-[#2b2b2b] border border-[#3e3e3e] rounded p-2 text-white focus:outline-none focus:border-primary"
                value={settings.baseUrl}
                onChange={(e) => setSettings({...settings, baseUrl: e.target.value})}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <label className="text-gray-400 block">温度 (Temperature)</label>
                <span className="text-gray-400">{settings.temperature}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                className="w-full accent-primary h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                value={settings.temperature}
                onChange={(e) => setSettings({...settings, temperature: parseFloat(e.target.value)})}
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, index) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-transparent' : 'bg-gray-600'
            }`}>
              {msg.role === 'assistant' ? <Sparkles size={20} className="text-purple-400" /> : <User size={16} />}
            </div>
            <div className={`flex flex-col max-w-[85%] min-w-0 group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm text-white">Wand AI</span>
                  <span className="text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              
              <div className={`px-4 py-2 rounded-lg text-sm w-full overflow-hidden ${
                msg.role === 'assistant' 
                  ? `text-gray-300 pl-0 pt-0 prose prose-invert max-w-none prose-p:my-1 prose-pre:bg-[#2b2b2b] prose-pre:p-2 prose-pre:rounded ${isLoading && index === messages.length - 1 ? 'streaming-active' : ''}`
                  : 'bg-primary text-white'
              }`}>
                {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachedFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-1 bg-black/20 border border-white/10 rounded px-2 py-1 text-xs">
                        <Paperclip size={10} />
                        <span className="truncate max-w-[150px]" title={file.path}>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <MessageContent 
                    content={msg.content} 
                    onSaveTool={async (name, code, desc) => {
                      try {
                        await window.api.saveTool(name, code, desc);
                      } catch (error) {
                        console.error("Failed to save tool:", error);
                      }
                    }}
                  />
                ) : (
                  msg.content
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-1 px-1 h-6">
                <CopyButton 
                  content={msg.content} 
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white" 
                />
                {msg.role === 'user' && (
                  <span className="text-[10px] text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-accent bg-secondary/30">
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-[#2b2b2b] border border-[#3e3e3e] rounded-md px-2 py-1 text-xs text-gray-300">
                <span className="truncate max-w-[150px]" title={file.path}>{file.name}</span>
                <button 
                  onClick={() => removeAttachedFile(index)}
                  className="hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="relative bg-accent/50 rounded-lg border border-accent focus-within:border-primary/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything (Ctrl+L)..."
            className="w-full bg-transparent border-none p-3 pr-12 text-sm focus:ring-0 resize-none h-[80px] scrollbar-hide"
          />
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button 
              onClick={handleFileSelect}
              className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10"
              title="Attach files"
            >
              <Paperclip size={16} />
            </button>
            <button 
              onClick={isLoading ? handleStop : handleSend}
              className={`p-1.5 rounded-md transition-colors ${isLoading ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'} text-white`}
            >
              {isLoading ? <Square size={16} fill="currentColor" /> : <Send size={16} />}
            </button>
          </div>
        </div>
        <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
          <div className="flex gap-2">
            <button className="hover:text-gray-300">@ Context</button>
            <button className="hover:text-gray-300">/ Command</button>
          </div>
          <span>Markdown supported</span>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
