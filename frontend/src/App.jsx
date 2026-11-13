import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { useLocation, useNavigate } from 'react-router-dom';
import RouteStateMiddleware from './routes/RouteStateMiddleware';
import { buildPath } from './routes/appRoutes';
import {
  TopNav as AppTopNav,
  SidebarLeft as AppSidebarLeft,
  SidebarRight as AppSidebarRight,
  MobileNav as AppMobileNav,
} from './components/AppChrome';
import AppPostCard from './components/PostCard';
import {
  BookmarksView as AppBookmarksView,
  ExploreView as AppExploreView,
  FriendsView as AppFriendsView,
  GroupInviteView as AppGroupInviteView,
  MessagesView as AppMessagesView,
  ProfileView as AppProfileView,
  SearchResultsView as AppSearchResultsView,
} from './pages/AppViews';
import { 
  Plus,
  Video,
  Search,
  MessageSquarePlus,
  Camera,
  UploadCloud,
  Square,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  UserPlus,
  BookOpen,
  MessageCircle,
  MoreHorizontal,
  Flag,
  Heart,
  Send,
  Smile,
  X,
  Bookmark,
  MessageSquare,
  PenTool,
  Home,
  Compass,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { socketUrl } from './services/backend';
import { getMediaFileError } from './utils/mediaFiles';
import { createPost, deleteUploadedMedia, fetchPosts, notifyPostsChanged, subscribeToPostsChanged, uploadPostMedia } from './services/postsApi';
import {
  fetchConversations,
  fetchUsers,
  clearAuthState,
  getAuthSession,
  readCurrentUser,
  readToken,
  subscribeToConversationsChanged,
  subscribeToUsersChanged,
  updateUser,
  writeCurrentUser,
} from './services/mongoApi';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';

const STORY_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const POST_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;

const revokeObjectUrl = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

const inferMediaType = (mimeType = '', url = '') => {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (url.startsWith('data:video') || /\.(mp4|webm|ogg)$/i.test(url)) return 'video';
  return 'image';
};

const compressImageBlob = (fileOrBlob, maxWidth = 1600, quality = 0.82) =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new window.Image();

    img.onload = () => {
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          resolve(blob || fileOrBlob);
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(fileOrBlob);
    };

    img.src = objectUrl;
  });

const prepareUploadBlob = async (fileOrBlob, type) => {
  if (type === 'image') {
    if (fileOrBlob?.type?.toLowerCase() === 'image/gif') return fileOrBlob;
    return compressImageBlob(fileOrBlob);
  }
  return fileOrBlob;
};

