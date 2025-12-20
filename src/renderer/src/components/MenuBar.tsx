import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Search, MoreHorizontal, LayoutPanelLeft } from 'lucide-react';

interface MenuBarProps {
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onCloseEditor: () => void;
  onShowTools: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onOpenFile,
  onOpenFolder,
  onSave,
  onSaveAs,
  onCloseEditor,
  onShowTools
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleMouseEnter = (menu: string) => {
    if (activeMenu) {
      setActiveMenu(menu);
    }
  };

  const handleAction = (action: () => void) => {
    action();
    setActiveMenu(null);
  };

  const allMenus = [
    { id: 'file', label: '文件' },
    { id: 'edit', label: '编辑' },
    { id: 'selection', label: '选择' },
    { id: 'view', label: '查看' },
    { id: 'go', label: '转到' },
    { id: 'run', label: '运行' },
    { id: 'tools', label: '工具' },
    { id: 'terminal', label: '终端' },
    { id: 'help', label: '帮助' },
  ];

  const visibleMenus = allMenus;
  const hiddenMenus = [];

  const renderMenuContent = (menuId: string) => {
    if (menuId === 'file') {
      return (
        <>
          <MenuItem label="打开文件..." shortcut="Ctrl+O" onClick={() => handleAction(onOpenFile)} />
          <MenuItem label="打开文件夹..." shortcut="Ctrl+K Ctrl+O" onClick={() => handleAction(onOpenFolder)} />
          <MenuSeparator />
          <MenuItem label="保存" shortcut="Ctrl+S" onClick={() => handleAction(onSave)} />
          <MenuItem label="另存为..." shortcut="Ctrl+Shift+S" onClick={() => handleAction(onSaveAs)} />
          <MenuSeparator />
          <MenuItem label="关闭编辑器" shortcut="Ctrl+F4" onClick={() => handleAction(onCloseEditor)} />
          <MenuSeparator />
          <MenuItem label="退出" shortcut="Alt+F4" onClick={() => window.close()} />
        </>
      );
    }
    if (menuId === 'tools') {
      return (
        <>
          <MenuItem label="查看所有工具" onClick={() => handleAction(onShowTools)} />
        </>
      );
    }
    return (
      <div className="px-4 py-2 text-gray-500 italic">暂未实现</div>
    );
  };

  return (
    <div className="h-[35px] bg-[#1e1e1e] flex items-center px-2 text-[13px] select-none border-b border-[#2b2b2b] w-full justify-between" ref={menuRef} style={{ WebkitAppRegion: 'drag' } as any}>
      
      {/* Left Section: Icon, Menus, Nav */}
      <div className="flex items-center h-full flex-shrink-0">
        {/* App Icon / Sidebar Toggle */}
        <div className="mr-3 ml-1 text-gray-400 hover:text-white cursor-pointer" style={{ WebkitAppRegion: 'no-drag' } as any}>
           <LayoutPanelLeft size={16} />
        </div>

        {/* Visible Menus */}
        {visibleMenus.map((menu) => (
          <div key={menu.id} className="relative h-full flex items-center">
            <div 
              className={`px-2 h-[24px] mx-[1px] flex items-center rounded hover:bg-[#353535] cursor-default ${activeMenu === menu.id ? 'bg-[#353535]' : ''}`}
              onClick={() => handleMenuClick(menu.id)}
              onMouseEnter={() => handleMouseEnter(menu.id)}
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <span className="text-[#cccccc]">{menu.label}</span>
            </div>
            
            {activeMenu === menu.id && (
              <div className="absolute top-[30px] left-0 min-w-[250px] bg-[#252526] shadow-xl border border-[#454545] rounded-md py-1 z-50 text-[#cccccc]" style={{ WebkitAppRegion: 'no-drag' } as any}>
                {renderMenuContent(menu.id)}
              </div>
            )}
          </div>
        ))}

        {/* More Menu (...) */}
        <div className="relative h-full flex items-center">
          <div 
            className={`px-1 h-[24px] mx-[1px] flex items-center rounded hover:bg-[#353535] cursor-default ${activeMenu === 'more' ? 'bg-[#353535]' : ''}`}
            onClick={() => handleMenuClick('more')}
            onMouseEnter={() => handleMouseEnter('more')}
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <MoreHorizontal size={16} className="text-[#cccccc]" />
          </div>
          
          {activeMenu === 'more' && (
            <div className="absolute top-[30px] left-0 min-w-[200px] bg-[#252526] shadow-xl border border-[#454545] rounded-md py-1 z-50 text-[#cccccc]" style={{ WebkitAppRegion: 'no-drag' } as any}>
              {hiddenMenus.map(menu => (
                <MenuItem 
                  key={menu.id} 
                  label={menu.label} 
                  onClick={() => {
                    // For now just show not implemented, or could open sub-menu logic
                    setActiveMenu(menu.id); // This might be tricky if we want nested menus, for now just switch active menu or do nothing
                  }} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Navigation Arrows */}
        <div className="flex items-center ml-2 space-x-1 text-gray-500" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="p-1 hover:bg-[#353535] rounded cursor-pointer hover:text-gray-300">
            <ArrowLeft size={14} />
          </div>
          <div className="p-1 hover:bg-[#353535] rounded cursor-pointer hover:text-gray-300">
            <ArrowRight size={14} />
          </div>
        </div>
      </div>
      
      {/* Center Section: Search Box */}
      <div className="flex-1 flex justify-center items-center px-4">
        <div className="w-full max-w-[600px] h-[24px] bg-[#2b2b2b] border border-[#3e3e3e] rounded-md flex items-center px-2 text-gray-400 hover:bg-[#333333] hover:border-[#4e4e4e] transition-colors cursor-pointer group" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <Search size={13} className="mr-2 group-hover:text-gray-300" />
          <span className="text-xs group-hover:text-gray-300">Wand</span>
        </div>
      </div>

      {/* Right Section: Window Controls Placeholder */}
      <div className="w-[140px] flex-shrink-0" />
    </div>
  );
};

const MenuItem: React.FC<{ label: string; shortcut?: string; onClick: () => void }> = ({ label, shortcut, onClick }) => (
  <div 
    className="px-3 py-1.5 hover:bg-[#04395e] hover:text-white cursor-default flex justify-between items-center group"
    onClick={onClick}
  >
    <span>{label}</span>
    {shortcut && <span className="text-xs text-gray-400 group-hover:text-white ml-6">{shortcut}</span>}
  </div>
);

const MenuSeparator: React.FC = () => (
  <div className="h-[1px] bg-[#454545] my-1 mx-2" />
);

export default MenuBar;
