import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

interface ToolsModalProps {
  onClose: () => void;
}

const ToolsModal: React.FC<ToolsModalProps> = ({ onClose }) => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      // @ts-ignore
      const result = await window.electron.ipcRenderer.invoke('ai:get-tools', {});
      setTools(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] w-[800px] h-[600px] rounded-lg shadow-xl border border-[#333] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <h2 className="text-white font-medium">Available Tools</h2>
          <div className="flex items-center gap-2">
            <button onClick={fetchTools} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white" title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-gray-400 text-center mt-10">Loading tools...</div>
          ) : error ? (
            <div className="text-red-400 text-center mt-10">Error: {error}</div>
          ) : (
            <div className="grid gap-4">
              {tools.map((tool) => (
                <div key={tool.name} className="bg-[#252526] p-4 rounded border border-[#333]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[#4ec9b0] font-mono font-bold text-lg">{tool.name}</h3>
                  </div>
                  <p className="text-gray-300 mb-3 text-sm">{tool.description}</p>
                  
                  <div className="bg-[#1e1e1e] p-3 rounded text-xs font-mono text-gray-400">
                    <div className="mb-1 text-[#569cd6]">Parameters:</div>
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(tool.parameters, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolsModal;