function ClustrLoader() {
  const canvasRef = useRef(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = [
    'connecting your stars',
    'mapping your cluster',
    'finding your people',
    'opening your network',
    'building your circle',
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = window.devicePixelRatio || 1;
    const width = 240;
    const height = 240;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cx = 125;
    const cy = 120;
    const radius = 88;
    const openDeg = 42;
    const span = 360 - 2 * openDeg;
    const nodeCount = 10;
    const toRad = (deg) => deg * Math.PI / 180;

    const nodes = Array.from({ length: nodeCount }, (_, index) => {
      const fraction = index / (nodeCount - 1);
      const deg = -openDeg - fraction * span;
      const x = cx + radius * Math.cos(toRad(deg));
      const y = cy + radius * Math.sin(toRad(deg));
      const nodeRadius = (index === 0 || index === nodeCount - 1)
        ? 11
        : (index === Math.round((nodeCount - 1) / 2))
          ? 11
          : (index === 2 || index === 7)
            ? 7.5
            : 6;

      return { x, y, r: nodeRadius, t: fraction };
    });

    const connections = [
      [0, 2], [1, 3], [0, 3],
      [3, 5], [4, 6],
      [6, 8], [7, 9], [6, 9],
      [2, 5], [4, 7],
    ];

    const lerpColor = (t) => {
      const stops = [
        [0x1e, 0xcf, 0xff],
        [0x70, 0x33, 0xee],
        [0xd0, 0x40, 0xe8],
      ];
      const scaled = t * 2;
      const stopIndex = Math.min(Math.floor(scaled), 1);
      const factor = scaled - stopIndex;
      const start = stops[stopIndex];
      const end = stops[stopIndex + 1];

      return [
        Math.round(start[0] + (end[0] - start[0]) * factor),
        Math.round(start[1] + (end[1] - start[1]) * factor),
        Math.round(start[2] + (end[2] - start[2]) * factor),
      ];
    };

    const rgba = (t, alpha) => {
      const [r, g, b] = lerpColor(t);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    const arcDuration = 1200;
    const nodeStart = 200;
    const nodeGap = 220;
    const connectionDelay = 80;
    const connectionDuration = 320;
    const ringDuration = 500;

    const nodeTime = (index) => nodeStart + index * nodeGap;
    const connectionTime = (a, b) => Math.max(nodeTime(a), nodeTime(b)) + connectionDelay;
    const totalDuration = nodeTime(nodeCount - 1) + 1500;

    const easeOut = (t) => 1 - (1 - t) ** 3;
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);
    const spring = (t) => {
      if (t >= 1) return 1;
      return 1 - Math.exp(-8 * t) * Math.cos(12 * t);
    };

    const drawArc = (progress) => {
      const totalRad = toRad(span);
      const drawn = totalRad * progress;
      const steps = 160;
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;

      for (let index = 0; index < steps; index += 1) {
        const t0 = index / steps;
        const t1 = (index + 1) / steps;
        if (t0 * totalRad > drawn) break;

        const a0 = toRad(-openDeg) - t0 * totalRad;
        const a1 = toRad(-openDeg) - Math.min(t1 * totalRad, drawn);
        const [r, g, b] = lerpColor(t0);
        ctx.strokeStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, a0, a1, true);
        ctx.stroke();
      }
    };

    const drawConnection = (a, b, progress) => {
      const start = nodes[a];
      const end = nodes[b];
      const x2 = start.x + (end.x - start.x) * progress;
      const y2 = start.y + (end.y - start.y) * progress;
      const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
      gradient.addColorStop(0, rgba(start.t, 0.55));
      gradient.addColorStop(1, rgba(end.t, 0.55));
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.stroke();
    };

    const drawNode = (node, progress, ringProgress) => {
      const { x, y, r, t } = node;
      const [nr, ng, nb] = lerpColor(t);

      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 2.8);
      halo.addColorStop(0, `rgba(${nr},${ng},${nb},0.13)`);
      halo.addColorStop(1, `rgba(${nr},${ng},${nb},0)`);
      ctx.beginPath();
      ctx.arc(x, y, r * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = halo;
      ctx.fill();

      if (ringProgress < 1) {
        const rippleRadius = r + r * 1.7 * ringProgress;
        ctx.beginPath();
        ctx.arc(x, y, rippleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${nr},${ng},${nb},${0.6 * (1 - ringProgress)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      const scaledRadius = r * Math.min(spring(progress * 1.1), 1.1);
      ctx.beginPath();
      ctx.arc(x, y, scaledRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${nr},${ng},${nb})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, scaledRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    };

    let frameId;
    let startTime = null;

    const render = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) % totalDuration;
      ctx.clearRect(0, 0, width, height);

      drawArc(easeInOut(Math.min(elapsed / arcDuration, 1)));

      connections.forEach(([a, b]) => {
        const startAt = connectionTime(a, b);
        if (elapsed < startAt) return;
        drawConnection(a, b, easeOut(Math.min((elapsed - startAt) / connectionDuration, 1)));
      });

      nodes.forEach((node, index) => {
        const startAt = nodeTime(index);
        if (elapsed < startAt) return;
        drawNode(
          node,
          Math.min((elapsed - startAt) / 500, 1),
          Math.min((elapsed - startAt) / ringDuration, 1),
        );
      });

      frameId = window.requestAnimationFrame(render);
    };

    frameId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % messages.length);
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [messages.length]);

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(30,207,255,0.08),_transparent_35%),linear-gradient(180deg,_#09111b_0%,_#0c0c0c_100%)] font-sans text-white">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="clustr-loader-wrap">
          <canvas
            ref={canvasRef}
            className="clustr-loader-stage"
            style={{ width: 240, height: 240 }}
          />
          <div className="clustr-loader-label">
            <span className="clustr-loader-brand">clustr</span>
            <div className="clustr-loader-sub">
              <span
                className="transition-opacity duration-300"
                key={messageIndex}
              >
                {messages[messageIndex]}
              </span>
              <span className="clustr-loader-cursor" />
            </div>
            <div className="clustr-loader-pips">
              <div className="clustr-loader-pip clustr-loader-p1" />
              <div className="clustr-loader-pip clustr-loader-p2" />
              <div className="clustr-loader-pip clustr-loader-p3" />
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes clustrFloatY { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
            @keyframes clustrBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
            @keyframes clustrPip { 0%, 100% { transform: scale(1); opacity: .45; } 50% { transform: scale(1.5); opacity: 1; } }
            .clustr-loader-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2.8rem 1rem 2.2rem; min-height: 340px; gap: 1.8rem; }
            .clustr-loader-stage { display: block; animation: clustrFloatY 5s ease-in-out infinite; }
            .clustr-loader-label { display: flex; flex-direction: column; align-items: center; gap: 7px; }
            .clustr-loader-brand { font-size: 22px; font-weight: 500; letter-spacing: .1em; color: rgba(255,255,255,0.96); text-transform: lowercase; }
            .clustr-loader-sub { min-height: 18px; display: flex; align-items: center; gap: 3px; font-size: 12px; color: rgba(255,255,255,0.56); text-transform: lowercase; }
            .clustr-loader-cursor { display: inline-block; width: 1px; height: 11px; background: rgba(255,255,255,0.56); animation: clustrBlink 1s step-end infinite; }
            .clustr-loader-pips { display: flex; gap: 6px; margin-top: 2px; }
            .clustr-loader-pip { width: 5px; height: 5px; border-radius: 9999px; }
            .clustr-loader-p1 { background: #1ecfff; animation: clustrPip 1.8s ease-in-out infinite; }
            .clustr-loader-p2 { background: #8040f0; animation: clustrPip 1.8s ease-in-out infinite; animation-delay: .3s; }
            .clustr-loader-p3 { background: #d040e8; animation: clustrPip 1.8s ease-in-out infinite; animation-delay: .6s; }
          `,
        }}
      />
    </div>
  );
}

export default function SkillNet() {
  const navigate = useNavigate();
  const location = useLocation();
  const transferParams = new URLSearchParams(location.search);
  const requestedReturnTo = transferParams.get('returnTo') || '';
  const safeReturnTo = /^\/invite\/[a-f\d]{64}$/i.test(requestedReturnTo) ? requestedReturnTo : null;
  const isAuthRoute = location.pathname === '/auth';
  const [user, setUser] = useState(null);
  
  const [authLoaded, setAuthLoaded] = useState(false);
  const [minLoadTimePassed, setMinLoadTimePassed] = useState(true);
  const [postAuthLoading, setPostAuthLoading] = useState(false);
  
  const [darkMode, setDarkMode] = useState(false); 
  const [currentView, setCurrentView] = useState('home'); 
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [messageThreads, setMessageThreads] = useState([]);
  const [selectedChatUserId, setSelectedChatUserId] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);
  const socketRef = useRef(null);
  const socketContextRef = useRef({ user: null, usersInfo: {} });
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [presenceMap, setPresenceMap] = useState({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [feedFilter, setFeedFilter] = useState('all'); 
  const [feedSort, setFeedSort] = useState('following');
  
  const [posts, setPosts] = useState([]);
  const [usersInfo, setUsersInfo] = useState({}); 

  useEffect(() => {
    socketContextRef.current = { user, usersInfo };
  }, [user, usersInfo]);

  useEffect(() => {
    if (!postAuthLoading) return;

    setMinLoadTimePassed(false);
    const timer = setTimeout(() => {
      setMinLoadTimePassed(true);
      setPostAuthLoading(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [postAuthLoading]);
  
  useEffect(() => {
    let active = true;
    const syncAuthSession = async () => {
      try {
        const currentUser = await getAuthSession();
        if (!active) return;
        const cachedUser = readCurrentUser();
        if (JSON.stringify(cachedUser) !== JSON.stringify(currentUser)) {
          writeCurrentUser(currentUser);
        }
        setUser((previousUser) => JSON.stringify(previousUser) === JSON.stringify(currentUser) ? previousUser : currentUser);
      } catch (error) {
        if (!active) return;
        setUser(null);
        if (error.status !== 401) {
          console.error('Authentication session check failed:', error);
        }
      } finally {
        if (active) setAuthLoaded(true);
      }
    };

    const syncFromStorage = (event) => {
      if (event.key !== 'clustr:current-user' && event.key !== 'clustr:token') return;
      if (!event.newValue) {
        setUser(null);
        return;
      }
      syncAuthSession();
    };

    const unsubscribe = subscribeToUsersChanged(syncAuthSession);
    const syncLocalAuthChange = (event) => {
      if (event.detail?.loggedOut) {
        setUser(null);
      } else {
        syncAuthSession();
      }
    };
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('clustr:auth-changed', syncLocalAuthChange);
    const intervalId = window.setInterval(syncAuthSession, 3000);
    syncAuthSession();

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('clustr:auth-changed', syncLocalAuthChange);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authLoaded) return;

    if (!user && !isAuthRoute) {
      if (location.pathname === '/') return;
      const invitationPath = /^\/invite\/[a-f\d]{64}$/i.test(location.pathname) ? location.pathname : null;
      navigate(invitationPath ? `/auth?returnTo=${encodeURIComponent(invitationPath)}` : '/auth', { replace: true });
      return;
    }

    if (user && isAuthRoute && !safeReturnTo) {
      navigate(buildPath('profile', { profileId: user.uid }), { replace: true });
    }
  }, [authLoaded, user, isAuthRoute, safeReturnTo, location.pathname, navigate]);

  useEffect(() => {
    if (!user) return;

    const loadUsers = async () => {
      try {
        const users = await fetchUsers();
      const usersMap = {};
        users.forEach((profile) => {
          usersMap[profile.uid] = profile;
      });
      setUsersInfo(usersMap);
      } catch (err) {
        console.error("Users fetch error:", err);
      }
    };

    const loadPosts = async () => {
      try {
        const postsData = await fetchPosts();
        setPosts(postsData);
      } catch (err) {
        console.error('Posts fetch error:', err);
      }
    };

    loadUsers();
    loadPosts();
    const unsubscribeUsers = subscribeToUsersChanged(loadUsers);
    const unsubscribePostEvents = subscribeToPostsChanged(loadPosts);

    return () => {
      unsubscribeUsers();
      unsubscribePostEvents();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMessageThreads([]);
      return;
    }

    const loadConversations = async () => {
      try {
        const threads = await fetchConversations(user.uid);
        setMessageThreads(threads.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
      } catch (err) {
        console.error('Conversations fetch error:', err);
      }
    };

    loadConversations();
    return subscribeToConversationsChanged(loadConversations);
  }, [user]);

  useEffect(() => {
    if (isAuthRoute) return;

    const nextPath = buildPath(currentView, {
      profileId: selectedProfileId,
      searchQuery,
      chatUserId: selectedChatUserId,
      inviteToken,
    });

    const currentUrl = `${location.pathname}${location.search}`;
    if (nextPath !== currentUrl) {
      navigate(nextPath, { replace: true });
    }
  }, [currentView, selectedProfileId, searchQuery, selectedChatUserId, inviteToken, navigate, location.pathname, location.search, isAuthRoute]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setSocketConnected(false);
      setSocketError('');
      setMessageThreads([]);
      return;
    }

    if (!socketRef.current) {
      const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: (callback) => callback({ token: readToken() }),
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socketRef.current = socket;
      setSocket(socket);

      const emitRegister = () => {
        const activeUser = socketContextRef.current.user;
        if (!activeUser) return;
        const userData = socketContextRef.current.usersInfo[activeUser.uid] || {};
        socket.emit('register', {
          userId: activeUser.uid,
          following: userData.following || [],
          followers: userData.followers || [],
        });
      };

      socket.on('connect', () => {
        console.log('[Socket] Connected');
        setSocketConnected(true);
        setSocketError('');
        emitRegister();
      });

      socket.on('conversations:init', (data) => {
        console.log('[Socket] Conversations initialized:', data);
        if (Array.isArray(data?.threads)) {
          setMessageThreads(data.threads.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
        }
      });

      socket.on('conversation:update', (updatedThread) => {
        console.log('[Socket] Conversation updated:', updatedThread);
        setMessageThreads((currentThreads) => {
          const nextThreads = currentThreads.filter((thread) => thread.id !== updatedThread.id);
          return [updatedThread, ...nextThreads].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        });
      });

      socket.on('conversation:removed', ({ id }) => {
        if (!id) return;
        setMessageThreads((currentThreads) => currentThreads.filter((thread) => thread.id !== id));
        setSelectedChatUserId((currentSelection) => currentSelection === id ? null : currentSelection);
      });

      socket.on('message:confirmation', (data) => {
        console.log('[Socket] Message confirmation:', data);
      });

      socket.on('presence:state', (state) => {
        if (!state || typeof state !== 'object') return;
        setPresenceMap((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(state).map(([userId, online]) => [userId, Boolean(online)])),
        }));
      });

      socket.on('presence:update', ({ userId, online }) => {
        if (!userId) return;
        setPresenceMap((current) => ({
          ...current,
          [userId]: Boolean(online),
        }));
      });

      socket.on('error:validation', (error) => {
        console.error('[Socket] Validation error:', error);
      });

      socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
        setSocketConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        setSocketConnected(false);
        setSocketError(error?.message || 'Unable to connect to chat server');
      });

      socket.on('auth:logout', () => {
        clearAuthState();
        setUser(null);
      });
    }

    return () => {
    };
  }, [user]);

  useEffect(() => {
    if (!user || !socketRef.current?.connected) return;
    const userData = usersInfo[user.uid] || {};
    socketRef.current.emit('register', {
      userId: user.uid,
      following: userData.following || [],
      followers: userData.followers || [],
    });
  }, [user, usersInfo]);

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log('[Socket] Disconnecting on unmount');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setSocketConnected(false);
      setSocketError('');
    };
  }, []);

  if (postAuthLoading || !minLoadTimePassed) {
    return <ClustrLoader />;
  }

  if (!authLoaded) {
    return <ClustrLoader />;
  }

  if (!user && !isAuthRoute) {
    if (location.pathname === '/') {
      return <LandingPage onLogin={() => navigate('/auth')} />;
    }
    return null;
  }

  if (isAuthRoute) {
    return (
      <AuthPage
        onBack={() => navigate('/')}
        onContinue={(signedInUser, context = {}) => {
          const destination = safeReturnTo || buildPath('profile', { profileId: signedInUser?.uid || null });
          setUser(signedInUser);
          writeCurrentUser(signedInUser);
          if (safeReturnTo) {
            setInviteToken(safeReturnTo.split('/').pop());
            setSelectedChatUserId(null);
            setCurrentView('invite');
          } else {
            setSelectedProfileId(signedInUser?.uid || null);
            setCurrentView('profile');
          }

          if (context.mode === 'login' || context.mode === 'signup') {
            setPostAuthLoading(true);
            window.setTimeout(() => {
              navigate(destination, { replace: true });
            }, 2500);
            return;
          }

          navigate(destination, { replace: true });
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans animate-in fade-in duration-1000 ${darkMode ? 'dark bg-[#0f1020] text-slate-200' : 'bg-[#f5f7ff] text-[#1d2342]'}`}>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className={`absolute inset-0 ${darkMode ? 'bg-[radial-gradient(circle_at_top,_rgba(34,199,245,0.14),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.16),_transparent_28%),linear-gradient(180deg,_#0f1020_0%,_#14172d_100%)]' : 'bg-[radial-gradient(circle_at_top,_rgba(34,199,245,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(96,165,250,0.12),_transparent_26%),linear-gradient(180deg,_#f8faff_0%,_#eef2ff_100%)]'}`}></div>
      </div>
      <RouteStateMiddleware
        setCurrentView={setCurrentView}
        setSelectedProfileId={setSelectedProfileId}
        setSelectedChatUserId={setSelectedChatUserId}
        setSearchQuery={setSearchQuery}
        setInviteToken={setInviteToken}
      />
      
      <AppTopNav 
        darkMode={darkMode} setDarkMode={setDarkMode} user={user} usersInfo={usersInfo} 
        setCurrentView={setCurrentView} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        setSelectedProfileId={setSelectedProfileId}
        posts={posts}
      />

      <div className="max-w-[1440px] mx-auto flex justify-center gap-6 px-4 pt-[80px] relative">
        
        <AppSidebarLeft 
          currentView={currentView} setCurrentView={setCurrentView} user={user} usersInfo={usersInfo} posts={posts}
          setSelectedProfileId={setSelectedProfileId}
        />

        <main className="flex-1 max-w-[680px] w-full min-h-screen pb-28 md:pb-8">
          <AnimatePresence mode="wait">
          {currentView === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <StoriesCarousel user={user} usersInfo={usersInfo} />
              <CreatePost user={user} usersInfo={usersInfo} />
              <FeedFilters
                feedFilter={feedFilter}
                setFeedFilter={setFeedFilter}
                feedSort={feedSort}
                setFeedSort={setFeedSort}
              />
              <Feed
                posts={posts}
                user={user}
                usersInfo={usersInfo}
                feedFilter={feedFilter}
                feedSort={feedSort}
                searchQuery={searchQuery}
                setCurrentView={setCurrentView}
                setSelectedProfileId={setSelectedProfileId}
              />
            </motion.div>
          )}

          {currentView === 'invite' && (
            <motion.div key="invite" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <AppGroupInviteView
                token={inviteToken}
                user={user}
                setCurrentView={setCurrentView}
                setSelectedChatUserId={setSelectedChatUserId}
                setMessageThreads={setMessageThreads}
              />
            </motion.div>
          )}

          {currentView === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AppProfileView
              user={user}
              usersInfo={usersInfo}
              posts={posts}
              selectedProfileId={selectedProfileId}
              setCurrentView={setCurrentView}
              setSelectedProfileId={setSelectedProfileId}
              setSelectedChatUserId={setSelectedChatUserId}
            />
            </motion.div>
          )}

          {currentView === 'explore' && (
            <motion.div key="explore" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AppExploreView setSearchQuery={setSearchQuery} setCurrentView={setCurrentView} />
            </motion.div>
          )}

          {currentView === 'search' && (
            <motion.div key="search" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AppSearchResultsView
              searchQuery={searchQuery}
              posts={posts}
              usersInfo={usersInfo}
              user={user}
              setCurrentView={setCurrentView}
              setSelectedProfileId={setSelectedProfileId}
            />
            </motion.div>
          )}

          {currentView === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AppFriendsView
              user={user}
              usersInfo={usersInfo}
              setCurrentView={setCurrentView}
              setSelectedProfileId={setSelectedProfileId}
              setSelectedChatUserId={setSelectedChatUserId}
            />
            </motion.div>
          )}

          {currentView === 'bookmarks' && (
            <motion.div key="bookmarks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AppBookmarksView user={user} usersInfo={usersInfo} posts={posts} />
            </motion.div>
          )}

          {currentView === 'messages' && (
            <motion.div key="messages" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            <AppMessagesView
              user={user}
              usersInfo={usersInfo}
              messageThreads={messageThreads}
              selectedChatUserId={selectedChatUserId}
              setSelectedChatUserId={setSelectedChatUserId}
              setCurrentView={setCurrentView}
              setSelectedProfileId={setSelectedProfileId}
              socket={socket}
              socketConnected={socketConnected}
              socketError={socketError}
              presenceMap={presenceMap}
              setMessageThreads={setMessageThreads}
            />
            </motion.div>
          )}
          </AnimatePresence>
        </main>


        <AppSidebarRight
          usersInfo={usersInfo}
          currentUser={user}
          setCurrentView={setCurrentView}
          setSelectedProfileId={setSelectedProfileId}
          messageThreads={messageThreads}
          setSelectedChatUserId={setSelectedChatUserId}
        />


        <AppMobileNav currentView={currentView} setCurrentView={setCurrentView} user={user} setSelectedProfileId={setSelectedProfileId} />
      </div>
    </div>
  );
}

