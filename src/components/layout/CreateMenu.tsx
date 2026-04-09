import { useNavigate } from 'react-router-dom';
import { PlusSquare, Image, Film, CircleUser } from 'lucide-react';
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
          <button className="active:scale-90 transition-all p-2 outline-none bg-white/5 hover:bg-white/10 rounded-full border border-white/10 backdrop-blur-md" aria-label="Create">
            <PlusSquare className="w-6 h-6 text-foreground/80" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        align="start" 
        side="right"
        sideOffset={16}
        /* मुख्य बॉक्स पूर्ण ट्रान्सपरंट केला आहे */
        className="flex flex-col gap-3 p-2 bg-transparent border-none shadow-none z-[100] animate-in fade-in slide-in-from-left-2 duration-300"
      >
        {/* --- Post Option --- */}
        <DropdownMenuItem 
          onClick={() => navigate('/create')}
          className="group relative flex items-center justify-center h-12 w-12 hover:w-36 rounded-full cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-blue-500/20 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] focus:bg-blue-500"
        >
          <div className="flex items-center gap-3 overflow-hidden px-1">
            <Image className="h-5 w-5 min-w-[20px] text-blue-400 group-hover:scale-110 group-focus:text-white transition-transform duration-300" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-focus:text-white transition-all duration-500 font-medium tracking-wide text-[14px] text-blue-400">
              Post
            </span>
          </div>
        </DropdownMenuItem>

        {/* --- Reel Option --- */}
        <DropdownMenuItem 
          onClick={() => navigate('/create-reel')}
          className="group relative flex items-center justify-center h-12 w-12 hover:w-36 rounded-full cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-rose-500/20 hover:border-rose-500/50 hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] focus:bg-rose-500"
        >
          <div className="flex items-center gap-3 overflow-hidden px-1">
            <Film className="h-5 w-5 min-w-[20px] text-rose-400 group-hover:scale-110 group-focus:text-white transition-transform duration-300" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-focus:text-white transition-all duration-500 font-medium tracking-wide text-[14px] text-rose-400">
              Reel
            </span>
          </div>
        </DropdownMenuItem>

        {/* --- Story Option --- */}
        <DropdownMenuItem 
          onClick={() => navigate('/create-story')}
          className="group relative flex items-center justify-center h-12 w-12 hover:w-36 rounded-full cursor-pointer bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-amber-500/20 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] focus:bg-amber-500"
        >
          <div className="flex items-center gap-3 overflow-hidden px-1">
            <CircleUser className="h-5 w-5 min-w-[20px] text-amber-400 group-hover:scale-110 group-focus:text-white transition-transform duration-300" />
            <span className="max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 group-focus:text-white transition-all duration-500 font-medium tracking-wide text-[14px] text-amber-400">
              Story
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}