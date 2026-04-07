import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { StoryViewer } from './StoryViewer';
import { AddStoryDialog } from './AddStoryDialog';

interface StoryGroup {
  user_id: string;
  username: string;
  avatar_url: string | null;
  stories: Array<{
    id: string;
    media_url: string;
    media_type: string | null;
    created_at: string;
    expires_at: string;
  }>;
}

export function StoriesRow() {
  const { user } = useAuth();
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: storyGroups = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stories')
        .select('*, profiles!stories_user_id_fkey(username, avatar_url)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (!data) return [];

      const grouped: Record<string, StoryGroup> = {};
      for (const s of data) {
        const profile = s.profiles as any;
        if (!grouped[s.user_id]) {
          grouped[s.user_id] = {
            user_id: s.user_id,
            username: profile?.username || '',
            avatar_url: profile?.avatar_url || null,
            stories: [],
          };
        }
        grouped[s.user_id].stories.push({
          id: s.id,
          media_url: s.media_url,
          media_type: s.media_type,
          created_at: s.created_at,
          expires_at: s.expires_at,
        });
      }

      // Put current user first
      const result = Object.values(grouped);
      const myIdx = result.findIndex(g => g.user_id === user?.id);
      if (myIdx > 0) {
        const [mine] = result.splice(myIdx, 1);
        result.unshift(mine);
      }
      return result;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const hasMyStory = storyGroups.some(g => g.user_id === user?.id);

  return (
    <>
      <div className="flex gap-4 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-separator">
        {/* Add story button */}
        {!hasMyStory && (
          <button onClick={() => setShowAdd(true)} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center relative">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                {user?.user_metadata?.username?.[0]?.toUpperCase() || 'Y'}
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                <Plus className="w-3 h-3 text-primary-foreground" />
              </div>
            </div>
            <span className="text-[11px] text-foreground truncate w-16 text-center">Your story</span>
          </button>
        )}

        {storyGroups.map((group, i) => (
          <button
            key={group.user_id}
            onClick={() => setViewingIndex(i)}
            className="flex flex-col items-center gap-1 flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-full p-[2px] story-ring">
              <div className="w-full h-full rounded-full bg-background p-[2px]">
                <div className="w-full h-full rounded-full bg-muted overflow-hidden">
                  {group.avatar_url ? (
                    <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                      {group.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <span className="text-[11px] text-foreground truncate w-16 text-center">
              {group.user_id === user?.id ? 'Your story' : group.username}
            </span>
          </button>
        ))}
      </div>

      {viewingIndex !== null && (
        <StoryViewer
          groups={storyGroups}
          initialIndex={viewingIndex}
          onClose={() => setViewingIndex(null)}
        />
      )}

      {showAdd && <AddStoryDialog open={showAdd} onClose={() => setShowAdd(false)} />}
    </>
  );
}
