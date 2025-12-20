import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Eye, Code } from 'lucide-react';
import Sidebar from './components/Sidebar';

// Configure PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
import ChatInterface from './components/ChatInterface';
import WorkspaceView from './components/WorkspaceView';
import FileExplorer from './components/FileExplorer';
import { EditorTabs, EditorFile } from './components/EditorTabs';
import MenuBar from './components/MenuBar';
import ToolsModal from './components/ToolsModal';

const PdfViewer = ({ content }: { content: string }) => {
  const [numPages, setNumPages] = useState<number>(0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
  }

  return (
    <div className="w-full h-full overflow-auto bg-[#525659] flex justify-center p-8">
      <Document
        file={content}
        onLoadSuccess={onDocumentLoadSuccess}
        className="flex flex-col gap-4"
        loading={null}
        error={<div className="text-red-500">Failed to load PDF</div>}
      >
        {Array.from(new Array(numPages), (_, index) => (
          <Page 
            key={`page_${index + 1}`} 
            pageNumber={index + 1} 
            renderTextLayer={false}
            renderAnnotationLayer={false}
            scale={1.2}
            className="shadow-lg"
            loading={null}
          />
        ))}
      </Document>
    </div>
  );
};

function App() {
  const [projectPath, setProjectPath] = useState<string | null>(() => {
    return localStorage.getItem('wand_last_project_path');
  });
  
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('wand_last_project_path') ? 'projects' : 'chat';
  });
  
  // Editor State
  const [openFiles, setOpenFiles] = useState<EditorFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [showTools, setShowTools] = useState(false);
  
  // Resizable panels state
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(400);
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  useEffect(() => {
    if (projectPath) {
      localStorage.setItem('wand_last_project_path', projectPath);
    } else {
      localStorage.removeItem('wand_last_project_path');
    }
  }, [projectPath]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        const newWidth = e.clientX - 50; // 50 is sidebar width
        if (newWidth > 150 && newWidth < 600) setLeftWidth(newWidth);
      }
      if (isDraggingRight) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth > 250 && newWidth < 800) setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    if (isDraggingLeft || isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  const handleOpenProject = async () => {
    const path = await window.api.openDirectory();
    if (path) {
      setProjectPath(path);
      setActiveTab('projects'); // Switch to projects tab automatically
    }
  };

  const handleFileSelect = async (file: { name: string; path: string; isDirectory: boolean }) => {
    if (!file.isDirectory) {
      // Check if already open
      const existingFile = openFiles.find(f => f.path === file.path);
      if (existingFile) {
        setActiveFilePath(file.path);
        return;
      }

      try {
        // Timeout after 10 seconds
        const content = await Promise.race([
          window.api.readFile(file.path),
          new Promise<string>((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]);
        
        const newFile: EditorFile = { name: file.name, path: file.path, content, isUnsaved: false };
        setOpenFiles([...openFiles, newFile]);
        setActiveFilePath(file.path);
      } catch (error: any) {
        // Extract the actual error message
        let message = error.message || '操作超时或发生错误';
        if (message.includes('Error: ')) {
          message = message.split('Error: ').pop();
        }
        alert(`打开文件失败：${message}`);
        console.error('File open error:', error);
      }
    }
  };

  const handleTabClose = (path: string) => {
    const newFiles = openFiles.filter(f => f.path !== path);
    setOpenFiles(newFiles);
    
    if (activeFilePath === path) {
      // If closing active tab, switch to the last one or null
      if (newFiles.length > 0) {
        setActiveFilePath(newFiles[newFiles.length - 1].path);
      } else {
        setActiveFilePath(null);
      }
    }
  };

  const handleTabsReorder = (newFiles: EditorFile[]) => {
    setOpenFiles(newFiles);
  };

  // Menu Bar Actions
  const handleOpenFile = async () => {
    const path = await window.api.openFile();
    if (path) {
      const name = path.split(/[\\/]/).pop() || 'file';
      handleFileSelect({ name, path, isDirectory: false });
      setActiveTab('projects');
    }
  };

  const handleSave = async () => {
    if (!activeFilePath) return;
    
    const file = openFiles.find(f => f.path === activeFilePath);
    if (!file) return;

    if (activeFilePath.startsWith('untitled:')) {
      handleSaveAs();
    } else {
      try {
        await window.api.saveFile(activeFilePath, file.content);
        // Update isUnsaved status
        setOpenFiles(openFiles.map(f => 
          f.path === activeFilePath ? { ...f, isUnsaved: false } : f
        ));
      } catch (error) {
        console.error('Failed to save:', error);
        alert('保存失败');
      }
    }
  };

  const handleSaveAs = async () => {
    if (!activeFilePath) return;
    
    const file = openFiles.find(f => f.path === activeFilePath);
    if (!file) return;

    const path = await window.api.showSaveDialog();
    if (path) {
      try {
        await window.api.saveFile(path, file.content);
        
        // Update file info
        const name = path.split(/[\\/]/).pop() || 'file';
        const updatedFiles = openFiles.map(f => 
          f.path === activeFilePath 
            ? { ...f, name, path, isUnsaved: false } 
            : f
        );
        setOpenFiles(updatedFiles);
        setActiveFilePath(path);
      } catch (error) {
        console.error('Failed to save as:', error);
        alert('另存为失败');
      }
    }
  };

  const handleCloseEditor = () => {
    if (activeFilePath) {
      handleTabClose(activeFilePath);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            if (e.shiftKey) {
              // Ctrl+Shift+O -> Open Folder (VS Code uses Ctrl+K Ctrl+O, but this is simpler for now)
              // Or we can stick to Ctrl+K Ctrl+O logic if needed, but let's map Ctrl+Shift+O to Open Project
              // Actually VS Code uses Ctrl+K Ctrl+O for Open Folder. 
              // Let's just use Ctrl+O for File and maybe add a button for Folder.
              // But wait, user asked for VS Code layout.
              // Let's support Ctrl+O for File.
            } else {
              handleOpenFile();
            }
            break;
          case 's':
            e.preventDefault();
            if (e.shiftKey) {
              handleSaveAs();
            } else {
              handleSave();
            }
            break;
          case 'w': // Close tab
            e.preventDefault();
            handleCloseEditor();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFilePath, openFiles]); // Dependencies for handlers

  const activeFile = openFiles.find(f => f.path === activeFilePath);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
      <MenuBar 
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenProject}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onCloseEditor={handleCloseEditor}
        onShowTools={() => setShowTools(true)}
      />
      {showTools && <ToolsModal onClose={() => setShowTools(false)} />}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* File Explorer (Visible when project is open and 'projects' tab is active) */}
        {activeTab === 'projects' && projectPath && (
          <>
            <div style={{ width: leftWidth }} className="flex-shrink-0">
              <FileExplorer projectPath={projectPath} onFileSelect={handleFileSelect} />
            </div>
            {/* Left Resizer */}
            <div
              className={`w-1 hover:bg-primary/50 cursor-col-resize transition-colors z-10 ${isDraggingLeft ? 'bg-primary' : 'bg-transparent'}`}
              onMouseDown={() => setIsDraggingLeft(true)}
            />
          </>
        )}

        {/* Left Chat Panel (Visible when 'chat' tab is active) */}
        {/* Removed left chat panel as user requested it on the right */}
        {/* {activeTab === 'chat' && (
          <>
            <div style={{ width: leftWidth }} className="flex-shrink-0 bg-secondary border-r border-accent">
              <ChatInterface />
            </div>
            <div
              className={`w-1 hover:bg-primary/50 cursor-col-resize transition-colors z-10 ${isDraggingLeft ? 'bg-primary' : 'bg-transparent'}`}
              onMouseDown={() => setIsDraggingLeft(true)}
            />
          </>
        )} */}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          {activeTab === 'chat' && <WorkspaceView onOpenProject={handleOpenProject} />}
          
          {activeTab === 'projects' && (
            // Always show editor area if we have files, or if we are in project mode
            <div className="flex flex-col h-full">
              {openFiles.length > 0 ? (
                <>
                  {/* Editor Tabs */}
                  <EditorTabs 
                    files={openFiles}
                    activePath={activeFilePath}
                    onTabClick={setActiveFilePath}
                    onTabClose={handleTabClose}
                    onTabsReorder={handleTabsReorder}
                  />
                  
                  {/* Editor Content */}
                  <div className="flex-1 overflow-hidden relative bg-[#252526]">
                    {activeFile ? (
                      <>
                        {activeFile.path.toLowerCase().endsWith('.md') && (
                          <div className="absolute top-2 right-4 z-10 flex bg-[#2b2b2b] rounded-md border border-[#3e3e3e] p-1">
                            <button
                              onClick={() => setViewMode('preview')}
                              className={`p-1.5 rounded ${viewMode === 'preview' ? 'bg-[#3e3e3e] text-white' : 'text-gray-400 hover:text-gray-200'}`}
                              title="Preview"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => setViewMode('source')}
                              className={`p-1.5 rounded ${viewMode === 'source' ? 'bg-[#3e3e3e] text-white' : 'text-gray-400 hover:text-gray-200'}`}
                              title="Source Code"
                            >
                              <Code size={16} />
                            </button>
                          </div>
                        )}

                        {activeFile.path.toLowerCase().endsWith('.pdf') ? (
                          <PdfViewer 
                            content={activeFile.content} 
                          />
                        ) : activeFile.path.toLowerCase().endsWith('.md') && viewMode === 'preview' ? (
                          <div className="w-full h-full overflow-auto p-8 prose prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {activeFile.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <textarea 
                            className="w-full h-full bg-transparent text-gray-300 resize-none focus:outline-none p-4 font-mono text-sm"
                            value={activeFile.content}
                            onChange={(e) => {
                              const newContent = e.target.value;
                              setOpenFiles(openFiles.map(f => 
                                f.path === activeFilePath ? { ...f, content: newContent, isUnsaved: true } : f
                              ));
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Select a file
                      </div>
                    )}
                  </div>
                </>
              ) : (
                projectPath ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    Select a file to view content
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                    <p>No project open</p>
                    <button 
                      onClick={handleOpenProject}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                    >
                      Open Project
                    </button>
                  </div>
                )
              )}
            </div>
          )}
          {activeTab === 'notes' && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Notes View (Coming Soon)
            </div>
          )}
          {activeTab === 'skills' && (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Skills View (Coming Soon)
            </div>
          )}
        </div>

        {/* Right Resizer */}
        <div
          className={`w-1 hover:bg-primary/50 cursor-col-resize transition-colors border-l border-accent z-10 ${isDraggingRight ? 'bg-primary' : 'bg-transparent'}`}
          onMouseDown={() => setIsDraggingRight(true)}
        />

        {/* Right Sidebar - AI Assistant (Cursor-like) */}
        <div style={{ width: rightWidth }} className="flex flex-col bg-secondary flex-shrink-0">
          <ChatInterface workspacePath={projectPath} />
        </div>
      </div>
    </div>
  );
}

export default App;
