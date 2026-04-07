import { useRef, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImagePlus, Trash2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  storyId?: string;                 // if provided, we are editing
  initialMediaUrl?: string;
  initialMediaType?: string | null;
}

export function AddStoryDialog({ open, onClose, storyId, initialMediaUrl, initialMediaType }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(initialMediaUrl || null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVideo, setIsVideo] = useState(initialMediaType === 'video');
  const isEditing = !!storyId;

  // Reset when dialog opens with new props
  useEffect(() => {
    if (open) {
      setPreview(initialMediaUrl || null);
      setIsVideo(initialMediaType === 'video');
      setFile(null);
    }
  }, [open, initialMediaUrl, initialMediaType]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const video = f.type.startsWith('video/');
    setIsVideo(video);
    if (!video) {
      const compressed = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1080 });
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
    } else {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const deleteOldMedia = async (oldUrl: string) => {
    // Extract storage path from public URL
    const path = oldUrl.split('/story-media/')[1];
    if (path) {
      await supabase.storage.from('story-media').remove([path]);
    }
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!file && !isEditing) {
      toast({ title: 'Please select a file', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      let mediaUrl = initialMediaUrl;
      let mediaType = isVideo ? 'video' : 'image';

      if (file) {
        // Upload new file
        const ext = isVideo ? 'mp4' : 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('story-media').upload(path, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('story-media').getPublicUrl(path);
        mediaUrl = data.publicUrl;

        // If editing, delete old media after new upload
        if (isEditing && initialMediaUrl) {
          await deleteOldMedia(initialMediaUrl);
        }
      }

      if (isEditing && storyId) {
        // Update existing story
        const { error } = await supabase
          .from('stories')
          .update({
            media_url: mediaUrl,
            media_type: mediaType,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', storyId)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Story updated!' });
      } else {
        // Create new story
        const { error } = await supabase.from('stories').insert({
          user_id: user.id,
          media_url: mediaUrl,
          media_type: mediaType,
        });
        if (error) throw error;
        toast({ title: 'Story added!' });
      }

      queryClient.invalidateQueries({ queryKey: ['stories'] });
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'Something went wrong', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!isEditing || !initialMediaUrl) return;
    setLoading(true);
    try {
      await deleteOldMedia(initialMediaUrl);
      // Also delete story record
      if (storyId) {
        await supabase.from('stories').delete().eq('id', storyId).eq('user_id', user?.id);
      }
      toast({ title: 'Story media removed' });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      onClose();
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to delete media', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Story' : 'Add Story'}</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[9/16] max-h-[400px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:bg-accent transition-colors"
          >
            <ImagePlus className="w-12 h-12 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Select photo or video</span>
          </button>
        ) : (
          <div className="aspect-[9/16] max-h-[400px] rounded-lg overflow-hidden bg-black relative">
            {isVideo ? (
              <video src={preview} className="w-full h-full object-contain" controls />
            ) : (
              <img src={preview} alt="" className="w-full h-full object-contain" />
            )}
            {isEditing && (
              <button
                onClick={handleDeleteMedia}
                className="absolute bottom-2 right-2 bg-black/60 p-2 rounded-full"
                disabled={loading}
              >
                <Trash2 className="w-5 h-5 text-white" />
              </button>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

        {preview && (
          <Button onClick={handleUpload} disabled={loading} className="w-full">
            {loading ? 'Saving...' : isEditing ? 'Update Story' : 'Share Story'}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}