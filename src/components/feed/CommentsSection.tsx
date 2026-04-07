import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Comment {
  id: string;
  text: string;
  created_at: string;
  user_id: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

interface CommentsSectionProps {
  targetId: string;
  targetType: 'post' | 'reel';
  onCommentAdded?: () => void;
}

export function CommentsSection({ targetId, targetType, onCommentAdded }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchComments();
  }, [targetId]);

  const fetchComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq(targetType === 'post' ? 'post_id' : 'reel_id', targetId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setComments(data as Comment[]);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    setSubmitting(true);
    
    // १. कमेंट इन्सर्ट करणे
    const { data: commentData, error: commentError } = await supabase
      .from('comments')
      .insert({
        user_id: user.id,
        [targetType === 'post' ? 'post_id' : 'reel_id']: targetId,
        text: newComment.trim()
      })
      .select()
      .single();

    if (!commentError) {
      // २. नोटिफिकेशन पाठवण्यासाठी आधी पोस्ट/रीलचा मालक (owner) शोधणे
      const table = targetType === 'post' ? 'posts' : 'reels';
      const { data: contentData } = await supabase
        .from(table)
        .select('user_id')
        .eq('id', targetId)
        .single();

      // ३. नोटिफिकेशन लॉजिक (स्वतःच्या पोस्टवर स्वतः कमेंट केल्यास नोटिफिकेशन जाणार नाही)
      if (contentData && contentData.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: contentData.user_id, // कंटेंटचा मालक
          actor_id: user.id,            // कमेंट करणारा
          type: 'comment',
          post_id: targetType === 'post' ? targetId : null,
          // टीप: जर डेटाबेसमध्ये 'reel_id' कॉलम असेल तर तो इथे वापरता येईल
        });
      }

      setNewComment('');
      await fetchComments();
      onCommentAdded?.();
      inputRef.current?.focus();
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-muted/30 px-4 py-3">
      {/* Comments list */}
      <div className="space-y-3 max-h-72 overflow-y-auto mb-3 scrollbar-hide">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex gap-2 text-sm">
              <Link to={`/profile/${comment.user_id}`} className="shrink-0">
                <div className="w-7 h-7 rounded-full bg-muted overflow-hidden">
                  {comment.profiles?.avatar_url ? (
                    <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                      {comment.profiles?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </Link>
              <div className="flex-1">
                <div className="bg-background/60 rounded-lg px-3 py-1.5 shadow-sm">
                  <Link to={`/profile/${comment.user_id}`} className="font-semibold text-sm hover:underline mr-2">
                    {comment.profiles?.username}
                  </Link>
                  <span className="text-sm break-words leading-relaxed">{comment.text}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 ml-1">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment input form */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-background rounded-full border border-border/60 px-3 py-1 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
        <input
          ref={inputRef}
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-transparent text-sm outline-none py-2 px-1"
          disabled={submitting}
        />
        <button 
          type="submit" 
          disabled={!newComment.trim() || submitting}
          className="text-primary disabled:opacity-40 p-1.5 rounded-full transition-colors hover:bg-primary/10"
        >
          {submitting ? (
             <div className="w-4 h-4 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}