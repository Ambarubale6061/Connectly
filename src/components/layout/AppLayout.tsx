import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TopNav } from './TopNav';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppLayout({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {!isMobile && <Sidebar />}
      {isMobile && <TopNav />}
      <main className={`${isMobile ? 'pb-14' : 'ml-[72px] lg:ml-[244px]'}`}>
        {children}
      </main>
      {isMobile && <BottomNav />}
    </div>
  );
}
