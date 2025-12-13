import React, { useState } from 'react';
import { X, FileCode, File, FileJson, FileType } from 'lucide-react';

export interface EditorFile {
  path: string;
  name: string;
  content: string;
  isUnsaved?: boolean;
}

interface EditorTabsProps {
  files: EditorFile[];
  activePath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabsReorder: (newFiles: EditorFile[]) => void;
}

const getFileIcon = (filename: string) => {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FileCode size={14} className="text-blue-400" />;
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return <FileCode size={14} className="text-yellow-400" />;
  if (filename.endsWith('.json')) return <FileJson size={14} className="text-yellow-200" />;
  if (filename.endsWith('.css')) return <FileType size={14} className="text-blue-300" />;
  return <File size={14} className="text-gray-400" />;
};

export const EditorTabs: React.FC<EditorTabsProps> = ({
  files,
  activePath,
  onTabClick,
  onTabClose,
  onTabsReorder
}) => {
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, path: string) => {
    setDraggedPath(path);
    e.dataTransfer.effectAllowed = 'move';
    // Optional: Set custom drag image if needed
  };

  const handleDragOver = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    if (!draggedPath || draggedPath === targetPath) return;

    const fromIndex = files.findIndex(f => f.path === draggedPath);
    const toIndex = files.findIndex(f => f.path === targetPath);
    
    if (fromIndex === -1 || toIndex === -1) return;

    const newFiles = [...files];
    const [movedItem] = newFiles.splice(fromIndex, 1);
    newFiles.splice(toIndex, 0, movedItem);
    
    onTabsReorder(newFiles);
  };

  return (
    <div className="flex bg-[#1e1e1e] overflow-x-auto scrollbar-hide h-[35px] w-full">
      {files.map((file) => {
        const isActive = activePath === file.path;
        return (
          <div
            key={file.path}
            draggable
            onDragStart={(e) => handleDragStart(e, file.path)}
            onDragOver={(e) => handleDragOver(e, file.path)}
            onClick={() => onTabClick(file.path)}
            className={`
              group flex items-center gap-2 px-3 min-w-[120px] max-w-[200px] h-full
              cursor-pointer select-none text-[13px] border-r border-[#252526]
              ${isActive 
                ? 'bg-[#252526] text-white border-t-2 border-t-primary' 
                : 'bg-transparent text-[#969696] hover:bg-[#2d2d2d] border-t-2 border-t-transparent'}
            `}
          >
            <span className="flex-shrink-0">
               {getFileIcon(file.name)}
            </span>
            <span className="truncate flex-1">{file.name}</span>
            <div className="w-[20px] h-[20px] flex items-center justify-center ml-1">
              {file.isUnsaved ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-white group-hover:hidden" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(file.path);
                    }}
                    className="hidden group-hover:flex p-0.5 rounded-md hover:bg-[#4b4b4b] hover:text-white items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTabClose(file.path);
                  }}
                  className={`
                    p-0.5 rounded-md hover:bg-[#4b4b4b] hover:text-white flex items-center justify-center
                    ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    transition-opacity
                  `}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
