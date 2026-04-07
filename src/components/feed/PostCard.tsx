import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageCarousel } from './ImageCarousel';
import { CommentsSection } from './CommentsSection';
import { ShareDialog } from './ShareDialog';

interface PostCardProps {
  post: {
    id: string;
    user_id: string;
    image_urls: string[];
    caption: string | null;
    location: string | null;
    likes_count: number | null;
    comments_count: number | null;
    created_at: string;
    profiles?: {
      username: string;
      avatar_url: string | null;
      full_name: string | null;
    };
  };
  isLiked?: boolean;
  isSaved?: boolean;
  onLikeToggle?: () => void;
  onSaveToggle?: () => void;
}

export function PostCard({ post, isLiked = false, isSaved = false, onLikeToggle, onSaveToggle }: PostCardProps) {
  const [liked, setLiked] = useState(isLiked);
  const [saved, setSaved] = useState(isSaved);
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count ?? 0);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { user } = useAuth();
  const profile = post.profiles;

  // सुरुवातीला लाईक आणि सेव्ह स्टेटस चेक करण्यासाठी
  useEffect(() => {
    if (!user) return;
    const checkStatus = async () => {
      const [{ data: likeData }, { data: saveData }] = await Promise.all([
        supabase
          .from('likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('target_type', 'post')
          .eq('target_id', post.id)
          .maybeSingle(),
        supabase
          .from('saved_posts')
          .select('id')
          .eq('user_id', user.id)
          .eq('post_id', post.id)
          .maybeSingle()
      ]);
      setLiked(!!likeData);
      setSaved(!!saveData);
    };
    checkStatus();
  }, [user, post.id]);

  const handleLike = async () => {
    if (!user) return;
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(prev => (newLiked ? prev + 1 : prev - 1));

    if (newLiked) {
      // १. लाईक इन्सर्ट करा
      await supabase.from('likes').insert({ 
        user_id: user.id, 
        target_type: 'post', 
        target_id: post.id 
      });

      // २. नोटिफिकेशन लॉजिक (स्वतःच्या पोस्टला लाईक केल्यास नोटिफिकेशन जाणार नाही)
      if (post.user_id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id, // पोस्टचा मालक
          actor_id: user.id,     // ज्याने लाईक केले तो
          type: 'like',
          post_id: post.id,
        });
      }
    } else {
      // लाईक रिमूव्ह करा
      await supabase.from('likes').delete().match({ 
        user_id: user.id, 
        target_type: 'post', 
        target_id: post.id 
      });
      
      // टीप: आपण सहसा लाईक काढल्यावर नोटिफिकेशन डिलीट करत नाही, 
      // पण गरज असल्यास इथे 'notifications' टेबलमधून डिलीटची क्वेरी टाकू शकतो.
    }
    onLikeToggle?.();
  };

  const handleDoubleTap = () => {
    if (!liked) handleLike();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const handleSave = async () => {
    if (!user) return;
    const newSaved = !saved;
    setSaved(newSaved);

    if (newSaved) {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
    } else {
      await supabase.from('saved_posts').delete().match({ user_id: user.id, post_id: post.id });
    }
    onSaveToggle?.();
  };

  const handleCommentAdded = () => {
    setCommentsCount(prev => prev + 1);
  };

  return (
    <>
      <article className="pb-3 mb-0 border-b border-separator">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <Link to={`/profile/${post.user_id}`} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-medium">
                  {profile?.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="leading-tight">
              <span className="text-sm font-semibold text-foreground">{profile?.username}</span>
              {post.location && (
                <p className="text-xs text-muted-foreground mt-0.5">{post.location}</p>
              )}
            </div>
          </Link>
          <button className="text-foreground p-1">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>

        {/* Image Carousel with Double Tap */}
        <div className="relative bg-black" onDoubleClick={handleDoubleTap}>
          <ImageCarousel images={post.image_urls} />
          <AnimatePresence>
            {showHeart && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              >
                <Heart className="w-20 h-20 fill-white text-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className="transform active:scale-90 transition-transform">
              <Heart className={`w-6 h-6 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-foreground'}`} />
            </button>
            <button onClick={() => setShowComments(!showComments)} className="transform active:scale-90 transition-transform">
              <MessageCircle className="w-6 h-6 text-foreground" />
            </button>
            <button onClick={() => setShowShareDialog(true)} className="transform active:scale-90 transition-transform">
              <Send className="w-6 h-6 text-foreground" />
            </button>
          </div>
          <button onClick={handleSave} className="transform active:scale-90 transition-transform">
            <Bookmark className={`w-6 h-6 transition-colors ${saved ? 'fill-foreground text-foreground' : 'text-foreground'}`} />
          </button>
        </div>

        {/* Likes count */}
        {likesCount > 0 && (
          <div className="px-3 pt-1">
            <p className="text-sm font-semibold text-foreground">
              {likesCount.toLocaleString()} {likesCount === 1 ? 'like' : 'likes'}
            </p>
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <div className="px-3 pt-0">
            <p className="text-sm text-foreground">
              <Link to={`/profile/${post.user_id}`} className="font-semibold mr-2">
                {profile?.username}
              </Link>
              <span className="break-words">{post.caption}</span>
            </p>
          </div>
        )}

        {/* Comments toggle */}
        {commentsCount > 0 && (
          <button 
            onClick={() => setShowComments(!showComments)}
            className="px-3 pt-0 text-sm text-muted-foreground"
          >
            {showComments ? 'Hide comments' : `View all ${commentsCount} comments`}
          </button>
        )}

        {/* Timestamp */}
        <div className="px-3 pb-1 pt-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>

        {/* Inline Comments Section */}
        {showComments && (
          <div className="border-t border-separator mt-1">
            <CommentsSection 
              targetId={post.id} 
              targetType="post" 
              onCommentAdded={handleCommentAdded}
            />
          </div>
        )}
      </article>

      <ShareDialog 
        open={showShareDialog} 
        onOpenChange={setShowShareDialog}
        shareType="post"
        shareId={post.id}
      />
    </>
  );
}