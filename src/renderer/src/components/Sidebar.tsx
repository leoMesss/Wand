import React from 'react';
import { Files, Settings, MessageSquare } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'projects', icon: Files, label: 'Projects' },
    { id: 'chat', icon: MessageSquare, label: 'AI Chat' },
  ];

  return (
    <div className="w-[50px] flex flex-col items-center py-2 border-r border-accent bg-secondary">
      <div className="flex-1 flex flex-col w-full">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`h-[50px] w-full flex items-center justify-center relative group ${
              activeTab === item.id 
                ? 'text-white' 
                : 'text-[#858585] hover:text-white'
            }`}
            title={item.label}
          >
            {activeTab === item.id && (
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white" />
            )}
            <item.icon size={26} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      <div className="mt-auto">
        <button className="h-[50px] w-full flex items-center justify-center text-[#858585] hover:text-white">
          <Settings size={26} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
