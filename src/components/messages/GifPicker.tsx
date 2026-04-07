import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

const TENOR_API_KEY = 'AIzaSyAyimkuYQYF_FXVALexPzR4sMzNHuBa6s4';
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

interface TenorGif {
  id: string;
  media_formats: { gif?: { url: string }; tinygif?: { url: string } };
  title: string;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<TenorGif[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchGifs = async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim()
        ? `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${TENOR_API_KEY}&limit=24&media_filter=gif,tinygif`
        : `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=24&media_filter=gif,tinygif`;
      const res = await fetch(endpoint);
      const data = await res.json();
      setGifs(data.results ?? []);
    } catch { setGifs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGifs(''); }, []);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchGifs(val), 400);
  };

  const getUrl = (gif: TenorGif) => gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url || '';

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            autoFocus
            placeholder="Search GIFs…"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400"
          />
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
        {loading ? (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : gifs.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">{query ? 'No GIFs found' : 'Type to search GIFs'}</div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {gifs.map(gif => {
              const url = getUrl(gif);
              if (!url) return null;
              return (
                <button key={gif.id} onClick={() => onSelect(url)}
                  className="aspect-video rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 active:scale-95 transition-all">
                  <img src={url} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-[9px] text-gray-300 py-1">Powered by Tenor</p>
    </div>
  );
}