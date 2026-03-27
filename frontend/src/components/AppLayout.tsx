'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import { MenuSection, NavigationProvider } from './NavigationContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<MenuSection>('representatividade');

  return (
    <NavigationProvider value={{ activeSection, setActiveSection }}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeItem={activeSection}
          onSelectItem={setActiveSection}
        />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </NavigationProvider>
  );
}
