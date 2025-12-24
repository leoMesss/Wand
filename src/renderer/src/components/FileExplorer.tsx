import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  FilePlus,
  FolderPlus,
  RefreshCw,
  MoreHorizontal,
  FileCode,
  FileJson,
  FileType,
  Image as ImageIcon,
  MinusSquare
} from 'lucide-react';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileExplorerProps {
  projectPath: string;
  onFileSelect: (file: FileNode) => void;
}

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode size={14} className="text-[#519aba]" />;
    case 'js':
    case 'jsx':
      return <FileCode size={14} className="text-[#f1e05a]" />;
    case 'json':
      return <FileJson size={14} className="text-[#f1e05a]" />;
    case 'css':
    case 'scss':
    case 'less':
      return <FileType size={14} className="text-[#563d7c]" />;
    case 'html':
      return <FileCode size={14} className="text-[#e34c26]" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'gif':
      return <ImageIcon size={14} className="text-[#a074c4]" />;
    case 'md':
      return <FileTextIcon size={14} className="text-[#519aba]" />;
    default:
      return <File size={14} className="text-[#cccccc]" />;
  }
};

// Custom simple icon for Markdown to avoid import conflict if needed, or just use File
const FileTextIcon = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);

// Define a context to avoid prop drilling
const FileExplorerContext = React.createContext<{
  renamingNodePath: string | null;
  creatingNode: { parentPath: string; type: 'file' | 'folder' } | null;
  refreshPath: string | null;
  onRename: (node: FileNode, newName: string) => void;
  onCancelRename: () => void;
  onCreate: (parentPath: string, name: string, type: 'file' | 'folder') => void;
  onCancelCreate: () => void;
  onRefreshComplete: () => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onSelect: (file: FileNode) => void;
  selectedNodePath: string | null;
  onNodeSelect: (node: FileNode) => void;
}>({
  renamingNodePath: null,
  creatingNode: null,
  refreshPath: null,
  onRename: () => {},
  onCancelRename: () => {},
  onCreate: () => {},
  onCancelCreate: () => {},
  onRefreshComplete: () => {},
  onContextMenu: () => {},
  onSelect: () => {},
  selectedNodePath: null,
  onNodeSelect: () => {},
});

const NewFileItem: React.FC<{
  type: 'file' | 'folder';
  level: number;
  existingNames: string[];
  onCommit: (name: string) => void;
  onCancel: () => void;
}> = ({ type, level, existingNames, onCommit, onCancel }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const validate = (name: string) => {
    if (!name) return '名称不能为空';
    if (existingNames.includes(name)) {
      return `此位置已存在文件或文件夹 ${name}。请选择其他名称。`;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    const err = validate(e.target.value);
    if (err && e.target.value !== '') setError(err);
    else setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) {
      onCancel();
      return;
    }
    const err = validate(value);
    if (err) {
      setError(err);
      return;
    }
    onCommit(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!value) {
        onCancel();
      } else {
        const err = validate(value);
        if (!err) {
          onCommit(value);
        }
      }
    }
  };

  const handleBlur = () => {
    if (!value) {
      onCancel();
    } else {
      const err = validate(value);
      if (!err) {
        onCommit(value);
      }
    }
  };

  return (
    <div className="relative">
      <div 
        className="flex items-center py-[3px] bg-[#094771] text-white"
        style={{ paddingLeft: `${level * 12 + 10}px` }}
      >
        <span className="mr-1.5">
          {type === 'folder' ? (
            <Folder size={14} className="text-[#dcb67a]" />
          ) : (
            getFileIcon(value)
          )}
        </span>
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full bg-[#3c3c3c] text-white border border-[#007fd4] outline-none px-1 h-[18px] leading-[18px]"
            onClick={(e) => e.stopPropagation()}
          />
        </form>
      </div>
      {error && (
        <div className="absolute left-0 z-50 px-2 py-1 mt-1 text-xs text-white bg-[#be1100] border border-[#be1100] shadow-md break-words" style={{ minWidth: '200px', left: `${level * 12 + 10}px` }}>
          {error}
        </div>
      )}
    </div>
  );
};

