import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, UserPlus, AtSign, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces for Type Safety ---
interface Profile {
  username: string;
  avatar_url: string | null;
}

interface Post {
  id: string;
  image_urls: string[];
}

interface Notification {
  id: string;
  created_at: string;
  type: 'like' | 'comment' | 'follow' | 'mention';
  read: boolean;
  actor_id: string;
  user_id: string;
  post_id?: string;
  actor: Profile;
  post?: Post;
}

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(username, avatar_url),
          post:posts!notifications_post_id_fkey(id, image_urls)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as unknown as Notification[];
    },
    enabled: !!user,
  });

  // Mark all as read
  useEffect(() => {
    if (!user) return;
    const markRead = async () => {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      
      queryClient.invalidateQueries({ queryKey: ['unread-notifications'] });
    };
    markRead();
  }, [user, queryClient]);

  // Realtime update logic
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const getNotifText = (type: Notification['type']) => {
    switch (type) {
      case 'like': return 'liked your post.';
      case 'comment': return 'commented on your post.';
      case 'follow': return 'started following you.';
      case 'mention': return 'mentioned you in a comment.';
      default: return 'interacted with you.';
    }
  };

  // Logic for grouping
  const groups: Record<string, Notification[]> = {
    'Today': [],
    'This Week': [],
    'This Month': [],
    'Earlier': []
  };

  notifications?.forEach(n => {
    const date = new Date(n.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) groups['Today'].push(n);
    else if (diffDays < 7) groups['This Week'].push(n);
    else if (diffDays < 30) groups['This Month'].push(n);
    else groups['Earlier'].push(n);
  });

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto bg-background min-h-screen">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-4 py-4 border-b border-border">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Notifications</h2>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : notifications?.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">Activity On Your Posts</h3>
            <p className="text-muted-foreground text-sm mt-2">
              When someone likes or comments on your photos, you'll see them here.
            </p>
          </div>
        ) : (
          <div className="pb-20">
            {Object.entries(groups).map(([title, items]) => (
              items.length > 0 && (
                <div key={title} className="mb-4">
                  <h3 className="text-[15px] font-bold px-4 py-3">{title}</h3>
                  <div className="divide-y divide-border/50">
                    <AnimatePresence>
                      {items.map(n => (
                        <NotificationRow key={n.id} n={n} getNotifText={getNotifText} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function NotificationRow({ n, getNotifText }: { n: Notification; getNotifText: (t: Notification['type']) => string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const actor = n.actor;
  const post = n.post;

  const { data: followStatus, refetch: refetchFollow } = useQuery({
    queryKey: ['follow-status', user?.id, n.actor_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('id, status')
        .eq('follower_id', user!.id)
        .eq('following_id', n.actor_id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && n.type === 'follow',
  });

  const handleFollowBack = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (followStatus) {
      await supabase.from('follows').delete().eq('id', followStatus.id);
    } else {
      await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: n.actor_id,
        status: 'accepted',
      });
      await supabase.from('notifications').insert({
        user_id: n.actor_id,
        actor_id: user.id,
        type: 'follow',
      });
    }
    refetchFollow();
    queryClient.invalidateQueries({ queryKey: ['profile', n.actor_id] });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors relative ${!n.read ? 'bg-primary/5' : ''}`}
    >
      <Link to={`/profile/${n.actor_id}`} className="relative flex-shrink-0">
        <div className="w-12 h-12 rounded-full bg-muted overflow-hidden border border-border">
          {actor?.avatar_url ? (
            <img src={actor.avatar_url} alt={actor.username} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-md font-bold bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white">
              {actor?.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        {!n.read && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 border-2 border-background rounded-full" />
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-snug">
          <Link to={`/profile/${n.actor_id}`} className="font-bold hover:underline">
            {actor?.username}
          </Link>{' '}
          <span className="text-foreground">{getNotifText(n.type)}</span>{' '}
          <span className="text-muted-foreground text-[13px]">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: false })}
          </span>
        </p>
      </div>

      <div className="flex-shrink-0 ml-2">
        {n.type === 'follow' ? (
          <button
            onClick={handleFollowBack}
            className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 ${
              followStatus
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {followStatus ? 'Following' : 'Follow'}
          </button>
        ) : post?.image_urls?.[0] ? (
          <Link to={`/post/${post.id}`}>
            <img 
              src={post.image_urls[0]} 
              alt="Post preview" 
              className="w-11 h-11 object-cover rounded-sm border border-border" 
            />
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}