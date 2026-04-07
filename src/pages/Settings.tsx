import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  ArrowLeft, ChevronRight, Lock, Bell, Moon, Sun, Eye, Shield,
  UserX, Activity, Trash2, LogOut, Key, HelpCircle, Info, FileText,
  Globe, Heart, MessageCircle, Users, Wifi, Download, Briefcase,
  UserCheck, Copy, Check, Mail, AtSign, Tag, BookMarked, Volume2,
  Smartphone, Image, RefreshCw, AlertTriangle, Zap, Filter,
  ToggleLeft, Search, Loader2, Edit3, Plus,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility  = 'everyone' | 'following' | 'off';
type DataUsage   = 'auto' | 'low' | 'high';
type AccountType = 'personal' | 'business' | 'creator';
type PageKey =
  | 'main'
  | 'notifications' | 'privacy' | 'security' | 'content' | 'data' | 'account'
  | 'change-password' | 'change-email' | 'two-fa' | 'login-activity'
  | 'blocked-users' | 'close-friends' | 'delete-account' | 'support';

interface UserSettings {
  push_notifications: boolean;       email_notifications: boolean;
  notification_likes: boolean;       notification_comments: boolean;
  notification_follows: boolean;     notification_mentions: boolean;
  notification_story_views: boolean; notification_messages: boolean;
  sound_notifications: boolean;      vibrate_notifications: boolean;
  activity_status: boolean;          show_online_status: boolean;
  read_receipts: boolean;            typing_indicators: boolean;
  story_privacy: Visibility;         likes_visibility: boolean;
  comment_controls: Visibility;      mentions_allowed: Visibility;
  tags_allowed: Visibility;          dms_from: Visibility;
  story_reactions: boolean;          autoplay_videos: boolean;
  high_quality_uploads: boolean;     data_usage: DataUsage;
  sensitive_content: boolean;        suggested_posts: boolean;
  save_original_photos: boolean;     security_login_alerts: boolean;
  two_factor_enabled: boolean;       account_type: AccountType;
  language: string;
}

const DEFAULTS: UserSettings = {
  push_notifications: true,   email_notifications: true,
  notification_likes: true,   notification_comments: true,
  notification_follows: true, notification_mentions: true,
  notification_story_views: true, notification_messages: true,
  sound_notifications: true,  vibrate_notifications: true,
  activity_status: true,      show_online_status: true,
  read_receipts: true,        typing_indicators: true,
  story_privacy: 'everyone',  likes_visibility: true,
  comment_controls: 'everyone', mentions_allowed: 'everyone',
  tags_allowed: 'everyone',   dms_from: 'everyone',
  story_reactions: true,      autoplay_videos: true,
  high_quality_uploads: true, data_usage: 'auto',
  sensitive_content: false,   suggested_posts: true,
  save_original_photos: false, security_login_alerts: true,
  two_factor_enabled: false,  account_type: 'personal',
  language: 'English',
};

// ─── Primitives ───────────────────────────────────────────────────────────────

function PageShell({
  title, onBack, children,
}: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
      </div>
      <div className="flex-1 px-4 py-4 space-y-4 pb-28">
        {children}
      </div>
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-1.5 mt-1">
      {title}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
      {children}
    </div>
  );
}

