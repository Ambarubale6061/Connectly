import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Heart, 
  Film, 
  Send, 
  Settings, 
  PlusSquare 
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { CreateMenu } from './CreateMenu';
import { cn } from '@/lib/utils'; // Tailwind classes merge sathi helpful

// Types for better safety
interface NavItem {
  to: string;
  icon: any;
  label: string;
  badge?: number;
}

export function Sidebar() {
  const { user } = useAuth() as any;

  const navItems: NavItem[] = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/reels', icon: Film, label: 'Reels' },
    { to: '/messages', icon: Send, label: 'Messages' },
    { to: '/notifications', icon: Heart, label: 'Notifications' },
  ];

  // Helper function for repetitive styling
  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group hover:bg-accent/50",
      isActive ? "font-bold text-foreground" : "font-normal text-foreground/80 hover:scale-105"
    );

  return (
    <aside className="fixed left-0 top-0 h-full w-[72px] lg:w-[244px] border-r border-border bg-background z-50 hidden md:flex flex-col py-8 px-3 transition-all duration-300">
      
      {/* Logo Section */}
      <div className="mb-10 px-3">
        <NavLink to="/" className="block transition-transform active:scale-95">
          <h1 className="text-[28px] font-bold font-serif italic tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text hidden lg:block">
            Connectly
          </h1>
          <span className="text-3xl font-serif italic font-bold lg:hidden flex justify-center">
            C
          </span>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-2 flex-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={navLinkClasses}>
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon 
                    className={cn(
                      "w-7 h-7 transition-transform group-active:scale-90",
                      isActive ? "stroke-[2.5px]" : "stroke-2"
                    )} 
                  />
                  {/* Notification Dot (Bhavishyat vapru शकता) */}
                  {label === 'Notifications' && (
                    <span className="absolute top-0 right-0 h-2 w-2 bg-primary rounded-full border-2 border-background hidden group-hover:block" />
                  )}
                </div>
                <span className="hidden lg:block text-[16px] tracking-tight">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
        
        {/* Create Menu Section */}
        <CreateMenu>
          <div className="flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group hover:bg-accent/50 text-foreground cursor-pointer hover:scale-105 active:scale-95 w-full">
            <PlusSquare className="w-7 h-7 stroke-2" />
            <span className="hidden lg:block text-[16px] tracking-tight">Create</span>
          </div>
        </CreateMenu>

        {/* Profile Link */}
        <NavLink to={`/profile/${user?.id}`} className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <div className={cn(
                "w-7 h-7 rounded-full overflow-hidden transition-all ring-offset-background",
                isActive ? "ring-2 ring-foreground ring-offset-2" : "ring-1 ring-border"
              )}>
                <Avatar className="w-full h-full border-none">
                  <AvatarImage src={user?.avatar_url} className="object-cover" />
                  <AvatarFallback className="text-[10px] bg-muted font-bold">
                    {user?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="hidden lg:block text-[16px] tracking-tight">Profile</span>
            </>
          )}
        </NavLink>
      </nav>

      {/* Settings at Bottom */}
      <div className="mt-auto border-t border-border/50 pt-4">
        <NavLink to="/settings" className={navLinkClasses}>
          {({ isActive }) => (
            <>
              <Settings className={cn(
                "w-7 h-7 transition-all duration-500",
                !isActive && "group-hover:rotate-45"
              )} />
              <span className="hidden lg:block text-[16px] tracking-tight">Settings</span>
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}