function StoriesCarousel({ user, usersInfo }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStoryUrl, setNewStoryUrl] = useState('');
  const [newStoryFile, setNewStoryFile] = useState(null);
  const [newStoryType, setNewStoryType] = useState('');
  const [viewingStory, setViewingStory] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [localStory, setLocalStory] = useState(null);
  const localStoryUrlRef = useRef('');
  
  const [activeTab, setActiveTab] = useState('upload');
  const videoRef = useRef(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const currentUserData = usersInfo[user?.uid] || {};
  const isStoryValid = (timestamp) => timestamp && (Date.now() - timestamp < 24 * 60 * 60 * 1000);
  const activeLocalStory = localStory && isStoryValid(localStory.storyTimestamp) ? localStory : null;
  const displayCurrentUserData = activeLocalStory
    ? {
        ...currentUserData,
        currentStory: activeLocalStory.currentStory,
        currentStoryType: activeLocalStory.currentStoryType,
        storyTimestamp: activeLocalStory.storyTimestamp,
      }
    : currentUserData;
  const updateStoryPreview = (nextUrl, nextFile = null, nextType = '') => {
    setNewStoryUrl((currentUrl) => {
      revokeObjectUrl(currentUrl);
      return nextUrl;
    });
    setNewStoryFile(nextFile);
    setNewStoryType(nextType);
  };
  
  const startCamera = async () => {
    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStream(stream);
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Could not access camera. Please check your browser permissions or use the Upload option.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (showAddModal && activeTab === 'camera' && !newStoryUrl) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showAddModal, activeTab, newStoryUrl]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        updateStoryPreview(URL.createObjectURL(blob), blob, 'image');
        stopCamera();
      }, 'image/jpeg', 0.7);
    }
  };

  const startRecording = () => {
    if (!cameraStream) return;
    chunksRef.current = [];
    try {
      const mediaRecorder = new MediaRecorder(cameraStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        if (blob.size > STORY_UPLOAD_LIMIT_BYTES) {
          alert('Video is too large (Max 20MB). Try a shorter clip.');
          updateStoryPreview('', null, '');
          return;
        }
        updateStoryPreview(URL.createObjectURL(blob), blob, 'video');
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 4000);
    } catch (err) {
      console.error("Recording error:", err);
      alert("Video recording is not supported in this browser context.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopCamera();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formatError = getMediaFileError(file, { allowAttachments: false });
    if (formatError) {
      alert(formatError);
      return;
    }
    
    if (file.size > STORY_UPLOAD_LIMIT_BYTES) {
       alert("File is too large (Max 10MB). Please choose a smaller file.");
       return;
    }

    updateStoryPreview(URL.createObjectURL(file), file, inferMediaType(file.type));
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    updateStoryPreview('', null, '');
    setActiveTab('upload');
    setIsRecording(false);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopCamera();
  };

  const handleAddStory = async () => {
    if (!user || !newStoryFile) return;
    setIsAdding(true);
    try {
      const preparedStoryBlob = await prepareUploadBlob(newStoryFile, newStoryType);
      const storyFile = preparedStoryBlob instanceof File
        ? preparedStoryBlob
        : new File(
            [preparedStoryBlob],
            `story.${newStoryType === 'video' ? 'webm' : 'jpg'}`,
            { type: preparedStoryBlob.type || newStoryFile.type || (newStoryType === 'video' ? 'video/webm' : 'image/jpeg') },
                );
      let uploadedStory;
      try {
        uploadedStory = await uploadPostMedia(storyFile);

        const storyPayload = {
          currentStory: uploadedStory.url,
          currentStoryType: uploadedStory.mediaType || newStoryType || inferMediaType(newStoryFile.type, uploadedStory.url),
          storyTimestamp: Date.now(),
        };
        await updateUser(user.uid, storyPayload);
        setLocalStory(storyPayload);
        handleCloseModal();
      } catch (error) {
        if (uploadedStory?.mediaId) await deleteUploadedMedia(uploadedStory.mediaId).catch(() => {});
        throw error;
      }
    } catch (err) {
      console.error("Error adding story:", err);
      alert(err?.message || 'Could not add story. Please make sure the server is running and try again.');
    }
    setIsAdding(false);
  };

  const handleDeleteStory = async () => {
    if (!user) return;
    try {
      await updateUser(user.uid, {
        currentStory: null,
        currentStoryType: null,
        storyTimestamp: null
      });
      revokeObjectUrl(localStoryUrlRef.current);
      localStoryUrlRef.current = '';
      setLocalStory(null);
      setViewingStory(null);
    } catch (err) {
      console.error("Error deleting story:", err);
    }
  };

  useEffect(() => () => revokeObjectUrl(localStoryUrlRef.current), []);

  const dynamicStories = Object.values(usersInfo)
    .filter(u => u.uid !== user?.uid && u.currentStory && isStoryValid(u.storyTimestamp))
    .slice(0, 10)
    .map((u, i) => ({
      id: u.uid,
      name: u.displayName.substring(0, 10) + (u.displayName.length > 10 ? '...' : ''),
      avatar: u.photoURL,
      storyUrl: u.currentStory,
      mediaType: u.currentStoryType || inferMediaType('', u.currentStory || ''),
      color: ['border-blue-400', 'border-emerald-400', 'border-purple-400', 'border-orange-400'][i % 4]
    }));

  const hasMyStory = displayCurrentUserData.currentStory && isStoryValid(displayCurrentUserData.storyTimestamp);

  const stories = [
    { 
      id: 'add', 
      name: 'Your Story', 
      avatar: displayCurrentUserData.photoURL, 
      isAdd: !hasMyStory,
      storyUrl: displayCurrentUserData.currentStory,
      mediaType: displayCurrentUserData.currentStoryType || inferMediaType('', displayCurrentUserData.currentStory || ''),
      color: hasMyStory ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'
    },
    ...dynamicStories
  ];

  return (
    <>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-6 pt-2 snap-x">
        {stories.map((story) => (
          <div 
            key={story.id} 
            onClick={() => {
              if (story.id === 'add' && !hasMyStory) setShowAddModal(true);
              else if (story.storyUrl) setViewingStory(story);
            }}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer snap-start group"
          >
            <div className={`relative w-[60px] h-[70px] rounded-[20px] flex items-center justify-center bg-white dark:bg-slate-800 transition-transform ${story.id !== 'add' || hasMyStory ? `border-2 ${story.color}` : 'border border-slate-200 dark:border-slate-700'}`}>
               {story.storyUrl ? (
                 story.mediaType === 'video' ? (
                   <video src={story.storyUrl} muted playsInline className="w-[52px] h-[62px] rounded-[16px] object-cover bg-slate-100 dark:bg-slate-700" />
                 ) : (
                   <img src={story.storyUrl} className="w-[52px] h-[62px] rounded-[16px] object-cover bg-slate-100 dark:bg-slate-700" alt={story.name}/>
                 )
               ) : (
                 <img src={story.avatar} className="w-[52px] h-[62px] rounded-[16px] object-cover bg-slate-100 dark:bg-slate-700" alt={story.name}/>
               )}
               {story.isAdd && (
                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
                   <Plus size={12} className="text-white font-bold"/>
                 </div>
               )}
            </div>
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{story.name}</span>
          </div>
        ))}
      </div>


      <AnimatePresence>
      {showAddModal && (
        <motion.div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <motion.div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800" initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} transition={{ duration: 0.2 }}>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5">Create Story</h2>
            

            <div className="flex gap-2 mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} onClick={() => { setActiveTab('upload'); updateStoryPreview('', null, ''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-colors ${activeTab === 'upload' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <UploadCloud size={16} /> Upload Media
              </motion.button>
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} onClick={() => { setActiveTab('camera'); updateStoryPreview('', null, ''); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[13px] font-semibold transition-colors ${activeTab === 'camera' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <Camera size={16} /> Camera
              </motion.button>
            </div>


            <div className="min-h-[160px] flex flex-col justify-center mb-6">
              {activeTab === 'upload' && (
                <div className="flex flex-col items-center gap-4">
                  {newStoryUrl ? (
                    <div className="relative w-full max-h-[220px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {newStoryType === 'video' ? (
                         <video src={newStoryUrl} autoPlay loop playsInline className="max-h-[220px] object-contain" />
                      ) : (
                         <img src={newStoryUrl} alt="Preview" className="max-h-[220px] object-contain" />
                      )}
                      <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.95 }} onClick={() => updateStoryPreview('', null, '')} className="absolute top-2 right-2 bg-slate-900/60 p-1.5 rounded-full text-white hover:bg-slate-900/80 transition-colors z-10">
                        <X size={14} />
                      </motion.button>
                    </div>
                  ) : (
                    <label className="w-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:border-blue-500 dark:hover:bg-blue-500/10 transition-colors bg-slate-50 dark:bg-slate-800/50">
                      <UploadCloud size={32} className="text-blue-500" />
                      <span className="text-[14px] font-medium text-slate-600 dark:text-slate-400">Click to upload an image or video</span>
                      <span className="text-[11px] text-slate-400">JPG, PNG or MP4 (Max 20MB)</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
              )}

              {activeTab === 'camera' && (
                <div className="flex flex-col items-center gap-4 w-full">
                  {newStoryUrl ? (
                    <div className="relative w-full max-h-[250px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                      {newStoryType === 'video' ? (
                         <video src={newStoryUrl} autoPlay loop playsInline className="max-h-[250px] object-contain" />
                      ) : (
                         <img src={newStoryUrl} alt="Captured" className="max-h-[250px] object-contain" />
                      )}
                      <motion.button whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.95 }} onClick={() => updateStoryPreview('', null, '')} className="absolute top-2 right-2 bg-slate-900/60 p-1.5 rounded-full text-white hover:bg-slate-900/80 transition-colors z-10">
                        <X size={14} />
                      </motion.button>
                    </div>
                  ) : (
                    <div className="relative w-full rounded-xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border border-slate-800">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                      
                      {isRecording && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                          <span className="text-[9px] text-white font-bold tracking-widest uppercase">REC</span>
                        </div>
                      )}

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={capturePhoto} 
                          disabled={isRecording} 
                          className={`bg-white/20 p-3 rounded-full backdrop-blur-md transition-colors border-2 border-white shadow-sm ${isRecording ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/40'}`} 
                          title="Take Photo"
                        >
                          <Camera size={20} className="text-white" />
                        </motion.button>
                        {!isRecording ? (
                           <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={startRecording} className="bg-red-500/80 p-3 rounded-full backdrop-blur-md hover:bg-red-600 transition-colors border-2 border-white shadow-sm" title="Record Video (4s max)">
                             <Video size={20} className="text-white" />
                           </motion.button>
                        ) : (
                           <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={stopRecording} className="bg-white p-3 rounded-full backdrop-blur-md animate-pulse border-2 border-red-500 shadow-sm" title="Stop Recording">
                             <Square size={20} className="text-red-500 fill-current" />
                           </motion.button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCloseModal}
                className="px-5 py-2 rounded-full font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-[13px]"
              >
                Cancel
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddStory}
                disabled={isAdding || !newStoryFile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-semibold transition-colors disabled:opacity-50 text-[13px]"
              >
                {isAdding ? 'Posting...' : 'Share Story'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>


      {viewingStory && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-200">
          <div className="flex justify-between items-center p-6 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
              <img src={viewingStory.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-white/30 object-cover" />
              <span className="text-white font-semibold text-[14px]">{viewingStory.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {viewingStory.id === 'add' && (
                <button 
                  onClick={handleDeleteStory}
                  className="p-2.5 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-400 transition-colors mr-2"
                  title="Delete your story"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button 
                onClick={() => setViewingStory(null)}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-8 pt-24 sm:px-6">
            <div className="flex h-[calc(100vh-8rem)] max-h-[780px] w-full max-w-[min(92vw,440px)] items-center justify-center overflow-hidden rounded-2xl bg-black shadow-2xl">
              {viewingStory.mediaType === 'video' ? (
                <video src={viewingStory.storyUrl} autoPlay playsInline controls className="h-full w-full object-contain" />
              ) : (
                <img src={viewingStory.storyUrl} alt="Story" className="h-full w-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CreatePost({ user, usersInfo }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaType, setMediaType] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [postType, setPostType] = useState('interested'); 
  const [isPublishing, setIsPublishing] = useState(false);
  
  const currentUserData = usersInfo[user?.uid] || {};
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const hasDraft =
    !!title.trim() ||
    !!content.trim() ||
    !!tags.trim() ||
    !!mediaUrl.trim() ||
    !!attachment;

  const updateMediaPreview = (nextUrl, nextFile = null, nextType = '') => {
    setMediaUrl((currentUrl) => {
      revokeObjectUrl(currentUrl);
      return nextUrl;
    });
    setMediaFile(nextFile);
    setMediaType(nextType);
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formatError = getMediaFileError(file, { allowAttachments: false });
    if (formatError) {
      alert(formatError);
      return;
    }

    const uploadLimitMB = (POST_UPLOAD_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
    if (file.size > POST_UPLOAD_LIMIT_BYTES) {
      alert(`File is too large (Max ${uploadLimitMB}MB). Please choose a smaller image or a shorter video.`);
      return;
    }

    updateMediaPreview(URL.createObjectURL(file), file, inferMediaType(file.type));
  };

  const handleAttachmentUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadLimitMB = (POST_UPLOAD_LIMIT_BYTES / (1024 * 1024)).toFixed(0);
    if (file.size > POST_UPLOAD_LIMIT_BYTES) {
      alert(`Attachment is too large (Max ${uploadLimitMB}MB). Please choose a smaller file.`);
      return;
    }

    setAttachmentFile(file);
    setAttachment({
      name: file.name,
      type: file.type || 'application/octet-stream',
      url: '',
    });
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaUrl.trim() && !title.trim() && !attachment) return;
    setIsPublishing(true);
    
    let skillsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

    try {
      const mediaUploadPromise = mediaFile
        ? (async () => {
            const preparedMediaBlob = await prepareUploadBlob(mediaFile, mediaType);
            const preparedMimeType = preparedMediaBlob.type || mediaFile.type;
            const sourceBaseName = (mediaFile.name || 'media').replace(/\.[^.]*$/, '');
            const uploadName = preparedMimeType?.toLowerCase().split(';', 1)[0].trim() === 'image/jpeg'
              ? `${sourceBaseName || 'media'}.jpg`
              : (mediaFile.name || `media.${mediaType === 'video' ? 'mp4' : 'jpg'}`);
            const uploadFile = preparedMediaBlob instanceof File
              ? preparedMediaBlob
              : new File(
                  [preparedMediaBlob],
                  uploadName,
                  { type: preparedMimeType },
                );
            const uploaded = await uploadPostMedia(uploadFile);
            return {
              url: uploaded.url,
              mediaId: uploaded.mediaId,
              mediaType: uploaded.mediaType || mediaType,
            };
          })()
        : Promise.resolve(null);

      const attachmentUploadPromise = attachmentFile
        ? uploadPostMedia(attachmentFile).then((uploaded) => ({
            name: attachmentFile.name,
            type: attachmentFile.type || 'application/octet-stream',
            url: uploaded.url,
            mediaId: uploaded.mediaId,
          }))
        : Promise.resolve(null);

      const uploadResults = await Promise.allSettled([
        mediaUploadPromise,
        attachmentUploadPromise,
      ]);
      const failedUpload = uploadResults.find((result) => result.status === 'rejected');
      if (failedUpload) {
        const uploadedIds = uploadResults
          .filter((result) => result.status === 'fulfilled')
          .flatMap((result) => [result.value?.mediaId])
          .filter(Boolean);
        await Promise.all(uploadedIds.map((id) => deleteUploadedMedia(id).catch(() => {})));
        throw failedUpload.reason;
      }
      const [uploadedMediaUrl, uploadedAttachment] = uploadResults.map((result) => result.value);

      await createPost({
        authorId: user.uid,
        title: title.trim(),
        content: content.trim(),
        mediaUrl: uploadedMediaUrl?.url || '',
        mediaId: uploadedMediaUrl?.mediaId || '',
        mediaType: uploadedMediaUrl?.url ? (uploadedMediaUrl.mediaType || mediaType || inferMediaType(mediaFile?.type || '', uploadedMediaUrl.url)) : '',
        attachment: uploadedAttachment,
        postType: postType || 'standard',
        skills: skillsArray,
        likes: [],
        reactions: [],
        reposts: [],
        reports: [],
        comments: [],
        createdAt: Date.now()
      });
      notifyPostsChanged();
      setTitle('');
      setContent('');
      setTags('');
      updateMediaPreview('', null, '');
      setAttachment(null);
      setAttachmentFile(null);
      setPostType('interested');
    } catch (error) {
      console.error("Error creating post", error);
      alert(error?.message || 'Could not create post. Please make sure the server is running and try again.');
    }
    setIsPublishing(false);
  };

  return (
    <div className="mb-6 rounded-[1.6rem] border border-[#e8e1d8] bg-[#fffdfa] p-5 shadow-[0_12px_30px_rgba(43,54,78,0.08)] dark:border-[#2e2620] dark:bg-[#1d1713]">
      <div className="flex gap-4">
        <img 
          src={currentUserData.photoURL || `https://i.pravatar.cc/150?u=${user?.uid}`} 
          alt="Avatar" 
          className="h-10 w-10 flex-shrink-0 rounded-full border border-[#e8e1d8] bg-[#f6f2ec] object-cover dark:border-[#3a3028] dark:bg-[#241d18]"
        />
        <div className="flex-1 flex flex-col gap-2">

          <input 
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a title (optional)..."
            className="w-full rounded-xl border border-[#ece5dc] bg-[#f6f2ec] px-4 py-2.5 text-[14px] font-medium text-[#1f1b16] outline-none transition-colors placeholder:text-[#aca093] focus:border-[#cfdbff] focus:bg-[#fffdfa] dark:border-[#2c241e] dark:bg-[#241d18] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-[#a77858] dark:focus:bg-[#241d18]"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Ask a question, share what you know, or find someone to learn from..."
            className="min-h-[64px] w-full resize-none rounded-xl border border-[#ece5dc] bg-[#f6f2ec] px-4 py-3 text-[14px] font-medium text-[#1f1b16] outline-none transition-colors placeholder:text-[#aca093] focus:border-[#cfdbff] focus:bg-[#fffdfa] dark:border-[#2c241e] dark:bg-[#241d18] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-[#a77858] dark:focus:bg-[#241d18]"
          />
          <input 
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Add skill tags, comma-separated (e.g. React, Figma, Spanish)"
            className="w-full rounded-xl border border-[#ece5dc] bg-[#f6f2ec] px-4 py-2.5 text-[13px] font-medium text-[#1f1b16] outline-none transition-colors placeholder:text-[#aca093] focus:border-[#cfdbff] focus:bg-[#fffdfa] dark:border-[#2c241e] dark:bg-[#241d18] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-[#a77858] dark:focus:bg-[#241d18]"
          />
        </div>
      </div>

      <input 
        type="file" 
        accept="image/jpeg,image/png,image/webp,image/gif" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleMediaUpload} 
      />
      <input
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        ref={videoInputRef}
        onChange={handleMediaUpload}
      />
      <input
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
        className="hidden"
        ref={attachmentInputRef}
        onChange={handleAttachmentUpload}
      />

      {mediaUrl ? (
        <div className="relative mt-4 ml-[56px] flex max-h-[320px] max-w-md items-center justify-center overflow-hidden rounded-[16px] border border-slate-200 bg-black/5 shadow-sm dark:border-slate-700 dark:bg-black/30">
          {mediaType === 'video' ? (
             <video src={mediaUrl} controls autoPlay loop playsInline className="max-h-[320px] w-full object-contain"></video>
          ) : (
             <img src={mediaUrl} alt="Upload preview" className="max-h-[320px] w-full object-contain" />
          )}
          <button onClick={() => updateMediaPreview('', null, '')} className="absolute top-2 right-2 bg-slate-900/60 p-1.5 rounded-full text-white hover:bg-slate-900/80 transition-colors z-10 backdrop-blur-sm">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {attachment && (
        <div className="mt-4 ml-[56px] max-w-sm">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e8e1d8] bg-[#f8f4ee] px-4 py-3 shadow-sm dark:border-[#3a3028] dark:bg-[#241d18]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="rounded-full bg-[#e8efff] p-2 text-[#2563ff] dark:bg-[#27443c]/40 dark:text-[#86cbbb]">
                <Paperclip size={14} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{attachment.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Attachment ready to post</p>
              </div>
            </div>
            <button onClick={() => { setAttachment(null); setAttachmentFile(null); }} className="rounded-full bg-slate-900/60 p-1.5 text-white transition-colors hover:bg-slate-900/80">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center ml-[56px] mt-4 gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[#665c52] transition-colors hover:bg-[#f1ede7] dark:text-stone-300 dark:hover:bg-[#241d18]">
            <ImageIcon size={16} className="text-[#2563ff]" /> <span className="text-[13px] hidden sm:inline">Photo</span>
          </button>
          <button onClick={() => videoInputRef.current?.click()} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[#665c52] transition-colors hover:bg-[#f1ede7] dark:text-stone-300 dark:hover:bg-[#241d18]">
            <Video size={16} className="text-[#2563ff]" /> <span className="text-[13px] hidden sm:inline">Video</span>
          </button>
          <button onClick={() => attachmentInputRef.current?.click()} className="mr-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium text-[#665c52] transition-colors hover:bg-[#f1ede7] dark:text-stone-300 dark:hover:bg-[#241d18]">
            <Paperclip size={16} className="text-[#2563ff]" /> <span className="text-[13px] hidden sm:inline">Attachment</span>
          </button>


          <button 
            onClick={() => setPostType('interested')}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-all whitespace-nowrap ${postType === 'interested' ? 'border-[#2563ff] bg-[#e8efff] text-[#2563ff] dark:bg-[#244139]/40 dark:text-[#86cbbb]' : 'border-[#e8e1d8] bg-transparent text-[#665c52] hover:bg-[#f1ede7] dark:border-[#3a3028] dark:text-stone-300 dark:hover:bg-[#241d18]'}`}
          >
            <UserPlus size={14} className={postType === 'interested' ? 'text-[#2563ff]' : 'text-[#aea295]'} /> Interested
          </button>
          <button 
            onClick={() => setPostType('sharing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold transition-all whitespace-nowrap ${postType === 'sharing' ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-slate-700 text-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <BookOpen size={14} className={postType === 'sharing' ? 'text-emerald-600' : 'text-slate-400'} /> Sharing
          </button>
          <button 
            onClick={() => setPostType('discussion')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[13px] font-semibold transition-all whitespace-nowrap ${postType === 'discussion' ? 'border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-200 dark:border-slate-700 text-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <MessageCircle size={14} className={postType === 'discussion' ? 'text-orange-600' : 'text-slate-400'} /> Discussion
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          {hasDraft && (
            <button 
              onClick={() => { setContent(''); updateMediaPreview('', null, ''); setTitle(''); setTags(''); setAttachment(null); setAttachmentFile(null); }}
              className="text-[13px] font-medium text-[#928679] transition-colors hover:text-[#5f554b] dark:text-stone-400 dark:hover:text-stone-200"
            >
              Cancel
            </button>
          )}
          <button 
            onClick={handlePost}
            disabled={isPublishing || (!content.trim() && !mediaUrl.trim() && !title.trim() && !attachment)}
            className={`rounded-full px-5 py-2 text-[13px] font-semibold text-white transition-all ${
              (content.trim() || mediaUrl.trim() || title.trim() || attachment) 
                ? 'bg-blue-600 hover:bg-blue-700 shadow-md active:scale-95' 
                : 'bg-[#9ec0ff] cursor-not-allowed opacity-80'
            } disabled:opacity-50`}
          >
            {isPublishing ? '...' : 'Share Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedFilters({ feedFilter, setFeedFilter, feedSort, setFeedSort }) {
  const baseButtonClass =
    'flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors whitespace-nowrap';
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortOptions = [
    { id: 'following', label: 'Following' },
    { id: 'recent', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
  ];
  const activeSortLabel = sortOptions.find((option) => option.id === feedSort)?.label || 'Following';

  return (
    <div className="flex items-center justify-between mb-4 px-1">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide text-[13px] font-semibold text-[#665c52] dark:text-stone-400">
        <button 
          onClick={() => setFeedFilter('all')} 
          className={`rounded-full px-4 py-1.5 transition-colors whitespace-nowrap ${feedFilter === 'all' ? 'border border-[#cfdbff] bg-[#e8efff] text-[#2563ff] dark:border-[#35594f] dark:bg-[#244139]/40 dark:text-[#86cbbb]' : 'hover:bg-[#f1ede7] dark:hover:bg-[#241d18]'}`}
        >
          All
        </button>
        <button
          onClick={() => setFeedFilter('interested')}
          className={`${baseButtonClass} ${feedFilter === 'interested' ? 'border border-[#cfdbff] bg-[#e8efff] text-[#2563ff] dark:border-[#35594f] dark:bg-[#244139]/40 dark:text-[#86cbbb]' : 'hover:bg-[#f1ede7] dark:hover:bg-[#241d18]'}`}
        >
          <UserPlus size={14} className={feedFilter === 'interested' ? 'text-[#2563ff]' : 'text-slate-400'} />
          Interested
        </button>
        <button
          onClick={() => setFeedFilter('discussion')}
          className={`${baseButtonClass} ${feedFilter === 'discussion' ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300' : 'hover:bg-[#f1ede7] dark:hover:bg-[#241d18]'}`}
        >
          <MessageSquarePlus size={14} className={feedFilter === 'discussion' ? 'text-orange-600 dark:text-orange-300' : 'text-slate-400'} />
          Discussions
        </button>
        <button
          onClick={() => setFeedFilter('sharing')}
          className={`${baseButtonClass} ${feedFilter === 'sharing' ? 'bg-[#eefaf2] text-[#10b981] dark:bg-[#4a2f20]/50 dark:text-[#e1ab8d]' : 'hover:bg-[#f1ede7] dark:hover:bg-[#241d18]'}`}
        >
          <BookOpen size={14} className={feedFilter === 'sharing' ? 'text-[#10b981]' : 'text-slate-400'} />
          Sharing
        </button>
      </div>
      <div className="relative ml-4 hidden sm:block">
        <button
          onClick={() => setIsSortMenuOpen((open) => !open)}
          className="flex items-center gap-1 whitespace-nowrap text-[12px] text-[#928679] transition-colors hover:text-[#5f554b] dark:text-stone-400 dark:hover:text-stone-200"
        >
          <span>Sort by:</span>
          <span className="flex items-center font-bold text-[#1f1b16] dark:text-stone-100">
            {activeSortLabel}
            <ChevronDown size={14} className={`ml-1 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {isSortMenuOpen && (
          <div className="absolute right-0 top-full z-20 mt-2 min-w-[140px] rounded-2xl border border-[#e8e1d8] bg-white p-1.5 shadow-[0_14px_40px_rgba(43,54,78,0.12)] dark:border-[#2e2620] dark:bg-[#1d1713]">
            {sortOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setFeedSort(option.id);
                  setIsSortMenuOpen(false);
                }}
                className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors ${feedSort === option.id ? 'bg-[#eefaf2] text-[#10b981] dark:bg-[#4a2f20]/50 dark:text-[#e1ab8d]' : 'text-[#665c52] hover:bg-[#f1ede7] dark:text-stone-300 dark:hover:bg-[#241d18]'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Feed({ posts, user, usersInfo, feedFilter, feedSort, searchQuery, setCurrentView, setSelectedProfileId }) {
  const currentUserData = usersInfo[user?.uid] || {};
  const following = currentUserData.following || [];


  let filteredPosts = [...posts];

  if (feedFilter === 'interested') {
    filteredPosts = filteredPosts.filter(p => p.postType === 'interested');
  } else if (feedFilter === 'sharing') {
    filteredPosts = filteredPosts.filter(p => p.postType === 'sharing');
  } else if (feedFilter === 'discussion') {
    filteredPosts = filteredPosts.filter(p => p.postType === 'discussion');
  }

  if (searchQuery && searchQuery.trim()) {
    const lowerQ = searchQuery.toLowerCase();
    filteredPosts = filteredPosts.filter(p => {
      const contentMatch = p.content?.toLowerCase().includes(lowerQ);
      const titleMatch = p.title?.toLowerCase().includes(lowerQ);
      const skillMatch = p.skills?.some(skill => skill.toLowerCase().includes(lowerQ));
      const authorMatch = usersInfo[p.authorId]?.displayName?.toLowerCase().includes(lowerQ);
      return contentMatch || titleMatch || skillMatch || authorMatch;
    });
  }

  filteredPosts.sort((a, b) => {
    const timeA = Number(a.createdAt) || 0;
    const timeB = Number(b.createdAt) || 0;

    if (feedSort === 'oldest') {
      return timeA - timeB;
    }

    if (feedSort === 'following') {
      const aPriority = following.includes(a.authorId) || a.authorId === user?.uid ? 1 : 0;
      const bPriority = following.includes(b.authorId) || b.authorId === user?.uid ? 1 : 0;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
    }

    return timeB - timeA;
  });

  if (filteredPosts.length === 0) {
    return (
      <div className="rounded-[1.6rem] border border-[#e8e1d8] bg-[#fffdfa] p-12 text-center shadow-[0_12px_30px_rgba(43,54,78,0.08)] dark:border-[#2e2620] dark:bg-[#1d1713]">
        <p className="text-[14px] font-medium text-[#928679] dark:text-stone-400">No posts found. Try a different filter or search term!</p>
      </div>
    );
  }

  return (
      <motion.div className="pb-12 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}>
      <AnimatePresence>
      {filteredPosts.map(post => (
        <AppPostCard
          key={post.id}
          post={post}
          user={user}
          usersInfo={usersInfo}
          setCurrentView={setCurrentView}
          setSelectedProfileId={setSelectedProfileId}
        />
      ))}
      </AnimatePresence>
    </motion.div>
  );
}