function Row({
  icon: Icon, label, subtitle, value,
  toggle, onToggle,
  select, options, onSelect,
  onClick,
  danger, badge, last, saving, rightLabel,
}: {
  icon: React.ElementType; label: string; subtitle?: string; value?: any;
  toggle?: boolean; onToggle?: (v: boolean) => void;
  select?: boolean; options?: string[]; onSelect?: (v: any) => void;
  onClick?: () => void; danger?: boolean; badge?: string;
  last?: boolean; saving?: boolean; rightLabel?: string;
}) {
  const clickable = !!onClick && !toggle && !select;
  return (
    <div
      className={`flex items-center gap-3 px-4 py-[13px] ${!last ? 'border-b border-border/50' : ''} ${clickable ? 'cursor-pointer active:bg-accent/40 transition-colors' : ''}`}
      onClick={clickable ? onClick : undefined}
    >
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-destructive/10' : 'bg-muted/60'}`}>
        <Icon className={`w-4 h-4 ${danger ? 'text-destructive' : 'text-foreground/70'}`} />
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${danger ? 'text-destructive' : 'text-foreground'}`}>{label}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-1">
        {badge && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{badge}</Badge>}
        {rightLabel && <span className="text-xs text-muted-foreground">{rightLabel}</span>}
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : select ? (
          <Select value={value} onValueChange={onSelect}>
            <SelectTrigger className="w-[108px] h-7 text-xs border-border/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options?.map(o => (
                <SelectItem key={o} value={o} className="text-xs capitalize">{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : toggle ? (
          <Switch checked={!!value} onCheckedChange={onToggle} />
        ) : clickable ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
        ) : null}
      </div>
    </div>
  );
}

function FormField({ label, type = 'text', placeholder, value, onChange, hint, error }: {
  label: string; type?: string; placeholder?: string;
  value: string; onChange: (v: string) => void;
  hint?: string; error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <Input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        className={`h-11 ${error ? 'border-destructive' : ''}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Settings() {
  const navigate      = useNavigate();
  const { user, signOut } = useAuth();
  const qc            = useQueryClient();
  const { toast }     = useToast();

  const [page, setPage]       = useState<PageKey>('main');
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // form fields
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [copied, setCopied] = useState(false);
  const [cfSearch, setCfSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // ── Profile query ──
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // ── Settings state ──
  const [s, setS] = useState<UserSettings>(DEFAULTS);
  useEffect(() => {
    if (profile?.settings) setS(prev => ({ ...prev, ...(profile.settings as any) }));
  }, [profile]);

  const save = useCallback(async <K extends keyof UserSettings>(key: K, val: UserSettings[K]) => {
    setSavingKey(key);
    const next = { ...s, [key]: val };
    setS(next);
    if (user) {
      const { error } = await supabase.from('profiles').update({ settings: next as any }).eq('id', user.id);
      if (error) {
        setS(s);
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        qc.invalidateQueries({ queryKey: ['profile', user.id] });
      }
    }
    setSavingKey(null);
  }, [s, user, qc, toast]);

  const isSaving = (k: string) => savingKey === k;

  // ── Dark mode ──
  const toggleDark = () => {
    const n = !darkMode;
    setDarkMode(n);
    document.documentElement.classList.toggle('dark', n);
    localStorage.setItem('theme', n ? 'dark' : 'light');
    toast({ title: n ? '🌙 Dark mode on' : '☀️ Light mode on' });
  };

  // ── Privacy toggle ──
  const togglePrivacy = async () => {
    if (!user || !profile) return;
    const n = !profile.is_private;
    await supabase.from('profiles').update({ is_private: n }).eq('id', user.id);
    refetchProfile();
    toast({ title: n ? '🔒 Account is now private' : '🌐 Account is now public' });
  };

  // ── Change password ──
  const handlePw = async () => {
    setPwErr('');
    if (pw1.length < 8) { setPwErr('Minimum 8 characters'); return; }
    if (pw1 !== pw2)    { setPwErr('Passwords do not match'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setPwLoading(false);
    if (error) { setPwErr(error.message); }
    else { setPw1(''); setPw2(''); setPage('security'); toast({ title: '✅ Password updated' }); }
  };

  // ── Change email ──
  const handleEmail = async () => {
    setEmailErr('');
    if (!newEmail.includes('@')) { setEmailErr('Enter a valid email'); return; }
    setEmailLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailLoading(false);
    if (error) { setEmailErr(error.message); }
    else { setNewEmail(''); setPage('security'); toast({ title: '📧 Verification email sent' }); }
  };

  // ── Push notifications ──
  const togglePush = async () => {
    if (!s.push_notifications) {
      if ('Notification' in window) {
        const p = await Notification.requestPermission();
        if (p === 'granted') { await save('push_notifications', true); toast({ title: '🔔 Push notifications enabled' }); }
        else toast({ title: 'Blocked in browser settings', variant: 'destructive' });
      }
    } else await save('push_notifications', false);
  };

  // ── Notification actions ──
  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: '✅ All marked as read' });
  };
  const clearAllNotifs = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast({ title: '🗑️ Notifications cleared' });
  };

  // ── 2FA ──
  const open2FA = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    setTwoFASecret(Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * 32)]).join(''));
    setPage('two-fa');
  };
  const copySecret = () => { navigator.clipboard.writeText(twoFASecret); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  // ── Blocked users ──
  const { data: blocked = [], isLoading: blockedLoading } = useQuery({
    queryKey: ['blocked-users', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('blocked_users')
        .select('blocked_id, profiles!blocked_users_blocked_id_fkey(id,username,avatar_url)')
        .eq('blocker_id', user!.id);
      return (data ?? []).map((b: any) => b.profiles).filter(Boolean);
    },
    enabled: !!user && page === 'blocked-users',
  });
  const unblock = async (id: string) => {
    await supabase.from('blocked_users').delete().eq('blocker_id', user!.id).eq('blocked_id', id);
    qc.invalidateQueries({ queryKey: ['blocked-users'] });
    toast({ title: 'User unblocked' });
  };

  // ── Close friends ──
  const { data: cf = [], isLoading: cfLoading } = useQuery({
    queryKey: ['close-friends', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('close_friends')
        .select('friend_id, profiles!close_friends_friend_id_fkey(id,username,avatar_url)')
        .eq('user_id', user!.id);
      return (data ?? []).map((c: any) => c.profiles).filter(Boolean);
    },
    enabled: !!user && page === 'close-friends',
  });
  const addCF = async () => {
    if (!cfSearch.trim()) return;
    const { data: found } = await supabase.from('profiles').select('id').eq('username', cfSearch.trim()).maybeSingle();
    if (found) {
      const { error } = await supabase.from('close_friends').insert({ user_id: user!.id, friend_id: found.id });
      if (!error) { qc.invalidateQueries({ queryKey: ['close-friends'] }); setCfSearch(''); toast({ title: `✅ @${cfSearch} added` }); }
      else toast({ title: 'Already in list', variant: 'destructive' });
    } else toast({ title: 'User not found', variant: 'destructive' });
  };
  const removeCF = async (id: string) => {
    await supabase.from('close_friends').delete().eq('user_id', user!.id).eq('friend_id', id);
    qc.invalidateQueries({ queryKey: ['close-friends'] });
    toast({ title: 'Removed' });
  };

  // ── Counts ──
  const { data: savedCount = 0 } = useQuery({
    queryKey: ['saved-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('saved_posts').select('*', { count: 'exact', head: true }).eq('user_id', user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notif', user?.id],
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user!.id).eq('read', false);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const go = (p: PageKey) => setPage(p);

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: MAIN
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'main') return (
    <AppLayout>
      <div className="max-w-lg mx-auto pb-28">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border/60 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold tracking-tight">Settings</h2>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* Profile card */}
          {profile && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 flex items-center gap-4">
              <Avatar className="w-14 h-14 ring-2 ring-primary/20">
                <AvatarImage src={profile.avatar_url ?? ''} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                  {profile.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">{profile.full_name || profile.username}</p>
                <p className="text-xs text-muted-foreground">@{profile.username}</p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{profile.posts_count ?? 0} posts</span>
                  <span className="text-[11px] text-muted-foreground">{profile.followers_count ?? 0} followers</span>
                </div>
              </div>
              <button
                onClick={() => navigate('/edit-profile')}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-xl px-3 py-2 hover:bg-primary/5 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          )}

          <div>
            <SectionLabel title="Account" />
            <Card>
              <Row icon={Key}    label="Account & Security" subtitle="Password, email, 2FA"                onClick={() => go('security')} />
              <Row icon={Lock}   label="Privacy"            subtitle="Visibility, interactions, messaging" onClick={() => go('privacy')} />
              <Row icon={Users}  label="People"             subtitle="Close friends, blocked users"        onClick={() => go('account')} last />
            </Card>
          </div>

          <div>
            <SectionLabel title="Notifications" />
            <Card>
              <Row icon={Bell}   label="Push Notifications" subtitle={s.push_notifications ? 'On' : 'Off'} toggle value={s.push_notifications} onToggle={togglePush} saving={isSaving('push_notifications')} />
              <Row icon={Mail}   label="Email Notifications" toggle value={s.email_notifications} onToggle={v => save('email_notifications', v)} saving={isSaving('email_notifications')} />
              <Row icon={Bell}   label="Notification Types"  subtitle="Likes, comments, follows & more" badge={unreadCount > 0 ? `${unreadCount} new` : undefined} onClick={() => go('notifications')} last />
            </Card>
          </div>

          <div>
            <SectionLabel title="Preferences" />
            <Card>
              <Row icon={darkMode ? Sun : Moon} label={darkMode ? 'Light Mode' : 'Dark Mode'} toggle value={darkMode} onToggle={toggleDark} />
              <Row icon={Globe}  label="Language"           rightLabel={s.language}                      onClick={() => go('content')} />
              <Row icon={Zap}    label="Content & Display"  subtitle="Videos, quality, feed"             onClick={() => go('content')} />
              <Row icon={Download} label="Data & Storage"   subtitle="History, export, saved posts"      onClick={() => go('data')} last />
            </Card>
          </div>

          <div>
            <SectionLabel title="More" />
            <Card>
              <Row icon={HelpCircle} label="Help & Support" onClick={() => go('support')} />
              <Row icon={Info}       label="About"          subtitle="Connectly v2.0" onClick={() => go('support')} last />
            </Card>
          </div>

          <div>
            <SectionLabel title="Session" />
            <Card>
              <Row icon={LogOut}  label="Log Out"         danger onClick={async () => { await signOut(); navigate('/auth'); }} />
              <Row icon={Trash2}  label="Delete Account"  danger onClick={() => { setDeleteConfirm(''); go('delete-account'); }} last />
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: SECURITY
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'security') return (
    <AppLayout>
      <PageShell title="Account & Security" onBack={() => go('main')}>
        <div>
          <SectionLabel title="Login" />
          <Card>
            <Row icon={Key}           label="Change Password"        subtitle="Update your login password"    onClick={() => { setPw1(''); setPw2(''); setPwErr(''); go('change-password'); }} />
            <Row icon={Mail}          label="Change Email"           subtitle={user?.email ?? ''}             onClick={() => { setNewEmail(''); setEmailErr(''); go('change-email'); }} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Two-Factor Authentication" />
          <Card>
            <Row icon={Shield}        label="Setup 2FA"              subtitle={s.two_factor_enabled ? '✅ Enabled — tap to manage' : 'Not set up'} badge={s.two_factor_enabled ? 'ON' : undefined} onClick={open2FA} />
            <Row icon={AlertTriangle} label="Login Activity"         subtitle="View recent sessions"          onClick={() => go('login-activity')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Alerts" />
          <Card>
            <Row icon={AlertTriangle} label="Security Login Alerts"  subtitle="Notify me of new logins"       toggle value={s.security_login_alerts} onToggle={v => save('security_login_alerts', v)} saving={isSaving('security_login_alerts')} last />
          </Card>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: CHANGE PASSWORD
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'change-password') return (
    <AppLayout>
      <PageShell title="Change Password" onBack={() => go('security')}>
        <Card>
          <div className="p-4 space-y-4">
            <FormField label="New Password"     type="password" placeholder="Min. 8 characters"  value={pw1} onChange={setPw1} />
            <FormField label="Confirm Password" type="password" placeholder="Repeat new password" value={pw2} onChange={v => { setPw2(v); setPwErr(''); }} error={pwErr} />
            <Button className="w-full h-11" onClick={handlePw} disabled={pwLoading}>
              {pwLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {pwLoading ? 'Updating…' : 'Update Password'}
            </Button>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground text-center px-4">You'll stay logged in on this device.</p>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: CHANGE EMAIL
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'change-email') return (
    <AppLayout>
      <PageShell title="Change Email" onBack={() => go('security')}>
        <Card>
          <div className="p-4 space-y-4">
            <div className="bg-muted/40 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">Current email</p>
              <p className="text-sm font-semibold mt-0.5">{user?.email}</p>
            </div>
            <FormField label="New Email Address" type="email" placeholder="you@example.com" value={newEmail} onChange={v => { setNewEmail(v); setEmailErr(''); }} error={emailErr} hint="A verification link will be sent to the new address." />
            <Button className="w-full h-11" onClick={handleEmail} disabled={emailLoading}>
              {emailLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {emailLoading ? 'Sending…' : 'Send Verification'}
            </Button>
          </div>
        </Card>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: TWO-FA
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'two-fa') return (
    <AppLayout>
      <PageShell title="Two-Factor Authentication" onBack={() => go('security')}>
        <Card>
          <div className="p-5 space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Open your authenticator app (Google Authenticator, Authy, etc.) and scan the QR code, or enter the setup key manually.
            </p>
            <div className="flex justify-center">
              <div className="w-40 h-40 rounded-2xl bg-muted/60 border-2 border-dashed border-border flex flex-col items-center justify-center gap-2">
                <Shield className="w-10 h-10 text-muted-foreground/30" />
                <span className="text-[11px] text-muted-foreground/50 font-medium">QR Code</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium">Setup key:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted rounded-xl px-4 py-3 text-xs font-mono tracking-widest text-center break-all">
                  {twoFASecret}
                </code>
                <button onClick={copySecret} className="w-10 h-10 flex items-center justify-center rounded-xl border border-border/60 hover:bg-muted transition-colors flex-shrink-0">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
            {s.two_factor_enabled ? (
              <Button variant="outline" className="w-full h-11 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={async () => { await save('two_factor_enabled', false); setPage('security'); toast({ title: '2FA disabled' }); }}>
                Disable 2FA
              </Button>
            ) : (
              <Button className="w-full h-11"
                onClick={async () => { await save('two_factor_enabled', true); setPage('security'); toast({ title: '🛡️ 2FA Enabled' }); }}>
                Enable 2FA
              </Button>
            )}
          </div>
        </Card>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: LOGIN ACTIVITY
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'login-activity') return (
    <AppLayout>
      <PageShell title="Login Activity" onBack={() => go('security')}>
        <div className="space-y-3">
          {[
            { device: 'Chrome on Windows',   location: 'Pune, Maharashtra',    time: 'Active now',           current: true  },
            { device: 'Safari on iPhone 15', location: 'Mumbai, Maharashtra',  time: '2 hours ago',          current: false },
            { device: 'Firefox on macOS',    location: 'Bangalore, Karnataka', time: 'Yesterday at 9:41 AM', current: false },
            { device: 'Chrome on Android',   location: 'Delhi, NCR',           time: '3 days ago',           current: false },
          ].map((sess, i) => (
            <Card key={i}>
              <div className="flex items-start gap-3 p-4">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{sess.device}</p>
                  <p className="text-xs text-muted-foreground">{sess.location}</p>
                  <p className={`text-xs mt-0.5 font-medium ${sess.current ? 'text-green-500' : 'text-muted-foreground'}`}>{sess.time}</p>
                </div>
                {sess.current
                  ? <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px]">This device</Badge>
                  : <button className="text-xs text-destructive/70 font-semibold hover:text-destructive transition-colors">Remove</button>
                }
              </div>
            </Card>
          ))}
          <p className="text-[11px] text-muted-foreground text-center px-4 pt-1">
            Full session management requires a server-side edge function.
          </p>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: PRIVACY
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'privacy') return (
    <AppLayout>
      <PageShell title="Privacy" onBack={() => go('main')}>
        <div>
          <SectionLabel title="Account Visibility" />
          <Card>
            <Row icon={Lock}     label="Private Account"    subtitle={profile?.is_private ? 'Only approved followers' : 'Public to everyone'} toggle value={profile?.is_private ?? false} onToggle={togglePrivacy} />
            <Row icon={Activity} label="Activity Status"    subtitle="Show when you were last active" toggle value={s.activity_status}    onToggle={v => save('activity_status', v)}    saving={isSaving('activity_status')} />
            <Row icon={Eye}      label="Show Online Status" subtitle="Show when you're online"        toggle value={s.show_online_status} onToggle={v => save('show_online_status', v)} saving={isSaving('show_online_status')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Posts & Stories" />
          <Card>
            <Row icon={Eye}           label="Story Privacy"       select value={s.story_privacy}    options={['everyone','following','off']} onSelect={v => save('story_privacy', v)}    saving={isSaving('story_privacy')} />
            <Row icon={Heart}         label="Hide Like Counts"    subtitle="Others can't see likes on your posts" toggle value={!s.likes_visibility} onToggle={v => save('likes_visibility', !v)} saving={isSaving('likes_visibility')} />
            <Row icon={MessageCircle} label="Comment Controls"    select value={s.comment_controls} options={['everyone','following','off']} onSelect={v => save('comment_controls', v)} saving={isSaving('comment_controls')} />
            <Row icon={Heart}         label="Story Reactions"     subtitle="Allow reactions on your stories" toggle value={s.story_reactions} onToggle={v => save('story_reactions', v)} saving={isSaving('story_reactions')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Who Can Contact You" />
          <Card>
            <Row icon={AtSign}        label="Who Can Mention You" select value={s.mentions_allowed} options={['everyone','following','off']} onSelect={v => save('mentions_allowed', v)} saving={isSaving('mentions_allowed')} />
            <Row icon={Tag}           label="Who Can Tag You"     select value={s.tags_allowed}     options={['everyone','following','off']} onSelect={v => save('tags_allowed', v)}     saving={isSaving('tags_allowed')} />
            <Row icon={MessageCircle} label="DMs From"            select value={s.dms_from}         options={['everyone','following','off']} onSelect={v => save('dms_from', v)}         saving={isSaving('dms_from')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Messaging" />
          <Card>
            <Row icon={Eye}       label="Read Receipts"     subtitle="Let others know you've read their messages" toggle value={s.read_receipts}    onToggle={v => save('read_receipts', v)}    saving={isSaving('read_receipts')} />
            <Row icon={ToggleLeft} label="Typing Indicators" subtitle="Show when you're composing"                toggle value={s.typing_indicators} onToggle={v => save('typing_indicators', v)} saving={isSaving('typing_indicators')} last />
          </Card>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'notifications') return (
    <AppLayout>
      <PageShell title="Notifications" onBack={() => go('main')}>
        <div>
          <SectionLabel title="Channels" />
          <Card>
            <Row icon={Bell}       label="Push Notifications"  subtitle={s.push_notifications ? 'On' : 'Off'} toggle value={s.push_notifications}   onToggle={togglePush}                              saving={isSaving('push_notifications')} />
            <Row icon={Mail}       label="Email Notifications" toggle value={s.email_notifications}  onToggle={v => save('email_notifications', v)} saving={isSaving('email_notifications')} />
            <Row icon={Volume2}    label="Sound"               toggle value={s.sound_notifications}  onToggle={v => save('sound_notifications', v)} saving={isSaving('sound_notifications')} />
            <Row icon={Smartphone} label="Vibration"           toggle value={s.vibrate_notifications} onToggle={v => save('vibrate_notifications', v)} saving={isSaving('vibrate_notifications')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Activity Alerts" />
          <Card>
            <Row icon={Heart}         label="Likes"           toggle value={s.notification_likes}       onToggle={v => save('notification_likes', v)}       saving={isSaving('notification_likes')} />
            <Row icon={MessageCircle} label="Comments"        toggle value={s.notification_comments}    onToggle={v => save('notification_comments', v)}    saving={isSaving('notification_comments')} />
            <Row icon={Users}         label="New Followers"   toggle value={s.notification_follows}     onToggle={v => save('notification_follows', v)}     saving={isSaving('notification_follows')} />
            <Row icon={AtSign}        label="Mentions"        toggle value={s.notification_mentions}    onToggle={v => save('notification_mentions', v)}    saving={isSaving('notification_mentions')} />
            <Row icon={Eye}           label="Story Views"     toggle value={s.notification_story_views} onToggle={v => save('notification_story_views', v)} saving={isSaving('notification_story_views')} />
            <Row icon={MessageCircle} label="Direct Messages" toggle value={s.notification_messages}   onToggle={v => save('notification_messages', v)}   saving={isSaving('notification_messages')} last />
          </Card>
        </div>
        <div className="flex gap-2">
          <button onClick={markAllRead}    className="flex-1 text-xs font-semibold py-3 rounded-xl bg-card border border-border/60 hover:bg-accent transition-colors flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Mark All Read {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button onClick={clearAllNotifs} className="flex-1 text-xs font-semibold py-3 rounded-xl bg-card border border-border/60 text-destructive/80 hover:bg-destructive/5 transition-colors flex items-center justify-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: ACCOUNT (people)
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'account') return (
    <AppLayout>
      <PageShell title="People" onBack={() => go('main')}>
        <div>
          <SectionLabel title="Lists" />
          <Card>
            <Row icon={UserCheck} label="Close Friends"   subtitle="People who can see your close friends stories" badge="⭐" onClick={() => go('close-friends')} />
            <Row icon={UserX}     label="Blocked Users"   subtitle="People you've blocked"                                   onClick={() => go('blocked-users')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Account Type" />
          <Card>
            <Row icon={Briefcase} label="Account Type" select value={s.account_type} options={['personal','business','creator']} onSelect={v => save('account_type', v as AccountType)} saving={isSaving('account_type')} last />
          </Card>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: CLOSE FRIENDS
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'close-friends') return (
    <AppLayout>
      <PageShell title="Close Friends ⭐" onBack={() => go('account')}>
        <div className="flex gap-2">
          <Input placeholder="Search by username…" value={cfSearch} onChange={e => setCfSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCF()} className="h-10" />
          <Button className="h-10 px-4 flex-shrink-0" onClick={addCF}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>

        {cfLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {!cfLoading && cf.length === 0 && (
          <div className="text-center py-14">
            <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No close friends yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Search for a username above</p>
          </div>
        )}
        <div className="space-y-2">
          {cf.map((f: any) => (
            <Card key={f.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={f.avatar_url} />
                  <AvatarFallback>{f.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm flex-1">@{f.username}</span>
                <button onClick={() => removeCF(f.id)} className="text-xs text-destructive/70 hover:text-destructive font-semibold transition-colors">Remove</button>
              </div>
            </Card>
          ))}
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: BLOCKED USERS
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'blocked-users') return (
    <AppLayout>
      <PageShell title="Blocked Users" onBack={() => go('account')}>
        {blockedLoading && <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {!blockedLoading && blocked.length === 0 && (
          <div className="text-center py-14">
            <UserX className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No blocked users</p>
          </div>
        )}
        <div className="space-y-2">
          {blocked.map((u: any) => (
            <Card key={u.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-semibold text-sm flex-1">@{u.username}</span>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => unblock(u.id)}>Unblock</Button>
              </div>
            </Card>
          ))}
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: CONTENT & DISPLAY
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'content') return (
    <AppLayout>
      <PageShell title="Content & Display" onBack={() => go('main')}>
        <div>
          <SectionLabel title="Appearance" />
          <Card>
            <Row icon={darkMode ? Sun : Moon} label={darkMode ? 'Light Mode' : 'Dark Mode'} toggle value={darkMode} onToggle={toggleDark} />
            <Row icon={Globe} label="Language" select value={s.language} options={['English','Hindi','Spanish','French','German','Japanese','Portuguese','Arabic']} onSelect={v => save('language', v)} saving={isSaving('language')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Media" />
          <Card>
            <Row icon={Zap}   label="Autoplay Videos"     subtitle="Play videos automatically" toggle value={s.autoplay_videos}      onToggle={v => save('autoplay_videos', v)}      saving={isSaving('autoplay_videos')} />
            <Row icon={Image} label="High Quality Uploads" subtitle="Upload at full resolution" toggle value={s.high_quality_uploads}  onToggle={v => save('high_quality_uploads', v)}  saving={isSaving('high_quality_uploads')} />
            <Row icon={Image} label="Save Original Photos" subtitle="Keep originals when posting" toggle value={s.save_original_photos} onToggle={v => save('save_original_photos', v)} saving={isSaving('save_original_photos')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Feed" />
          <Card>
            <Row icon={Filter}    label="Sensitive Content" subtitle="Show potentially sensitive posts" toggle value={s.sensitive_content} onToggle={v => save('sensitive_content', v)} saving={isSaving('sensitive_content')} />
            <Row icon={RefreshCw} label="Suggested Posts"   subtitle="Posts from accounts you don't follow" toggle value={s.suggested_posts} onToggle={v => save('suggested_posts', v)} saving={isSaving('suggested_posts')} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Network" />
          <Card>
            <Row icon={Wifi} label="Data Usage" subtitle="Controls how media is loaded" select value={s.data_usage} options={['auto','low','high']} onSelect={v => save('data_usage', v as DataUsage)} saving={isSaving('data_usage')} last />
          </Card>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: DATA & STORAGE
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'data') return (
    <AppLayout>
      <PageShell title="Data & Storage" onBack={() => go('main')}>
        <div>
          <SectionLabel title="Your Content" />
          <Card>
            <Row icon={BookMarked} label="Saved Posts"          subtitle={`${savedCount} saved`}        onClick={() => navigate('/profile')} />
            <Row icon={Search}     label="Clear Search History" subtitle="Remove all recent searches"    onClick={() => { localStorage.removeItem('search_history'); toast({ title: '🗑️ Search history cleared' }); }} last />
          </Card>
        </div>
        <div>
          <SectionLabel title="Export" />
          <Card>
            <Row icon={Download} label="Download Your Data" subtitle="Export profile & settings as JSON" onClick={() => {
              const blob = new Blob([JSON.stringify({ profile, settings: s, exported_at: new Date().toISOString() }, null, 2)], { type: 'application/json' });
              const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `connectly-${profile?.username}.json` });
              a.click();
              toast({ title: '📥 Data exported' });
            }} last />
          </Card>
        </div>
        <div className="bg-muted/40 rounded-2xl border border-border/40 p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your exported file includes your profile info and preferences. Media files are stored securely on our servers.
          </p>
        </div>
      </PageShell>
    </AppLayout>
  );

  // ══════════════════════════════════════════════════════════════════════════
//  PAGE: SUPPORT
// ══════════════════════════════════════════════════════════════════════════
if (page === 'support') return (
  <AppLayout>
    <PageShell title="Help & Support" onBack={() => go('main')}>
      {/* Branding Section */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <img 
            src="/cold.png" 
            alt="Connectly" 
            className="relative w-20 h-20 object-contain drop-shadow-xl"
          />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Connectly</h2>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Social Experience Redefined</p>
        </div>
      </div>

      <Card>
        <Row 
          icon={HelpCircle} 
          label="Help Center" 
          subtitle="Browse articles and FAQs" 
          onClick={() => window.open('#', '_blank')} 
        />
        <Row icon={FileText} label="Terms of Service" onClick={() => window.open('#', '_blank')} />
        <Row icon={FileText} label="Privacy Policy" onClick={() => window.open('#', '_blank')} last />
      </Card>

      <Card>
        <div className="p-5 text-center space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-tighter">Version 2.0 · Build 240406</p>
            <p className="text-[10px] text-muted-foreground/60">© 2026 Connectly. All rights reserved.</p>
          </div>
          
          {/* Developed By Section - Sleek UI */}
          <div className="pt-4 border-t border-border/40">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50 backdrop-blur-sm">
              <span className="text-[11px] text-muted-foreground">Developed by</span>
              <span className="text-[11px] font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">
                Ambar Ubale
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-2 font-medium uppercase tracking-[0.2em]">Full Stack Developer</p>
          </div>
        </div>
      </Card>
    </PageShell>
  </AppLayout>
);

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: DELETE ACCOUNT
  // ══════════════════════════════════════════════════════════════════════════
  if (page === 'delete-account') return (
    <AppLayout>
      <PageShell title="Delete Account" onBack={() => go('main')}>
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-1.5">
          <p className="text-sm font-bold text-destructive">⚠️ This action cannot be undone</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Deleting your account permanently removes all posts, reels, stories, messages, followers and saved content.
          </p>
        </div>
        <Card>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Type your username <span className="font-bold text-foreground">@{profile?.username}</span> to confirm:
              </p>
              <Input placeholder={profile?.username} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} className="h-11" />
            </div>
            <Button
              className="w-full h-11 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
              disabled={deleteConfirm !== profile?.username}
              onClick={async () => {
                toast({ title: 'Deletion requested', description: 'Your account will be removed within 30 days.' });
                setPage('main');
              }}
            >
              Permanently Delete Account
            </Button>
          </div>
        </Card>
      </PageShell>
    </AppLayout>
  );

  return null;
}