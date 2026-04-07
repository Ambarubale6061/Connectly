import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import {
  Settings,
  Grid3X3,
  Film,
  Bookmark,
  MessageCircle,
  Camera,
  Heart,
  MessageSquare,
  X,
  Link2,
  Image as ImageIcon,
  Clapperboard,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

// Helper hook for responsive design
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  return matches;
}

// Reusable follow button with notification logic
function FollowButton({ targetId, currentUserId }: { targetId: string; currentUserId?: string }) {
  const queryClient = useQueryClient();
  const { data: followStatus, refetch } = useQuery({
    queryKey: ['follow-status', currentUserId, targetId],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId!)
        .eq('following_id', targetId)
        .maybeSingle();
      return data;
    },
    enabled: !!currentUserId,
  });

  const handleToggle = async () => {
    if (!currentUserId) return;
    if (followStatus) {
      await supabase.from('follows').delete().eq('id', followStatus.id);
      toast({ title: 'Unfollowed', description: 'You unfollowed this user' });
    } else {
      // Insert follow
      await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: targetId,
        status: 'accepted',
      });
      // 🔔 Create follow notification
      await supabase.from('notifications').insert({
        user_id: targetId,
        actor_id: currentUserId,
        type: 'follow',
      });
      toast({ title: 'Followed', description: 'You followed this user' });
    }
    await refetch();
    queryClient.invalidateQueries({ queryKey: ['profile', targetId] });
    queryClient.invalidateQueries({ queryKey: ['followers', targetId] });
    queryClient.invalidateQueries({ queryKey: ['following', targetId] });
    if (currentUserId) queryClient.invalidateQueries({ queryKey: ['profile', currentUserId] });
  };

  return (
    <Button
      size="sm"
      variant={followStatus ? 'outline' : 'default'}
      onClick={handleToggle}
      className="rounded-full text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
    >
      {followStatus ? 'Unfollow' : 'Follow'}
    </Button>
  );
}

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwn = user?.id === id;
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [listType, setListType] = useState<'followers' | 'following' | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // ---------- DATA FETCHING ----------
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: posts } = useQuery({
    queryKey: ['profile-posts', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', id!)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: reels } = useQuery({
    queryKey: ['profile-reels', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reels')
        .select('*')
        .eq('user_id', id!)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: saved } = useQuery({
    queryKey: ['saved-posts', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('saved_posts')
        .select('*, posts(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user && isOwn,
  });

  const { data: followStatus, refetch: refetchFollow } = useQuery({
    queryKey: ['follow-status', user?.id, id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('id, status')
        .eq('follower_id', user!.id)
        .eq('following_id', id!)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!id && !isOwn,
  });

  const { data: followersList } = useQuery({
    queryKey: ['followers', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('follower_id, profiles!follows_follower_id_fkey(id, username, avatar_url, full_name)')
        .eq('following_id', id!)
        .eq('status', 'accepted');
      return data?.map((item) => item.profiles) ?? [];
    },
    enabled: !!id && listType !== null,
  });

  const { data: followingList } = useQuery({
    queryKey: ['following', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, avatar_url, full_name)')
        .eq('follower_id', id!)
        .eq('status', 'accepted');
      return data?.map((item) => item.profiles) ?? [];
    },
    enabled: !!id && listType !== null,
  });

  // ---------- ACTIONS ----------
  const handleFollow = async () => {
    if (!user || !id) return;
    if (followStatus) {
      await supabase.from('follows').delete().eq('id', followStatus.id);
      toast({ title: 'Unfollowed', description: `You unfollowed ${profile?.username}` });
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: id,
        status: profile?.is_private ? 'pending' : 'accepted',
      });
      // 🔔 Create follow notification (only for public follows or always? same as original logic)
      await supabase.from('notifications').insert({
        user_id: id,
        actor_id: user.id,
        type: 'follow',
      });
      toast({
        title: profile?.is_private ? 'Request sent' : 'Followed',
        description: profile?.is_private
          ? `Request sent to ${profile?.username}`
          : `You followed ${profile?.username}`,
      });
    }
    await refetchFollow();
    queryClient.invalidateQueries({ queryKey: ['profile', id] });
    queryClient.invalidateQueries({ queryKey: ['followers', id] });
    queryClient.invalidateQueries({ queryKey: ['following', id] });
  };

  const handleMessage = async () => {
    if (!user || !id) return;
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${id}),and(participant_1.eq.${id},participant_2.eq.${user.id})`)
      .maybeSingle();
    if (existing) {
      navigate(`/messages/${existing.id}`);
    } else {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({ participant_1: user.id, participant_2: id })
        .select('id')
        .single();
      if (newConvo) navigate(`/messages/${newConvo.id}`);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 400 });
      const path = `${user.id}/avatar_${Date.now()}.jpg`;
      await supabase.storage.from('avatars').upload(path, compressed, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl + '?t=' + Date.now() })
        .eq('id', user.id);
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast({ title: 'Avatar updated', description: 'Your profile picture has been changed.' });
    } catch (error) {
      toast({ title: 'Upload failed', description: 'Could not upload avatar.', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    queryClient.invalidateQueries({ queryKey: ['profile-posts', id] });
    toast({ title: 'Post deleted', description: 'Your post has been removed.' });
  };

  const handleDeleteReel = async (reelId: string) => {
    if (!confirm('Delete this reel?')) return;
    await supabase.from('reels').delete().eq('id', reelId);
    queryClient.invalidateQueries({ queryKey: ['profile-reels', id] });
    toast({ title: 'Reel deleted', description: 'Your reel has been removed.' });
  };

  const handleOpenList = (type: 'followers' | 'following') => setListType(type);
  const handleCloseList = () => setListType(null);

  const currentList = listType === 'followers' ? followersList : followingList;
  const listTitle = listType === 'followers' ? 'Followers' : 'Following';

  // ---------- LOADING & ERROR STATES ----------
  if (profileLoading) {
    return (
      <AppLayout>
        <div className="max-w-[935px] mx-auto p-4 space-y-6">
          <Skeleton className="h-48 w-full rounded-b-2xl" />
          <div className="flex justify-center items-start -mt-16 relative z-10">
            <Skeleton className="h-32 w-32 rounded-full border-4 border-background" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex justify-center gap-8 mt-6">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (profileError || !profile) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">User not found or an error occurred.</p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ---------- RENDER ----------
  return (
    <AppLayout>
      <div className="max-w-[935px] mx-auto relative bg-background min-h-screen">
        {/* Modern Banner with glass effect */}
        <div className="relative h-40 md:h-56 rounded-b-3xl overflow-hidden bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-pink-500/40 backdrop-blur-sm">
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/30 to-secondary/30" />
          )}
        </div>

        {/* Centered Avatar Overlapping Banner with modern ring */}
        <div className="flex justify-center -mt-14 md:-mt-20 relative z-10 px-4 group/avatar">
          <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-background bg-muted shadow-xl transition-transform duration-300 hover:scale-105">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover rounded-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-muted-foreground bg-gradient-to-br from-gray-100 to-gray-200 dark:from-neutral-800 dark:to-neutral-900 rounded-full">
                {profile.username[0]?.toUpperCase()}
              </div>
            )}
            {isOwn && (
              <>
                <button
                  onClick={() => avatarRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-all duration-200 disabled:opacity-100 backdrop-blur-sm"
                >
                  {uploadingAvatar ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </button>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </>
            )}
          </div>
        </div>

        {/* Profile Info & Actions */}
        <div className="pt-4 px-4 flex flex-col items-center text-center max-w-2xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {profile.username}
          </h1>
          {profile.full_name && <p className="text-sm md:text-base text-muted-foreground mt-1">{profile.full_name}</p>}

          {/* Action Buttons - Modern rounded-full */}
          <div className="flex items-center justify-center gap-3 mt-4 w-full">
            {isOwn ? (
              <>
                <Link to="/edit-profile">
                  <Button variant="secondary" className="rounded-full font-semibold px-6 h-9 shadow-sm hover:shadow-md transition-all">
                    Edit Profile
                  </Button>
                </Link>
                <Link to="/settings">
                  <Button variant="secondary" size="icon" className="rounded-full h-9 w-9 shadow-sm hover:shadow-md transition-all">
                    <Settings className="w-4 h-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Button
                  onClick={handleFollow}
                  variant={followStatus ? 'secondary' : 'default'}
                  className={`rounded-full font-semibold px-8 h-9 shadow-sm hover:shadow-md transition-all ${followStatus?.status === 'pending' ? 'bg-muted' : ''}`}
                >
                  {followStatus?.status === 'pending' ? 'Requested' : followStatus ? 'Following' : 'Follow'}
                </Button>
                <Button onClick={handleMessage} variant="secondary" className="rounded-full font-semibold px-6 h-9 shadow-sm hover:shadow-md transition-all">
                  Message
                </Button>
              </>
            )}
          </div>

          {/* Bio & Link with subtle icons */}
          {profile.bio && <p className="mt-4 text-sm md:text-base whitespace-pre-wrap leading-relaxed">{profile.bio}</p>}
          {profile.website && (
            <a
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-sm font-semibold text-blue-500 hover:text-blue-600 inline-flex items-center gap-1 transition-colors"
            >
              <Link2 className="w-4 h-4" /> {profile.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>

        {/* Stats Section - Modern card-like */}
        <div className="flex justify-center gap-8 md:gap-16 mt-6 py-4 border-y border-separator/50 bg-muted/20 backdrop-blur-sm">
          <div className="text-center flex flex-col items-center">
            <span className="font-bold text-lg">{profile.posts_count ?? posts?.length ?? 0}</span>
            <span className="text-sm text-muted-foreground">posts</span>
          </div>
          <button onClick={() => handleOpenList('followers')} className="text-center flex flex-col items-center hover:opacity-70 transition-all duration-200 group">
            <span className="font-bold text-lg group-hover:scale-105 transition-transform">{profile.followers_count ?? 0}</span>
            <span className="text-sm text-muted-foreground">followers</span>
          </button>
          <button onClick={() => handleOpenList('following')} className="text-center flex flex-col items-center hover:opacity-70 transition-all duration-200 group">
            <span className="font-bold text-lg group-hover:scale-105 transition-transform">{profile.following_count ?? 0}</span>
            <span className="text-sm text-muted-foreground">following</span>
          </button>
        </div>

        {/* Tabs - Instagram Style with better animations */}
        <div className="border-t border-separator mt-2">
          <div className="flex justify-center gap-12 text-xs font-semibold uppercase tracking-widest">
            <button
              onClick={() => setTab('posts')}
              className={`flex items-center gap-2 py-4 transition-all duration-200 ${
                tab === 'posts'
                  ? 'border-t-2 border-foreground text-foreground -mt-[2px]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Grid3X3 className="w-4 h-4" /> Posts
            </button>
            <button
              onClick={() => setTab('reels')}
              className={`flex items-center gap-2 py-4 transition-all duration-200 ${
                tab === 'reels'
                  ? 'border-t-2 border-foreground text-foreground -mt-[2px]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Film className="w-4 h-4" /> Reels
            </button>
            {isOwn && (
              <button
                onClick={() => setTab('saved')}
                className={`flex items-center gap-2 py-4 transition-all duration-200 ${
                  tab === 'saved'
                    ? 'border-t-2 border-foreground text-foreground -mt-[2px]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Bookmark className="w-4 h-4" /> Saved
              </button>
            )}
          </div>
        </div>

        {/* Content Grid - Modern zoom on hover */}
        <div className="grid grid-cols-3 gap-1 pb-20">
          {tab === 'posts' &&
            posts?.map((post) => (
              <div key={post.id} className="aspect-square relative group cursor-pointer bg-muted overflow-hidden">
                <Link to={`/post/${post.id}`}>
                  <img
                    src={post.image_urls[0]}
                    alt="Post"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Modern overlay with glass effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-6 text-white font-bold text-lg backdrop-blur-[2px]">
                    <div className="flex items-center gap-2">
                      <Heart className="w-6 h-6 fill-white drop-shadow-lg" /> {post.likes_count ?? 0}
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-6 h-6 fill-white drop-shadow-lg" /> {post.comments_count ?? 0}
                    </div>
                  </div>
                </Link>
                {isOwn && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeletePost(post.id);
                    }}
                    className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          
          {tab === 'reels' &&
            reels?.map((reel) => (
              <div key={reel.id} className="aspect-[9/16] relative group cursor-pointer bg-muted overflow-hidden">
                <Link to="/reels">
                  <video src={reel.video_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" muted preload="metadata" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-3 opacity-100 group-hover:bg-black/30 transition-colors">
                    <Film className="w-5 h-5 text-white drop-shadow-md" />
                  </div>
                </Link>
                {isOwn && (
                  <button
                    onClick={() => handleDeleteReel(reel.id)}
                    className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 hover:scale-110"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

          {tab === 'saved' &&
            saved?.map((s) => {
              const post = s.posts as any;
              if (!post) return null;
              return (
                <Link key={s.id} to={`/post/${post.id}`} className="aspect-square relative group bg-muted overflow-hidden">
                  <img src={post.image_urls[0]} alt="Saved Post" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[1px]" />
                </Link>
              );
            })}
        </div>

        {/* Empty States - Modern minimal design */}
        {tab === 'posts' && posts?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6 shadow-inner">
              <ImageIcon className="w-10 h-10 text-foreground/60 stroke-[1.5]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Posts Yet</h2>
            <p className="text-muted-foreground max-w-sm">When you share photos and videos, they will appear on your profile.</p>
          </div>
        )}
        
        {tab === 'reels' && reels?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6 shadow-inner">
              <Clapperboard className="w-10 h-10 text-foreground/60 stroke-[1.5]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Reels</h2>
            <p className="text-muted-foreground">Capture and share your favorite moments with Reels.</p>
          </div>
        )}

        {tab === 'saved' && saved?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6 shadow-inner">
              <Bookmark className="w-10 h-10 text-foreground/60 stroke-[1.5]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Save Content</h2>
            <p className="text-muted-foreground max-w-sm">Save photos and videos that you want to see again. No one is notified, and only you can see what you've saved.</p>
          </div>
        )}
      </div>

      {/* Desktop: Glassmorphic Sidebar for Followers/Following */}
      {isDesktop && listType !== null && (
        <div className="fixed inset-y-0 right-0 w-96 bg-background/80 backdrop-blur-xl border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between p-5 border-b bg-background/50">
            <h2 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">{listTitle}</h2>
            <Button variant="ghost" size="icon" onClick={handleCloseList} className="rounded-full hover:bg-muted transition-all">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-3">
              {currentList?.map((person) => (
                <div key={person.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-accent/40 transition-all duration-200">
                  <Link
                    to={`/profile/${person.id}`}
                    onClick={handleCloseList}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <Avatar className="h-12 w-12 border border-border shadow-sm">
                      <AvatarImage src={person.avatar_url} />
                      <AvatarFallback>{person.username?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{person.username}</p>
                      {person.full_name && <p className="text-xs text-muted-foreground truncate">{person.full_name}</p>}
                    </div>
                  </Link>
                  {person.id !== user?.id && <FollowButton targetId={person.id} currentUserId={user?.id} />}
                </div>
              ))}
              {currentList?.length === 0 && (
                <p className="text-center text-muted-foreground py-10">No {listType.toLowerCase()} yet</p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Mobile: Bottom Drawer with modern styling */}
      {!isDesktop && listType !== null && (
        <Drawer open={true} onOpenChange={(open) => !open && handleCloseList()}>
          <DrawerContent className="h-[85vh] rounded-t-3xl bg-background/95 backdrop-blur-md">
            <DrawerHeader className="border-b pb-4 bg-background/50">
              <DrawerTitle className="text-center text-lg font-bold">{listTitle}</DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="h-full px-4 pt-4 pb-20">
              <div className="space-y-3">
                {currentList?.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-accent/40 transition-all">
                    <Link
                      to={`/profile/${person.id}`}
                      onClick={handleCloseList}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <Avatar className="h-12 w-12 border border-border shadow-sm">
                        <AvatarImage src={person.avatar_url} />
                        <AvatarFallback>{person.username?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{person.username}</p>
                        {person.full_name && <p className="text-xs text-muted-foreground truncate">{person.full_name}</p>}
                      </div>
                    </Link>
                    {person.id !== user?.id && <FollowButton targetId={person.id} currentUserId={user?.id} />}
                  </div>
                ))}
                {currentList?.length === 0 && (
                  <p className="text-center text-muted-foreground py-10">No {listType.toLowerCase()} yet</p>
                )}
              </div>
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      )}
    </AppLayout>
  );
}