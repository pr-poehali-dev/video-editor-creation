import { createContext, useContext, type ReactNode } from 'react';

interface DemoContextType {
  isDemo: boolean;
}

const DemoContext = createContext<DemoContextType>({ isDemo: false });

export const DemoProvider = ({ children, isDemo }: { children: ReactNode; isDemo: boolean }) => (
  <DemoContext.Provider value={{ isDemo }}>{children}</DemoContext.Provider>
);

export const useDemo = () => useContext(DemoContext);

export default DemoContext;
