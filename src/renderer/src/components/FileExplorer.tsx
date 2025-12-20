import React, { useState, useEffect } from 'react';
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

const FileTreeItem: React.FC<{ 
  node: FileNode; 
  level: number; 
  onSelect: (file: FileNode) => void 
}> = ({ node, level, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div>
      <div 
        className={`flex items-center py-[3px] hover:bg-[#2a2d2e] cursor-pointer text-[13px] text-[#cccccc] select-none group`}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleToggle}
        draggable={!node.isDirectory}
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
        <span className="truncate">{node.name}</span>
      </div>
      
      {isOpen && (
        <div>
          {isLoading ? (
            <div className="pl-8 py-1 text-xs text-gray-500">Loading...</div>
          ) : (
            children.map((child) => (
              <FileTreeItem 
                key={child.path} 
                node={child} 
                level={level + 1} 
                onSelect={onSelect} 
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

  const loadRoot = async () => {
    if (projectPath) {
      const files = await window.api.readDirectory(projectPath);
      setRootFiles(files);
    }
  };

  useEffect(() => {
    loadRoot();
  }, [projectPath]);

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    loadRoot();
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]">
      {/* Explorer Section */}
      <div 
        className={`flex flex-col ${isExpanded ? 'flex-1 min-h-0' : ''} ${activeSection === 'explorer' ? 'border border-[#007fd4]' : 'border border-transparent'}`}
        onClick={() => setActiveSection('explorer')}
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
            {rootFiles.map((file) => (
              <FileTreeItem 
                key={file.path} 
                node={file} 
                level={0} 
                onSelect={onFileSelect} 
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
  );
};

export default FileExplorer;
