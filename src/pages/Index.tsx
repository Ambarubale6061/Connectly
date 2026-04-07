import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Feed } from '@/components/feed/Feed';
import { StoriesRow } from '@/components/stories/StoriesRow';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/auth', { replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="max-w-[470px] mx-auto">
        <StoriesRow />
        <div className="pt-2">
          <Feed />
        </div>
      </div>
    </AppLayout>
  );
}
