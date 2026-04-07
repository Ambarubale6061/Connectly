import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  ArrowLeft, ImageIcon, Info, Smile, Mic, Phone, Video,
  X, Reply, PhoneCall, PhoneMissed, VideoIcon, Square, Pause, Play,
  Gift, Check, CheckCheck,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import EmojiPicker from 'emoji-picker-react';
import ChatInfoPanel from '@/components/messages/ChatInfoPanel';
import CallModal from '@/components/messages/CallModal';
import IncomingCallModal from '@/components/messages/IncomingCallModal';
import GifPicker from '@/components/messages/GifPicker';
import { format } from 'date-fns';

// ============================================================================
// TYPES
// ============================================================================

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message: string | null;
  last_message_time: string | null;
  p1: Profile;
  p2: Profile;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  voice_note_url: string | null;
  gif_url: string | null;
  message_type: 'text' | 'image' | 'voice_note' | 'gif' | 'voice_call' | 'video_call';
  call_status: 'answered' | 'missed' | null;
  call_duration: number | null;
  is_read: boolean;
  reply_to: string | null;
  reactions: Record<string, string> | null;
  created_at: string;
}

// Type for inserting a new message (all required fields)
type MessageInsert = {
  conversation_id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  voice_note_url: string | null;
  gif_url: string | null;
  message_type: Message['message_type'];
  call_status: Message['call_status'];
  call_duration: number | null;
  reply_to: string | null;
};

interface IncomingCallData {
  type: 'voice' | 'video';
  callerId: string;
  callerName: string;
  callerAvatar: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatTime(dateStr: string): string {
  return format(new Date(dateStr), 'h:mm a');
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// VOICE NOTE PLAYER
// ============================================================================

interface VoiceNotePlayerProps {
  url: string;
  isMine: boolean;
}

function VoiceNotePlayer({ url, isMine }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }, [playing]);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    const percent = (audio.currentTime / (audio.duration || 1)) * 100;
    setProgress(percent);
  }, []);

  const handleMetadataLoad = useCallback((e: React.SyntheticEvent<HTMLAudioElement>) => {
    setDuration(Math.round(e.currentTarget.duration));
  }, []);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setProgress(0);
  }, []);

  return (
    <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl min-w-[190px] ${
      isMine ? 'bg-violet-500' : 'bg-gray-100 border border-gray-200'
    }`}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleMetadataLoad}
        onEnded={handleEnded}
      />
      <button
        onClick={togglePlayback}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isMine ? 'bg-white/25 text-white' : 'bg-violet-100 text-violet-600'
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className={`h-1 rounded-full overflow-hidden ${isMine ? 'bg-white/25' : 'bg-gray-300'}`}>
          <div
            className={`h-full rounded-full transition-all duration-100 ${isMine ? 'bg-white' : 'bg-violet-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-[10px] font-mono ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
          {duration > 0 ? formatDuration(duration) : '0:00'}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// VOICE RECORDER
// ============================================================================

interface VoiceRecorderProps {
  onSend: (blob: Blob) => void;
  onCancel: () => void;
}

function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(async (mediaStream) => {
        stream = mediaStream;
        const recorder = new MediaRecorder(mediaStream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          stream?.getTracks().forEach(track => track.stop());
          onSend(blob);
        };

        recorder.start();
        intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
      })
      .catch(() => onCancel());

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current.stop();
      }
    };
  }, [onSend, onCancel]);

  const stopRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
    }
    onCancel();
  }, [onCancel]);

  return (
    <div className="mx-3 mb-2 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      <span className="text-red-500 text-sm font-mono font-bold">{formatDuration(seconds)}</span>
      <span className="text-gray-400 text-xs flex-1">Recording…</span>
      <button
        onClick={cancelRecording}
        className="p-1.5 rounded-full hover:bg-red-100 text-gray-400 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <button
        onClick={stopRecording}
        className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
      >
        <Square className="w-3.5 h-3.5 text-white fill-white" />
      </button>
    </div>
  );
}

