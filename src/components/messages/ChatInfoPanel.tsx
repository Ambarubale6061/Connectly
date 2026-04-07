import { Link } from 'react-router-dom';
import { ArrowLeft, ImageIcon, LinkIcon, Volume2 } from 'lucide-react';
import { useState } from 'react';

interface ChatInfoPanelProps {
  conversationId: string;
  otherUser: any;
  onClose: () => void;
  messages: any[];
}

export default function ChatInfoPanel({ otherUser, onClose, messages }: ChatInfoPanelProps) {
  const [tab, setTab] = useState<'media' | 'links' | 'voice'>('media');

  const mediaMessages = messages.filter(m => m.image_url || m.gif_url);
  const linkMessages = messages.filter(m => m.text && /https?:\/\/[^\s]+/.test(m.text));
  const voiceMessages = messages.filter(m => m.voice_note_url);

  const TABS = [
    { id: 'media' as const, label: 'Media', icon: ImageIcon },
    { id: 'links' as const, label: 'Links', icon: LinkIcon },
    { id: 'voice' as const, label: 'Voice', icon: Volume2 },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
      </div>

      {/* Profile */}
      <div className="flex flex-col items-center py-8 border-b border-gray-100 gap-3 bg-gradient-to-b from-violet-50/50 to-white">
        <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-violet-100 shadow-sm">
          {otherUser.avatar_url
            ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-violet-600 bg-violet-100">{otherUser.username?.[0]?.toUpperCase()}</div>
          }
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-gray-900">{otherUser.username}</p>
          <Link to={`/profile/${otherUser.id}`} className="text-sm text-violet-500 hover:text-violet-600 mt-0.5 block transition-colors">
            View profile
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              tab === id ? 'border-b-2 border-violet-500 text-violet-600' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}>
        {tab === 'media' && (
          <div className="grid grid-cols-3 gap-0.5">
            {mediaMessages.length === 0 && (
              <div className="col-span-3 text-center py-12 text-sm text-gray-400">No shared media yet</div>
            )}
            {mediaMessages.map(m => (
              <div key={m.id} className="aspect-square overflow-hidden hover:opacity-90 transition-opacity cursor-pointer">
                <img src={m.image_url || m.gif_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {tab === 'links' && (
          <div className="p-4 space-y-3">
            {linkMessages.length === 0 && <p className="text-center py-12 text-sm text-gray-400">No shared links yet</p>}
            {linkMessages.map(m => {
              const url = m.text.match(/https?:\/\/[^\s]+/)?.[0];
              return (
                <a key={m.id} href={url} target="_blank" rel="noopener noreferrer"
                  className="block p-3 rounded-xl bg-gray-50 hover:bg-violet-50 border border-gray-200 hover:border-violet-200 transition-all">
                  <p className="text-sm text-violet-500 truncate font-medium">{url}</p>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{m.text}</p>
                </a>
              );
            })}
          </div>
        )}

        {tab === 'voice' && (
          <div className="p-4 space-y-3">
            {voiceMessages.length === 0 && <p className="text-center py-12 text-sm text-gray-400">No voice notes yet</p>}
            {voiceMessages.map(m => (
              <div key={m.id} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <audio src={m.voice_note_url} controls className="w-full h-8" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}