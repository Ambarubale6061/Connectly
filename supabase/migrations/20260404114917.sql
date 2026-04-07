-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  is_private BOOLEAN DEFAULT false,
  posts_count INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR
SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR
UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR
INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE
UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$ BEGIN
INSERT INTO public.profiles (id, username, full_name, avatar_url)
VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
CREATE TRIGGER on_auth_user_created
AFTER
INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_urls TEXT [] NOT NULL,
  caption TEXT,
  location TEXT,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  is_video BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone" ON public.posts FOR
SELECT USING (true);
CREATE POLICY "Users can create own posts" ON public.posts FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR
UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_posts_updated_at BEFORE
UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by everyone" ON public.comments FOR
SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.comments FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);
-- Likes table
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are viewable by everyone" ON public.likes FOR
SELECT USING (true);
CREATE POLICY "Users can create likes" ON public.likes FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE USING (auth.uid() = user_id);
-- Follows table
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows are viewable by everyone" ON public.follows FOR
SELECT USING (true);
CREATE POLICY "Users can follow" ON public.follows FOR
INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);
CREATE POLICY "Users can update follow status" ON public.follows FOR
UPDATE USING (auth.uid() = following_id);
-- Saved posts
CREATE TABLE public.saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved" ON public.saved_posts FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);
-- Stories
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active stories are viewable" ON public.stories FOR
SELECT USING (expires_at > now());
CREATE POLICY "Users can create stories" ON public.stories FOR
INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stories" ON public.stories FOR DELETE USING (auth.uid() = user_id);
-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention')),
  actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR
SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create notifications" ON public.notifications FOR
INSERT WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR
UPDATE USING (auth.uid() = user_id);
-- Count triggers
CREATE OR REPLACE FUNCTION public.update_post_likes_count() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT'
  AND NEW.target_type = 'post' THEN
UPDATE public.posts
SET likes_count = likes_count + 1
WHERE id = NEW.target_id;
ELSIF TG_OP = 'DELETE'
AND OLD.target_type = 'post' THEN
UPDATE public.posts
SET likes_count = likes_count - 1
WHERE id = OLD.target_id;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
CREATE TRIGGER on_like_change
AFTER
INSERT
  OR DELETE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();
CREATE OR REPLACE FUNCTION public.update_comments_count() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT' THEN
UPDATE public.posts
SET comments_count = comments_count + 1
WHERE id = NEW.post_id;
ELSIF TG_OP = 'DELETE' THEN
UPDATE public.posts
SET comments_count = comments_count - 1
WHERE id = OLD.post_id;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
CREATE TRIGGER on_comment_change
AFTER
INSERT
  OR DELETE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_comments_count();
CREATE OR REPLACE FUNCTION public.update_follow_counts() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT'
  AND NEW.status = 'accepted' THEN
UPDATE public.profiles
SET following_count = following_count + 1
WHERE id = NEW.follower_id;
UPDATE public.profiles
SET followers_count = followers_count + 1
WHERE id = NEW.following_id;
ELSIF TG_OP = 'DELETE'
AND OLD.status = 'accepted' THEN
UPDATE public.profiles
SET following_count = following_count - 1
WHERE id = OLD.follower_id;
UPDATE public.profiles
SET followers_count = followers_count - 1
WHERE id = OLD.following_id;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
CREATE TRIGGER on_follow_change
AFTER
INSERT
  OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();
CREATE OR REPLACE FUNCTION public.update_posts_count() RETURNS TRIGGER AS $$ BEGIN IF TG_OP = 'INSERT' THEN
UPDATE public.profiles
SET posts_count = posts_count + 1
WHERE id = NEW.user_id;
ELSIF TG_OP = 'DELETE' THEN
UPDATE public.profiles
SET posts_count = posts_count - 1
WHERE id = OLD.user_id;
END IF;
RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
CREATE TRIGGER on_post_change
AFTER
INSERT
  OR DELETE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_posts_count();
-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true);
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-media', 'story-media', true);
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR
SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR
INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name)) [1]
  );
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR
UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name)) [1]
  );
CREATE POLICY "Post images are publicly accessible" ON storage.objects FOR
SELECT USING (bucket_id = 'post-images');
CREATE POLICY "Users can upload post images" ON storage.objects FOR
INSERT WITH CHECK (
    bucket_id = 'post-images'
    AND auth.uid()::text = (storage.foldername(name)) [1]
  );
CREATE POLICY "Story media is publicly accessible" ON storage.objects FOR
SELECT USING (bucket_id = 'story-media');
CREATE POLICY "Users can upload story media" ON storage.objects FOR
INSERT WITH CHECK (
    bucket_id = 'story-media'
    AND auth.uid()::text = (storage.foldername(name)) [1]
  );
-- Indexes
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_likes_target ON public.likes(target_type, target_id);
CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_stories_user ON public.stories(user_id, expires_at);