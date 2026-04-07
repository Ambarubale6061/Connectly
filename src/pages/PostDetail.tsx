import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PostCard } from '@/components/feed/PostCard';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: post } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles!posts_user_id_fkey(username, avatar_url, full_name)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles!comments_user_id_fkey(username, avatar_url)')
        .eq('post_id', id!)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      if (!user || !post) return;

      // १. कमेंट इन्सर्ट करणे
      const { error: commentError } = await supabase.from('comments').insert({
        post_id: id!,
        user_id: user.id,
        text,
      });

      if (commentError) throw commentError;

      // २. नोटिफिकेशन लॉजिक (स्वतःच्या पोस्टवर कमेंट केल्यास नोटिफिकेशन जाणार नाही)
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, // पोस्टचा मालक
          actor_id: user.id,     // कमेंट करणारा युजर
          type: 'comment',
          post_id: id!,
        });
      }
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
    },
  });

  if (!post) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-[470px] mx-auto pt-4">
        <PostCard post={post} />

        {/* Comments List */}
        <div className="px-3 mt-4 space-y-4">
          {comments?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
          ) : (
            comments?.map(c => (
              <div key={c.id} className="flex gap-3">
                <Link to={`/profile/${c.user_id}`} className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                  {(c.profiles as any)?.avatar_url ? (
                    <img src={(c.profiles as any).avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-bold">
                      {(c.profiles as any)?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1">
                  <p className="text-sm text-foreground leading-snug">
                    <Link to={`/profile/${c.user_id}`} className="font-semibold mr-2 hover:underline">
                      {(c.profiles as any)?.username}
                    </Link>
                    <span className="break-words">{c.text}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Comment Input Form */}
        {user && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (commentText.trim() && !addComment.isPending) {
                addComment.mutate(commentText.trim());
              }
            }}
            className="flex items-center gap-3 px-3 py-3 border-t border-separator mt-6 sticky bottom-0 bg-background"
          >
            <Input
              placeholder="Add a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="border-0 focus-visible:ring-0 px-0 text-sm placeholder:text-muted-foreground"
              disabled={addComment.isPending}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || addComment.isPending}
              className="text-sm font-semibold text-primary disabled:opacity-30 transition-opacity"
            >
              {addComment.isPending ? 'Posting...' : 'Post'}
            </button>
          </form>
        )}
      </div>
    </AppLayout>
  );
}