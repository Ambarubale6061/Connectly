import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import CreatePost from "./pages/CreatePost";
import PostDetail from "./pages/PostDetail";
import Search from "./pages/Search";
import Explore from "./pages/Explore";
import Notifications from "./pages/Notifications";
import Reels from "./pages/Reels";
import CreateReel from "./pages/CreateReel";
import Messages from "./pages/Messages";
import ChatRoom from "./pages/ChatRoom";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { StoriesManager } from './pages/StoriesManager';
import CreateStory from './pages/CreateStory';

const queryClient = new QueryClient();

function ThemeInit() {
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ThemeInit />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile/:id" element={<Profile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/create" element={<CreatePost />} />
            <Route path="/create-reel" element={<CreateReel />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/search" element={<Search />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/reels" element={<Reels />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/stories" element={<StoriesManager />} />
            <Route path="/create-story" element={<CreateStory />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
