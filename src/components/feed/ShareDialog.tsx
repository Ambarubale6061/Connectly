import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Search, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareType: 'post' | 'reel';
  shareId: string;
}

interface User {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

export function ShareDialog({ open, onOpenChange, shareType, shareId }: ShareDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentUsers, setSentUsers] = useState<string[]>([]);
  const { user: currentUser } = useAuth();
  
  // Drag controls for smoother handle interaction
  const controls = useDragControls();

  useEffect(() => {
    if (open) {
      search.trim() ? searchUsers() : fetchRecentConversations();
    } else {
      setSearch('');
      setSentUsers([]);
    }
  }, [open, search]);

  const searchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, full_name')
      .ilike('username', `%${search}%`)
      .neq('id', currentUser?.id ?? '')
      .limit(15);
    if (!error && data) setUsers(data as User[]);
    setLoading(false);
  };

  const fetchRecentConversations = async () => {
    setLoading(true);
    try {
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          participant_1, participant_2,
          profiles_1:participant_1(id, username, avatar_url, full_name),
          profiles_2:participant_2(id, username, avatar_url, full_name)
        `)
        .or(`participant_1.eq.${currentUser?.id},participant_2.eq.${currentUser?.id}`)
        .order('last_message_time', { ascending: false })
        .limit(12);

      if (!error && conversations) {
        const uniqueUsers = new Map<string, User>();
        conversations.forEach((conv: any) => {
          const otherProfile = conv.participant_1 === currentUser?.id ? conv.profiles_2 : conv.profiles_1;
          if (otherProfile && !uniqueUsers.has(otherProfile.id)) {
            uniqueUsers.set(otherProfile.id, otherProfile);
          }
        });
        setUsers(Array.from(uniqueUsers.values()));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (userId: string) => {
    if (!currentUser || sentUsers.includes(userId)) return;
    setSendingId(userId);
    try {
      let conversationId: string | null = null;
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${currentUser.id},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${currentUser.id})`)
        .maybeSingle();

      if (existing) {
        conversationId = existing.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({ participant_1: currentUser.id, participant_2: userId })
          .select().single();
        if (convError) throw convError;
        conversationId = newConv.id;
      }

      const shareUrl = `${window.location.origin}/${shareType === 'post' ? 'post' : 'reels'}/${shareId}`;
      const messageText = `Shared a ${shareType}: ${shareUrl}`;

      await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: currentUser.id, text: messageText });
      await supabase.from('conversations').update({ last_message: messageText, last_message_time: new Date().toISOString() }).eq('id', conversationId);

      setSentUsers((prev) => [...prev, userId]);
      toast.success("Sent");
    } catch (error) {
      toast.error('Failed to share');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/60 backdrop-blur-[2px] z-[99]" />
      <DialogContent 
        className="fixed bottom-0 top-auto translate-y-0 sm:bottom-auto sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] w-full max-w-lg p-0 gap-0 overflow-hidden rounded-t-[24px] sm:rounded-2xl border-none bg-background shadow-2xl focus:outline-none z-[100] transition-none outline-none"
      >
        <motion.div
          drag="y" // Enable vertical drag
          dragConstraints={{ top: 0, bottom: 0 }} // Limits drag range
          dragElastic={0.7} // Bounce effect
          onDragEnd={(_, info) => {
            if (info.offset.y > 150) onOpenChange(false); // Close if dragged down far enough
          }}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 350 }}
          className="flex flex-col h-[75vh] sm:h-[60vh] touch-none"
        >
          {/* Drag Handle Area - This triggers the drag */}
          <div 
            className="w-full flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing flex-shrink-0"
            onPointerDown={(e) => controls.start(e)}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="px-4 py-1 text-center border-b border-border/40 flex-shrink-0">
            <DialogTitle className="text-[15px] font-bold tracking-tight">Share</DialogTitle>
          </div>

          <div className="p-4 flex-shrink-0 pointer-events-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 text-sm bg-secondary/60 rounded-xl border-none focus:ring-1 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>

          {/* List area needs to allow scrolling but prevent parent drag */}
          <div 
            className="flex-1 overflow-y-auto no-scrollbar px-4 pb-6 pointer-events-auto touch-pan-y" 
            onPointerDown={(e) => e.stopPropagation()} // Important: Stop drag when touching the list
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col pt-2">
                <AnimatePresence mode="popLayout">
                  {users.map((user) => (
                    <motion.div
                      key={user.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between py-3 px-1 active:bg-muted/40 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary text-lg font-bold">
                              {user.username[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-[14px] font-semibold truncate leading-tight">{user.username}</span>
                          <span className="text-[13px] text-muted-foreground truncate leading-tight">{user.full_name || user.username}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleShare(user.id)}
                        disabled={sendingId === user.id}
                        className={`min-w-[76px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                          sentUsers.includes(user.id)
                          ? 'bg-transparent border border-border text-muted-foreground'
                          : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {sendingId === user.id ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                        ) : sentUsers.includes(user.id) ? (
                          <span className="flex items-center justify-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Sent
                          </span>
                        ) : 'Send'}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}