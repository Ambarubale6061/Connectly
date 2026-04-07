import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

interface IncomingCallModalProps {
  callType: 'voice' | 'video';
  callerName: string;
  callerAvatar: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function IncomingCallModal({ callType, callerName, callerAvatar, onAccept, onDecline }: IncomingCallModalProps) {
  const playingRef = useRef(true);

  useEffect(() => {
    const ctx = new AudioContext();
    playingRef.current = true;
    const ring = () => {
      if (!playingRef.current) return;
      [440, 480].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.35);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
      });
      setTimeout(ring, 1600);
    };
    setTimeout(ring, 300);
    return () => { playingRef.current = false; ctx.close(); };
  }, []);

  const accept = () => { playingRef.current = false; onAccept(); };
  const decline = () => { playingRef.current = false; onDecline(); };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-sm mx-4 mb-6 sm:mb-0 rounded-3xl overflow-hidden shadow-2xl bg-white border border-gray-100">
        {/* Soft top gradient */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-violet-50 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center px-8 pt-10 pb-8 gap-5">
          {/* Avatar with ring */}
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-violet-200/60 animate-ping" style={{ transform: 'scale(1.5)', animationDuration: '1.8s' }} />
            <div className="absolute inset-0 rounded-full bg-violet-100/40 animate-ping" style={{ transform: 'scale(1.9)', animationDuration: '1.8s', animationDelay: '0.6s' }} />
            <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-violet-100 shadow-lg relative z-10">
              {callerAvatar
                ? <img src={callerAvatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-violet-600 bg-violet-100">{callerName?.[0]?.toUpperCase()}</div>
              }
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-900 text-xl font-bold">{callerName}</p>
            <p className="text-gray-400 text-sm mt-1">Incoming {callType === 'video' ? 'video' : 'voice'} call</p>
          </div>

          <div className="w-full h-px bg-gray-100" />

          {/* Buttons */}
          <div className="flex items-center justify-center gap-12 w-full pt-1">
            <div className="flex flex-col items-center gap-2">
              <button onClick={decline} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-red-200">
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-gray-400 text-xs font-medium">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button onClick={accept} className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-green-200">
                {callType === 'video' ? <Video className="w-7 h-7 text-white" /> : <Phone className="w-7 h-7 text-white" />}
              </button>
              <span className="text-gray-400 text-xs font-medium">Accept</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}