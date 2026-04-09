import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useInView } from 'react-intersection-observer';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Heart, MessageCircle, Send, MoreHorizontal, ArrowLeft, Download, Flag,
  Link as LinkIcon, EyeOff, Volume2, VolumeX, Music2, Pause, Play
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppLayout } from '@/components/layout/AppLayout';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 5;

export default function Reels() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, fetchNextPage, hasNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['reels-feed'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const { data: reels, error } = await supabase
        .from('reels')
        .select(`*, profiles!reels_user_id_fkey(username, avatar_url, full_name, id)`)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;

      if (user && reels.length) {
        const reelIds = reels.map(r => r.id);
        const { data: likes } = await supabase
          .from('likes')
          .select('target_id')
          .eq('user_id', user.id)
          .eq('target_type', 'reel')
          .in('target_id', reelIds);
        const likedMap = new Map(likes?.map(l => [l.target_id, true]) || []);
        reels.forEach(reel => { reel.user_liked = likedMap.has(reel.id); });
      }

      return { reels: reels ?? [], page: pageParam };
    },
    getNextPageParam: (lastPage) => lastPage.reels.length < PAGE_SIZE ? undefined : lastPage.page + 1,
    initialPageParam: 0,
  });

  const allReels = data?.pages.flatMap(p => p.reels) ?? [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-dvh flex items-center justify-center bg-black">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Full-bleed reel container — sits flush with the app shell */}
      <div
        className="relative w-full max-w-[420px] mx-auto bg-black"
        style={{ height: '100dvh' }}
      >
        {/* ── Floating back button (mobile only) ── */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 pt-safe pt-3 pb-2 lg:hidden pointer-events-none">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-md pointer-events-auto"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-base font-semibold text-white drop-shadow">Reels</h2>
        </div>

        {/* ── Snap scroller ── */}
        <div
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {allReels.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-white/60">No reels yet</p>
              <Button onClick={() => navigate('/create-reel')}>Create First Reel</Button>
            </div>
          )}

          {allReels.map((reel, i) => (
            <ReelCard
              key={reel.id}
              reel={reel}
              onInView={() => {
                if (i === allReels.length - 2 && hasNextPage) fetchNextPage();
              }}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

/* ─────────────────────────────────────────── */
/* helpers                                     */
/* ─────────────────────────────────────────── */

const formatCount = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
};

/* ─────────────────────────────────────────── */
/* ReelCard                                    */
/* ─────────────────────────────────────────── */

function ReelCard({ reel, onInView }: { reel: any; onInView: () => void }) {
  const { ref, inView } = useInView({ threshold: 0.6 });
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── preserved state (like / comments / share) ──
  const [liked, setLiked] = useState(reel.user_liked || false);
  const [likesCount, setLikesCount] = useState(reel.likes_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [doubleTapLike, setDoubleTapLike] = useState(false);

  // ── new state ──
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  const pauseIconTimer = useRef<ReturnType<typeof setTimeout>>();

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profile = reel.profiles;
  const isMobile = useIsMobile();

  // ── follow status ──
  useEffect(() => {
    if (user && reel.user_id !== user.id) checkFollowStatus();
  }, [user, reel.user_id]);

  const checkFollowStatus = async () => {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user?.id)
      .eq('following_id', reel.user_id)
      .maybeSingle();
    setIsFollowing(!!data);
  };

  const handleFollowToggle = async () => {
    if (!user) { toast.error('Please login to follow'); return; }
    if (followLoading) return;
    setFollowLoading(true);
    if (isFollowing) {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', user.id).eq('following_id', reel.user_id);
      if (!error) { setIsFollowing(false); toast.success(`Unfollowed ${profile?.username}`); }
      else toast.error('Failed to unfollow');
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id, following_id: reel.user_id, status: 'accepted'
      });
      if (!error) { setIsFollowing(true); toast.success(`Following ${profile?.username}`); }
      else toast.error('Failed to follow');
    }
    setFollowLoading(false);
  };

  // ── play / pause on inView ──
  useEffect(() => {
    if (!videoRef.current) return;
    if (inView) {
      videoRef.current.play().catch(() => {});
      setIsPaused(false);
      onInView();
    } else {
      videoRef.current.pause();
    }
  }, [inView]);

  // ── video progress ──
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgress(v.currentTime / v.duration);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);

  // ── tap to pause / play ──
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleVideoTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // double tap
      clearTimeout(tapTimer.current);
      if (!liked) handleLike();
      setDoubleTapLike(true);
      setTimeout(() => setDoubleTapLike(false), 700);
    } else {
      // single tap — toggle pause after delay
      tapTimer.current = setTimeout(() => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
          v.play().catch(() => {});
          setIsPaused(false);
        } else {
          v.pause();
          setIsPaused(true);
        }
        setShowPauseIcon(true);
        clearTimeout(pauseIconTimer.current);
        pauseIconTimer.current = setTimeout(() => setShowPauseIcon(false), 900);
      }, DOUBLE_TAP_DELAY);
    }
    lastTap.current = now;
  };

  // ── seek by tapping progress bar ──
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = ratio * videoRef.current.duration;
    }
  };

  // ── like (preserved logic) ──
  const handleLike = async () => {
    if (!user) { toast.error('Please login to like'); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((prev: number) => newLiked ? prev + 1 : prev - 1);
    if (newLiked) {
      await supabase.from('likes').insert({ user_id: user.id, target_type: 'reel', target_id: reel.id });
    } else {
      await supabase.from('likes').delete().match({ user_id: user.id, target_type: 'reel', target_id: reel.id });
    }
    queryClient.invalidateQueries({ queryKey: ['reels-feed'] });
  };

  // ── mute ──
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // ── real download ──
  const handleDownload = async () => {
    if (!reel.video_url) { toast.error('No video URL'); return; }
    try {
      setIsDownloading(true);
      toast.info('Downloading video…');
      const res = await fetch(reel.video_url);
      if (!res.ok) throw new Error('Network error');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reel-${reel.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Video saved!');
    } catch {
      toast.error('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  // song display text — fall back gracefully
  const songName = reel.song_name || reel.audio_name || 'Original Audio';
  const songArtist = reel.song_artist || profile?.username || '';

  return (
    <div
      ref={ref}
      className="snap-start relative bg-black flex items-center justify-center overflow-hidden"
      style={{ height: '100dvh', width: '100%' }}
      onClick={handleVideoTap}
    >
      {/* ── Video ── */}
      <video
        ref={videoRef}
        src={reel.video_url}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* ── Gradient overlays ── */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      {/* ── Double-tap heart ── */}
      <AnimatePresence>
        {doubleTapLike && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <Heart className="w-28 h-28 fill-white text-white drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pause/Play tap indicator ── */}
      <AnimatePresence>
        {showPauseIcon && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <div className="bg-black/40 rounded-full p-5 backdrop-blur-sm">
              {isPaused
                ? <Play className="w-10 h-10 text-white fill-white" />
                : <Pause className="w-10 h-10 text-white fill-white" />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════
          RIGHT SIDE ACTIONS
          (Like / Comments / Share preserved exactly)
          + 3-dots then Mute below
         ══════════════════════════════════════════ */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">

        {/* ── Like (preserved) ── */}
        <button onClick={(e) => { e.stopPropagation(); handleLike(); }} className="flex flex-col items-center gap-1 group">
          <Heart className={`w-8 h-8 transition-transform group-active:scale-90 ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          <span className="text-white text-xs font-medium">{formatCount(likesCount)}</span>
        </button>

        {/* ── Comments (preserved) ── */}
        <button onClick={(e) => { e.stopPropagation(); setShowComments(true); }} className="flex flex-col items-center gap-1 group">
          <MessageCircle className="w-8 h-8 text-white group-active:scale-90" />
          <span className="text-white text-xs font-medium">{formatCount(reel.comments_count ?? 0)}</span>
        </button>

        {/* ── Share (preserved) ── */}
        <button onClick={(e) => { e.stopPropagation(); setShowShare(true); }} className="flex flex-col items-center gap-1 group">
          <Send className="w-8 h-8 text-white group-active:scale-90" />
        </button>

        {/* ── 3-dots menu ── */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-7 h-7 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1">
            <DropdownMenuItem
              className="gap-3 py-2 cursor-pointer"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Downloading…' : 'Save video'}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2 cursor-pointer">
              <Flag className="w-4 h-4" /> Report
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 py-2 cursor-pointer">
              <EyeOff className="w-4 h-4" /> Not interested
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-3 py-2 cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/reels/${reel.id}`);
                toast.success('Link copied!');
              }}
            >
              <LinkIcon className="w-4 h-4" /> Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* ── Mute — placed BELOW 3-dots ── */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="p-2 rounded-full bg-black/40 backdrop-blur-sm"
        >
          {isMuted
            ? <VolumeX className="w-5 h-5 text-white" />
            : <Volume2 className="w-5 h-5 text-white" />
          }
        </button>
      </div>

      {/* ══════════════════════════════════════════
          BOTTOM LEFT — user info + caption + song
         ══════════════════════════════════════════ */}
      <div className="absolute left-3 bottom-6 right-16 z-10 space-y-2">

        {/* User row + follow */}
        <div className="flex items-center gap-2">
          <Link
            to={`/profile/${reel.user_id}`}
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="w-9 h-9 ring-2 ring-white">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-white text-sm font-bold drop-shadow">{profile?.username}</span>
          </Link>

          {user && reel.user_id !== user.id && (
            <button
              onClick={(e) => { e.stopPropagation(); handleFollowToggle(); }}
              disabled={followLoading}
              className={cn(
                'text-xs font-semibold px-3 py-1 rounded-md transition-all',
                isFollowing
                  ? 'bg-transparent border border-white/60 text-white hover:bg-white/10'
                  : 'bg-white text-black hover:bg-white/90'
              )}
            >
              {followLoading ? '…' : isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Caption */}
        {reel.caption && (
          <p className="text-white text-sm leading-snug line-clamp-2 drop-shadow-md max-w-[85%]">
            {reel.caption}
          </p>
        )}

        {/* ── Song display ── */}
        <div className="flex items-center gap-4 mt-1">
          <div className="relative w-5 h-5 shrink-0">
            <Music2 className="w-5 h-5 text-white" />
          </div>
          <div className="overflow-hidden max-w-[180px]">
            <motion.p
              className="text-white text-xs font-medium whitespace-nowrap"
              animate={
                songName.length > 24
                  ? { x: ['0%', '-60%', '0%'] }
                  : {}
              }
              transition={{ duration: 6, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
            >
              {songArtist ? `${songName} · ${songArtist}` : songName}
            </motion.p>
          </div>


        </div>
      </div>

      {/* ── Progress bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 z-20 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
      >
        <div
          className="h-full bg-white transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* ── Drawers (preserved) ── */}
      <CommentsDrawer
        open={showComments}
        onOpenChange={setShowComments}
        reelId={reel.id}
        isMobile={isMobile}
      />
      <ShareReelDrawer
        open={showShare}
        onOpenChange={setShowShare}
        reel={reel}
        isMobile={isMobile}
      />
    </div>
  );
}

/* ─────────────────────────────────────────── */
/* CommentsDrawer — unchanged logic            */
/* ─────────────────────────────────────────── */
function CommentsDrawer({ open, onOpenChange, reelId, isMobile }: {
  open: boolean; onOpenChange: (v: boolean) => void; reelId: string; isMobile: boolean;
}) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open && reelId) fetchComments();
  }, [open, reelId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('reel_comments')
      .select(`*, profiles!reel_comments_user_id_fkey(username, avatar_url, full_name)`)
      .eq('reel_id', reelId)
      .order('created_at', { ascending: false });
    if (data) setComments(data);
  };

  const postComment = async () => {
    if (!user || !newComment.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from('reel_comments')
      .insert({ reel_id: reelId, user_id: user.id, text: newComment.trim() });
    if (!error) {
      setNewComment('');
      fetchComments();
      await supabase.rpc('increment_reel_comment_count', { reel_id_param: reelId });
    } else {
      toast.error('Failed to post comment');
    }
    setLoading(false);
  };

  const commentsList = (
    <>
      {comments.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">No comments yet</div>
      ) : (
        <div className="space-y-4 py-4">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={comment.profiles?.avatar_url} />
                <AvatarFallback>{comment.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{comment.profiles?.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm mt-0.5">{comment.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const inputBar = (
    <div className="p-4 border-t flex gap-2 items-center">
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarImage src={user?.user_metadata?.avatar_url} />
        <AvatarFallback>{user?.email?.[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <Input
        placeholder="Add a comment..."
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && postComment()}
        className="flex-1 rounded-full"
      />
      <Button size="sm" onClick={postComment} disabled={loading || !newComment.trim()}>Post</Button>
    </div>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Comments</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 px-2">{commentsList}</ScrollArea>
          {inputBar}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] rounded-t-2xl">
        <DrawerHeader className="border-b pb-3">
          <DrawerTitle className="text-center">Comments</DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 px-4">{commentsList}</ScrollArea>
        {inputBar}
      </DrawerContent>
    </Drawer>
  );
}

/* ─────────────────────────────────────────── */
/* ShareReelDrawer — unchanged logic           */
/* ─────────────────────────────────────────── */
function ShareReelDrawer({ open, onOpenChange, reel, isMobile }: {
  open: boolean; onOpenChange: (v: boolean) => void; reel: any; isMobile: boolean;
}) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) fetchConversations();
  }, [open, user]);

  const fetchConversations = async () => {
    const { data: convs, error } = await supabase
      .from('conversations')
      .select('id, participant_1, participant_2')
      .or(`participant_1.eq.${user?.id},participant_2.eq.${user?.id}`);
    if (error || !convs) return;
    const otherUserIds = convs.map(conv =>
      conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1
    );
    if (otherUserIds.length === 0) return;
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', otherUserIds);
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const enriched = convs.map(conv => {
      const otherId = conv.participant_1 === user?.id ? conv.participant_2 : conv.participant_1;
      return { id: conv.id, user: profileMap.get(otherId) || null };
    }).filter(item => item.user);
    setConversations(enriched);
  };

  const shareViaMessage = async (conversationId: string) => {
    const reelUrl = `${window.location.origin}/reels/${reel.id}`;
    const shareText = `Check out this reel: ${reelUrl}`;
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user?.id,
      text: shareText,
    });
    if (error) toast.error('Failed to send message');
    else { toast.success('Reel shared!'); onOpenChange(false); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/reels/${reel.id}`);
    toast.success('Link copied!');
    onOpenChange(false);
  };

  const filtered = conversations.filter(c =>
    c.user?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const shareContent = (
    <div className="p-4">
      <Input
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 rounded-full"
      />
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {filtered.map(conv => (
            <div
              key={conv.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer"
              onClick={() => shareViaMessage(conv.id)}
            >
              <Avatar>
                <AvatarImage src={conv.user?.avatar_url} />
                <AvatarFallback>{conv.user?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{conv.user?.username}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No conversations found</p>
          )}
        </div>
      </ScrollArea>
      <Button variant="outline" className="w-full mt-4" onClick={copyLink}>
        <LinkIcon className="w-4 h-4 mr-2" /> Copy Link
      </Button>
    </div>
  );

  if (!isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">Share Reel</DialogTitle>
          </DialogHeader>
          {shareContent}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-2xl">
        <DrawerHeader>
          <DrawerTitle className="text-center">Share Reel</DrawerTitle>
        </DrawerHeader>
        {shareContent}
      </DrawerContent>
    </Drawer>
  );
}