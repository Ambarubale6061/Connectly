import { NavLink } from 'react-router-dom';
import { Home, Search, Film, Send } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export function BottomNav() {
  // Cast user as any to avoid TypeScript "Property does not exist" errors
  const { user } = useAuth() as any;

  const items = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/reels', icon: Film, label: 'Reels' },
    { to: '/messages', icon: Send, label: 'Messages' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: `/profile/${user?.id}`, isProfile: true, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-50 flex justify-around items-center h-[56px] lg:hidden px-3 pb-safe">
      {items.map(({ to, icon: Icon, isProfile, label }) => (
        <NavLink
          key={label}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-col items-center justify-center w-full h-full transition-all duration-200 active:scale-90 ${
              isActive ? 'text-foreground' : 'text-muted-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isProfile ? (
                <div className={`w-7 h-7 rounded-full overflow-hidden transition-all duration-200 ${
                  isActive ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110' : 'ring-1 ring-border/50'
                }`}>
                  <Avatar className="w-full h-full">
                    <AvatarImage 
                      key={user?.avatar_url}
                      src={user?.avatar_url} 
                      alt={user?.username || 'User'} 
                      className="object-cover w-full h-full"
                    />
                    <AvatarFallback className="text-[10px] font-bold bg-secondary text-secondary-foreground uppercase">
                      {user?.username?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <Icon 
                  className={`w-[26px] h-[26px] transition-all ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`}
                  aria-label={label}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}