import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, Send, Image, Info, Smile } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';
import imageCompression from 'browser-image-compression';

export default function ChatRoom() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Conversation info
  const { data: conversation } = useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, p1:profiles!conversations_participant_1_fkey(id, username, avatar_url), p2:profiles!conversations_participant_2_fkey(id, username, avatar_url)')
        .eq('id', id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const otherUser = conversation
    ? ((conversation.p1 as any)?.id === user?.id ? conversation.p2 : conversation.p1) as any
    : null;

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id!)
        .order('created_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!id,
  });

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`messages-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', id] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!user || !id || messages.length === 0) return;
    const unread = messages.filter(m => !m.is_read && m.sender_id !== user.id);
    if (unread.length > 0) {
      supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id)
        .eq('is_read', false)
        .then(() => {});
    }
  }, [messages, user, id]);

  const sendMessage = async (messageText?: string, imageUrl?: string) => {
    if (!user || !id) return;
    const t = messageText?.trim();
    if (!t && !imageUrl) return;
    setSending(true);
    try {
      await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: user.id,
        text: t || null,
        image_url: imageUrl || null,
      });
      await supabase.from('conversations').update({
        last_message: t || '📷 Photo',
        last_message_time: new Date().toISOString(),
      }).eq('id', id);
      setText('');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    const compressed = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1080 });
    const path = `${user.id}/${Date.now()}.jpg`;
    await supabase.storage.from('chat-images').upload(path, compressed);
    const { data } = supabase.storage.from('chat-images').getPublicUrl(path);
    sendMessage(undefined, data.publicUrl);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-separator bg-background">
        <button onClick={() => navigate('/messages')}>
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        {otherUser && (
          <Link to={`/profile/${otherUser.id}`} className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
              {otherUser.avatar_url ? (
                <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  {otherUser.username?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-sm font-semibold text-foreground">{otherUser.username}</span>
          </Link>
        )}
        <Link to={otherUser ? `/profile/${otherUser.id}` : '#'}>
          <Info className="w-5 h-5 text-foreground" />
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.map(m => {
          const isMine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] ${isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'} rounded-2xl px-3 py-2`}>
                {m.image_url && (
                  <img src={m.image_url} alt="" className="rounded-lg max-w-full mb-1" />
                )}
                {m.text && <p className="text-sm">{m.text}</p>}
                <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: false })}
                  {isMine && m.is_read && ' · Seen'}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-separator bg-background">
        <button onClick={() => fileRef.current?.click()}>
          <Image className="w-6 h-6 text-primary" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />
        <Input
          placeholder="Message..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage(text))}
          className="flex-1 rounded-full bg-muted border-0"
        />
        <button
          onClick={() => sendMessage(text)}
          disabled={sending || !text.trim()}
          className="text-primary font-semibold text-sm disabled:opacity-30"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
