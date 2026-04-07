import { Link } from 'react-router-dom';
import { Play, Heart, MessageCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';

interface ReelCardProps {
  reel: {
    id: string;
    user_id: string;
    video_url: string;
    caption: string | null;
    likes_count: number | null;
    comments_count: number | null;
    created_at: string;
    profiles?: {
      username: string;
      avatar_url: string | null;
      full_name: string | null;
    };
  };
}

export function ReelCard({ reel }: ReelCardProps) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likes_count ?? 0);
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  const profile = reel.profiles;

  useEffect(() => {
    if (!user) return;
    const checkLike = async () => {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('target_type', 'reel')
        .eq('target_id', reel.id)
        .maybeSingle();
      setLiked(!!data);
    };
    checkLike();
  }, [user, reel.id]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => newLiked ? prev + 1 : prev - 1);

    if (newLiked) {
      await supabase.from('likes').insert({ 
        user_id: user.id, 
        target_type: 'reel', 
        target_id: reel.id 
      });
    } else {
      await supabase.from('likes').delete().match({ 
        user_id: user.id, 
        target_type: 'reel', 
        target_id: reel.id 
      });
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Link to={`/reels?reel=${reel.id}`} className="block">
      <div className="pb-3 mb-0 border-b border-separator">
        {/* Header */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-medium">
                {profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <span className="text-sm font-semibold text-foreground">{profile?.username}</span>
            <p className="text-xs text-muted-foreground">Reel • {formatDistanceToNow(new Date(reel.created_at), { addSuffix: true })}</p>
          </div>
        </div>

        {/* Video Preview */}
        <div 
          className="relative aspect-[9/16] max-h-[560px] w-full bg-black cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <video
            ref={videoRef}
            src={reel.video_url}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          
          <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
            <Play className="w-14 h-14 text-white drop-shadow-lg opacity-90" />
          </div>
        </div>

        {/* Caption */}
        {reel.caption && (
          <p className="px-3 pt-2 text-sm text-foreground line-clamp-2">
            <span className="font-semibold mr-1">{profile?.username}</span>
            {reel.caption}
          </p>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-4 px-3 pt-1 pb-1">
          <button onClick={handleLike} className="flex items-center gap-1 transform active:scale-90 transition-transform">
            <Heart className={`w-6 h-6 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
            <span className="text-sm font-medium">{likesCount}</span>
          </button>
          <div className="flex items-center gap-1">
            <MessageCircle className="w-6 h-6 text-foreground" />
            <span className="text-sm font-medium">{reel.comments_count ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}