import { Link, useLocation } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { CreateMenu } from './CreateMenu';

export function TopNav() {
  const location = useLocation();

  if (location.pathname !== '/') return null;

  return (
    <header className="sticky top-0 z-[60] bg-background/80 backdrop-blur-xl border-b border-border/40 px-4 h-[52px] flex items-center justify-between lg:hidden transition-all duration-300">
      
      {/* Create Menu (plus icon) */}
      <CreateMenu />

      {/* Centered Logo */}
      <Link 
        to="/" 
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center group"
      >
        <h1 className="text-[24px] font-bold font-serif italic tracking-tight text-foreground transition-all duration-300 group-active:scale-95">
          Connectly
        </h1>
      </Link>

      {/* Heart Icon with notification dot */}
      <Link 
        to="/notifications" 
        className="relative active:scale-90 transition-transform p-1"
        aria-label="Notifications"
      >
        <Heart className="w-[26px] h-[26px] text-foreground stroke-[1.8]" />
        <span className="absolute top-1 right-1 w-[8px] h-[8px] bg-red-500 rounded-full border-2 border-background animate-pulse" />
      </Link>
    </header>
  );
}