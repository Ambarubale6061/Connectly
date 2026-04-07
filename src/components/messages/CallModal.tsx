import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PhoneOff, Video, VideoOff, Mic, MicOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface CallModalProps {
  callType: 'voice' | 'video';
  conversationId: string;
  myUserId: string;
  otherUser: { id: string; username: string; avatar_url?: string };
  isCallee?: boolean;
  onEnd: (duration?: number) => void;
}

function fmt(s: number) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'turn:a.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:a.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function Btn({ onClick, active, label, size = 'md', children }: {
  onClick: () => void; active?: boolean; label?: string; size?: 'sm' | 'md'; children: React.ReactNode;
}) {
  const sz = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={onClick} className={`${sz} rounded-full flex items-center justify-center transition-all active:scale-95 shadow-sm ${
        active ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
      }`}>{children}</button>
      {label && <span className="text-[10px] text-gray-400 font-medium text-center leading-tight">{label}</span>}
    </div>
  );
}

export default function CallModal({ callType, conversationId, myUserId, otherUser, isCallee = false, onEnd }: CallModalProps) {
  const isVideo = callType === 'video';
  const [phase, setPhase] = useState<'ringing' | 'connecting' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [camFront, setCamFront] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAVRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const signalChRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceBuffer = useRef<RTCIceCandidateInit[]>([]);
  const hasRemote = useRef(false);
  const makingOffer = useRef(false);
  const isEnded = useRef(false);

  const sendSignal = useCallback(async (type: string, payload: object = {}) => {
    try {
      await supabase.from('call_signals').insert({
        conversation_id: conversationId, from_user: myUserId, to_user: otherUser.id, type, payload,
      });
    } catch (e) { console.error('sendSignal:', e); }
  }, [conversationId, myUserId, otherUser.id]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of iceBuffer.current) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
    iceBuffer.current = [];
  }, []);

  const cleanup = useCallback(() => {
    if (isEnded.current) return;
    isEnded.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    try { pcRef.current?.close(); } catch {}
    if (signalChRef.current) supabase.removeChannel(signalChRef.current);
    supabase.from('call_signals').delete().eq('conversation_id', conversationId).eq('from_user', myUserId).then(() => {});
  }, [conversationId, myUserId]);

  const startTimer = useCallback(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => setDuration(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
  }, []);

  const handleEndRef = useRef<(notify?: boolean) => void>(() => {});
  const handleEnd = useCallback((notify = true) => { handleEndRef.current(notify); }, []);
  useEffect(() => {
    handleEndRef.current = (notify = true) => {
      const d = phase === 'connected' ? duration : undefined;
      if (notify && !isEnded.current) sendSignal('call-end', {}).catch(() => {});
      cleanup();
      onEnd(d);
    };
  });

  const buildPC = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    pc.onicecandidate = ({ candidate }) => { if (candidate) sendSignal('ice-candidate', { candidate: candidate.toJSON() }); };
    pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') pc.restartIce(); };
    pc.ontrack = ({ streams }) => {
      if (remoteAVRef.current && streams[0]) remoteAVRef.current.srcObject = streams[0];
      setPhase('connected'); startTimer();
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if ((s === 'disconnected' || s === 'failed') && !isEnded.current) { setError('Connection lost'); handleEnd(false); }
    };
    return pc;
  }, [sendSignal, startTimer]);

  const getMedia = useCallback(async (front = true) => {
    const stream = await navigator.mediaDevices.getUserMedia(
      isVideo
        ? { audio: { echoCancellation: true, noiseSuppression: true }, video: { facingMode: front ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 } }
    );
    localStreamRef.current = stream;
    if (localVideoRef.current && isVideo) { localVideoRef.current.srcObject = stream; localVideoRef.current.muted = true; }
    return stream;
  }, [isVideo]);

  const subscribeSignals = useCallback(() => {
    const ch = supabase.channel(`rtc-${conversationId}-${myUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_signals', filter: `to_user=eq.${myUserId}` },
        async ({ new: row }: { new: any }) => {
          if (row.conversation_id !== conversationId) return;
          const pc = pcRef.current;
          switch (row.type as string) {
            case 'call-accept': {
              if (isCallee || !pc) break;
              setPhase('connecting');
              try {
                makingOffer.current = true;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                makingOffer.current = false;
                await sendSignal('offer', { sdp: pc.localDescription!.toJSON() });
              } catch (e) { console.error('createOffer:', e); }
              break;
            }
            case 'offer': {
              if (!pc || isEnded.current) break;
              const collision = makingOffer.current || pc.signalingState !== 'stable';
              if (collision && !isCallee) break;
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(row.payload.sdp));
                hasRemote.current = true; await flushIce();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await sendSignal('answer', { sdp: pc.localDescription!.toJSON() });
                setPhase('connecting');
              } catch (e) { console.error('answer:', e); }
              break;
            }
            case 'answer': {
              if (!pc || pc.signalingState !== 'have-local-offer') break;
              try { await pc.setRemoteDescription(new RTCSessionDescription(row.payload.sdp)); hasRemote.current = true; await flushIce(); } catch (e) { console.error('setRemote:', e); }
              break;
            }
            case 'ice-candidate': {
              const c = row.payload.candidate;
              if (!c) break;
              if (hasRemote.current && pc) { try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
              else iceBuffer.current.push(c);
              break;
            }
            case 'call-end': handleEnd(false); break;
            case 'call-decline': setError('Call declined'); setTimeout(() => handleEnd(false), 1800); break;
          }
        }
      ).subscribe();
    signalChRef.current = ch;
  }, [conversationId, myUserId, isCallee, sendSignal, flushIce]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const stream = await getMedia(camFront);
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        buildPC(stream); subscribeSignals();
        if (isCallee) { await sendSignal('call-accept', { callType }); setPhase('connecting'); }
        else setPhase('ringing');
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError' ? 'Camera/mic permission denied' : e?.message ?? 'Failed to start call');
        setTimeout(() => { if (mounted) onEnd(undefined); }, 2500);
      }
    };
    init();
    return () => { mounted = false; cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMic = () => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = micMuted; }); setMicMuted(v => !v); };
  const toggleCam = () => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = camOff; }); setCamOff(v => !v); };
  const toggleSpeaker = () => { if (remoteAVRef.current) remoteAVRef.current.muted = !speakerOff; setSpeakerOff(v => !v); };
  const flipCam = async () => {
    if (!isVideo || !pcRef.current) return;
    const nf = !camFront; setCamFront(nf);
    localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
    try {
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nf ? 'user' : 'environment' } });
      const [nt] = ns.getVideoTracks();
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender && nt) await sender.replaceTrack(nt);
      const cur = localStreamRef.current;
      if (cur) { cur.getVideoTracks().forEach(t => cur.removeTrack(t)); cur.addTrack(nt); if (localVideoRef.current) localVideoRef.current.srcObject = cur; }
    } catch (e) { console.error('flipCam:', e); }
  };

  const statusLabel = { ringing: 'Ringing…', connecting: 'Connecting…', connected: fmt(duration), ended: 'Call ended' }[phase];

  // ── VIDEO CALL ─────────────────────────────────────────────────────────────
  if (isVideo) {
    return (
      <div className="fixed inset-0 z-[200] bg-gray-900 flex flex-col">
        <video ref={remoteAVRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />

        {/* Pre-connect overlay */}
        {phase !== 'connected' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
            <div className="relative mb-8">
              <div className="absolute inset-0 rounded-full bg-violet-100 animate-ping" style={{ transform: 'scale(1.7)', animationDuration: '2s' }} />
              <div className="absolute inset-0 rounded-full bg-violet-50 animate-ping" style={{ transform: 'scale(2.2)', animationDuration: '2s', animationDelay: '0.6s' }} />
              <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-violet-200 shadow-xl relative z-10">
                {otherUser.avatar_url
                  ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-5xl font-bold text-violet-600 bg-violet-100">{otherUser.username?.[0]?.toUpperCase()}</div>
                }
              </div>
            </div>
            <p className="text-gray-900 text-2xl font-bold">{otherUser.username}</p>
            <div className="mt-3 flex items-center gap-2 text-gray-400 text-sm font-medium">
              {phase === 'ringing' ? 'Ringing' : 'Connecting'}
              <span className="flex gap-1">{[0, 200, 400].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg">{error}</div>
        )}

        {/* Top info bar */}
        <div className="absolute top-0 left-0 right-0 z-20 px-5 pt-12 pb-6 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
          <div className="pointer-events-auto">
            <p className="text-white text-lg font-bold">{otherUser.username}</p>
            {phase === 'connected' && <p className="text-green-300 text-sm font-mono mt-0.5">{fmt(duration)}</p>}
          </div>
        </div>

        {/* Local PiP */}
        <div className="absolute top-14 right-4 z-30 w-[100px] h-[140px] rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl">
          <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${camOff ? 'hidden' : ''}`} />
          {camOff && <div className="w-full h-full bg-gray-200 flex items-center justify-center"><VideoOff className="w-6 h-6 text-gray-400" /></div>}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 z-20 px-8 pb-12 pt-8 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-end justify-center gap-5">
            <Btn onClick={toggleSpeaker} active={speakerOff} label={speakerOff ? 'Speaker\noff' : 'Speaker'} size="sm">
              {speakerOff ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Btn>
            <Btn onClick={toggleMic} active={micMuted} label={micMuted ? 'Unmute' : 'Mute'}>
              {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </Btn>
            <div className="flex flex-col items-center gap-1.5">
              <button onClick={() => handleEnd(true)} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition-all shadow-xl shadow-red-500/40">
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-[10px] text-white/70">End</span>
            </div>
            <Btn onClick={toggleCam} active={camOff} label={camOff ? 'Start\nvideo' : 'Stop\nvideo'}>
              {camOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </Btn>
            <Btn onClick={flipCam} label="Flip" size="sm">
              <RotateCcw className="w-5 h-5" />
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // ── VOICE CALL ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden">
      {/* Light background with soft violet gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-purple-50" />
      {/* Soft blobs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-violet-200/40 blur-[80px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-purple-200/30 blur-[80px]" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-6">
        {/* Avatar */}
        <div className="relative mb-10">
          {phase === 'ringing' && (
            <>
              <div className="absolute inset-0 rounded-full bg-violet-200/60 animate-ping" style={{ transform: 'scale(1.8)', animationDuration: '2s' }} />
              <div className="absolute inset-0 rounded-full bg-violet-100/40 animate-ping" style={{ transform: 'scale(2.4)', animationDuration: '2s', animationDelay: '0.5s' }} />
            </>
          )}
          {phase === 'connected' && (
            <div className="absolute inset-0 rounded-full border-2 border-green-300 animate-ping" style={{ transform: 'scale(1.4)', animationDuration: '3s' }} />
          )}
          <div className="w-40 h-40 rounded-full overflow-hidden relative z-10 shadow-xl ring-4 ring-violet-100">
            {otherUser.avatar_url
              ? <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-violet-600 bg-violet-100">{otherUser.username?.[0]?.toUpperCase()}</div>
            }
          </div>
        </div>

        <p className="text-gray-900 text-3xl font-bold tracking-tight mb-2">{otherUser.username}</p>

        <div className="h-8 flex items-center mb-14">
          {phase === 'connected'
            ? <span className="text-green-500 text-xl font-mono font-bold">{fmt(duration)}</span>
            : (
              <span className="text-gray-400 text-base font-medium flex items-center gap-2.5">
                {phase === 'ringing' ? 'Ringing' : 'Connecting'}
                <span className="flex gap-1">
                  {[0, 180, 360].map(d => <span key={d} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </span>
            )
          }
        </div>

        {error && (
          <div className="mb-8 px-5 py-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-500 text-sm font-medium">{error}</div>
        )}

        {/* Controls */}
        <div className="flex items-end justify-center gap-5 w-full">
          <Btn onClick={toggleSpeaker} active={speakerOff} label={speakerOff ? 'Speaker\noff' : 'Speaker'} size="sm">
            {speakerOff ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </Btn>
          <Btn onClick={toggleMic} active={micMuted} label={micMuted ? 'Unmute' : 'Mute'}>
            {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Btn>
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={() => handleEnd(true)} className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition-all shadow-xl shadow-red-400/30">
              <PhoneOff className="w-8 h-8 text-white" />
            </button>
            <span className="text-[10px] text-gray-400">End call</span>
          </div>
          <div className="w-12 h-12" />
          <div className="w-12 h-12" />
        </div>
      </div>

      <video ref={remoteAVRef} autoPlay playsInline className="hidden" />
    </div>
  );
}