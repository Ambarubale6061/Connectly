import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { AddStoryDialog } from './AddStoryDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface StoryGroup {
  user_id: string;
  username: string;
  avatar_url: string | null;
  stories: Array<{
    id: string;
    media_url: string;
    media_type: string | null;
    created_at: string;
  }>;
}

interface StoryViewerProps {
  groups: StoryGroup[];
  initialIndex: number;
  onClose: () => void;
}

export function StoryViewer({ groups, initialIndex, onClose }: StoryViewerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [groupIndex, setGroupIndex] = useState(initialIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const DURATION = 5000;

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];
  const isOwner = user?.id === group?.user_id;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goNext = useCallback(() => {
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(s => s + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(g => g + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, groupIndex, group, groups, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(s => s - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex(g => g - 1);
      setStoryIndex(0);
      setProgress(0);
    }
  }, [storyIndex, groupIndex]);

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || !story) return;
    const interval = 50;
    timerRef.current = window.setInterval(() => {
      setProgress(p => {
        const next = p + (interval / DURATION) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, interval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused, story, goNext]);

  // Pause when typing
  useEffect(() => {
    setIsPaused(replyText.length > 0);
  }, [replyText]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  const handleDelete = async () => {
    if (!story) return;
    try {
      const path = story.media_url.split('/story-media/')[1];
      if (path) {
        await supabase.storage.from('story-media').remove([path]);
      }
      await supabase.from('stories').delete().eq('id', story.id);
      toast({ title: 'Story deleted' });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to delete story', variant: 'destructive' });
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    // Use setTimeout to avoid state update conflicts
    setTimeout(() => setShowEditDialog(true), 0);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowMenu(false);
    setTimeout(() => setShowDeleteConfirm(true), 0);
  };

  if (!group || !story) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
        >
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 flex gap-0.5 p-2 z-10">
            {group.stories.map((_, i) => (
              <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-none"
                  style={{
                    width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10 pt-2">
            <Link to={`/profile/${group.user_id}`} onClick={onClose} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                {group.avatar_url ? (
                  <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-white/70">
                    {group.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-white text-sm font-semibold">{group.username}</span>
            </Link>
            <div className="flex items-center gap-3">
              {isOwner && (
                <div 
                  className="relative" 
                  ref={menuRef}
                  onMouseDown={(e) => e.stopPropagation()}
                  onMouseUp={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMenu(!showMenu);
                    }}
                    className="text-white focus:outline-none"
                  >
                    <MoreHorizontal className="w-6 h-6" />
                  </button>
                  {showMenu && (
                    <div 
                      className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-[200] py-1 border"
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={handleEditClick}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Edit className="mr-2 h-4 w-4" /> Edit Story
                      </button>
                      <button
                        onClick={handleDeleteClick}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Story
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button onClick={onClose}>
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>

          {/* Story media */}
          <div
            className="relative w-full h-full max-w-[420px] flex items-center justify-center"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => replyText.length === 0 && setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => replyText.length === 0 && setIsPaused(false)}
          >
            {story.media_type === 'video' ? (
              <video src={story.media_url} className="max-w-full max-h-full object-contain" autoPlay muted playsInline />
            ) : (
              <img src={story.media_url} alt="" className="max-w-full max-h-full object-contain" />
            )}

            {/* Tap zones */}
            <button onClick={goPrev} className="absolute left-0 top-0 w-1/3 h-full" />
            <button onClick={goNext} className="absolute right-0 top-0 w-2/3 h-full" />
          </div>

          {/* Nav arrows (desktop) */}
          {groupIndex > 0 && (
            <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 hidden md:block">
              <ChevronLeft className="w-8 h-8 text-white/70" />
            </button>
          )}
          {groupIndex < groups.length - 1 && (
            <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:block">
              <ChevronRight className="w-8 h-8 text-white/70" />
            </button>
          )}

          {/* Reply input */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <Input
              placeholder="Send message"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              className="bg-transparent border-white/30 text-white placeholder:text-white/50 rounded-full"
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Edit Dialog */}
      {showEditDialog && story && (
        <AddStoryDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          storyId={story.id}
          initialMediaUrl={story.media_url}
          initialMediaType={story.media_type}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The story will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}