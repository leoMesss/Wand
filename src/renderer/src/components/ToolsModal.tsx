import React, { useEffect, useState } from 'react';
import { X, RefreshCw, ChevronDown, ChevronRight, Trash2, Search, Plus } from 'lucide-react';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
  is_visible?: boolean;
  code?: string;
  permission_level?: number;
  tool_type?: string;
  is_gen?: boolean;
  metadata?: any;
}

interface ToolsModalProps {
  onClose: () => void;
}

const ToolsModal: React.FC<ToolsModalProps> = ({ onClose }) => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledTools, setEnabledTools] = useState<Set<string>>(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [editingCode, setEditingCode] = useState<{ [key: string]: string }>({});
  const [editingProps, setEditingProps] = useState<{ [key: string]: Partial<ToolDefinition> }>({});
  const [dirtyTools, setDirtyTools] = useState<Set<string>>(new Set());
  const [confirmingSave, setConfirmingSave] = useState<ToolDefinition | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<ToolDefinition | null>(null);
  const [revertOnCancel, setRevertOnCancel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTool, setNewTool] = useState<Partial<ToolDefinition>>({
    name: '',
    description: '',
    code: 'def new_tool():\n    """Description"""\n    pass',
    permission_level: 5,
    tool_type: 'general',
    is_gen: false,
    metadata: {}
  });
  const [newToolMetadata, setNewToolMetadata] = useState('{}');
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchTools = async () => {
    setLoading(true);
    setError(null);
    try {
      // @ts-ignore
      const result = await window.api.getAllTools();
      setTools(result);
      
      // Initialize enabled tools from localStorage
      const savedEnabled = localStorage.getItem('wand_enabled_tools');
      if (savedEnabled) {
        const enabledSet = new Set<string>(JSON.parse(savedEnabled));
        setEnabledTools(enabledSet);
        
        // Sync backend with localStorage state
        result.forEach(async (t: ToolDefinition) => {
          const shouldBeVisible = enabledSet.has(t.name);
          if (t.is_visible !== shouldBeVisible) {
             // @ts-ignore
             await window.electron.ipcRenderer.invoke('ai:update-tool-visibility', t.name, shouldBeVisible);
          }
        });
      } else {
        // Default to all enabled if no localStorage
        const allNames = result.map((t: ToolDefinition) => t.name);
        setEnabledTools(new Set(allNames));
        localStorage.setItem('wand_enabled_tools', JSON.stringify(allNames));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  const toggleTool = async (name: string) => {
    const isVisible = !enabledTools.has(name);
    
    // Optimistic update
    const newEnabled = new Set(enabledTools);
    if (isVisible) {
      newEnabled.add(name);
    } else {
      newEnabled.delete(name);
    }
    setEnabledTools(newEnabled);
    localStorage.setItem('wand_enabled_tools', JSON.stringify(Array.from(newEnabled)));

    try {
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('ai:update-tool-visibility', name, isVisible);
    } catch (err) {
      console.error('Failed to update tool visibility:', err);
      // Revert on error
      fetchTools();
    }
  };

  const toggleExpand = (name: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedTools(newExpanded);
  };

  const handleCodeChange = (name: string, newCode: string) => {
    setEditingCode(prev => ({ ...prev, [name]: newCode }));
    setDirtyTools(prev => new Set(prev).add(name));
  };

  const handlePropChange = (name: string, field: keyof ToolDefinition, value: any) => {
    setEditingProps(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        [field]: value
      }
    }));
    setDirtyTools(prev => new Set(prev).add(name));
  };

  const handleSaveTool = (tool: ToolDefinition, shouldRevertOnCancel: boolean = false) => {
    setConfirmingSave(tool);
    setRevertOnCancel(shouldRevertOnCancel);
  };

  const handleCancelSave = () => {
    if (confirmingSave && revertOnCancel) {
        handleCancelEdit(confirmingSave.name);
    }
    setConfirmingSave(null);
    setRevertOnCancel(false);
  };

  const executeSaveTool = async () => {
    if (!confirmingSave) return;
    const tool = confirmingSave;
    
    const codeToSave = editingCode[tool.name] !== undefined ? editingCode[tool.name] : tool.code;
    const propsToSave = editingProps[tool.name] || {};
    
    // Merge current tool props with edits
    const description = propsToSave.description !== undefined ? propsToSave.description : tool.description;
    const permission_level = propsToSave.permission_level !== undefined ? propsToSave.permission_level : (tool.permission_level || 0);
    const tool_type = propsToSave.tool_type !== undefined ? propsToSave.tool_type : (tool.tool_type || "");
    const is_gen = propsToSave.is_gen !== undefined ? propsToSave.is_gen : (tool.is_gen !== undefined ? tool.is_gen : true);
    
    let metadata = tool.metadata || {};
    if (propsToSave.metadata !== undefined) {
        try {
            metadata = JSON.parse(propsToSave.metadata);
        } catch (e) {
            console.error("Invalid JSON for metadata", e);
            // Optionally alert user
        }
    }
    
    // Note: saveTool supports name, code, description, permission_level, tool_type.

    if (!codeToSave) {
        setConfirmingSave(null);
        return;
    }

    try {
      // @ts-ignore
      await window.api.saveTool(tool.name, codeToSave, description, permission_level, tool_type, is_gen, metadata);
      
      // Clear dirty state
      const newDirty = new Set(dirtyTools);
      newDirty.delete(tool.name);
      setDirtyTools(newDirty);
      
      // Clear editing state
      const newEditingCode = { ...editingCode };
      delete newEditingCode[tool.name];
      setEditingCode(newEditingCode);

      const newEditingProps = { ...editingProps };
      delete newEditingProps[tool.name];
      setEditingProps(newEditingProps);
      
      // Refresh tools to get updated state
      await fetchTools();
    } catch (err) {
      console.error("Failed to save tool:", err);
      alert("Failed to save tool: " + err);
    } finally {
        setConfirmingSave(null);
    }
  };

  const handleCancelEdit = (name: string) => {
    const newDirty = new Set(dirtyTools);
    newDirty.delete(name);
    setDirtyTools(newDirty);
    
    const newEditingCode = { ...editingCode };
    delete newEditingCode[name];
    setEditingCode(newEditingCode);

    const newEditingProps = { ...editingProps };
    delete newEditingProps[name];
    setEditingProps(newEditingProps);
  };

  const handleDeleteTool = (tool: ToolDefinition) => {
    setConfirmingDelete(tool);
  };

  const executeDeleteTool = async () => {
    if (!confirmingDelete) return;
    const tool = confirmingDelete;

    try {
      // @ts-ignore
      await window.api.deleteTool(tool.name);
      
      // Update local state
      setTools(prev => prev.filter(t => t.name !== tool.name));
      
      const newEnabled = new Set(enabledTools);
      newEnabled.delete(tool.name);
      setEnabledTools(newEnabled);
      localStorage.setItem('wand_enabled_tools', JSON.stringify(Array.from(newEnabled)));
      
      const newExpanded = new Set(expandedTools);
      newExpanded.delete(tool.name);
      setExpandedTools(newExpanded);

    } catch (err) {
      console.error("Failed to delete tool:", err);
      alert("Failed to delete tool: " + err);
    } finally {
      setConfirmingDelete(null);
    }
  };

  const handleCreateTool = async () => {
    setCreateError(null);
    // Parse name and description from code
    const nameMatch = newTool.code?.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    const descriptionMatch = newTool.code?.match(/"""([\s\S]*?)"""/) || newTool.code?.match(/'''([\s\S]*?)'''/);

    const extractedName = nameMatch ? nameMatch[1] : '';
    const extractedDescription = descriptionMatch ? descriptionMatch[1].trim() : '';

    if (!newTool.code) {
      setCreateError("Code is required.");
      return;
    }

    if (!extractedName) {
        setCreateError("Could not find function name in code. Please define a function using 'def name(...):'");
        return;
    }

    if (!extractedDescription) {
        setCreateError("Could not find description in code. Please add a docstring using \"\"\"...\"\"\"");
        return;
    }

    if (extractedName === 'new_tool') {
        setCreateError("Please change the function name from 'new_tool' to something unique.");
        return;
    }

    if (extractedDescription === 'Description') {
        setCreateError("Please change the description from default 'Description' to something meaningful.");
        return;
    }

    let parsedMetadata = {};
    try {
        parsedMetadata = JSON.parse(newToolMetadata);
    } catch (e) {
        setCreateError("Invalid Metadata JSON");
        return;
    }
    
    try {
      // @ts-ignore
      const result = await window.api.saveTool(
        extractedName,
        newTool.code,
        extractedDescription,
        newTool.permission_level,
        newTool.tool_type,
        newTool.is_gen,
        parsedMetadata
      );

      if (result && result.message && result.message.startsWith("Error")) {
        setCreateError(result.message);
        return;
      }
      
      setIsCreating(false);
      setNewTool({
        name: '',
        description: '',
        code: 'def new_tool():\n    """Description"""\n    pass',
        permission_level: 5,
        tool_type: 'general',
        is_gen: false,
        metadata: {}
      });
      setNewToolMetadata('{}');
      setCreateError(null);
      fetchTools();
    } catch (err: any) {
      console.error("Failed to create tool:", err);
      setCreateError("Failed to create tool: " + err.message || err);
    }
  };

  const toggleAll = async () => {
    const shouldEnable = enabledTools.size !== tools.length;
    
    // Optimistic update
    let newEnabledSet: Set<string>;
    if (shouldEnable) {
      const allNames = tools.map(t => t.name);
      newEnabledSet = new Set(allNames);
    } else {
      newEnabledSet = new Set();
    }
    setEnabledTools(newEnabledSet);
    localStorage.setItem('wand_enabled_tools', JSON.stringify(Array.from(newEnabledSet)));

    // Update one by one for now (could be optimized with bulk update API)
    for (const tool of tools) {
      if (enabledTools.has(tool.name) !== shouldEnable) {
        try {
          // @ts-ignore
          await window.electron.ipcRenderer.invoke('ai:update-tool-visibility', tool.name, shouldEnable);
        } catch (err) {
          console.error(`Failed to update visibility for ${tool.name}:`, err);
        }
      }
    }
  };

  const filteredTools = tools.filter(tool => 
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] w-[800px] h-[600px] rounded-lg shadow-xl border border-[#333] flex flex-col relative">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-medium">Available Tools</h2>
            {!loading && !error && (
              <button 
                onClick={toggleAll}
                className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#252526] hover:bg-[#2d2d2d] border border-[#3e3e3e] transition-all group"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  enabledTools.size === tools.length && tools.length > 0
                    ? 'bg-blue-600 border-blue-600' 
                    : 'border-gray-500 group-hover:border-gray-400'
                }`}>
                  {enabledTools.size === tools.length && tools.length > 0 && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-300 font-medium">Select All</span>
              </button>
            )}
            
            <div className="relative ml-2">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" size={14} />
              <input 
                type="text"
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#252526] border border-[#3e3e3e] rounded-md text-xs text-gray-300 focus:outline-none focus:border-[#4ec9b0] w-[200px]"
              />
            </div>
            
            <button 
              onClick={() => setIsCreating(true)}
              className="p-1.5 bg-[#252526] hover:bg-[#2d2d2d] border border-[#3e3e3e] rounded-md text-gray-400 hover:text-white transition-colors ml-2"
              title="Create New Tool"
            >
              <Plus size={14} />
            </button>
          </div>
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
            <div className="grid gap-2">
              {filteredTools.map((tool) => (
                <div key={tool.name} className="bg-[#252526] rounded border border-[#333] overflow-hidden">
                  <div className="flex items-center p-3 bg-[#2b2b2b] hover:bg-[#333] transition-colors">
                    <input 
                      type="checkbox" 
                      checked={enabledTools.has(tool.name)}
                      onChange={() => toggleTool(tool.name)}
                      className="mr-3 h-4 w-4 rounded bg-[#1e1e1e] border-[#3e3e3e]"
                    />
                    <div 
                      className="flex-1 flex items-center cursor-pointer select-none"
                      onClick={() => toggleExpand(tool.name)}
                    >
                      {expandedTools.has(tool.name) ? (
                        <ChevronDown size={16} className="text-gray-400 mr-2" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400 mr-2" />
                      )}
                      <h3 className="text-[#4ec9b0] font-mono font-bold text-sm">{tool.name}</h3>
                      <span className="ml-3 text-gray-500 text-xs truncate max-w-[400px]">{tool.description}</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTool(tool);
                      }}
                      className="p-1 bg-[#4e2a2a] hover:bg-[#663333] rounded text-red-500 hover:text-red-400 transition-colors ml-2"
                      title="Delete Tool"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  {expandedTools.has(tool.name) && (
                    <div className="p-4 border-t border-[#333] bg-[#1e1e1e]">
                      
                      {/* Description Field */}
                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Description</label>
                        <textarea 
                          className="w-full h-[60px] bg-[#252526] text-gray-300 p-2 border border-[#3e3e3e] rounded focus:border-[#4ec9b0] focus:outline-none resize-y text-xs"
                          value={editingProps[tool.name]?.description !== undefined ? editingProps[tool.name].description : tool.description}
                          onChange={(e) => handlePropChange(tool.name, 'description', e.target.value)}
                          onBlur={() => { if (dirtyTools.has(tool.name)) handleSaveTool(tool, true); }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        {/* Permission Level */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Permission Level</label>
                          <select 
                            className="w-full bg-[#252526] text-gray-300 p-2 border border-[#3e3e3e] rounded focus:border-[#4ec9b0] focus:outline-none text-xs"
                            value={editingProps[tool.name]?.permission_level !== undefined ? editingProps[tool.name].permission_level : (tool.permission_level || 0)}
                            onChange={(e) => {
                                handlePropChange(tool.name, 'permission_level', parseInt(e.target.value) || 0);
                                handleSaveTool(tool, true);
                            }}
                          >
                            {[5, 6, 7, 8, 9, 10].map(level => (
                                <option key={level} value={level}>P{level}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Tool Type */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Tool Type</label>
                          <input 
                            type="text"
                            className="w-full bg-[#252526] text-gray-300 p-2 border border-[#3e3e3e] rounded focus:border-[#4ec9b0] focus:outline-none text-xs"
                            value={editingProps[tool.name]?.tool_type !== undefined ? editingProps[tool.name].tool_type : (tool.tool_type || "")}
                            onChange={(e) => handlePropChange(tool.name, 'tool_type', e.target.value)}
                            onBlur={() => { if (dirtyTools.has(tool.name)) handleSaveTool(tool, true); }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        {/* Is Gen */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Is Generated</label>
                          <select 
                            className="w-full bg-[#252526] text-gray-300 p-2 border border-[#3e3e3e] rounded focus:border-[#4ec9b0] focus:outline-none text-xs"
                            value={editingProps[tool.name]?.is_gen !== undefined ? (editingProps[tool.name].is_gen ? "true" : "false") : (tool.is_gen ? "true" : "false")}
                            onChange={(e) => {
                                handlePropChange(tool.name, 'is_gen', e.target.value === "true");
                                handleSaveTool(tool, true);
                            }}
                          >
                             <option value="true">True</option>
                             <option value="false">False</option>
                          </select>
                        </div>
                      </div>

                      {/* Metadata Field */}
                      <div className="mb-3">
                        <label className="block text-xs text-gray-500 mb-1">Metadata (JSON)</label>
                        <textarea 
                          className="w-full h-[60px] bg-[#252526] text-gray-300 p-2 border border-[#3e3e3e] rounded focus:border-[#4ec9b0] focus:outline-none resize-y text-xs font-mono"
                          value={editingProps[tool.name]?.metadata !== undefined ? editingProps[tool.name].metadata : JSON.stringify(tool.metadata || {}, null, 2)}
                          onChange={(e) => handlePropChange(tool.name, 'metadata', e.target.value)}
                          onBlur={() => { if (dirtyTools.has(tool.name)) handleSaveTool(tool, true); }}
                        />
                      </div>

                      {/* Code Field */}
                      <div className="bg-[#252526] p-3 rounded text-xs font-mono text-gray-400 relative group">
                        <div className="mb-1 text-[#569cd6] flex justify-between items-center">
                          <span>Code:</span>
                        </div>
                        <textarea 
                          className="w-full h-[200px] bg-[#1e1e1e] text-gray-300 p-2 border border-[#3e3e3e] rounded focus:border-[#4ec9b0] focus:outline-none resize-y font-mono text-xs"
                          value={editingCode[tool.name] !== undefined ? editingCode[tool.name] : (tool.code || "No source code available")}
                          onChange={(e) => handleCodeChange(tool.name, e.target.value)}
                          onBlur={() => { if (dirtyTools.has(tool.name)) handleSaveTool(tool, true); }}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {isCreating && (
          <div className="absolute inset-0 bg-[#1e1e1e] z-10 flex flex-col rounded-lg">
             <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
                <h2 className="text-xl font-bold text-white">Create New Tool</h2>
                <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
             </div>
             
             <div className="flex-1 overflow-auto p-6">
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    className="w-full bg-[#252526] border border-[#3e3e3e] rounded p-2 text-white focus:border-[#4ec9b0] focus:outline-none h-60 font-mono text-xs"
                    value={newTool.code}
                    onChange={e => {
                        setNewTool({...newTool, code: e.target.value});
                        if (createError) setCreateError(null);
                    }}
                    spellCheck={false}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Permission Level</label>
                        <select 
                            className="w-full bg-[#252526] border border-[#3e3e3e] rounded p-2 text-white focus:border-[#4ec9b0] focus:outline-none text-sm"
                            value={newTool.permission_level}
                            onChange={e => setNewTool({...newTool, permission_level: parseInt(e.target.value)})}
                        >
                            {[5, 6, 7, 8, 9, 10].map(l => <option key={l} value={l}>P{l}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Tool Type</label>
                        <input 
                            type="text" 
                            className="w-full bg-[#252526] border border-[#3e3e3e] rounded p-2 text-white focus:border-[#4ec9b0] focus:outline-none text-sm"
                            value={newTool.tool_type}
                            onChange={e => setNewTool({...newTool, tool_type: e.target.value})}
                            placeholder="e.g. general, analysis, io"
                        />
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-1">Is Generated</label>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer text-sm">
                            <input 
                                type="radio" 
                                name="is_gen"
                                checked={newTool.is_gen === true}
                                onChange={() => setNewTool({...newTool, is_gen: true})}
                            /> Yes
                        </label>
                        <label className="flex items-center gap-2 text-gray-300 cursor-pointer text-sm">
                            <input 
                                type="radio" 
                                name="is_gen"
                                checked={newTool.is_gen === false}
                                onChange={() => setNewTool({...newTool, is_gen: false})}
                            /> No
                        </label>
                    </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Metadata (JSON)</label>
                  <textarea 
                    className="w-full bg-[#252526] border border-[#3e3e3e] rounded p-2 text-white focus:border-[#4ec9b0] focus:outline-none h-20 font-mono text-xs"
                    value={newToolMetadata}
                    onChange={e => setNewToolMetadata(e.target.value)}
                    spellCheck={false}
                    placeholder="{}"
                  />
                </div>
             </div>

             <div className="flex justify-end gap-3 p-4 border-t border-[#333] bg-[#1e1e1e] items-center">
                {createError && (
                    <span className="text-red-500 text-xs mr-auto">{createError}</span>
                )}
                <button 
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 rounded bg-[#2b2b2b] hover:bg-[#333] text-white transition-colors text-sm"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleCreateTool}
                    className="px-4 py-2 rounded bg-[#4ec9b0] hover:bg-[#3da892] text-black font-medium transition-colors text-sm"
                >
                    Save Tool
                </button>
             </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmingSave && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-[#252526] w-[400px] rounded-lg shadow-2xl border border-[#333] p-0 overflow-hidden">
            <div className="p-4 flex items-start gap-3">
                <div className="text-[#3794ff] mt-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                    </svg>
                </div>
                <div>
                    <h3 className="text-white text-base font-medium mb-1">是否保存编辑?</h3>
                    <p className="text-gray-400 text-sm">您确定要保存对 "{confirmingSave.name}" 的更改吗？</p>
                </div>
            </div>
            <div className="flex justify-end gap-2 p-3 bg-[#1e1e1e] border-t border-[#333]">
              <button 
                onClick={executeSaveTool}
                className="px-4 py-1.5 bg-[#0078d4] hover:bg-[#006cbd] text-white text-sm rounded"
              >
                保存
              </button>
              <button 
                onClick={handleCancelSave}
                className="px-4 py-1.5 bg-[#3e3e3e] hover:bg-[#4e4e4e] text-white text-sm rounded"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmingDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-[#252526] w-[400px] rounded-lg shadow-2xl border border-[#333] p-0 overflow-hidden">
            <div className="p-4 flex items-start gap-3">
                <div className="text-red-500 mt-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                    </svg>
                </div>
                <div>
                    <h3 className="text-white text-base font-medium mb-1">确认删除?</h3>
                    <p className="text-gray-400 text-sm">您确定要删除工具 "{confirmingDelete.name}" 吗？此操作不可恢复。</p>
                </div>
            </div>
            <div className="flex justify-end gap-2 p-3 bg-[#1e1e1e] border-t border-[#333]">
              <button 
                onClick={executeDeleteTool}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
              >
                删除
              </button>
              <button 
                onClick={() => setConfirmingDelete(null)}
                className="px-4 py-1.5 bg-[#3e3e3e] hover:bg-[#4e4e4e] text-white text-sm rounded"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolsModal;
