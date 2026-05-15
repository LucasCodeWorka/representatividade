'use client';

import { MenuSection } from './NavigationContext';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeItem: MenuSection;
  onSelectItem: (item: MenuSection) => void;
}

export default function Sidebar({ collapsed, onToggle, activeItem, onSelectItem }: SidebarProps) {
  const menuItems = [
    { id: 'representatividade', label: 'Analise PCP', icon: 'chart' },
    { id: 'aprovar-retirada', label: 'Diretoria', icon: 'bar' },
    { id: 'retirada-final', label: 'Retirada Final', icon: 'trash' },
    { id: 'cenarios', label: 'Cenarios', icon: 'compare' },
    { id: 'comportamento-suspensao', label: 'Comportamento', icon: 'pulse' },
  ];

  const secondaryItems = [
    { id: 'configuracoes', label: 'Configuracoes', icon: 'cog' },
  ];

  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'chart':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'bar':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'trash':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        );
      case 'cog':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'compare':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h6m-6 5h10M17 4l3 3-3 3M7 14l-3 3 3 3" />
          </svg>
        );
      case 'pulse':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <aside className={`bg-slate-800 text-white flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold text-rose-400">LIEBE</h1>
            <span className="text-xs text-slate-400">ANALISE</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1 hover:bg-slate-700 rounded"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
          </svg>
        </button>
      </div>

      {/* Principal */}
      <div className="flex-1 py-4">
        {!collapsed && <p className="px-4 text-xs text-slate-500 uppercase mb-2">Principal</p>}
        <nav className="space-y-1 px-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id as MenuSection)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeItem === item.id
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {renderIcon(item.icon)}
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        {!collapsed && <p className="px-4 text-xs text-slate-500 uppercase mt-6 mb-2">Configuracoes</p>}
        <nav className="space-y-1 px-2 mt-2">
          {secondaryItems.map(item => (
            <button
              key={item.id}
              onClick={() => onSelectItem(item.id as MenuSection)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeItem === item.id
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {renderIcon(item.icon)}
              {!collapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        {!collapsed && (
          <div className="text-xs text-slate-500">
            <p>Admin / Cache</p>
          </div>
        )}
      </div>
    </aside>
  );
}
