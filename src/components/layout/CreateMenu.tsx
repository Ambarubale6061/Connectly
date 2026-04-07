import { useNavigate } from 'react-router-dom';
import { PlusSquare, Image, Film, CircleUser, Plus, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CreateMenuProps {
  children?: React.ReactNode;
}

export function CreateMenu({ children }: CreateMenuProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children ? (
          children
        ) : (
          <button className="active:scale-90 transition-all p-1.5 outline-none bg-secondary/50 rounded-lg hover:bg-secondary" aria-label="Create">
            <PlusSquare className="w-[24px] h-[24px] text-foreground stroke-[2]" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="start" 
        side="right"
        sideOffset={16}
        className="w-[240px] p-1.5 bg-background/80 backdrop-blur-2xl border-border/40 rounded-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] z-[100] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Post Option */}
        <DropdownMenuItem 
          onClick={() => navigate('/create')}
          className="flex items-center justify-between p-3 rounded-[14px] cursor-pointer focus:bg-primary focus:text-primary-foreground transition-all duration-200 group mb-1"
        >
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-500/10 rounded-lg group-focus:bg-white/20 transition-colors">
                <Image className="h-4.5 w-4.5 text-blue-500 group-focus:text-white" />
             </div>
             <span className="font-semibold text-[15px] tracking-tight">Post</span>
          </div>
          <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </DropdownMenuItem>

        {/* Reel Option */}
        <DropdownMenuItem 
          onClick={() => navigate('/create-reel')}
          className="flex items-center justify-between p-3 rounded-[14px] cursor-pointer focus:bg-rose-500 focus:text-white transition-all duration-200 group mb-1"
        >
          <div className="flex items-center gap-3">
             <div className="p-2 bg-rose-500/10 rounded-lg group-focus:bg-white/20 transition-colors">
                <Film className="h-4.5 w-4.5 text-rose-500 group-focus:text-white" />
             </div>
             <span className="font-semibold text-[15px] tracking-tight">Reel</span>
          </div>
          <Sparkles className="h-4 w-4 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </DropdownMenuItem>

        {/* Separator Line */}
        <div className="h-[1px] bg-border/40 my-1.5 mx-2" />

        {/* Story Option */}
        <DropdownMenuItem 
          onClick={() => navigate('/create-story')}
          className="flex items-center justify-between p-3 rounded-[14px] cursor-pointer focus:bg-amber-500 focus:text-white transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
             <div className="p-2 bg-amber-500/10 rounded-lg group-focus:bg-white/20 transition-colors">
                <CircleUser className="h-4.5 w-4.5 text-amber-500 group-focus:text-white" />
             </div>
             <span className="font-semibold text-[15px] tracking-tight">Story</span>
          </div>
          <Plus className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}