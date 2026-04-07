import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Film, ArrowLeft, Loader2, Play, X, Clapperboard } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateReel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Basic validation: Max 50MB for demo purposes
    if (f.size > 50 * 1024 * 1024) {
      toast.error("Video size too large (Max 50MB)");
      return;
    }

    setVideo(f);
    setPreview(URL.createObjectURL(f));
  };

  const resetSelection = () => {
    setVideo(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!user || !video) return;
    setLoading(true);
    
    try {
      const fileExt = video.name.split('.').pop();
      const path = `${user.id}/reels/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reel-videos')
        .upload(path, video);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('reel-videos').getPublicUrl(path);

      const { error: dbError } = await supabase.from('reels').insert({
        user_id: user.id,
        video_url: data.publicUrl,
        caption: caption.trim() || null,
      });

      if (dbError) throw dbError;

      toast.success("Reel shared!");
      navigate('/reels');
    } catch (err: any) {
      toast.error(err.message || "Failed to upload reel");
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
            <h2 className="text-lg font-bold tracking-tight">New Reel</h2>
          </div>
          
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !video} 
            size="sm"
            className="rounded-full px-6 font-bold bg-primary text-primary-foreground transition-all active:scale-95"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Share'}
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Video Preview Section */}
          {!preview ? (
            <div 
              onClick={() => fileRef.current?.click()}
              className="group w-full aspect-[9/16] max-h-[600px] border-2 border-dashed border-border/60 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer overflow-hidden"
            >
              <div className="p-6 bg-secondary rounded-full group-hover:scale-110 transition-transform">
                <Clapperboard className="w-12 h-12 text-primary" />
              </div>
              <div className="text-center px-6">
                <p className="font-bold text-lg text-foreground">Select Reel Video</p>
                <p className="text-sm text-muted-foreground mt-1">High quality vertical videos (9:16) work best</p>
              </div>
            </div>
          ) : (
            <div className="relative group aspect-[9/16] max-h-[600px] rounded-[32px] overflow-hidden bg-black shadow-2xl border border-border/20">
              <video 
                src={preview} 
                className="w-full h-full object-cover" 
                controlsList="nodownload"
                autoPlay 
                muted 
                loop 
              />
              <button
                onClick={resetSelection}
                className="absolute top-4 right-4 bg-black/60 hover:bg-black text-white rounded-full p-2 backdrop-blur-md transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-2">
                 <Play className="w-3 h-3 fill-white text-white" />
                 <span className="text-[10px] font-bold text-white uppercase tracking-widest">Preview</span>
              </div>
            </div>
          )}

          <input 
            ref={fileRef} 
            type="file" 
            accept="video/*" 
            className="hidden" 
            onChange={handleFile} 
          />

          {/* Form Fields */}
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
                  placeholder="Write a caption for your reel..."
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="min-h-[120px] text-[15px] resize-none border-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50 shadow-none bg-transparent"
                />
               </div>
            </div>

            <div className="border-t border-border/40 pt-6">
               <div className="bg-secondary/30 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Reel Settings</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    By sharing, your reel will appear in the Reels tab and can be discovered by anyone on Connectly.
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}