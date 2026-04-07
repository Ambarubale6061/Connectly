import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, User, AtSign, Code2 } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, full_name: fullName } },
        });
        if (error) throw error;
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[#020617]">
      
      {/* --- LIGHT NAVY BLUE CLOUDS BACKGROUND --- */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Soft Navy Cloud 1 */}
        <motion.div 
          animate={{ 
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[80%] h-[70%] rounded-full bg-blue-900/20 blur-[140px]" 
        />
        {/* Soft Navy Cloud 2 */}
        <motion.div 
          animate={{ 
            x: [0, -40, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-5%] w-[70%] h-[60%] rounded-full bg-slate-800/30 blur-[130px]" 
        />
        {/* Central Ambient Glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-black/40" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-[420px] z-10"
      >
        {/* --- MAIN GLASS CARD --- */}
        <div className="relative group">
          {/* Subtle Outer Glow */}
          <div className="absolute -inset-1 bg-blue-500/10 rounded-[40px] blur-2xl group-hover:bg-blue-500/20 transition duration-1000"></div>
          
          <div className="relative bg-[#0f172a]/40 backdrop-blur-[40px] border border-white/10 rounded-[36px] p-8 md:p-10 shadow-2xl">
            
            {/* Logo Section */}
            <div className="flex justify-center mb-10">
              <motion.img 
                src="/lo.png" 
                alt="Logo" 
                className="h-28 w-auto drop-shadow-2xl"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="bg-white/5 border-white/5 pl-12 h-12 rounded-2xl text-white focus:bg-white/10 focus:border-blue-500/50 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <AtSign className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                      <Input
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        className="bg-white/5 border-white/5 pl-12 h-12 rounded-2xl text-white focus:bg-white/10 focus:border-blue-500/50 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/5 border-white/5 pl-12 h-12 rounded-2xl text-white focus:bg-white/10 focus:border-blue-500/50 transition-all"
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-white/5 pl-12 pr-12 h-12 rounded-2xl text-white focus:bg-white/10 focus:border-blue-500/50 transition-all"
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-slate-500 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center font-medium bg-red-500/10 py-2.5 rounded-xl border border-red-500/20">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FFB800] to-[#FF8A00] text-white font-bold text-lg hover:shadow-[0_0_25px_rgba(255,184,0,0.4)] transition-all active:scale-[0.98] mt-4"
              >
                {loading ? 'Wait a moment...' : isLogin ? 'Login' : 'Join Connectly'}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-slate-400 text-sm hover:text-white transition-colors font-medium"
              >
                {isLogin ? "New to Connectly? " : "Already have an account? "}
                <span className="text-white font-bold underline underline-offset-4 ml-1">
                  {isLogin ? 'Sign up' : 'Sign in'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* --- PERSONALIZED FOOTER --- */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2 text-slate-500 text-[11px] tracking-[0.25em] uppercase font-medium">
          <Code2 size={14} className="text-blue-500" />
          Developed by <span className="text-slate-300">Ambar Ubale</span>
        </div>
        <div className="text-[9px] text-slate-600 tracking-[0.1em] uppercase">
          Full Stack Developer
        </div>
      </motion.div>
    </div>
  );
}