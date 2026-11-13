import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BookOpen,
  Bookmark,
  Compass,
  FileText,
  Home,
  Image,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PenTool,
  PlaySquare,
  Search,
  Sun,
  Target,
  User as UserIcon,
  Users,
  Zap,
  Briefcase,
  Code,
  Layout,
} from 'lucide-react';
import Logo from './Logo';
import { logoutUser, toggleFollow } from '../services/mongoApi';

export function TopNav({ darkMode, setDarkMode, user, usersInfo, setCurrentView, searchQuery, setSearchQuery, setSelectedProfileId, posts }) {
  const currentUserData = usersInfo[user?.uid] || {};
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.uid) {
      // Clear the previous user's notification state when the session ends.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeenNotificationIds([]);
      return;
    }

    try {
      const stored = window.localStorage.getItem(`seenNotifications_${user.uid}`);
      setSeenNotificationIds(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error('Failed to load seen notifications:', error);
      setSeenNotificationIds([]);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      window.localStorage.setItem(`seenNotifications_${user?.uid}`, JSON.stringify(seenNotificationIds));
    }
  }, [seenNotificationIds, user?.uid]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const notifications = [];

  posts
    .filter((post) => post.authorId === user?.uid)
    .forEach((post) => {
      (post.likes || [])
        .filter((likerId) => likerId !== user?.uid)
        .forEach((likerId) => {
          const liker = usersInfo[likerId] || {};
          notifications.push({
            id: `like-${post.id}-${likerId}`,
            actorId: likerId,
            actorName: liker.displayName || 'Someone',
            actorAvatar: liker.photoURL || `https://i.pravatar.cc/150?u=${likerId}`,
            message: `liked your post${post.title ? ` "${post.title}"` : ''}`,
            createdAt: post.createdAt || 0,
          });
        });

      (post.comments || [])
        .filter((comment) => comment.authorId !== user?.uid)
        .forEach((comment) => {
          const commenter = usersInfo[comment.authorId] || {};
          notifications.push({
            id: `comment-${post.id}-${comment.id}`,
            actorId: comment.authorId,
            actorName: commenter.displayName || 'Someone',
            actorAvatar: commenter.photoURL || `https://i.pravatar.cc/150?u=${comment.authorId}`,
            message: `commented: "${comment.text}"`,
            createdAt: comment.createdAt || 0,
          });
        });
    });

  (currentUserData.followers || []).forEach((followerId) => {
    const follower = usersInfo[followerId] || {};
    notifications.push({
      id: `follower-${followerId}`,
      actorId: followerId,
      actorName: follower.displayName || 'Someone',
      actorAvatar: follower.photoURL || `https://i.pravatar.cc/150?u=${followerId}`,
      message: 'started following you',
      createdAt: 0,
    });
  });

  notifications.sort((a, b) => b.createdAt - a.createdAt);

  const unreadCount = notifications.filter((notification) => !seenNotificationIds.includes(notification.id)).length;

  const handleLogout = async () => {
    try {
      await logoutUser();
      setIsMenuOpen(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleNotificationsToggle = () => {
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
    setIsMenuOpen(false);
    if (nextOpen) {
      setSeenNotificationIds(notifications.map((notification) => notification.id));
    }
  };

  const handleNotificationClick = (notification) => {
    setIsNotificationsOpen(false);
    if (notification.actorId) {
      setSelectedProfileId(notification.actorId);
      setCurrentView('profile');
    }
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return 'Recent';
    const diff = Math.max(0, now - timestamp);
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-[64px] items-center justify-between border-b border-[#d8defe] bg-[linear-gradient(180deg,#f9fbff_0%,#eef2ff_100%)]/92 px-4 backdrop-blur-xl transition-colors duration-300 dark:border-[#302b53] dark:bg-[linear-gradient(180deg,#17152a_0%,#0f1020_100%)]/92 lg:px-8">
      <div className="flex cursor-pointer items-center gap-2" onClick={() => { setCurrentView('home'); setSearchQuery(''); }}>
        <Logo className="h-10" withWordmark={false} darkMode={darkMode} />
      </div>

      <div className="mx-4 hidden max-w-[500px] flex-1 md:block">
        <div className="group relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8a92b8] transition-colors group-focus-within:text-[#6d49f4] dark:text-slate-500 dark:group-focus-within:text-[#9fdcff]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) setCurrentView('search');
              else setCurrentView('home');
            }}
            placeholder="Search skills, people, topics..."
            className="w-full rounded-full border border-[#dfe5ff] bg-[#f1f5ff] py-2.5 pl-11 pr-4 text-[14px] font-medium text-[#1d2342] outline-none transition-all placeholder:text-[#8a92b8] focus:border-[#8db4ff] focus:bg-[#fbfcff] dark:border-[#2d2b4f] dark:bg-[#1b1a33] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[#8b5cf6] dark:focus:bg-[#19182d]"
          />
        </div>
      </div>

      <div className="relative flex items-center gap-2 sm:gap-3">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setDarkMode(!darkMode)} className="rounded-full p-2 text-[#5a6289] transition-colors hover:bg-[#eef3ff] dark:text-slate-300 dark:hover:bg-[#201f39]">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </motion.button>
        <div className="relative hidden sm:block">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={handleNotificationsToggle} className="relative rounded-full p-2 text-[#5a6289] transition-colors hover:bg-[#eef3ff] dark:text-slate-300 dark:hover:bg-[#201f39]">
            <Bell size={20} />
            {unreadCount > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </motion.button>

          <AnimatePresence>
          {isNotificationsOpen && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} transition={{ duration: 0.15 }} className="absolute right-0 top-[50px] z-50 w-[340px] overflow-hidden rounded-2xl border border-[#e8e1d8] bg-[#fffdfa] shadow-[0_20px_40px_rgba(43,54,78,0.08)] dark:border-[#332a24] dark:bg-[#211b17]">
              <div className="flex items-center justify-between border-b border-[#f1ece5] px-4 py-3 dark:border-[#312923]">
                <h3 className="text-[14px] font-bold text-[#1f1b16] dark:text-stone-100">Notifications</h3>
                <span className="text-[11px] font-semibold text-[#ac9f91] dark:text-stone-500">{notifications.length}</span>
              </div>

              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-[#8f8377] dark:text-stone-400">
                  No notifications yet.
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="flex w-full items-start gap-3 border-b border-[#f1ece5] px-4 py-3 text-left transition-colors hover:bg-[#f7f4ef] dark:border-[#312923] dark:hover:bg-[#2a231d]"
                    >
                      <img
                        src={notification.actorAvatar}
                        alt={notification.actorName}
                        className="h-10 w-10 rounded-full border border-[#e9e1d8] object-cover dark:border-[#3a3028]"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#655b50] dark:text-stone-200">
                          <span className="font-bold text-[#1f1b16] dark:text-[#f7efe4]">{notification.actorName}</span>{' '}
                          {notification.message}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-[#ac9f91] dark:text-stone-500">{timeAgo(notification.createdAt)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => setCurrentView('bookmarks')} className="hidden rounded-full p-2 text-[#5a6289] transition-colors hover:bg-[#eef3ff] dark:text-slate-300 dark:hover:bg-[#201f39] sm:block">
          <Bookmark size={20} />
        </motion.button>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="ml-2 flex cursor-pointer items-center gap-2 pl-3 transition-opacity hover:opacity-80 sm:border-l sm:border-[#dbe2ff] dark:sm:border-[#2d2b4f]"
        >
          <img src={currentUserData.photoURL || `https://i.pravatar.cc/150?u=${user?.uid}`} alt="Profile" className="h-8 w-8 rounded-full border border-[#dbe2ff] bg-[#f8faff] object-cover dark:border-[#3c3866]" />
          <div className="hidden flex-col items-start justify-center lg:flex">
            <span className="flex items-center gap-1 leading-none text-[14px] font-semibold text-[#1d2342] dark:text-[#eef2ff]">
              {currentUserData.displayName || 'Sign in'} <svg className="h-3.5 w-3.5 text-[#8a92b8] dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </span>
          </div>
        </motion.div>

        <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} transition={{ duration: 0.15 }} className="absolute right-0 top-[50px] z-50 w-48 rounded-xl border border-[#e8e1d8] bg-[#fffdfa] py-2 shadow-[0_20px_40px_rgba(43,54,78,0.08)] dark:border-[#332a24] dark:bg-[#211b17]">
            <motion.button
              whileHover={{ x: 4, backgroundColor: 'var(--hover-bg)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedProfileId(user?.uid || null);
                setCurrentView('profile');
                setIsMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-[#5d5349] transition-colors hover:bg-[#f7f4ef] dark:text-stone-200 dark:hover:bg-[#2a231d]"
            >
              <div className="rounded-full bg-[#e8efff] p-1.5 dark:bg-[#27443c]/40"><UserIcon size={16} className="text-[#2563ff] dark:text-[#86cbbb]" /></div>
              View Profile
            </motion.button>
            <motion.button
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <div className="p-1.5 text-red-500"><LogOut size={16} /></div>
              Sign Out
            </motion.button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export function SidebarLeft({ currentView, setCurrentView, user, usersInfo, posts, setSelectedProfileId }) {
  const currentUserData = usersInfo[user?.uid] || {};
  const userPostsCount = posts?.filter((p) => p.authorId === user?.uid).length || 0;

  const mainNav = [
    { id: 'home', label: 'Feed', icon: Home },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'videos', label: 'Watch Videos', icon: PlaySquare },
    { id: 'photos', label: 'Photos', icon: Image },
  ];

  const learnNav = [
    { id: 'teaching', label: "I'm Teaching", icon: BookOpen },
    { id: 'learning', label: "I'm Learning", icon: Target },
    { id: 'matches', label: 'Matches', icon: Zap },
    { id: 'marketplace', label: 'Marketplace', icon: Briefcase },
    { id: 'files', label: 'Files', icon: FileText },
  ];

  const pagesNav = [
    { id: 'uiux', label: 'UI/UX Community', icon: Layout },
    { id: 'webdesign', label: 'Web Designer', icon: Code },
    { id: 'dribbble', label: 'Dribbble Community', icon: Target },
    { id: 'behance', label: 'Behance', icon: PenTool },
  ];

  const renderNav = (items) => (
    <div className="space-y-0.5">
      {items.map((item) => {
        const isActive = currentView === item.id;
        const Icon = item.icon;
        return (
          <motion.button
            key={item.id}
            whileHover={{ x: 8, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (item.id === 'profile') setSelectedProfileId(user?.uid || null);
              if (item.id === 'home') setCurrentView('home');
              else if (item.id === 'friends') setCurrentView('friends');
              else if (item.id === 'videos' || item.id === 'photos') setCurrentView('search');
              else setCurrentView(item.id);
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-200 ${
              isActive
                ? 'bg-[#e8efff] text-[#2563ff] font-bold dark:bg-[#244139]/40 dark:text-[#86cbbb]'
                : 'text-[#665c52] font-medium hover:bg-[#f2eee8] dark:text-stone-300 dark:hover:bg-[#241d18]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon size={20} className={isActive ? 'text-[#2563ff] dark:text-[#86cbbb]' : 'text-[#aea295] dark:text-stone-500'} />
              <span className="text-[14px]">{item.label}</span>
            </div>
            {item.badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${item.badgeColor}`}>
                {item.badge}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <aside className="scrollbar-hide sticky top-[80px] hidden h-[calc(100vh-80px)] w-[260px] overflow-y-auto pb-8 lg:block">
      <div className="mb-6 flex flex-col items-center rounded-[1.4rem] border border-[#d8defe] bg-[linear-gradient(180deg,#f9fbff_0%,#eef2ff_100%)] p-5 shadow-[0_10px_26px_rgba(86,96,196,0.16)] dark:border-[#302b53] dark:bg-[linear-gradient(180deg,#17152a_0%,#0f1020_100%)]">
        <div className="-mr-2 -mt-2 flex w-full justify-end">
          <button className="rounded-md p-1 text-[#8a92b8] hover:bg-[#eef3ff] dark:text-slate-500 dark:hover:bg-[#201f39]">
            <Menu size={18} />
          </button>
        </div>
        <img src={currentUserData.photoURL} alt="Profile" className="mb-3 h-16 w-16 rounded-full border-2 border-[#efe7dd] object-cover dark:border-[#2b221d]" />
        <h3 className="text-[15px] font-bold text-[#1d2342] dark:text-[#eef2ff]">{currentUserData.displayName}</h3>
        <p className="text-[12px] font-medium text-[#8a92b8] dark:text-slate-500">{currentUserData.username || '@username'}</p>

        <div className="mt-4 flex w-full justify-between border-t border-[#f1ece5] pt-4 text-center dark:border-[#2c241e]">
          <div>
            <p className="text-[15px] font-bold text-[#1d2342] dark:text-[#eef2ff]">{currentUserData.followers?.length || 0}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a92b8] dark:text-slate-500">Followers</p>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1d2342] dark:text-[#eef2ff]">{currentUserData.following?.length || 0}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a92b8] dark:text-slate-500">Following</p>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1d2342] dark:text-[#eef2ff]">{userPostsCount}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8a92b8] dark:text-slate-500">Posts</p>
          </div>
        </div>
      </div>

      <nav className="space-y-6">
        <div>
          <h4 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-[#8a92b8] dark:text-slate-500">Main</h4>
          {renderNav(mainNav)}
        </div>

        <div>
          <h4 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-[#8a92b8] dark:text-slate-500">Learn & Teach</h4>
          {renderNav(learnNav)}
        </div>

        <div>
          <h4 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-[#8a92b8] dark:text-slate-500">Pages You Like</h4>
          {renderNav(pagesNav)}
          <button className="mt-2 px-3 text-[13px] font-bold text-[#6d49f4] hover:underline dark:text-[#c4b5fd]">View All &gt;</button>
        </div>
      </nav>
    </aside>
  );
}

export function SidebarRight({ usersInfo, currentUser, setCurrentView, setSelectedProfileId, messageThreads, setSelectedChatUserId }) {
  const currentUserData = usersInfo[currentUser?.uid] || {};

  const topContributors = Object.values(usersInfo)
    .filter((u) => u.uid !== currentUser?.uid)
    .slice(0, 4)
    .map((u) => ({
      id: u.uid,
      name: u.displayName,
      role: u.role || u.skills?.[0] || 'Member',
      avatar: u.photoURL,
      isFollowing: currentUserData.following?.includes(u.uid)
    }));

  const handleFollowToggle = async (targetUserId) => {
    if (!currentUser) return;

    try {
      await toggleFollow(currentUser.uid, targetUserId);
    } catch (err) {
      console.error("Follow error", err);
    }
  };

  const recentChats = (messageThreads || [])
    .map((thread) => {
      if (thread.type === 'group') {
        return {
          id: thread.id,
          targetId: thread.id,
          name: thread.group?.name || 'Group chat',
          avatar: thread.group?.image || '',
          isGroup: true,
          lastMessage: thread.lastMessage || 'Start a conversation',
        };
      }
      const otherUserId = thread.participants?.find((id) => id !== currentUser?.uid);
      const otherUser = usersInfo[otherUserId];
      if (!otherUser) return null;
      return {
        id: thread.id,
        targetId: otherUserId,
        name: otherUser.displayName,
        avatar: otherUser.photoURL,
        isGroup: false,
        lastMessage: thread.lastMessage || 'Start a conversation',
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  return (
    <aside className="scrollbar-hide sticky top-[80px] hidden h-[calc(100vh-80px)] w-[300px] overflow-y-auto pb-8 lg:block">
      <div className="mb-4 rounded-[1.5rem] border border-[#e8e1d8] bg-[#fffdfa] p-5 shadow-[0_12px_30px_rgba(43,54,78,0.08)] dark:border-[#2e2620] dark:bg-[#1d1713]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#1f1b16] dark:text-stone-100">
            <BookOpen size={16} className="text-[#2563ff]" /> Top Contributors
          </h3>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="text-[12px] font-semibold text-[#2563ff] hover:underline dark:text-[#86cbbb]">See All</motion.button>
        </div>

        <div className="space-y-4">
          {topContributors.length > 0 ? topContributors.map((user) => (
            <motion.div key={user.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-3">
              <img src={user.avatar} className="h-10 w-10 rounded-full border border-[#ece4da] object-cover dark:border-slate-800" alt={user.name} />
              <div className="min-w-0 flex-1">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSelectedProfileId?.(user.id);
                    setCurrentView?.('profile');
                  }}
                  className="truncate text-[13px] font-bold text-[#1f1b16] hover:underline dark:text-stone-100"
                >
                  {user.name}
                </motion.button>
                <p className="truncate text-[11px] text-[#928679] dark:text-stone-400">{user.role}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFollowToggle(user.id)}
                className={`rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-colors ${
                  user.isFollowing
                    ? 'border-[#e8e1d8] bg-[#fffdfa] text-[#655b50] hover:bg-[#f1ede7] dark:border-[#3a3028] dark:bg-[#241d18] dark:text-stone-300'
                    : 'border-[#2563ff] bg-transparent text-[#2563ff] hover:bg-[#e8efff]'
                }`}
              >
                {user.isFollowing ? 'Following' : 'Follow'}
              </motion.button>
            </motion.div>
          )) : (
            <p className="py-2 text-center text-[13px] text-slate-500">No other users found.</p>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-[1.5rem] border border-[#e8e1d8] bg-[#fffdfa] p-5 shadow-[0_12px_30px_rgba(43,54,78,0.08)] dark:border-[#2e2620] dark:bg-[#1d1713]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#1f1b16] dark:text-stone-100">
            <MessageSquare size={16} className="text-[#2563ff]" /> Messages
          </h3>
          <motion.button whileHover={{ scale: 1.15, rotateZ: 20 }} whileTap={{ scale: 0.9 }} className="text-slate-400 transition-colors hover:text-slate-600"><PenTool size={14} /></motion.button>
        </div>

        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full rounded-xl border border-[#ece5dc] bg-[#f6f2ec] py-1.5 pl-8 pr-3 text-[13px] text-[#1f1b16] outline-none transition-colors focus:border-[#cfdbff] dark:bg-[#241d18] dark:text-stone-100"
          />
        </div>

        {recentChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <p className="mb-1 text-[13px] font-medium text-slate-500">No messages yet</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentView('friends')}
              className="text-[13px] font-semibold text-[#2563ff] hover:underline dark:text-[#86cbbb]"
            >
              Start a conversation
            </motion.button>
          </div>
        ) : (
          <div className="space-y-3">
            {recentChats.map((chat) => (
              <motion.button
                key={chat.id}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setSelectedChatUserId?.(chat.targetId);
                  setCurrentView?.('messages');
                }}
                className="flex w-full items-center gap-3 text-left"
              >
                {chat.isGroup ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-blue-50 text-blue-600 dark:border-slate-800 dark:bg-blue-500/10 dark:text-blue-400">
                    {chat.avatar ? <img src={chat.avatar} className="h-full w-full rounded-full object-cover" alt="" /> : <Users size={16} />}
                  </span>
                ) : (
                  <img src={chat.avatar} className="h-10 w-10 rounded-full border border-slate-100 object-cover dark:border-slate-800" alt={chat.name} />
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{chat.name}</h4>
                  <p className="truncate text-[11px] text-slate-500">{chat.lastMessage}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentView('messages')}
          className="mt-2 w-full border-t border-[#f1ece5] pt-3 text-center text-[13px] font-bold text-[#2563ff] hover:underline dark:border-[#2c241e] dark:text-[#86cbbb]"
        >
          View All Messages
        </motion.button>
      </div>
    </aside>
  );
}

export function MobileNav({ currentView, setCurrentView, user, setSelectedProfileId }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#e8e1d8] bg-[#fffdfa]/94 p-3 pb-safe shadow-[0_-6px_18px_rgba(43,54,78,0.08)] backdrop-blur-xl dark:border-[#2e2620] dark:bg-[#1a1512]/94 md:hidden">
      <motion.button whileHover={{ scale: 1.1, rotateZ: 5 }} whileTap={{ scale: 0.95 }} onClick={() => setCurrentView('home')} className={`rounded-xl p-2 transition-all ${currentView === 'home' ? 'bg-[#e8efff] text-[#2563ff] dark:bg-[#244139]/40 dark:text-[#86cbbb]' : 'text-[#928679] hover:text-[#2563ff]'}`}>
        <Home size={22} className={currentView === 'home' ? 'fill-current' : ''} />
      </motion.button>
      <motion.button whileHover={{ scale: 1.1, rotateZ: -5 }} whileTap={{ scale: 0.95 }} onClick={() => setCurrentView('explore')} className={`rounded-xl p-2 transition-all ${currentView === 'explore' ? 'bg-[#e8efff] text-[#2563ff] dark:bg-[#244139]/40 dark:text-[#86cbbb]' : 'text-[#928679] hover:text-[#2563ff]'}`}>
        <Compass size={22} className={currentView === 'explore' ? 'fill-current' : ''} />
      </motion.button>
      <motion.button whileHover={{ scale: 1.1, rotateZ: 5 }} whileTap={{ scale: 0.95 }} onClick={() => { setSelectedProfileId(user?.uid || null); setCurrentView('profile'); }} className={`rounded-xl p-2 transition-all ${currentView === 'profile' ? 'bg-[#e8efff] text-[#2563ff] dark:bg-[#244139]/40 dark:text-[#86cbbb]' : 'text-[#928679] hover:text-[#2563ff]'}`}>
        <UserIcon size={22} className={currentView === 'profile' ? 'fill-current' : ''} />
      </motion.button>
    </nav>
  );
}