// ============================================================================
// CALL LOG
// ============================================================================

interface CallLogProps {
  message: Message;
  isMine: boolean;
}

function CallLog({ message, isMine }: CallLogProps) {
  const isVideo = message.message_type === 'video_call';
  const isMissed = message.call_status === 'missed';

  return (
    <div className="flex justify-center my-3">
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs border ${
        isMissed ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 bg-gray-50 text-gray-500'
      }`}>
        {isMissed ? (
          <PhoneMissed className="w-3.5 h-3.5" />
        ) : isVideo ? (
          <VideoIcon className="w-3.5 h-3.5" />
        ) : (
          <PhoneCall className="w-3.5 h-3.5" />
        )}
        <span className="font-medium">
          {isMissed
            ? (isMine ? 'Missed call' : 'You missed a call')
            : `${isVideo ? 'Video' : 'Voice'} call${message.call_duration ? ` · ${formatDuration(message.call_duration)}` : ''}`}
        </span>
        <span className="opacity-50">{formatTime(message.created_at)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// NEW MESSAGE DIVIDER
// ============================================================================

function NewMessageDivider() {
  return (
    <div className="flex items-center gap-3 my-3 px-2">
      <div className="flex-1 h-px bg-violet-200" />
      <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-3 py-1 rounded-full border border-violet-200">
        New messages
      </span>
      <div className="flex-1 h-px bg-violet-200" />
    </div>
  );
}

// ============================================================================
// REACTION PICKER (Instagram-style)
// ============================================================================

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
  onClose: () => void;
  position: 'left' | 'right';
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function ReactionPicker({ onReact, onClose, position }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className={`absolute bottom-full mb-2 ${position === 'left' ? 'left-0' : 'right-0'} flex items-center gap-1 rounded-full px-2 py-1.5 z-20 shadow-lg border border-gray-100 bg-white`}
    >
      {QUICK_REACTIONS.map(emoji => (
        <button
          key={emoji}
          onClick={() => {
            onReact(emoji);
            onClose();
          }}
          className="text-2xl hover:scale-125 transition-transform w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"
          style={{ lineHeight: 1 }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  isGrouped: boolean;
  otherUser: Profile | null;
  onReply: () => void;
  onReact: (emoji: string) => void;
  currentUserId: string;
}

function MessageBubble({
  message,
  isMine,
  isGrouped,
  otherUser,
  onReply,
  onReact,
  currentUserId,
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const isCall = message.message_type === 'voice_call' || message.message_type === 'video_call';
  const isVoice = message.message_type === 'voice_note';
  const isGif = message.message_type === 'gif' || !!message.gif_url;
  const isImage = !!message.image_url && !isGif && !isCall;

  const reactions = message.reactions || {};
  const reactionGroups: Record<string, number> = {};
  Object.values(reactions).forEach(emoji => {
    reactionGroups[emoji] = (reactionGroups[emoji] || 0) + 1;
  });
  const myReaction = reactions[currentUserId];

  const handleDoubleClick = () => {
    onReact('❤️');
  };

  if (isCall) {
    return <CallLog message={message} isMine={isMine} />;
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} w-full ${isGrouped ? 'mb-0.5' : 'mb-2'} group/message`}>
      {/* Other user avatar */}
      {!isMine && (
        <div className={`w-7 h-7 rounded-full shrink-0 mr-2 self-end ${isGrouped ? 'invisible' : ''}`}>
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-200" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-600">
              {otherUser?.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-[78%] lg:max-w-[65%] ${isMine ? 'items-end' : 'items-start'} relative`}>
        {/* Reply preview */}
        {message.reply_to && (
          <div className="text-[11px] px-2.5 py-1 mb-1 rounded-lg border-l-2 border-violet-400 bg-violet-50 text-violet-500 max-w-full truncate">
            ↩ Replying to a message
          </div>
        )}

        {/* Message bubble with double-click for reaction */}
        <div
          onDoubleClick={handleDoubleClick}
          className={`relative overflow-hidden ${
            isImage || isGif ? '' : isVoice ? 'rounded-2xl' : `rounded-[18px] ${isMine ? 'rounded-br-[5px]' : 'rounded-bl-[5px]'} shadow-sm`
          } ${isImage || isGif ? '' : isMine ? 'bg-violet-500 text-white' : 'bg-white text-gray-800 border border-gray-200'}`}
        >
          {isImage && (
            <div className="rounded-[16px] overflow-hidden relative">
              <img src={message.image_url!} alt="" className="max-w-[240px] lg:max-w-[300px] w-full block object-cover" />
              <div className="absolute bottom-2 right-2 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="text-[10px] text-white">{formatTime(message.created_at)}</span>
                {isMine && (message.is_read ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3 text-white/70" />)}
              </div>
            </div>
          )}

          {isGif && message.gif_url && (
            <div className="rounded-[16px] overflow-hidden">
              <img src={message.gif_url} alt="GIF" className="max-w-[220px] lg:max-w-[280px] block" />
            </div>
          )}

          {isVoice && message.voice_note_url && (
            <VoiceNotePlayer url={message.voice_note_url} isMine={isMine} />
          )}

          {message.text && !isCall && (
            <div className="px-3.5 py-2 text-[14px] leading-relaxed">{message.text}</div>
          )}
        </div>

        {/* Timestamp + read receipt */}
        {!isImage && !isGif && (
          <div className={`flex items-center gap-1 mt-0.5 px-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-gray-400">{formatTime(message.created_at)}</span>
            {isMine && (message.is_read ? <CheckCheck className="w-3 h-3 text-violet-500" /> : <Check className="w-3 h-3 text-gray-300" />)}
          </div>
        )}

        {/* Reaction badges - fixed truncation with flex-wrap and proper sizing */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex gap-0.5 -mt-1 z-10 ${isMine ? 'mr-1' : 'ml-1'} flex-wrap`}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={`text-[13px] rounded-full px-1.5 py-0.5 flex items-center gap-0.5 border transition-all hover:scale-110 shadow-sm ${
                  myReaction === emoji ? 'bg-violet-50 border-violet-300' : 'bg-white border-gray-200'
                }`}
                style={{ lineHeight: 1.2 }}
              >
                <span className="text-base leading-none">{emoji}</span>
                {count > 1 && <span className="text-[10px] text-gray-400 ml-0.5">{count}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Hover actions - Instagram style */}
        <div className={`absolute ${isMine ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'} top-1/2 -translate-y-1/2 hidden group-hover/message:flex items-center gap-1 rounded-full px-1.5 py-1 z-20 shadow-md border border-gray-100 bg-white`}>
          <button
            onClick={() => setShowReactions(true)}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-violet-500 transition-colors rounded-full hover:bg-gray-100"
            title="React"
          >
            <Smile className="w-4 h-4" />
          </button>
          <button
            onClick={onReply}
            className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-violet-500 transition-colors rounded-full hover:bg-gray-100"
            title="Reply"
          >
            <Reply className="w-4 h-4" />
          </button>
        </div>

        {/* Reaction picker popup */}
        {showReactions && (
          <ReactionPicker
            onReact={onReact}
            onClose={() => setShowReactions(false)}
            position={isMine ? 'left' : 'right'}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN CHAT PANEL COMPONENT
// ============================================================================

interface ChatPanelProps {
  conversationId: string;
  onBack: () => void;
}

export default function ChatPanel({ conversationId, onBack }: ChatPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [isCallCallee, setIsCallCallee] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [newMessageIndex, setNewMessageIndex] = useState<number | null>(null);
  const [previousMessageCount, setPreviousMessageCount] = useState(0);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Queries
  const { data: conversation } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          p1:profiles!conversations_participant_1_fkey(id, username, avatar_url, is_online, last_seen),
          p2:profiles!conversations_participant_2_fkey(id, username, avatar_url, is_online, last_seen)
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      return data as unknown as Conversation;
    },
    enabled: !!conversationId,
    refetchInterval: 20000,
  });

  const otherUser = conversation
    ? (conversation.p1.id === user?.id ? conversation.p2 : conversation.p1)
    : null;

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  // Track new messages for divider
  useEffect(() => {
    if (!user || messages.length === 0) return;
    if (previousMessageCount === 0) {
      setPreviousMessageCount(messages.length);
      return;
    }
    if (messages.length > previousMessageCount) {
      const newMessages = messages.slice(previousMessageCount);
      const firstOtherIndex = newMessages.findIndex(m => m.sender_id !== user.id);
      if (firstOtherIndex !== -1) {
        setNewMessageIndex(previousMessageCount + firstOtherIndex);
      }
      setPreviousMessageCount(messages.length);
    }
  }, [messages, previousMessageCount, user]);

  // Real-time message subscription
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase.channel(`msg-${conversationId}`);
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  // Typing presence and call signaling
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase.channel(`typing-${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    typingChannelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const otherKeys = Object.keys(state).filter(key => key !== user.id);
      const isTyping = otherKeys.some(key =>
        (state[key] as unknown as Array<{ typing: boolean }>)?.some(p => p.typing)
      );
      setIsOtherTyping(isTyping);
    });

    channel.on('broadcast', { event: 'incoming-call' }, ({ payload }) => {
      if (payload.to === user.id) {
        setIncomingCall({
          type: payload.callType,
          callerId: payload.from,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar ?? '',
        });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ typing: false });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  // Profile real-time updates
  useEffect(() => {
    if (!otherUser?.id) return;

    const channel = supabase.channel(`prof-${otherUser.id}`);
    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${otherUser.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherUser?.id, conversationId, queryClient]);

  // Mark messages as read
  useEffect(() => {
    if (!user || !conversationId || messages.length === 0) return;

    const unreadMessages = messages.filter(m => !m.is_read && m.sender_id !== user.id);
    if (unreadMessages.length > 0) {
      supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .eq('is_read', false)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
          setNewMessageIndex(null);
        });
    }
  }, [messages, user, conversationId, queryClient]);

  // Online status
  useEffect(() => {
    if (!user) return;

    supabase
      .from('profiles')
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq('id', user.id)
      .then(() => {});

    return () => {
      supabase
        .from('profiles')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {});
    };
  }, [user]);

  // Broadcast typing status
  const broadcastTyping = useCallback(async (isTyping: boolean) => {
    try {
      await typingChannelRef.current?.track({ typing: isTyping });
    } catch (error) {
      console.error('Failed to broadcast typing:', error);
    }
  }, []);

  // Handle text input with typing indicator
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);

    if (!isUserTyping) {
      setIsUserTyping(true);
      broadcastTyping(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false);
      broadcastTyping(false);
    }, 2000);
  }, [isUserTyping, broadcastTyping]);

  // Send message (fixed TypeScript error with proper MessageInsert type)
  const sendMessage = useCallback(async (options: {
    text?: string;
    imageUrl?: string;
    voiceUrl?: string;
    gifUrl?: string;
    messageType?: Message['message_type'];
    callStatus?: 'answered' | 'missed';
    callDuration?: number;
  }) => {
    if (!user || !conversationId) return;

    const trimmedText = options.text?.trim();
    const hasContent = trimmedText || options.imageUrl || options.voiceUrl || options.gifUrl || options.messageType?.includes('call');
    if (!hasContent) return;

    setIsSending(true);
    broadcastTyping(false);
    setIsUserTyping(false);

    try {
      const newMessage: MessageInsert = {
        conversation_id: conversationId,
        sender_id: user.id,
        text: trimmedText || null,
        image_url: options.imageUrl || null,
        voice_note_url: options.voiceUrl || null,
        gif_url: options.gifUrl || null,
        message_type: options.messageType || 'text',
        call_status: options.callStatus || null,
        call_duration: options.callDuration || null,
        reply_to: replyToMessage?.id || null,
      };

      await supabase.from('messages').insert(newMessage);

      // Update conversation last message
      const lastMessagePreview = trimmedText
        || (options.voiceUrl ? '🎤 Voice note' : '')
        || (options.imageUrl ? '📷 Photo' : '')
        || (options.gifUrl ? '🎬 GIF' : '')
        || (options.messageType === 'voice_call' ? '📞 Voice call' : '')
        || (options.messageType === 'video_call' ? '📹 Video call' : '')
        || 'Message';

      await supabase
        .from('conversations')
        .update({
          last_message: lastMessagePreview,
          last_message_time: new Date().toISOString(),
        })
        .eq('id', conversationId);

      setText('');
      setReplyToMessage(null);
      setShowEmojiPicker(false);
      setShowGifPicker(false);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [user, conversationId, replyToMessage, broadcastTyping, queryClient]);

  // Handle image upload
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const compressedImage = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1080,
      });

      const filePath = `${user.id}/${Date.now()}.jpg`;
      await supabase.storage.from('chat-images').upload(filePath, compressedImage);
      const { data } = supabase.storage.from('chat-images').getPublicUrl(filePath);
      await sendMessage({ imageUrl: data.publicUrl, messageType: 'image' });
    } catch (error) {
      console.error('Failed to upload image:', error);
    }

    e.target.value = '';
  }, [user, sendMessage]);

  // Handle voice note send
  const handleVoiceSend = useCallback(async (blob: Blob) => {
    if (!user) return;

    setIsRecording(false);
    try {
      const filePath = `${user.id}/${Date.now()}.webm`;
      await supabase.storage.from('voice-notes').upload(filePath, blob, {
        contentType: 'audio/webm',
      });
      const { data } = supabase.storage.from('voice-notes').getPublicUrl(filePath);
      await sendMessage({ voiceUrl: data.publicUrl, messageType: 'voice_note' });
    } catch (error) {
      console.error('Failed to upload voice note:', error);
    }
  }, [user, sendMessage]);

  // Initiate call
  const initiateCall = useCallback(async (type: 'voice' | 'video') => {
    if (!user || !otherUser) return;

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('username, avatar_url')
      .eq('id', user.id)
      .single();

    const channel = supabase.channel(`typing-${conversationId}`);
    await channel.send({
      type: 'broadcast',
      event: 'incoming-call',
      payload: {
        to: otherUser.id,
        from: user.id,
        callType: type,
        callerName: myProfile?.username ?? 'Unknown',
        callerAvatar: myProfile?.avatar_url ?? '',
      },
    });

    setIsCallCallee(false);
    setCallType(type);
  }, [user, otherUser, conversationId]);

  // Handle call end
  const handleCallEnd = useCallback((duration?: number) => {
    const type = callType!;
    setCallType(null);
    setIsCallCallee(false);
    sendMessage({
      messageType: type === 'voice' ? 'voice_call' : 'video_call',
      callStatus: duration !== undefined ? 'answered' : 'missed',
      callDuration: duration,
    });
  }, [callType, sendMessage]);

  // Handle incoming call actions
  const handleAcceptCall = useCallback(() => {
    if (!incomingCall) return;
    setIsCallCallee(true);
    setCallType(incomingCall.type);
    setIncomingCall(null);
  }, [incomingCall]);

  const handleDeclineCall = useCallback(() => {
    if (!incomingCall) return;
    sendMessage({
      messageType: incomingCall.type === 'video' ? 'video_call' : 'voice_call',
      callStatus: 'missed',
    });
    setIncomingCall(null);
  }, [incomingCall, sendMessage]);

  // Add/remove reaction
  const handleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;

    const targetMessage = messages.find(m => m.id === messageId);
    if (!targetMessage) return;

    const currentReactions = targetMessage.reactions || {};
    const updatedReactions = { ...currentReactions };

    if (updatedReactions[user.id] === emoji) {
      delete updatedReactions[user.id];
    } else {
      updatedReactions[user.id] = emoji;
    }

    await supabase
      .from('messages')
      .update({ reactions: updatedReactions })
      .eq('id', messageId);

    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
  }, [user, messages, conversationId, queryClient]);

  // Render info panel
  if (showInfoPanel && otherUser) {
    return (
      <ChatInfoPanel
        conversationId={conversationId}
        otherUser={otherUser}
        onClose={() => setShowInfoPanel(false)}
        messages={messages}
      />
    );
  }

  return (
    <div className="flex flex-col h-full max-lg:fixed max-lg:inset-0 max-lg:h-[100dvh] max-lg:z-50 overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 shrink-0 bg-white border-b border-gray-100 shadow-sm">
        <button
          onClick={onBack}
          className="lg:hidden p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {otherUser && (
          <Link
            to={`/profile/${otherUser.id}`}
            className="flex items-center gap-2.5 flex-1 min-w-0 group"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-gray-100">
                {otherUser.avatar_url ? (
                  <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-violet-600 bg-violet-100">
                    {otherUser.username?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              {otherUser.is_online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-gray-900 truncate leading-tight group-hover:text-violet-600 transition-colors">
                {otherUser.username}
              </p>
              <p className="text-[11px] truncate font-medium">
                {isOtherTyping ? (
                  <span className="text-violet-500 animate-pulse">typing…</span>
                ) : otherUser.is_online ? (
                  <span className="text-green-500 font-semibold">Active now</span>
                ) : otherUser.last_seen ? (
                  <span className="text-gray-400">Active at {format(new Date(otherUser.last_seen), 'h:mm a')}</span>
                ) : (
                  <span className="text-gray-300">Offline</span>
                )}
              </p>
            </div>
          </Link>
        )}

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => initiateCall('voice')}
            title="Voice call"
            className="p-2.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
          >
            <Phone className="w-[17px] h-[17px]" />
          </button>
          <button
            onClick={() => initiateCall('video')}
            title="Video call"
            className="p-2.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
          >
            <Video className="w-[17px] h-[17px]" />
          </button>
          <button
            onClick={() => setShowInfoPanel(true)}
            title="Info"
            className="p-2.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
          >
            <Info className="w-[17px] h-[17px]" />
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-1"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#e5e7eb transparent',
          background: 'linear-gradient(180deg, #fafafa 0%, #f8f6ff 50%, #fafafa 100%)',
        }}
      >
        {messages.map((message, index) => {
          const isMine = message.sender_id === user?.id;
          const isCall = message.message_type === 'voice_call' || message.message_type === 'video_call';

          if (isCall) {
            return <CallLog key={message.id} message={message} isMine={isMine} />;
          }

          const nextMessage = messages[index + 1];
          const isGrouped = nextMessage
            && nextMessage.sender_id === message.sender_id
            && new Date(nextMessage.created_at).getTime() - new Date(message.created_at).getTime() < 60000;

          const showDivider = newMessageIndex === index;

          return (
            <div key={message.id}>
              {showDivider && <NewMessageDivider />}
              <MessageBubble
                message={message}
                isMine={isMine}
                isGrouped={isGrouped}
                otherUser={otherUser}
                onReply={() => setReplyToMessage(message)}
                onReact={(emoji) => handleReaction(message.id, emoji)}
                currentUserId={user?.id || ''}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        {isOtherTyping && (
          <div className="flex justify-start pl-9">
            <div className="flex items-center gap-1.5 px-4 py-3 rounded-[18px] rounded-bl-[5px] bg-white border border-gray-200 shadow-sm">
              {[0, 150, 300].map(delay => (
                <div
                  key={delay}
                  className="w-2 h-2 rounded-full bg-gray-300 animate-bounce"
                  style={{ animationDelay: `${delay}ms`, animationDuration: '900ms' }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Reply Bar */}
      {replyToMessage && (
        <div className="flex items-center gap-2 mx-3 mb-1.5 px-3 py-2 rounded-xl border border-violet-200 bg-violet-50">
          <Reply className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
          <span className="text-xs text-violet-600 truncate flex-1">
            {replyToMessage.text || (replyToMessage.image_url ? '📷 Photo' : replyToMessage.voice_note_url ? '🎤 Voice note' : 'Message')}
          </span>
          <button
            onClick={() => setReplyToMessage(null)}
            className="p-0.5 hover:bg-violet-100 rounded-full transition-colors"
          >
            <X className="w-3.5 h-3.5 text-violet-400" />
          </button>
        </div>
      )}

      {/* Voice Recorder */}
      {isRecording && (
        <VoiceRecorder onSend={handleVoiceSend} onCancel={() => setIsRecording(false)} />
      )}

      {/* Input Bar */}
      {!isRecording && (
        <div className="shrink-0 px-3 pb-3 pt-2 bg-white border-t border-gray-100">
          <div className="flex items-center gap-1.5 rounded-[26px] px-2 py-1 bg-gray-100 border border-gray-200">
            <IconButton
              onClick={() => {
                setShowEmojiPicker(v => !v);
                setShowGifPicker(false);
              }}
              isActive={showEmojiPicker}
            >
              <Smile className="w-5 h-5" />
            </IconButton>
            <IconButton
              onClick={() => {
                setShowGifPicker(v => !v);
                setShowEmojiPicker(false);
              }}
              isActive={showGifPicker}
            >
              <Gift className="w-5 h-5" />
            </IconButton>
            <IconButton onClick={() => fileInputRef.current?.click()}>
              <ImageIcon className="w-5 h-5" />
            </IconButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <input
              placeholder="Message…"
              value={text}
              onChange={handleTextChange}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage({ text, messageType: 'text' });
                }
              }}
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-[14px] h-9 py-1 text-gray-800 placeholder:text-gray-400"
            />

            {text.trim() ? (
              <button
                onClick={() => sendMessage({ text, messageType: 'text' })}
                disabled={isSending}
                className="px-3 py-1.5 text-violet-600 hover:text-violet-700 font-bold text-[14px] disabled:opacity-40 transition-colors"
              >
                Send
              </button>
            ) : (
              <IconButton onClick={() => setIsRecording(true)}>
                <Mic className="w-5 h-5" />
              </IconButton>
            )}
          </div>
        </div>
      )}

      {/* Emoji Picker - using emoji-picker-react */}
{showEmojiPicker && (
  <>
    <style>{`
      .emoji-picker-no-categories .epr-category-header {
        display: none;
      }
    `}</style>
    <div className="shrink-0 border-t border-gray-100 bg-white flex justify-center p-2 emoji-picker-no-categories">
      <div className="w-full max-w-[350px]">
        <EmojiPicker
          onEmojiClick={(emojiObject) => {
            setText(prev => prev + emojiObject.emoji);
          }}
          autoFocusSearch={false}
          theme="light"
          width="100%"
          height="280px"
        />
      </div>
    </div>
  </>
)}
      {/* GIF Picker */}
      {showGifPicker && (
        <div className="shrink-0 h-[320px] border-t border-gray-100 overflow-hidden bg-white">
          <GifPicker
            onSelect={url => sendMessage({ gifUrl: url, messageType: 'gif' })}
            onClose={() => setShowGifPicker(false)}
          />
        </div>
      )}

      {/* Call Modal */}
      {callType && otherUser && user && (
        <CallModal
          callType={callType}
          conversationId={conversationId}
          myUserId={user.id}
          otherUser={{
            id: otherUser.id,
            username: otherUser.username,
            avatar_url: otherUser.avatar_url,
          }}
          isCallee={isCallCallee}
          onEnd={handleCallEnd}
        />
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          callType={incomingCall.type}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
        />
      )}
    </div>
  );
}

// ============================================================================
// ICON BUTTON COMPONENT
// ============================================================================

interface IconButtonProps {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
}

function IconButton({ onClick, isActive, children }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-full transition-colors ${
        isActive
          ? 'text-violet-600 bg-violet-100'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}