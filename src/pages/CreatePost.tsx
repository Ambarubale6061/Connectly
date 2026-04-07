import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ImagePlus, X, ArrowLeft, Film, MapPin, Loader2, Plus } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';

export default function CreatePost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - images.length);
    if (files.length === 0) return;

    try {
      const compressed = await Promise.all(
        files.map(f => imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1440 }))
      );
      setImages(prev => [...prev, ...compressed]);
      setPreviews(prev => [...prev, ...compressed.map(f => URL.createObjectURL(f))]);
    } catch (err) {
      toast.error("Error compressing images");
    }
  };

  const removeImage = (i: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async () => {
    if (!user || images.length === 0) return;
    setLoading(true);

    try {
      const urls: string[] = [];
      for (const img of images) {
        const path = `${user.id}/posts/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage.from('post-images').upload(path, img);
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('post-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }

      const { error: dbError } = await supabase.from('posts').insert({
        user_id: user.id,
        image_urls: urls,
        caption: caption.trim() || null,
        location: location.trim() || null,
      });

      if (dbError) throw dbError;

      toast.success("Post shared successfully!");
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || "Failed to share post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      {/* CSS to hide scrollbar white strip */}
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <div className="max-w-xl mx-auto min-h-screen bg-background md:pt-4 no-scrollbar overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-1 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold tracking-tight">New Post</h2>
          </div>
          
          <div className="flex items-center gap-2">
            {!images.length && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/create-reel')}
                className="text-xs font-bold gap-1.5 rounded-full hover:bg-secondary"
              >
                <Film className="w-4 h-4" /> Reel
              </Button>
            )}
            <Button 
              onClick={handleSubmit} 
              disabled={loading || images.length === 0} 
              size="sm"
              className="rounded-full px-5 font-bold transition-all active:scale-95 bg-primary text-primary-foreground"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
            </Button>
          </div>
        </div>

        <div className="p-4 md:px-0">
          {/* Image Upload Area */}
          {previews.length === 0 ? (
            <div 
              onClick={() => fileRef.current?.click()}
              className="group w-full aspect-square border-2 border-dashed border-border/60 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <div className="p-6 bg-secondary rounded-full group-hover:scale-110 transition-transform">
                <ImagePlus className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-foreground">Select photos</p>
                <p className="text-sm text-muted-foreground mt-1">Up to 10 photos supported</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square group overflow-hidden rounded-2xl shadow-sm border border-border/20">
                  <img src={src} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 bg-black/60 hover:bg-black text-white rounded-full p-1.5 backdrop-blur-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {i === 0 && (
                    <div className="absolute bottom-2 left-2 bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm">
                      COVER
                    </div>
                  )}
                </div>
              ))}
              {previews.length < 10 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-secondary/50 transition-all text-muted-foreground"
                >
                  <Plus className="w-8 h-8" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Add More</span>
                </button>
              )}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />

          {/* Form Fields */}
          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
               <div className="w-10 h-10 rounded-full bg-secondary flex-shrink-0 overflow-hidden border border-border/50">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold bg-primary/10 text-primary">
                      {user?.username?.[0].toUpperCase()}
                    </div>
                  )}
               </div>
               <Textarea
                placeholder="Write a catchy caption..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                className="min-h-[120px] text-[15px] resize-none border-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50 shadow-none bg-transparent"
              />
            </div>

            <div className="border-t border-border/40 pt-2">
              <div className="flex items-center gap-3 py-3 group cursor-pointer border-b border-border/40">
                <MapPin className="w-5 h-5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
                <Input
                  placeholder="Add location"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="h-auto p-0 border-none focus-visible:ring-0 text-[14px] placeholder:text-muted-foreground/50 shadow-none bg-transparent"
                />
              </div>
            </div>

            <div className="px-1">
               <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
                Your post will be shared to your followers and can appear on the explore page.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}