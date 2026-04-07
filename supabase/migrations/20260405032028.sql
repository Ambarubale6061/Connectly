-- Reels table
CREATE TABLE public.reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reels are viewable by everyone" ON public.reels FOR
SELECT USING (true);
CREATE POLICY "Users can create own reels" ON public.reels FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reels" ON public.reels FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reels" ON public.reels FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_reels_updated_at BEFORE
UPDATE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_time TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR
SELECT USING (
    auth.uid() = participant_1
    OR auth.uid() = participant_2
  );
CREATE POLICY "Users can create conversations" ON public.conversations FOR
INSERT WITH CHECK (
    auth.uid() = participant_1
    OR auth.uid() = participant_2
  );
CREATE POLICY "Users can update own conversations" ON public.conversations FOR
UPDATE USING (
    auth.uid() = participant_1
    OR auth.uid() = participant_2
  );
-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR
SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.participant_1 = auth.uid()
          OR c.participant_2 = auth.uid()
        )
    )
  );
CREATE POLICY "Users can send messages" ON public.messages FOR
INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.participant_1 = auth.uid()
          OR c.participant_2 = auth.uid()
        )
    )
  );
CREATE POLICY "Users can update own messages" ON public.messages FOR
UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (
          c.participant_1 = auth.uid()
          OR c.participant_2 = auth.uid()
        )
    )
  );
CREATE POLICY "Users can delete own messages" ON public.messages FOR DELETE USING (auth.uid() = sender_id);
-- Blocked users table
CREATE TABLE public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own blocks" ON public.blocked_users FOR
SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can block" ON public.blocked_users FOR
INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock" ON public.blocked_users FOR DELETE USING (auth.uid() = blocker_id);
-- Hashtags table
CREATE TABLE public.hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hashtags are viewable by everyone" ON public.hashtags FOR
SELECT USING (true);
CREATE POLICY "Authenticated users can create hashtags" ON public.hashtags FOR
INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Post hashtags junction
CREATE TABLE public.post_hashtags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post hashtags are viewable by everyone" ON public.post_hashtags FOR
SELECT USING (true);
CREATE POLICY "Post owners can manage hashtags" ON public.post_hashtags FOR
INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Reel videos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reel-videos', 'reel-videos', true);
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true);
-- Storage policies for reel-videos
CREATE POLICY "Anyone can view reel videos" ON storage.objects FOR
SELECT USING (bucket_id = 'reel-videos');
CREATE POLICY "Authenticated users can upload reel videos" ON storage.objects FOR
INSERT WITH CHECK (
    bucket_id = 'reel-videos'
    AND auth.uid() IS NOT NULL
  );
CREATE POLICY "Users can delete own reel videos" ON storage.objects FOR DELETE USING (
  bucket_id = 'reel-videos'
  AND (storage.foldername(name)) [1] = auth.uid()::text
);
-- Storage policies for chat-images
CREATE POLICY "Chat image participants can view" ON storage.objects FOR
SELECT USING (bucket_id = 'chat-images');
CREATE POLICY "Authenticated users can upload chat images" ON storage.objects FOR
INSERT WITH CHECK (
    bucket_id = 'chat-images'
    AND auth.uid() IS NOT NULL
  );
-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime
ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime
ADD TABLE public.conversations;
-- Add banner_url to profiles for LinkedIn-style banner
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banner_url TEXT;
-- Reel likes count trigger
CREATE OR REPLACE FUNCTION public.update_reel_likes_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$ BEGIN IF TG_OP = 'INSERT'
  AND NEW.target_type = 'reel' THEN
UPDATE public.reels
SET likes_count = likes_count + 1
WHERE id = NEW.target_id;
ELSIF TG_OP = 'DELETE'
AND OLD.target_type = 'reel' THEN
UPDATE public.reels
SET likes_count = likes_count - 1
WHERE id = OLD.target_id;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER on_reel_like
AFTER
INSERT
  OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.update_reel_likes_count();