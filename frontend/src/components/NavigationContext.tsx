'use client';

import { createContext, useContext } from 'react';

export type MenuSection = 'representatividade' | 'aprovar-retirada' | 'retirada-final' | 'pareto' | 'configuracoes';

interface NavigationContextValue {
  activeSection: MenuSection;
  setActiveSection: (section: MenuSection) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({
  value,
  children
}: {
  value: NavigationContextValue;
  children: React.ReactNode;
}) {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }

  return context;
}
