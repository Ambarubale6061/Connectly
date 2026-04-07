import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit, Search, Trash2, MessageCircle } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import ChatPanel from '@/components/messages/ChatPanel';

function fmtConvoTime(d: string) {
  const dt = new Date(d);
  if (isToday(dt)) return format(dt, 'h:mm a');
  if (isYesterday(dt)) return 'Yesterday';
  return format(dt, 'MMM d');
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id: activeConvoId } = useParams<{ id?: string }>();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedConvo, setSelectedConvo] = useState<string | null>(activeConvoId || null);

  useEffect(() => { if (activeConvoId) setSelectedConvo(activeConvoId); }, [activeConvoId]);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversations')
        .select('*, p1:profiles!conversations_participant_1_fkey(id,username,avatar_url,is_online,last_seen), p2:profiles!conversations_participant_2_fkey(id,username,avatar_url,is_online,last_seen)')
        .or(`participant_1.eq.${user!.id},participant_2.eq.${user!.id}`)
        .order('last_message_time', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('convos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient]);

  const { data: unreadCounts = {} } = useQuery({
    queryKey: ['unread-counts', user?.id, (conversations as any[]).map((c: any) => c.id).join(',')],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all((conversations as any[]).map(async (c: any) => {
        const { count } = await supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id).neq('sender_id', user!.id).eq('is_read', false);
        if (count && count > 0) counts[c.id] = count;
      }));
      return counts;
    },
    enabled: !!user && (conversations as any[]).length > 0,
    refetchInterval: 5000,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['chat-search', search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const { data } = await supabase.from('profiles').select('id,username,avatar_url,full_name')
        .neq('id', user!.id).or(`username.ilike.%${search}%,full_name.ilike.%${search}%`).limit(10);
      return data ?? [];
    },
    enabled: !!search.trim() && !!user,
  });

  const startChat = async (otherId: string) => {
    if (!user) return;
    const { data: existing } = await supabase.from('conversations').select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${otherId}),and(participant_1.eq.${otherId},participant_2.eq.${user.id})`)
      .maybeSingle();
    const convoId = existing?.id ?? (await supabase.from('conversations').insert({ participant_1: user.id, participant_2: otherId }).select('id').single()).data?.id;
    if (!convoId) return;
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    if (isMobile) navigate(`/messages/${convoId}`);
    else setSelectedConvo(convoId);
    setSearch('');
  };

  const deleteConvo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    await supabase.from('messages').delete().eq('conversation_id', id);
    await supabase.from('conversations').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    if (selectedConvo === id) setSelectedConvo(null);
  };

  if (isMobile && activeConvoId) return <ChatPanel conversationId={activeConvoId} onBack={() => navigate('/messages')} />;

  const convoList = (
    <div className="h-full flex flex-col bg-white border-r border-gray-100">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-100">
        <h2 className="text-[17px] font-bold text-gray-900 flex-1">Messages</h2>
        <button className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
          <Edit className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search people…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 outline-none bg-gray-100 border border-transparent focus:border-violet-300 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
        {search.trim() ? (
          <>
            {(searchResults as any[]).length === 0
              ? <p className="text-center text-gray-400 text-sm py-8">No users found</p>
              : (searchResults as any[]).map((u: any) => (
                <button key={u.id} onClick={() => startChat(u.id)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left mb-0.5">
                  <div className="w-11 h-11 rounded-full overflow-hidden ring-1 ring-gray-200 flex-shrink-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-bold text-violet-600 bg-violet-100">{u.username[0]?.toUpperCase()}</div>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">{u.username}</p>
                    {u.full_name && <p className="text-xs text-gray-400 truncate">{u.full_name}</p>}
                  </div>
                </button>
              ))
            }
          </>
        ) : (
          <>
            {(conversations as any[]).length === 0 && (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500 mb-1">No messages yet</p>
                <p className="text-xs text-gray-400">Search to start a chat</p>
              </div>
            )}

            {(conversations as any[]).map((c: any) => {
              const other = (c.p1 as any)?.id === user?.id ? c.p2 : c.p1;
              const op = other as any;
              const isActive = selectedConvo === c.id;
              const unread = (unreadCounts as Record<string, number>)[c.id] ?? 0;
              const hasUnread = unread > 0;

              return (
                <div key={c.id}
                  onClick={() => { if (isMobile) navigate(`/messages/${c.id}`); else setSelectedConvo(c.id); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group mb-0.5 ${
                    isActive ? 'bg-violet-50 border border-violet-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden ring-1 ring-gray-200">
                      {op?.avatar_url
                        ? <img src={op.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-sm font-bold text-violet-600 bg-violet-100">{op?.username?.[0]?.toUpperCase()}</div>
                      }
                    </div>
                    {op?.is_online && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className={`text-[13px] truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {op?.username}
                      </p>
                      {c.last_message_time && (
                        <span className={`text-[10px] flex-shrink-0 font-medium ${hasUnread ? 'text-violet-500' : 'text-gray-400'}`}>
                          {fmtConvoTime(c.last_message_time)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                        {c.last_message || 'Start a conversation'}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {hasUnread && (
                          <div className="min-w-[18px] h-[18px] rounded-full bg-violet-500 flex items-center justify-center px-1">
                            <span className="text-[9px] text-white font-bold">{unread > 9 ? '9+' : unread}</span>
                          </div>
                        )}
                        <button onClick={e => deleteConvo(c.id, e)}
                          className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );

  if (isMobile) return <AppLayout><div className="h-[calc(100vh-56px)]">{convoList}</div></AppLayout>;

  return (
    <AppLayout>
      <div className="flex h-screen bg-gray-50">
        <div className="w-[310px] lg:w-[350px] flex-shrink-0 h-full">{convoList}</div>
        <div className="flex-1 h-full">
          {selectedConvo
            ? <ChatPanel conversationId={selectedConvo} onBack={() => setSelectedConvo(null)} />
            : (
              <div className="h-full flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-violet-50 via-white to-purple-50">
                <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center shadow-sm">
                  <MessageCircle className="w-9 h-9 text-violet-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Your messages</h3>
                  <p className="text-sm text-gray-400">Select a conversation to start chatting</p>
                </div>
              </div>
            )
          }
        </div>
      </div>
    </AppLayout>
  );
}