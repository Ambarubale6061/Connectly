import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Upload, Image, Video, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import imageCompression from 'browser-image-compression';

export function StoriesManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch user's stories
  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['my-stories', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const video = f.type.startsWith('video/');
    setIsVideo(video);
    let processedFile = f;
    if (!video) {
      processedFile = await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1080 });
    }
    setFile(processedFile);
    setPreview(URL.createObjectURL(processedFile));
  };

  const handleUpload = async () => {
    if (!user || !file) {
      toast({ title: 'Please select a photo or video', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = isVideo ? 'mp4' : 'jpg';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('story-media').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('story-media').getPublicUrl(path);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: user.id,
        media_url: urlData.publicUrl,
        media_type: isVideo ? 'video' : 'image',
      });
      if (insertError) throw insertError;

      toast({ title: 'Story uploaded successfully!' });
      // Reset form
      setPreview(null);
      setFile(null);
      setIsVideo(false);
      if (fileRef.current) fileRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['my-stories'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] }); // for StoriesRow
    } catch (err) {
      console.error(err);
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (storyId: string, mediaUrl: string) => {
    try {
      // Delete from storage
      const path = mediaUrl.split('/story-media/')[1];
      if (path) {
        await supabase.storage.from('story-media').remove([path]);
      }
      // Delete record
      const { error } = await supabase.from('stories').delete().eq('id', storyId);
      if (error) throw error;
      toast({ title: 'Story deleted' });
      queryClient.invalidateQueries({ queryKey: ['my-stories'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    } catch (err) {
      console.error(err);
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  if (!user) return <div className="flex justify-center p-8">Please log in</div>;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Manage Stories</h1>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <Label>Upload new story (photo or video)</Label>
              <div className="mt-2">
                {!preview ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-accent transition-colors"
                  >
                    <Upload className="w-10 h-10 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to select</span>
                  </button>
                ) : (
                  <div className="relative">
                    <div className="aspect-[9/16] max-h-[400px] mx-auto rounded-lg overflow-hidden bg-black">
                      {isVideo ? (
                        <video src={preview} className="w-full h-full object-contain" controls />
                      ) : (
                        <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setPreview(null);
                        setFile(null);
                        if (fileRef.current) fileRef.current.value = '';
                      }}
                      className="absolute top-2 right-2 bg-black/60 p-1 rounded-full"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
            <Button onClick={handleUpload} disabled={!file || uploading} className="w-full">
              {uploading ? 'Uploading...' : 'Share Story'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Stories */}
      <h2 className="text-xl font-semibold mb-4">Your Stories</h2>
      {isLoading ? (
        <div className="text-center py-8">Loading...</div>
      ) : stories.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No stories yet. Upload your first story!</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {stories.map((story) => (
            <div key={story.id} className="relative group">
              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-black">
                {story.media_type === 'video' ? (
                  <video src={story.media_url} className="w-full h-full object-cover" />
                ) : (
                  <img src={story.media_url} alt="Story" className="w-full h-full object-cover" />
                )}
              </div>
              <button
                onClick={() => setDeleteId(story.id)}
                className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
              <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                {new Date(story.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The story will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const story = stories.find(s => s.id === deleteId);
                if (story) handleDelete(story.id, story.media_url);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}