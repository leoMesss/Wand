import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, Bot, User, Settings, X, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AISettings {
  provider: string;
  apiKey: string;
  model: string;
  customModelId: string;
  baseUrl: string;
  temperature: number;
}

const ChatInterface: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am Wand, your all-purpose AI assistant. How can I help you today?',
      timestamp: Date.now()
    }
  ]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AISettings>({
    provider: 'DeepSeek - DeepSeek 系列模型',
    apiKey: '',
    model: '自定义模型',
    customModelId: 'deepseek-ai/DeepSeek-V3.2-Exp',
    baseUrl: 'https://api.siliconflow.cn/v1',
    temperature: 0.3
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const savedSettings = localStorage.getItem('wand_ai_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('wand_ai_settings', JSON.stringify(settings));
    setShowSettings(false);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');

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
      // Call the AI service via IPC with streaming
      window.api.chatStream(
        input, 
        settings,
        (chunk: string) => {
          setMessages(prev => prev.map(msg => 
            msg.id === aiResponseId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
        },
        () => {
          console.log('Stream finished');
        },
        (error: string) => {
          console.error('Stream error:', error);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-[#1e1e1e]">
      {/* Header */}
      <div className="p-4 border-b border-[#2b2b2b] flex justify-between items-center bg-[#252526]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400">
            <Sparkles size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm text-white">{settings.model === '自定义模型' ? 'Custom Model' : settings.model}</span>
            <div className="flex gap-1 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500/20" />
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors"
          title="AI Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-[#1e1e1e] z-50 flex flex-col p-4 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Settings size={18} />
              <span className="font-medium">AI 对话设置</span>
            </div>
            <button 
              onClick={handleSaveSettings}
              className="text-sm text-gray-400 hover:text-white"
            >
              关闭
            </button>
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
                onChange={(e) => setSettings({...settings, provider: e.target.value})}
              >
                <option>DeepSeek - DeepSeek 系列模型</option>
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

            <div className="space-y-1">
              <label className="text-gray-400 block">模型</label>
              <select 
                className="w-full bg-[#2b2b2b] border border-[#3e3e3e] rounded p-2 text-white focus:outline-none focus:border-primary"
                value={settings.model}
                onChange={(e) => setSettings({...settings, model: e.target.value})}
              >
                <option>自定义模型</option>
                <option>gpt-3.5-turbo</option>
                <option>gpt-4</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-gray-400 block">自定义模型 ID</label>
              <input 
                type="text" 
                className="w-full bg-[#2b2b2b] border border-[#3e3e3e] rounded p-2 text-white focus:outline-none focus:border-primary"
                value={settings.customModelId}
                onChange={(e) => setSettings({...settings, customModelId: e.target.value})}
                placeholder="e.g. deepseek-chat"
              />
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
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-primary' : 'bg-gray-600'
            }`}>
              {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
            </div>
            <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-2 rounded-lg text-sm ${
                msg.role === 'assistant' 
                  ? 'bg-accent text-foreground' 
                  : 'bg-primary text-white'
              }`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-500 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-accent bg-secondary/30">
        <div className="relative bg-accent/50 rounded-lg border border-accent focus-within:border-primary/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything (Ctrl+L)..."
            className="w-full bg-transparent border-none p-3 pr-12 text-sm focus:ring-0 resize-none h-[80px] scrollbar-hide"
          />
          <div className="absolute bottom-2 right-2 flex gap-1">
            <button className="p-1.5 text-gray-400 hover:text-white rounded-md hover:bg-white/10">
              <Paperclip size={16} />
            </button>
            <button 
              onClick={handleSend}
              className="p-1.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              <Send size={16} />
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
