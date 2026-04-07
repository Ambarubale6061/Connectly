import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  UserPlus,
  UserCheck,
  MessageCircle,
  Sparkles,
  Download,
  X,
  Heart,
  MessageCircle as CommentIcon,
  Play,
  Grid3x3,
  Video
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Search() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [aiImages, setAiImages] = useState([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [activeTab, setActiveTab] = useState('explore'); // 'explore', 'users', 'tags', 'ai'

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim() && activeTab === 'explore') {
        setActiveTab('users');
      } else if (!query.trim() && activeTab !== 'ai') {
        setActiveTab('explore');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeTab]);

  // Search users
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['search-users', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_private')
        .or(`username.ilike.%${debouncedQuery}%,full_name.ilike.%${debouncedQuery}%`)
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: debouncedQuery.length > 0 && activeTab === 'users',
  });

  // Search hashtags
  const { data: hashtags, isLoading: loadingHashtags } = useQuery({
    queryKey: ['search-hashtags', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      const { data, error } = await supabase
        .from('hashtags')
        .select('id, name, post_count')
        .ilike('name', `%${debouncedQuery}%`)
        .order('post_count', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: debouncedQuery.length > 0 && activeTab === 'tags',
  });

  // Infinite query for global posts & reels (Instagram-style Explore feed)
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingFeed,
  } = useInfiniteQuery({
    queryKey: ['global-feed'],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = 15;
      
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`id, caption, image_urls, likes_count, comments_count, created_at, user_id, is_video, profiles!user_id (username, avatar_url, full_name)`)
        .order('created_at', { ascending: false })
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
      if (postsError) throw postsError;
      
      const { data: reels, error: reelsError } = await supabase
        .from('reels')
        .select(`id, caption, video_url, likes_count, comments_count, created_at, user_id, profiles!user_id (username, avatar_url, full_name)`)
        .order('created_at', { ascending: false })
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
      if (reelsError) throw reelsError;
      
      const postsItems = (posts || []).map((p) => ({
        type: 'post',
        id: p.id,
        mediaUrl: p.image_urls?.[0] || '',
        isVideo: p.is_video || false,
        likesCount: p.likes_count || 0,
        commentsCount: p.comments_count || 0,
        createdAt: p.created_at,
      }));
      
      const reelsItems = (reels || []).map((r) => ({
        type: 'reel',
        id: r.id,
        mediaUrl: r.video_url,
        isVideo: true,
        likesCount: r.likes_count || 0,
        commentsCount: r.comments_count || 0,
        createdAt: r.created_at,
      }));
      
      const combined = [...postsItems, ...reelsItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return combined;
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length >= 10 ? allPages.length : undefined;
    },
    enabled: activeTab === 'explore',
  });

  const feed = feedData?.pages.flat() || [];

  // Check follow status
  const { data: followStatusMap } = useQuery({
    queryKey: ['follow-status', users?.map(u => u.id)],
    queryFn: async () => {
      if (!user || !users?.length) return {};
      const { data, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', users.map(u => u.id));
      if (error) throw error;
      const followingSet = new Set(data?.map(f => f.following_id));
      return users.reduce((acc, u) => {
        acc[u.id] = { isFollowing: followingSet.has(u.id) };
        return acc;
      }, {});
    },
    enabled: !!user && !!users?.length && activeTab === 'users',
  });

  const followMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-status'] });
      toast({ title: 'Followed', description: 'You are now following this user.' });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-status'] });
      toast({ title: 'Unfollowed', description: 'You unfollowed this user.' });
    },
  });

  // Handle AI Image Generation from the unified search bar
  const handleGenerateAI = async () => {
    if (!query.trim()) {
      toast({ title: 'Enter a prompt', description: 'Please enter something to generate.', variant: 'destructive' });
      return;
    }
    setActiveTab('ai');
    setIsLoadingAI(true);
    
    // Replace with real AI API integration
    setTimeout(() => {
      const generatedImages = Array.from(
        { length: 12 },
        (_, i) => `https://picsum.photos/seed/${query.replace(/\s+/g, '')}${i}/600/600`
      );
      setAiImages(generatedImages);
      setIsLoadingAI(false);
    }, 1500);
  };

  const downloadImage = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ai-generated-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto md:p-6 w-full">
        
        {/* Unified Search Panel with Glassmorphism */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl p-4 md:p-0 md:mb-6 border-b border-border/50 md:border-none">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1 group">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                placeholder="Search accounts, tags or type a prompt to generate..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateAI()}
                className="pl-12 pr-4 py-6 bg-muted/40 hover:bg-muted/60 focus:bg-background rounded-2xl border-border/50 focus:border-primary/50 transition-all duration-300 text-base shadow-sm"
              />
            </div>
            <Button
              onClick={handleGenerateAI}
              disabled={isLoadingAI}
              className="py-6 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:opacity-90 shadow-lg shadow-purple-500/20 transition-all duration-300"
            >
              {isLoadingAI ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  <span className="hidden sm:inline font-semibold text-white">Generate</span>
                </>
              )}
            </Button>
          </div>

          {/* Navigation Tabs if User is Searching */}
          {query && !isLoadingAI && (
            <div className="flex gap-6 mt-4 px-2 border-b border-border/50">
              {['users', 'tags', 'ai'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 text-sm font-semibold capitalize transition-colors relative ${
                    activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'ai' ? 'Generated AI' : tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-1 md:p-0">
          
          {/* 1. Explore Feed (Instagram Grid) */}
          {activeTab === 'explore' && (
            <div>
              {loadingFeed ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : feed.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                  <Grid3x3 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No posts to explore yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4">
                  {feed.map((item, idx) => (
                    <div
                      key={`explore-${item.id}-${idx}`}
                      onClick={() => navigate(`/${item.type}/${item.id}`)}
                      className="group relative aspect-square bg-muted/30 overflow-hidden cursor-pointer rounded-sm sm:rounded-xl"
                    >
                      {item.isVideo ? (
                        <>
                          <video
                            src={item.mediaUrl}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            onMouseEnter={(e) => e.target.play()}
                            onMouseLeave={(e) => {
                              e.target.pause();
                              e.target.currentTime = 0;
                            }}
                          />
                          <div className="absolute top-2 right-2 z-10">
                            <Video className="w-5 h-5 text-white drop-shadow-md" />
                          </div>
                        </>
                      ) : (
                        <img
                          src={item.mediaUrl}
                          alt="Post"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      
                      {/* Instagram Desktop Hover State */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden md:flex items-center justify-center gap-6 text-white backdrop-blur-[2px]">
                        <div className="flex items-center gap-2 font-semibold text-lg">
                          <Heart className="w-6 h-6 fill-white" />
                          <span>{item.likesCount}</span>
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-lg">
                          <CommentIcon className="w-6 h-6 fill-white" />
                          <span>{item.commentsCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {hasNextPage && (
                <div className="flex justify-center mt-8 pb-8">
                  <Button variant="ghost" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 2. Users Search Results */}
          {activeTab === 'users' && (
            <div className="flex flex-col gap-2 p-3">
              {loadingUsers ? (
                <div className="py-10 text-center"><div className="w-6 h-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : users?.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">No accounts found.</p>
              ) : (
                users?.map((profile) => {
                  const followStatus = followStatusMap?.[profile.id]?.isFollowing || false;
                  const isOwnProfile = user?.id === profile.id;
                  return (
                    <div key={profile.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/50 transition-colors">
                      <Link to={`/profile/${profile.id}`} className="flex items-center gap-4 flex-1">
                        <Avatar className="w-14 h-14 border border-border/50">
                          <AvatarImage src={profile.avatar_url || undefined} className="object-cover" />
                          <AvatarFallback className="bg-primary/5 text-primary text-lg">
                            {profile.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{profile.username}</p>
                          {profile.full_name && <p className="text-sm text-muted-foreground">{profile.full_name}</p>}
                        </div>
                      </Link>
                      {!isOwnProfile && (
                        <Button
                          size="sm"
                          variant={followStatus ? 'secondary' : 'default'}
                          onClick={() => followStatus ? unfollowMutation.mutate(profile.id) : followMutation.mutate(profile.id)}
                          className="rounded-xl px-5 font-semibold"
                        >
                          {followStatus ? 'Following' : 'Follow'}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. Hashtags Search Results */}
          {activeTab === 'tags' && (
            <div className="flex flex-col gap-2 p-3">
              {loadingHashtags ? (
                <div className="py-10 text-center"><div className="w-6 h-6 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : hashtags?.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">No tags found.</p>
              ) : (
                hashtags?.map((hashtag) => (
                  <Link
                    key={hashtag.id}
                    to={`/explore?tag=${hashtag.name}`}
                    className="flex items-center gap-4 p-3 rounded-2xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-full border border-border/50 flex items-center justify-center bg-background">
                      <SearchIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">#{hashtag.name}</p>
                      <p className="text-sm text-muted-foreground">{hashtag.post_count?.toLocaleString() || 0} posts</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {/* 4. AI Generated Results (Instagram Grid Format) */}
          {activeTab === 'ai' && (
            <div>
              {isLoadingAI ? (
                <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                  <Sparkles className="w-10 h-10 mb-4 animate-pulse text-purple-500" />
                  <p className="font-medium animate-pulse">Generating your masterpiece...</p>
                </div>
              ) : aiImages.length > 0 ? (
                <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4">
                  {aiImages.map((img, idx) => (
                    <div
                      key={idx}
                      className="group relative aspect-square overflow-hidden cursor-pointer rounded-sm sm:rounded-xl bg-muted/30"
                      onClick={() => setSelectedImage(img)}
                    >
                      <img
                        src={img}
                        alt={`AI generated ${query}`}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(img);
                          }}
                          className="absolute bottom-3 right-3 bg-white/20 backdrop-blur-md rounded-full p-2 hover:bg-white/40 transition-colors"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  <p>Type a prompt and click Generate to see magic here.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fullscreen AI Image Viewer */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-white/10 backdrop-blur-md transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(selectedImage);
              }}
              className="absolute bottom-8 right-8 text-white/80 hover:text-white p-4 rounded-full bg-white/10 backdrop-blur-md transition-colors"
            >
              <Download className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Generated Full View"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

      </div>
    </AppLayout>
  );
}