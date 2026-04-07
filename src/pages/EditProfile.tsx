import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

export default function EditProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fetch current profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    website: '',
  });

  // Local preview URLs for images
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Populate form when profile loads
  useState(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        website: profile.website || '',
      });
      setBannerPreview(profile.banner_url);
      setAvatarPreview(profile.avatar_url);
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Banner upload
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingBanner(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1200 });
      const path = `${user.id}/banner_${Date.now()}.jpg`;
      await supabase.storage.from('avatars').upload(path, compressed, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl + '?t=' + Date.now();
      setBannerPreview(publicUrl);
      // We'll save to DB on form submit
    } catch (error) {
      toast({ title: 'Upload failed', description: 'Could not upload banner.', variant: 'destructive' });
    } finally {
      setUploadingBanner(false);
    }
  };

  // Avatar upload
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 400 });
      const path = `${user.id}/avatar_${Date.now()}.jpg`;
      await supabase.storage.from('avatars').upload(path, compressed, { upsert: true });
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl + '?t=' + Date.now();
      setAvatarPreview(publicUrl);
    } catch (error) {
      toast({ title: 'Upload failed', description: 'Could not upload avatar.', variant: 'destructive' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const updates: any = {
        full_name: formData.full_name,
        bio: formData.bio,
        website: formData.website,
        updated_at: new Date().toISOString(),
      };
      // Only include image URLs if they changed
      if (bannerPreview && bannerPreview !== profile?.banner_url) {
        updates.banner_url = bannerPreview;
      }
      if (avatarPreview && avatarPreview !== profile?.avatar_url) {
        updates.avatar_url = avatarPreview;
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast({ title: 'Profile updated', description: 'Your profile has been saved.' });
      navigate(`/profile/${user.id}`);
    } catch (error) {
      toast({ title: 'Error', description: 'Could not update profile.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto p-4">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-4">
        {/* Header with back arrow */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Profile</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Banner Upload Card */}
          <div className="space-y-2">
            <Label>Profile Banner</Label>
            <div
              className="relative h-36 md:h-48 rounded-xl overflow-hidden bg-gradient-to-r from-purple-500/20 to-pink-500/20 cursor-pointer group"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerPreview ? (
                <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                {uploadingBanner ? (
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleBannerUpload}
                disabled={uploadingBanner}
              />
            </div>
            <p className="text-xs text-muted-foreground">Click to upload a banner image (recommended 1200x400)</p>
          </div>

          {/* Avatar Upload Card */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div
              className="relative w-24 h-24 rounded-full overflow-hidden bg-muted cursor-pointer group mx-auto md:mx-0"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Avatar className="w-full h-full">
                <AvatarImage src={avatarPreview || undefined} />
                <AvatarFallback>{profile?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition">
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Your full name"
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell something about yourself"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}