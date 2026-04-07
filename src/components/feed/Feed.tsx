import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { PostCard } from './PostCard';
import { ReelCard } from './ReelCard';
import { useInView } from 'react-intersection-observer';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const PAGE_SIZE = 5;

type FeedItem = 
  | { type: 'post'; data: any }
  | { type: 'reel'; data: any };

export function Feed() {
  const { user } = useAuth();
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isLoading, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['feed', user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const [postsResult, reelsResult] = await Promise.all([
        supabase
          .from('posts')
          .select(`*, profiles:user_id (username, avatar_url, full_name)`)
          .order('created_at', { ascending: false })
          .range(from, to),
        supabase
          .from('reels')
          .select(`*, profiles:user_id (username, avatar_url, full_name)`)
          .order('created_at', { ascending: false })
          .range(from, to)
      ]);

      if (postsResult.error) throw postsResult.error;
      if (reelsResult.error) throw reelsResult.error;

      const allItems: FeedItem[] = [
        ...(postsResult.data?.map(p => ({ type: 'post' as const, data: p })) ?? []),
        ...(reelsResult.data?.map(r => ({ type: 'reel' as const, data: r })) ?? [])
      ].sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime());

      return { items: allItems, page: pageParam };
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.items.length < PAGE_SIZE) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 0,
    enabled: !!user,
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage, isFetchingNextPage]);

  const allItems = data?.pages.flatMap(p => p.items) ?? [];

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-3 pt-4 px-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-muted/30 animate-pulse rounded-2xl h-[400px]" />
        ))}
      </div>
    );
  }

  return (
    /* Adding a global style tag here to hide the scrollbar across the app 
      or you can add 'no-scrollbar' class in your tailwind config 
    */
    <div className="max-w-xl mx-auto px-2 pb-20 pt-2 selection:bg-primary/10 overflow-y-auto no-scrollbar" 
         style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />

      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {allItems.map((item, index) => (
            <motion.div
              key={`${item.type}-${item.data.id}`}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              whileInView={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } 
              }}
              viewport={{ once: true, margin: "-50px" }}
              layout // Smoothly handles list changes
            >
              {item.type === 'post' 
                ? <PostCard post={item.data} /> 
                : <ReelCard reel={item.data} />
              }
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modern Loader Area */}
      <div ref={ref} className="py-12 flex flex-col items-center justify-center gap-4">
        {isFetchingNextPage ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2"
          >
            <Loader2 className="w-5 h-5 text-primary/60 animate-spin" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Loading more</span>
          </motion.div>
        ) : !hasNextPage && allItems.length > 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="text-[10px] text-muted-foreground/30 font-medium uppercase tracking-[0.3em] py-4"
          >
            End of Content
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}