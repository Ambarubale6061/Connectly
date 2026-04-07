import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Link } from 'react-router-dom';

export default function Explore() {
  const { data: posts } = useQuery({
    queryKey: ['explore'],
    queryFn: async () => {
      const { data } = await supabase
        .from('posts')
        .select('id, image_urls')
        .order('likes_count', { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  return (
    <AppLayout>
      <div className="max-w-[935px] mx-auto p-1">
        <div className="grid grid-cols-3 gap-1">
          {posts?.map(post => (
            <Link key={post.id} to={`/post/${post.id}`} className="aspect-square">
              <img src={post.image_urls[0]} alt="" className="w-full h-full object-cover" />
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
