import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImagePlus, ArrowLeft, Loader2, X, Film } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { toast } from 'sonner';

export default function CreateStory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const video = f.type.startsWith('video/');
    setIsVideo(video);

    let processedFile = f;
    if (!video) {
      // Compress image
      processedFile = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1080 });
    } else {
      // Optional: validate video size (e.g., max 50MB)
      if (f.size > 50 * 1024 * 1024) {
        toast.error("Video too large (max 50MB)");
        return;
      }
    }

    setMedia(processedFile);
    setPreview(URL.createObjectURL(processedFile));
  };

  const resetSelection = () => {
    setMedia(null);
    setPreview(null);
    setIsVideo(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!user || !media) return;
    setLoading(true);

    try {
      const ext = isVideo ? 'mp4' : 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('story-media')
        .upload(path, media);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('story-media')
        .getPublicUrl(path);

      // Story expires in 24 hours
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: dbError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: urlData.publicUrl,
        media_type: isVideo ? 'video' : 'image',
        expires_at: expiresAt,
      });

      if (dbError) throw dbError;

      toast.success("Story shared!");
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || "Failed to upload story");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <div className="max-w-xl mx-auto min-h-screen bg-background no-scrollbar overflow-y-auto pb-10">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-1 hover:bg-accent rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold tracking-tight">New Story</h2>
          </div>
          
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !media} 
            size="sm"
            className="rounded-full px-6 font-bold bg-primary text-primary-foreground transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Media Preview Section */}
          {!preview ? (
            <div 
              onClick={() => fileRef.current?.click()}
              className="group w-full aspect-[9/16] max-h-[600px] border-2 border-dashed border-border/60 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden"
            >
              <div className="p-6 bg-secondary rounded-full group-hover:scale-110 transition-transform">
                <ImagePlus className="w-12 h-12 text-primary" />
              </div>
              <div className="text-center px-6">
                <p className="font-bold text-lg text-foreground">Select photo or video</p>
                <p className="text-sm text-muted-foreground mt-1">Best viewed vertically (9:16)</p>
              </div>
            </div>
          ) : (
            <div className="relative group aspect-[9/16] max-h-[600px] rounded-[32px] overflow-hidden bg-black shadow-2xl border border-border/20">
              {isVideo ? (
                <video 
                  src={preview} 
                  className="w-full h-full object-cover" 
                  controlsList="nodownload"
                  autoPlay 
                  muted 
                  loop 
                />
              ) : (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              )}
              <button
                onClick={resetSelection}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white rounded-full p-2 backdrop-blur-md transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
                {isVideo ? (
                  <>
                    <Film className="w-3 h-3 text-white" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Video</span>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Photo</span>
                )}
              </div>
            </div>
          )}

          <input 
            ref={fileRef} 
            type="file" 
            accept="image/*,video/*" 
            className="hidden" 
            onChange={handleFile} 
          />

          {/* Caption Field */}
          <div className="space-y-6 pt-2">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex-shrink-0 overflow-hidden border border-border/50">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold bg-primary/10 text-primary">
                    {user?.username?.[0].toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <Textarea
                  placeholder="Add a caption (optional)"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="min-h-[100px] text-[15px] resize-none border-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50 shadow-none bg-transparent"
                />
              </div>
            </div>

            <div className="border-t border-border/40 pt-6">
              <div className="bg-secondary/30 rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Story Info</h4>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Your story will be visible to your followers for 24 hours. You can delete it anytime from your story viewer or profile.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}