const FileTreeItem: React.FC<{ 
  node: FileNode; 
  level: number; 
}> = ({ node, level }) => {
  const { renamingNodePath, creatingNode, onRename, onCancelRename, onCreate, onCancelCreate, onContextMenu, onSelect, selectedNodePath, onNodeSelect } = React.useContext(FileExplorerContext);
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [siblings, setSiblings] = useState<string[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const isRenaming = renamingNodePath === node.path;
  const isSelected = selectedNodePath === node.path;

  useEffect(() => {
    if (isRenaming) {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
      setRenameError(null);
      
      // Fetch siblings for validation
      const parentPath = node.path.substring(0, node.path.lastIndexOf('\\'));
      if (parentPath) {
        window.api.readDirectory(parentPath).then(files => {
            setSiblings(files.map(f => f.name));
        }).catch(console.error);
      }
    }
  }, [isRenaming, node.path]);

  // Auto-expand if creating a child in this folder
  useEffect(() => {
    if (creatingNode && creatingNode.parentPath === node.path && !isOpen) {
        if (children.length === 0) {
            // Trigger load
            const load = async () => {
                setIsLoading(true);
                try {
                  const files = await window.api.readDirectory(node.path);
                  setChildren(files);
                  setIsOpen(true);
                } catch (error) {
                  console.error('Failed to load directory:', error);
                } finally {
                  setIsLoading(false);
                }
            };
            load();
        } else {
            setIsOpen(true);
        }
    }
  }, [creatingNode, node.path]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeSelect(node);
    if (node.isDirectory) {
      if (!isOpen && children.length === 0) {
        setIsLoading(true);
        try {
          const files = await window.api.readDirectory(node.path);
          setChildren(files);
        } catch (error) {
          console.error('Failed to load directory:', error);
        } finally {
          setIsLoading(false);
        }
      }
      setIsOpen(!isOpen);
    } else {
      onSelect(node);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.path);
    e.dataTransfer.setData('application/wand-file', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const validateRename = (name: string) => {
      if (!name) return '名称不能为空';
      if (name === node.name) return null;
      if (siblings.includes(name)) {
          return `此位置已存在文件或文件夹 ${name}。请选择其他名称。`;
      }
      return null; 
  };

  const handleRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setRenameValue(e.target.value);
      const err = validateRename(e.target.value);
      if (err) setRenameError(err);
      else setRenameError(null);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue) {
      onCancelRename();
      return;
    }
    const err = validateRename(renameValue);
    if (err) {
        setRenameError(err);
        return;
    }
    onRename(node, renameValue);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancelRename();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!renameValue) {
        onCancelRename();
      } else if (renameValue === node.name) {
        onCancelRename();
      } else {
        const err = validateRename(renameValue);
        if (!err) {
          onRename(node, renameValue);
        }
      }
    }
  };

  const handleRenameBlur = () => {
    if (!renameValue) {
      onCancelRename();
    } else if (renameValue === node.name) {
      onCancelRename();
    } else {
      const err = validateRename(renameValue);
      if (!err) {
        onRename(node, renameValue);
      }
    }
  };

  return (
    <div className="relative">
      <div 
        className={`flex items-center py-[3px] hover:bg-[#2a2d2e] cursor-pointer text-[13px] text-[#cccccc] select-none group ${isRenaming ? 'bg-[#094771] text-white' : (isSelected ? 'bg-[#37373d]' : '')}`}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleToggle}
        onContextMenu={(e) => {
            onNodeSelect(node);
            onContextMenu(e, node);
        }}
        draggable={!node.isDirectory && !isRenaming}
        onDragStart={handleDragStart}
      >
        <span className={`mr-1 ${node.isDirectory ? 'text-[#cccccc]' : 'opacity-0'}`}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="mr-1.5">
          {node.isDirectory ? (
            isOpen ? <FolderOpen size={14} className="text-[#dcb67a]" /> : <Folder size={14} className="text-[#dcb67a]" />
          ) : (
            getFileIcon(node.name)
          )}
        </span>
        {isRenaming ? (
          <form onSubmit={handleRenameSubmit} className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={renameValue}
              onChange={handleRenameChange}
              onBlur={handleRenameBlur}
              onKeyDown={handleRenameKeyDown}
              className="w-full bg-[#3c3c3c] text-white border border-[#007fd4] outline-none px-1 h-[18px] leading-[18px]"
              onClick={(e) => e.stopPropagation()}
            />
          </form>
        ) : (
          <span className="truncate">{node.name}</span>
        )}
      </div>
      
      {isRenaming && renameError && (
        <div className="absolute left-0 z-50 px-2 py-1 mt-1 text-xs text-white bg-[#be1100] border border-[#be1100] shadow-md break-words" style={{ minWidth: '200px', left: `${level * 12 + 10}px`, top: '24px' }}>
          {renameError}
        </div>
      )}
      
      {isOpen && (
        <div>
          {creatingNode && creatingNode.parentPath === node.path && (
             <NewFileItem 
                type={creatingNode.type}
                level={level + 1}
                existingNames={children.map(c => c.name)}
                onCommit={(name) => onCreate(node.path, name, creatingNode.type)}
                onCancel={onCancelCreate}
             />
          )}
          {isLoading ? (
            <div className="pl-8 py-1 text-xs text-gray-500">Loading...</div>
          ) : (
            children.map((child) => (
              <FileTreeItem 
                key={child.path} 
                node={child} 
                level={level + 1} 
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ projectPath, onFileSelect }) => {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('explorer');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const projectName = projectPath.split(/[\\/]/).pop()?.toUpperCase();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode | null }>({ x: 0, y: 0, node: null });
  const [clipboard, setClipboard] = useState<{ path: string; mode: 'copy' | 'cut' } | null>(null);
  const [renamingNodePath, setRenamingNodePath] = useState<string | null>(null);
  const [creatingNode, setCreatingNode] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [refreshPath, setRefreshPath] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (contextMenu.node || contextMenu.x !== 0) {
      const menu = menuRef.current;
      if (menu) {
        const rect = menu.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let newX = contextMenu.x;
        let newY = contextMenu.y;

        // Check right edge
        if (newX + rect.width > winWidth) {
          newX = winWidth - rect.width - 5;
        }

        // Check bottom edge
        if (newY + rect.height > winHeight) {
          newY = winHeight - rect.height - 5;
        }
        
        // Ensure it doesn't go off top/left
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;

        menu.style.left = `${newX}px`;
        menu.style.top = `${newY}px`;
      }
    }
  }, [contextMenu]);

  const loadRoot = async () => {
    if (projectPath) {
      const files = await window.api.readDirectory(projectPath);
      setRootFiles(files);
    }
  };

  useEffect(() => {
    loadRoot();
    const handleClickOutside = () => setContextMenu({ x: 0, y: 0, node: null });
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [projectPath]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    loadRoot();
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode | null) => {
    e.preventDefault();
    e.stopPropagation();
    if (node) setSelectedNode(node);
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts if explorer is active/focused or if we want global shortcuts
      // For now, let's check if the active element is not an input/textarea
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (!selectedNode && !contextMenu.node) return;
      const targetNode = contextMenu.node || selectedNode;
      if (!targetNode) return;

      if (e.key === 'F2') {
        e.preventDefault();
        setRenamingNodePath(targetNode.path);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        // Trigger delete logic
        if (confirm(`Are you sure you want to delete '${targetNode.name}'?`)) {
            const parentPath = targetNode.path.substring(0, targetNode.path.lastIndexOf('\\'));
            window.api.delete(targetNode.path).then(() => {
                if (parentPath === projectPath) loadRoot();
                else setRefreshPath(parentPath);
            }).catch(console.error);
        }
      } else if (e.ctrlKey || e.metaKey) {
          switch(e.key.toLowerCase()) {
              case 'c':
                  e.preventDefault();
                  setClipboard({ path: targetNode.path, mode: 'copy' });
                  break;
              case 'x':
                  e.preventDefault();
                  setClipboard({ path: targetNode.path, mode: 'cut' });
                  break;
              case 'v':
                  e.preventDefault();
                  handlePaste(); // Paste uses clipboard state, target is selectedNode
                  break;
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode, contextMenu.node, clipboard, projectPath]);

  const handleNewFile = () => {
    const targetNode = contextMenu.node || selectedNode;
    const parentPath = targetNode 
      ? (targetNode.isDirectory ? targetNode.path : targetNode.path.substring(0, targetNode.path.lastIndexOf('\\')))
      : projectPath;
    
    setCreatingNode({ parentPath, type: 'file' });
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleNewFolder = () => {
    const targetNode = contextMenu.node || selectedNode;
    const parentPath = targetNode 
      ? (targetNode.isDirectory ? targetNode.path : targetNode.path.substring(0, targetNode.path.lastIndexOf('\\')))
      : projectPath;

    setCreatingNode({ parentPath, type: 'folder' });
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleCreate = async (parentPath: string, name: string, type: 'file' | 'folder') => {
      try {
          if (type === 'file') {
              await window.api.saveFile(`${parentPath}\\${name}`, '');
          } else {
              await window.api.createDirectory(`${parentPath}\\${name}`);
          }
          
          if (parentPath === projectPath) {
              loadRoot();
          } else {
              setRefreshPath(parentPath);
          }
      } catch (error) {
          console.error('Error creating:', error);
      }
      setCreatingNode(null);
  };

  const handleRevealInExplorer = () => {
    const targetNode = contextMenu.node || selectedNode;
    if (targetNode) {
      window.api.revealInExplorer(targetNode.path);
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleCopy = () => {
    const targetNode = contextMenu.node || selectedNode;
    if (targetNode) {
      setClipboard({ path: targetNode.path, mode: 'copy' });
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleCut = () => {
    const targetNode = contextMenu.node || selectedNode;
    if (targetNode) {
      setClipboard({ path: targetNode.path, mode: 'cut' });
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handlePaste = async () => {
    if (!clipboard) return;
    
    const targetNode = contextMenu.node || selectedNode;
    const destFolder = targetNode 
      ? (targetNode.isDirectory ? targetNode.path : targetNode.path.substring(0, targetNode.path.lastIndexOf('\\')))
      : projectPath;
    
    const fileName = clipboard.path.split(/[\\/]/).pop();
    if (!fileName) return;

    let destPath = `${destFolder}\\${fileName}`;

    try {
      if (clipboard.mode === 'copy') {
        let finalPath = destPath;
        let counter = 1;
        const namePart = fileName.substring(0, fileName.lastIndexOf('.'));
        const extPart = fileName.substring(fileName.lastIndexOf('.'));
        
        while (await window.api.exists(finalPath)) {
            finalPath = `${destFolder}\\${namePart} copy${counter > 1 ? ` ${counter}` : ''}${extPart}`;
            counter++;
        }
        
        await window.api.copyFile(clipboard.path, finalPath);
      } else {
        await window.api.rename(clipboard.path, destPath);
        setClipboard(null); 
      }
      
      if (destFolder === projectPath) {
          loadRoot();
      } else {
          setRefreshPath(destFolder);
      }
    } catch (error) {
      console.error('Error pasting:', error);
      alert('Failed to paste file/folder');
    }
    
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleCopyPath = () => {
    const targetNode = contextMenu.node || selectedNode;
    if (targetNode) {
      navigator.clipboard.writeText(targetNode.path);
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleCopyRelativePath = () => {
    const targetNode = contextMenu.node || selectedNode;
    if (targetNode && projectPath) {
      const relativePath = targetNode.path.replace(projectPath, '').replace(/^[\\/]/, '');
      navigator.clipboard.writeText(relativePath);
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleRename = () => {
    const targetNode = contextMenu.node || selectedNode;
    if (targetNode) {
      setRenamingNodePath(targetNode.path);
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  const handleRenameSubmit = async (node: FileNode, newName: string) => {
    if (newName && newName !== node.name) {
      const parentPath = node.path.substring(0, node.path.lastIndexOf('\\'));
      try {
        await window.api.rename(node.path, `${parentPath}\\${newName}`);
        if (parentPath === projectPath) {
            loadRoot();
        } else {
            setRefreshPath(parentPath);
        }
      } catch (error) {
        console.error('Error renaming:', error);
      }
    }
    setRenamingNodePath(null);
  };

  const handleDelete = async () => {
    const targetNode = contextMenu.node || selectedNode;
    if (!targetNode) return;
    if (confirm(`Are you sure you want to delete '${targetNode.name}'?`)) {
      try {
        const parentPath = targetNode.path.substring(0, targetNode.path.lastIndexOf('\\'));
        await window.api.delete(targetNode.path);
        if (parentPath === projectPath) {
            loadRoot();
        } else {
            setRefreshPath(parentPath);
        }
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
    setContextMenu({ x: 0, y: 0, node: null });
  };

  return (
    <FileExplorerContext.Provider value={{
      renamingNodePath,
      creatingNode,
      refreshPath,
      onRename: handleRenameSubmit,
      onCancelRename: () => setRenamingNodePath(null),
      onCreate: handleCreate,
      onCancelCreate: () => setCreatingNode(null),
      onRefreshComplete: () => setRefreshPath(null),
      onContextMenu: handleContextMenu,
      onSelect: onFileSelect,
      selectedNodePath: selectedNode?.path || null,
      onNodeSelect: setSelectedNode
    }}>
    <div 
      className="h-full flex flex-col bg-[#252526] text-[#cccccc] relative outline-none" 
      tabIndex={0}
      ref={containerRef}
      onClick={() => {
          // Clicking empty space deselects? VS Code keeps selection usually.
          // But let's keep focus.
          containerRef.current?.focus();
      }}
    >
      {(contextMenu.node || contextMenu.x !== 0) && (
        <div 
          ref={menuRef}
          className="fixed z-50 bg-[#252526] border border-[#454545] shadow-lg rounded-sm py-1 min-w-[250px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px]" onClick={handleNewFile}>新建文件...</div>
          <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px]" onClick={handleNewFolder}>新建文件夹...</div>
          {contextMenu.node && (
            <>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleRevealInExplorer}>
                <span>在文件资源管理器中显示</span>
                <span className="text-xs text-gray-400 ml-4">Shift+Alt+R</span>
              </div>
              <div className="h-[1px] bg-[#454545] my-1"></div>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleCut}>
                <span>剪切</span>
                <span className="text-xs text-gray-400 ml-4">Ctrl+X</span>
              </div>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleCopy}>
                <span>复制</span>
                <span className="text-xs text-gray-400 ml-4">Ctrl+C</span>
              </div>
            </>
          )}
          <div className={`px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between ${!clipboard ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handlePaste}>
            <span>粘贴</span>
            <span className="text-xs text-gray-400 ml-4">Ctrl+V</span>
          </div>
          {contextMenu.node && (
            <>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleCopyPath}>
                <span>复制路径</span>
                <span className="text-xs text-gray-400 ml-4">Shift+Alt+C</span>
              </div>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleCopyRelativePath}>
                <span>复制相对路径</span>
                <span className="text-xs text-gray-400 ml-4">Ctrl+K Ctrl+Shift+C</span>
              </div>
              <div className="h-[1px] bg-[#454545] my-1"></div>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleRename}>
                <span>重命名...</span>
                <span className="text-xs text-gray-400 ml-4">F2</span>
              </div>
              <div className="px-3 py-1 hover:bg-[#094771] hover:text-white cursor-pointer text-[13px] flex justify-between" onClick={handleDelete}>
                <span>删除</span>
                <span className="text-xs text-gray-400 ml-4">Delete</span>
              </div>
            </>
          )}
        </div>
      )}
      {/* Explorer Section */}
      <div 
        className={`flex flex-col ${isExpanded ? 'flex-1 min-h-0' : ''} ${activeSection === 'explorer' ? 'border border-[#007fd4]' : 'border border-transparent'}`}
        onClick={() => setActiveSection('explorer')}
        onContextMenu={(e) => handleContextMenu(e, null)}
      >
        {/* Section Header */}
        <div 
          className="group flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-[#2a2d2e]"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
            setActiveSection('explorer');
          }}
        >
          <div className="flex items-center font-bold text-[11px] tracking-wide overflow-hidden whitespace-nowrap">
            <span className="mr-1">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {projectName || 'NO FOLDER OPENED'}
          </div>
          
          {/* Actions (visible on hover) */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 hover:bg-[#3c3c3c] rounded" title="New File">
              <FilePlus size={14} />
            </button>
            <button className="p-1 hover:bg-[#3c3c3c] rounded" title="New Folder">
              <FolderPlus size={14} />
            </button>
            <button 
              className="p-1 hover:bg-[#3c3c3c] rounded" 
              title="Refresh"
              onClick={handleRefresh}
            >
              <RefreshCw size={14} />
            </button>
            <button className="p-1 hover:bg-[#3c3c3c] rounded" title="Collapse All">
              <MinusSquare size={14} />
            </button>
          </div>
        </div>

        {/* File Tree */}
        {isExpanded && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {creatingNode && creatingNode.parentPath === projectPath && (
                 <NewFileItem 
                    type={creatingNode.type}
                    level={0}
                    existingNames={rootFiles.map(f => f.name)}
                    onCommit={(name) => handleCreate(projectPath, name, creatingNode.type)}
                    onCancel={() => setCreatingNode(null)}
                 />
            )}
            {rootFiles.map((file) => (
              <FileTreeItem 
                key={file.path} 
                node={file} 
                level={0} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Timeline Section */}
      <div 
        className={`${activeSection === 'timeline' ? 'border border-[#007fd4]' : 'border-t border-[#2b2b2b] border-b-0 border-l-0 border-r-0'}`}
        onClick={() => setActiveSection('timeline')}
      >
        <div 
          className="flex items-center px-2 py-1 cursor-pointer hover:bg-[#2a2d2e] text-[11px] font-bold tracking-wide"
          onClick={(e) => {
            e.stopPropagation();
            setIsTimelineExpanded(!isTimelineExpanded);
            setActiveSection('timeline');
          }}
        >
          {isTimelineExpanded ? <ChevronDown size={14} className="mr-1" /> : <ChevronRight size={14} className="mr-1" />}
          TIMELINE
        </div>
        {isTimelineExpanded && (
          <div className="px-4 py-2 text-xs text-gray-500 break-words">
            除非文件已被排除或太大，否则本地历史记录将跟踪你保存的最新更改。尚未配置源代码管理。
          </div>
        )}
      </div>
      
      {/* Outline Section */}
      <div 
        className={`${activeSection === 'outline' ? 'border border-[#007fd4]' : 'border-t border-[#2b2b2b] border-b-0 border-l-0 border-r-0'}`}
        onClick={() => setActiveSection('outline')}
      >
        <div className="flex items-center px-2 py-1 cursor-pointer hover:bg-[#2a2d2e] text-[11px] font-bold tracking-wide">
          <ChevronRight size={14} className="mr-1" />
          OUTLINE
        </div>
      </div>
    </div>
    </FileExplorerContext.Provider>
  );
};

export default FileExplorer;
