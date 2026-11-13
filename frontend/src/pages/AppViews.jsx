import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, MessageCircle, MessageSquare, Search, Camera, X, Trash2, MoreHorizontal, Paperclip, FileText, Download, Image as ImageIcon, Check, Users, UserPlus, Forward, Shield, Pencil, Link as LinkIcon, Copy } from 'lucide-react';
import PostCard from '../components/PostCard';
import { deleteConversation, deleteMessagesForMe, deleteMessageForEveryone, clearConversationForMe, createGroupConversation, updateGroupConversation, addGroupParticipant, removeGroupParticipant, forwardMessage, createGroupInvitation, revokeGroupInvitation, getGroupInvitation, joinGroupInvitation, toggleFollow, updateUser, readToken } from '../services/mongoApi';
import { deleteUploadedMedia, uploadPostMedia } from '../services/postsApi';
import { apiBaseUrl } from '../services/backend';
import { getMediaFileError } from '../utils/mediaFiles';

const getChatAttachmentUrl = (url = '') => {
  if (!url.includes('/api/media/')) return url;
  return url.startsWith('/') ? `${apiBaseUrl}${url}` : url;
};

function PositionedPopover({ anchorRef, onClose, children, className }) {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, visibility: 'hidden' });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;

      const anchorRect = anchor.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const below = window.innerHeight - anchorRect.bottom - gap;
      const above = anchorRect.top - gap;
      const openAbove = below < popoverRect.height && above > below;
      const top = openAbove
        ? Math.max(margin, anchorRect.top - popoverRect.height - gap)
        : Math.min(Math.max(margin, anchorRect.bottom + gap), window.innerHeight - popoverRect.height - margin);
      const left = Math.max(
        margin,
        Math.min(anchorRect.right - popoverRect.width, window.innerWidth - popoverRect.width - margin),
      );
      setPosition({ top, left, visibility: 'visible' });
    };

    const handlePointerDown = (event) => {
      if (!popoverRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) onClose();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    updatePosition();
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: position.top, left: position.left, visibility: position.visibility, maxHeight: 'calc(100vh - 16px)' }}
      className={className}
    >
      {children}
    </div>,
    document.body,
  );
}

const readMessageTimestamp = (message) => {
  if (!message || typeof message !== 'object') return null;

  const timestampCandidates = [message.timestamp, message.createdAt, message.sentAt, message.time];

  for (const value of timestampCandidates) {
    if (value === null || value === undefined || value === '') continue;

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }

    const dateValue = new Date(value);
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.getTime();
    }
  }

  return null;
};

const formatSafeTime = (value) => {
  const timestamp = readMessageTimestamp({ timestamp: value });
  if (!timestamp) return '—';

  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const formatConversationDate = (value) => {
  const timestamp = readMessageTimestamp({ timestamp: value });
  if (!timestamp) return '—';

  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay());

  if (date >= startOfWeek) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatFileSize = (size) => {
  if (!Number.isFinite(size) || size <= 0) return '0 KB';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export function ProfileView({ user, usersInfo, posts, selectedProfileId, setCurrentView, setSelectedProfileId, setSelectedChatUserId }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [role, setRole] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const photoInputRef = useRef(null);

  const profileUserId = selectedProfileId || user?.uid;
  const currentUserData = usersInfo[profileUserId] || {};
  const signedInUserData = usersInfo[user?.uid] || {};
  const userPosts = posts.filter((p) => p.authorId === profileUserId);
  const isOwnProfile = !!user?.uid && profileUserId === user.uid;
  const isFollowing = !!user?.uid && !isOwnProfile && (signedInUserData.following || []).includes(profileUserId);

  const saveProfile = async () => {
    if (!isOwnProfile) return;
    await updateUser(user.uid, { bio, role });
    setEditing(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formatError = getMediaFileError(file, { allowAttachments: false });
    if (formatError) {
      alert(formatError);
      return;
    }

    if (!/\.(jpe?g|png|webp|gif)$/i.test(file.name || '')) {
      alert('Please select a supported image file.');
      return;
    }

    if (file.size > 2097152) {
      alert('Image is too large. Max size is 2MB.');
      return;
    }

    try {
      setUploadingPhoto(true);

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = async () => {
        const maxWidth = 400;
        const maxHeight = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(async (blob) => {
          try {
            if (!blob) throw new Error('Could not prepare the selected image.');
            const uploaded = await uploadPostMedia(new File([blob], 'profile.jpg', { type: 'image/jpeg' }));
            try {
              await updateUser(user.uid, { photoURL: uploaded.url, profilePic: uploaded.url });
            } catch (error) {
              if (uploaded?.mediaId) await deleteUploadedMedia(uploaded.mediaId).catch(() => {});
              throw error;
            }
            alert('Profile picture updated successfully!');
          } catch (error) {
            console.error('Photo upload error:', error);
            alert(error?.message || 'Could not upload photo. Please try again.');
          } finally {
            setUploadingPhoto(false);
          }
        }, 'image/jpeg', 0.75);
      };

      img.onerror = () => {
        setUploadingPhoto(false);
        alert('Failed to load image. Please try another image.');
      };

      const reader = new FileReader();
      reader.onload = (event) => {
        img.src = event.target?.result || '';
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setUploadingPhoto(false);
      console.error('Photo upload error:', error);
      alert('Could not upload photo. Please try again.');
    }

    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleFollowToggle = async () => {
    if (!user || isOwnProfile) return;

    try {
      await toggleFollow(user.uid, profileUserId);
    } catch (error) {
      console.error('Follow error', error);
    }
  };

  const handleMessageClick = () => {
    if (!profileUserId || isOwnProfile) return;
    setSelectedChatUserId?.(profileUserId);
    setCurrentView('messages');
  };

  const followersCount = currentUserData.followers?.length || 0;
  const followingCount = currentUserData.following?.length || 0;
  const postsCount = userPosts.length;
  return (
    <div className="space-y-7 pb-12">
      <section className="overflow-hidden rounded-[2rem] border border-[#dbe2ff] bg-[#f9fbff] shadow-[0_18px_44px_rgba(90,101,195,0.12)] dark:border-[#2d2b4f] dark:bg-[#16152a]">
        <div className="h-40 bg-[linear-gradient(135deg,#22c7f5_0%,#6395ff_42%,#8b5cf6_76%,#d946ef_100%)] sm:h-52" />

        <div className="relative px-5 pb-8 sm:px-8">
          <div className="flex flex-col items-start">
            <div className="relative -mt-16 sm:-mt-14 mb-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
              <img 
                src={currentUserData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.displayName || 'User')}&background=random`} 
                alt={currentUserData.displayName || 'Profile'} 
                onClick={() => setShowPhotoModal(true)}
                className="h-32 w-32 rounded-[1.5rem] border-4 border-[#f9fbff] dark:border-[#16152a] object-cover bg-white shadow-md cursor-pointer hover:opacity-90 transition-opacity" 
              />
              {isOwnProfile && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-2 -right-2 rounded-full bg-blue-600 p-2.5 text-white hover:bg-blue-700 shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                  title="Upload Photo"
                >
                  <Camera size={18} />
                </button>
              )}
            </div>

            <div className="w-full text-left">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    {currentUserData.displayName || 'User'}
                  </h2>
                  <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentUserData.email || currentUserData.username || 'No email provided'}
                  </p>
                </div>
                
                {!isOwnProfile && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleFollowToggle}
                      className={`rounded-full px-5 py-2 text-[13px] font-bold transition-all ${
                        isFollowing
                          ? 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button
                      onClick={handleMessageClick}
                      className="rounded-full border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                    >
                      <MessageCircle size={18} />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 max-w-2xl">
                {currentUserData.bio || currentUserData.role || 'No bio yet.'}
              </div>

              <div className="flex gap-6 mt-6 text-[14px] text-slate-500 dark:text-slate-400">
                <p><span className="font-bold text-slate-900 dark:text-white mr-1">{postsCount}</span> Posts</p>
                <p><span className="font-bold text-slate-900 dark:text-white mr-1">{followersCount}</span> Followers</p>
                <p><span className="font-bold text-slate-900 dark:text-white mr-1">{followingCount}</span> Following</p>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
            {editing && isOwnProfile ? (
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Bio
                  </label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white transition-all"
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Role
                  </label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white transition-all"
                    placeholder="Your role (e.g. Frontend Developer)"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={saveProfile}
                    className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded-full border border-slate-200 px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : isOwnProfile ? (
              <button
                onClick={() => setEditing(true)}
                className="rounded-full border border-slate-200 px-6 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Edit Profile
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {userPosts.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Posts</h3>
          <div className="space-y-4">
            {userPosts.map((post) => (
              <PostCard key={post.id} post={post} user={user} usersInfo={usersInfo} setCurrentView={setCurrentView} setSelectedProfileId={setSelectedProfileId} />
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {showPhotoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowPhotoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl w-full flex justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowPhotoModal(false)}
                className="absolute -top-12 right-0 md:-right-12 md:top-0 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
              <img 
                src={currentUserData.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.displayName || 'User')}&background=random`} 
                alt={currentUserData.displayName || 'Profile Full'} 
                className="max-h-[85vh] w-auto object-contain rounded-xl shadow-2xl" 
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchResultsView({ searchQuery, posts, usersInfo, user, setCurrentView, setSelectedProfileId }) {
  const lowerQuery = searchQuery.trim().toLowerCase();
  const users = Object.values(usersInfo).filter((profile) => {
    if (!lowerQuery) return false;
    return (
      profile.displayName?.toLowerCase().includes(lowerQuery) ||
      profile.username?.toLowerCase().includes(lowerQuery) ||
      profile.role?.toLowerCase().includes(lowerQuery) ||
      profile.skills?.some((skill) => skill.toLowerCase().includes(lowerQuery))
    );
  });

  const matchingPosts = posts.filter((post) => {
    if (!lowerQuery) return false;
    return (
      post.title?.toLowerCase().includes(lowerQuery) ||
      post.content?.toLowerCase().includes(lowerQuery) ||
      post.skills?.some((skill) => skill.toLowerCase().includes(lowerQuery)) ||
      usersInfo[post.authorId]?.displayName?.toLowerCase().includes(lowerQuery)
    );
  });

  return (
    <div className="pb-12 space-y-6">
      <div className="px-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Search Results</h2>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
          Results for "{searchQuery}"
        </p>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">People</h3>
          <span className="text-[12px] text-slate-400">{users.length}</span>
        </div>
        {users.length === 0 ? (
          <p className="text-[13px] text-slate-500">No matching people found.</p>
        ) : (
          <div className="space-y-3">
            {users.map((profile) => (
              <button
                key={profile.uid}
                onClick={() => {
                  setSelectedProfileId(profile.uid);
                  setCurrentView('profile');
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <img src={profile.photoURL} alt={profile.displayName} className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{profile.displayName}</p>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    {profile.role || 'Member'}{profile.uid === user?.uid ? ' • You' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Posts</h3>
          <span className="text-[12px] text-slate-400">{matchingPosts.length}</span>
        </div>
        {matchingPosts.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-[13px] text-slate-500">
            No matching posts found.
          </div>
        ) : (
          <div className="space-y-4">
            {matchingPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                usersInfo={usersInfo}
                setCurrentView={setCurrentView}
                setSelectedProfileId={setSelectedProfileId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function FriendsView({ user, usersInfo, setCurrentView, setSelectedProfileId, setSelectedChatUserId }) {
  const currentUserData = usersInfo[user?.uid] || {};
  const followers = (currentUserData.followers || []).map((id) => usersInfo[id]).filter(Boolean);
  const following = (currentUserData.following || []).map((id) => usersInfo[id]).filter(Boolean);
  const suggestions = Object.values(usersInfo)
    .filter((profile) => profile.uid !== user?.uid && !currentUserData.following?.includes(profile.uid))
    .slice(0, 6);

  const renderFriendCard = (profile, showChat = true) => (
    <div key={profile.uid} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <button
        onClick={() => {
          setSelectedProfileId(profile.uid);
          setCurrentView('profile');
        }}
        className="flex items-center gap-3 text-left"
      >
        <img src={profile.photoURL} alt={profile.displayName} className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
        <div>
          <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{profile.displayName}</p>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">{profile.role || 'Member'}</p>
        </div>
      </button>
      {showChat && (
        <button
          onClick={() => {
            setSelectedChatUserId(profile.uid);
            setCurrentView('messages');
          }}
          className="rounded-full border border-blue-500 px-4 py-1.5 text-[12px] font-semibold text-blue-600 transition-colors hover:bg-blue-50"
        >
          Chat
        </button>
      )}
    </div>
  );

  return (
    <div className="pb-12 space-y-6">
      <div className="px-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Friends</h2>
        <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Manage the people you follow and message.</p>
      </div>

      <section>
        <h3 className="mb-3 px-2 text-[15px] font-bold text-slate-900 dark:text-slate-100">Following</h3>
        {following.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-[13px] text-slate-500">You are not following anyone yet.</div>
        ) : (
          <div className="space-y-3">{following.map((profile) => renderFriendCard(profile))}</div>
        )}
      </section>

      <section>
        <h3 className="mb-3 px-2 text-[15px] font-bold text-slate-900 dark:text-slate-100">Followers</h3>
        {followers.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-[13px] text-slate-500">No followers yet.</div>
        ) : (
          <div className="space-y-3">{followers.map((profile) => renderFriendCard(profile))}</div>
        )}
      </section>

      <section>
        <h3 className="mb-3 px-2 text-[15px] font-bold text-slate-900 dark:text-slate-100">Suggested People</h3>
        {suggestions.length === 0 ? (
          <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-[13px] text-slate-500">No suggestions right now.</div>
        ) : (
          <div className="space-y-3">{suggestions.map((profile) => renderFriendCard(profile, false))}</div>
        )}
      </section>
    </div>
  );
}

export function ExploreView({ setSearchQuery, setCurrentView }) {
  const handleTopicClick = (topic) => {
    setSearchQuery(topic);
    setCurrentView('home');
  };

  return (
    <div className="pb-12">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 px-2">
         Explore Network
      </h2>
      <div className="grid gap-4">
        {['React', 'UI/UX Design', 'Backend Systems', 'Cloud DevOps'].map(topic => (
          <div 
            key={topic} 
            onClick={() => handleTopicClick(topic)}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm font-bold text-slate-800 dark:text-slate-200 text-center cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            {topic}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookmarksView({ user, usersInfo, posts }) {
  const currentUserData = usersInfo[user?.uid] || {};
  const savedPostIds = currentUserData.savedPosts || [];
  const savedPosts = posts.filter(p => savedPostIds.includes(p.id));

  return (
    <div className="pb-12">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 px-2 flex items-center gap-2">
        <Bookmark size={24} className="text-blue-500"/> Saved Content
      </h2>
      {savedPosts.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          No saved posts yet.
        </div>
      ) : (
        <div className="space-y-4">
          {savedPosts.map(post => <PostCard key={post.id} post={post} user={user} usersInfo={usersInfo} />)}
        </div>
      )}
    </div>
  );
}

export function GroupInviteView({ token, user, setCurrentView, setSelectedChatUserId, setMessageThreads }) {
  const [invitation, setInvitation] = useState(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingInvitation(true);
    setInvitation(null);
    setError('');
    getGroupInvitation(token)
      .then((result) => {
        if (active) setInvitation(result.group);
      })
      .catch((requestError) => {
        console.error('Failed to load group invitation:', requestError);
        if (active) setError(requestError?.message || 'This invitation is invalid or has been revoked.');
      })
      .finally(() => {
        if (active) setLoadingInvitation(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleJoin = async () => {
    if (!user || !token || joining) return;
    try {
      setJoining(true);
      setError('');
      const result = await joinGroupInvitation(token);
      const conversation = result.conversation;
      if (!conversation?.id) throw new Error('The group could not be loaded after joining.');
      setMessageThreads((currentThreads) => [
        conversation,
        ...currentThreads.filter((thread) => thread.id !== conversation.id),
      ].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)));
      setSelectedChatUserId(conversation.id);
      setCurrentView('messages');
    } catch (joinError) {
      console.error('Failed to join group from invitation:', joinError);
      setError(joinError?.message || 'Could not join this group. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <section className="mx-auto mt-8 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {invitation?.image ? <img src={invitation.image} alt="" className="h-full w-full rounded-full object-cover" /> : <Users size={21} />}
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">
        {loadingInvitation ? 'Checking invitation…' : invitation ? `Join ${invitation.name}` : 'Invitation unavailable'}
      </h2>
      {invitation && (
        <p className="mt-2 text-[13px] text-slate-500">
          {invitation.participantCount} {invitation.participantCount === 1 ? 'participant' : 'participants'} · Join to view and message the group.
        </p>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
      {invitation && (
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining || !user}
          className="mt-5 rounded-full bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {joining ? 'Joining…' : 'Join Group'}
        </button>
      )}
    </section>
  );
}

export function MessagesView({ user, usersInfo, messageThreads, selectedChatUserId, setSelectedChatUserId, setCurrentView, setSelectedProfileId, socket, socketConnected, socketError, presenceMap = {}, setMessageThreads }) {
  const [inputText, setInputText] = useState('');
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const deleteMenuButtonRef = useRef(null);
  const [showGroupCreate, setShowGroupCreate] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupSearchInput, setGroupSearchInput] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupCreateError, setGroupCreateError] = useState('');
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMemberSearch, setGroupMemberSearch] = useState('');
  const [groupManageError, setGroupManageError] = useState('');
  const [groupInviteUrl, setGroupInviteUrl] = useState('');
  const [groupInviteBusy, setGroupInviteBusy] = useState(false);
  const [groupInviteNotice, setGroupInviteNotice] = useState('');
  const [forwardMessageId, setForwardMessageId] = useState(null);
  const [selectedForwardRecipientIds, setSelectedForwardRecipientIds] = useState([]);
  const [forwardingMessage, setForwardingMessage] = useState(false);
  const [forwardError, setForwardError] = useState('');
  const [messageActionId, setMessageActionId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [showMessageDeleteDialog, setShowMessageDeleteDialog] = useState(false);
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [chatSelectionMode, setChatSelectionMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState([]);
  const [deletingThreads, setDeletingThreads] = useState(false);
  const [chatActionError, setChatActionError] = useState('');
  const [chatActionNotice, setChatActionNotice] = useState('');
  const fileInputRef = useRef(null);

  const activeThread = selectedChatUserId
    ? messageThreads.find((t) => (t.type === 'group' && t.id === selectedChatUserId) || t.participants?.includes(selectedChatUserId))
    : null;

  const activeChatUser = selectedChatUserId ? usersInfo[selectedChatUserId] : null;
  const isGroupChat = activeThread?.type === 'group';
  const isGroupAdmin = isGroupChat && activeThread.group?.adminId === user?.uid;
  const selectedMessages = activeThread?.messages?.filter((message) => selectedMessageIds.includes(message.id)) || [];
  const canDeleteSelectedForEveryone = selectedMessageIds.length > 0 &&
    selectedMessages.length === selectedMessageIds.length &&
    selectedMessages.every((message) =>
      !message.deletedForEveryone &&
      ((message.authorId || message.senderId) === user?.uid || (isGroupChat && isGroupAdmin))
    );
  const recipientOnline = !!(activeChatUser?.uid && presenceMap[activeChatUser.uid]);

  useEffect(() => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
    setShowMessageDeleteDialog(false);
    setShowDeleteMenu(false);
    setMessageActionId(null);
    setChatActionError('');
    setChatActionNotice('');
  }, [selectedChatUserId]);

  useEffect(() => {
    setGroupInviteUrl('');
    setGroupInviteNotice('');
    setGroupManageError('');
  }, [activeThread?.id]);

  const applyConversationView = (conversation) => {
    if (!conversation || !setMessageThreads) return;
    setMessageThreads((currentThreads) => [
      conversation,
      ...currentThreads.filter((thread) => thread.id !== conversation.id),
    ].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)));
  };

  const toggleMessageSelection = (messageId) => {
    if (!messageId) return;
    setSelectedMessageIds((current) => current.includes(messageId)
      ? current.filter((id) => id !== messageId)
      : [...current, messageId]);
  };

  const cancelMessageSelection = () => {
    setSelectionMode(false);
    setSelectedMessageIds([]);
    setChatActionError('');
  };

  const startMessageSelection = () => {
    setSelectionMode(true);
    setSelectedMessageIds([]);
    setShowDeleteMenu(false);
  };

  const toggleThreadSelection = (threadId) => {
    setSelectedThreadIds((current) => current.includes(threadId)
      ? current.filter((id) => id !== threadId)
      : [...current, threadId]);
  };

  const handleDeleteSelectedChats = async () => {
    if (!selectedThreadIds.length || deletingThreads) return;
    if (!window.confirm(`Delete ${selectedThreadIds.length} selected conversation${selectedThreadIds.length === 1 ? '' : 's'} from your list? Other participants will keep their copies.`)) return;
    setDeletingThreads(true);
    setChatActionError('');
    const deletedIds = [];
    try {
      for (const threadId of selectedThreadIds) {
        await deleteConversation(threadId);
        deletedIds.push(threadId);
      }
      setMessageThreads((current) => current.filter((thread) => !deletedIds.includes(thread.id)));
      setSelectedThreadIds([]);
      setChatSelectionMode(false);
      setChatActionNotice('Selected conversations deleted from your list.');
    } catch (error) {
      console.error('Failed to delete selected conversations:', error);
      setMessageThreads((current) => current.filter((thread) => !deletedIds.includes(thread.id)));
      setSelectedThreadIds((current) => current.filter((id) => !deletedIds.includes(id)));
      setChatActionError(error?.message || 'Could not delete all selected conversations.');
    } finally {
      setDeletingThreads(false);
    }
  };

  const handleDeleteSelectedMessages = async (forEveryone = false) => {
    if (!activeThread?.id || selectedMessageIds.length === 0) return;

    try {
      setDeletingMessages(true);
      setChatActionError('');
      setChatActionNotice('');
      if (forEveryone) {
        for (const messageId of selectedMessageIds) {
          const result = await deleteMessageForEveryone(activeThread.id, messageId);
          applyConversationView(result.conversation);
        }
      } else {
        const result = await deleteMessagesForMe(activeThread.id, selectedMessageIds);
        applyConversationView(result.conversation);
      }
      setShowMessageDeleteDialog(false);
      cancelMessageSelection();
      setChatActionNotice(forEveryone ? 'Selected messages deleted for everyone.' : 'Selected messages deleted from your view.');
    } catch (error) {
      console.error('Failed to delete selected chat messages:', error);
      setShowMessageDeleteDialog(false);
      setChatActionError(error?.message || 'Could not delete selected messages. Please try again.');
    } finally {
      setDeletingMessages(false);
    }
  };

  const cancelSelectedMessageDeletion = () => {
    if (deletingMessages) return;
    setShowMessageDeleteDialog(false);
  };

  const handleClearChatForMe = async () => {
    if (!activeThread?.id || clearingChat) return;
    if (!window.confirm('Clear Chat from your side only? The other participant will keep their messages and attachments.')) return;

    try {
      setClearingChat(true);
      setChatActionError('');
      setChatActionNotice('');
      const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const result = await clearConversationForMe(activeThread.id, requestId);
      applyConversationView(result.conversation);
      setChatActionNotice('Conversation cleared from your view.');
      cancelMessageSelection();
    } catch (error) {
      console.error('Failed to clear chat for current user:', error);
      setChatActionError(error?.message || 'Could not clear this conversation. Please try again.');
    } finally {
      setClearingChat(false);
    }
  };

  const handleCreateGroup = async () => {
    if (creatingGroup) return;
    try {
      setCreatingGroup(true);
      setGroupCreateError('');
      const result = await createGroupConversation(groupNameInput, selectedGroupMemberIds);
      applyConversationView(result.conversation);
      setShowGroupCreate(false);
      setGroupNameInput('');
      setGroupSearchInput('');
      setSelectedGroupMemberIds([]);
      setSelectedChatUserId(result.conversation.id);
    } catch (error) {
      console.error('Failed to create group:', error);
      setGroupCreateError(error?.message || 'Could not create the group. Please try again.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!isGroupAdmin || !activeThread) return;
    const nextName = window.prompt('Enter a new group name:', activeThread.group?.name || '');
    if (nextName === null || !nextName.trim()) return;
    try {
      setGroupManageError('');
      const result = await updateGroupConversation(activeThread.id, nextName.trim());
      applyConversationView(result.conversation);
    } catch (error) {
      console.error('Failed to update group name:', error);
      setGroupManageError(error?.message || 'Could not update the group name.');
    }
  };

  const handleAddGroupMember = async (participantId) => {
    if (!isGroupAdmin || !activeThread) return;
    try {
      setGroupManageError('');
      const result = await addGroupParticipant(activeThread.id, participantId);
      applyConversationView(result.conversation);
    } catch (error) {
      console.error('Failed to add group member:', error);
      setGroupManageError(error?.message || 'Could not add this participant.');
    }
  };

  const handleRemoveGroupMember = async (participantId) => {
    if (!isGroupAdmin || !activeThread || participantId === activeThread.group?.adminId) return;
    const memberName = usersInfo[participantId]?.displayName || 'this participant';
    if (!window.confirm(`Remove ${memberName} from this group? They will no longer receive new messages or access the group history.`)) return;
    try {
      setGroupManageError('');
      const result = await removeGroupParticipant(activeThread.id, participantId);
      applyConversationView(result.conversation);
    } catch (error) {
      console.error('Failed to remove group member:', error);
      setGroupManageError(error?.message || 'Could not remove this participant.');
    }
  };

  const handleCreateGroupInvitation = async () => {
    if (!isGroupAdmin || !activeThread || groupInviteBusy) return;
    try {
      setGroupInviteBusy(true);
      setGroupManageError('');
      setGroupInviteNotice('');
      const result = await createGroupInvitation(activeThread.id);
      setGroupInviteUrl(`${window.location.origin}/invite/${result.token}`);
      setGroupInviteNotice('Invite link generated. Share it with eligible participants.');
    } catch (error) {
      console.error('Failed to generate group invitation:', error);
      setGroupManageError(error?.message || 'Could not generate an invite link.');
    } finally {
      setGroupInviteBusy(false);
    }
  };

  const handleRevokeGroupInvitation = async () => {
    if (!isGroupAdmin || !activeThread || groupInviteBusy || !groupInviteUrl) return;
    if (!window.confirm('Revoke this invite link? Anyone using it will no longer be able to join.')) return;
    try {
      setGroupInviteBusy(true);
      setGroupManageError('');
      setGroupInviteNotice('');
      await revokeGroupInvitation(activeThread.id);
      setGroupInviteUrl('');
      setGroupInviteNotice('Invite link revoked.');
    } catch (error) {
      console.error('Failed to revoke group invitation:', error);
      setGroupManageError(error?.message || 'Could not revoke the invite link.');
    } finally {
      setGroupInviteBusy(false);
    }
  };

  const handleCopyGroupInvitation = async () => {
    try {
      await navigator.clipboard.writeText(groupInviteUrl);
      setGroupInviteNotice('Invite link copied.');
    } catch (error) {
      console.error('Failed to copy group invitation:', error);
      setGroupManageError('Could not copy the invite link. You can select and copy it manually.');
    }
  };

  const handleForwardMessage = async () => {
    if (!activeThread?.id || !forwardMessageId || selectedForwardRecipientIds.length === 0) return;
    try {
      setForwardingMessage(true);
      setForwardError('');
      const result = await forwardMessage(activeThread.id, forwardMessageId, selectedForwardRecipientIds);
      result.conversations?.forEach(applyConversationView);
      setForwardMessageId(null);
      setSelectedForwardRecipientIds([]);
      setMessageActionId(null);
      setChatActionNotice('Message forwarded.');
    } catch (error) {
      console.error('Failed to forward message:', error);
      setForwardError(error?.message || 'Could not forward this message.');
    } finally {
      setForwardingMessage(false);
    }
  };

  const toggleGroupMemberSelection = (participantId) => {
    setSelectedGroupMemberIds((current) => current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId]);
  };

  const toggleForwardRecipientSelection = (recipientId) => {
    setSelectedForwardRecipientIds((current) => current.includes(recipientId)
      ? current.filter((id) => id !== recipientId)
      : [...current, recipientId]);
  };

  const uploadAttachments = async (files) => {
    if (!files.length) return [];
    const invalidFile = files.find((file) => getMediaFileError(file, { allowAttachments: true, allowArchives: false }));
    if (invalidFile) {
      throw new Error(getMediaFileError(invalidFile, { allowAttachments: true, allowArchives: false }));
    }

    const token = readToken();
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await fetch(`${apiBaseUrl}/api/chat/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      let message = 'Attachment upload failed';
      try {
        const data = await response.json();
        message = data?.message || message;
      } catch {
        message = response.statusText || message;
      }
      throw new Error(message);
    }

    const data = await response.json();
    return Array.isArray(data?.attachments) ? data.attachments : [];
  };

  const handleAttachmentSelection = (event) => {
    const nextFiles = Array.from(event.target.files || []);
    if (!nextFiles.length) return;

    const invalidFiles = nextFiles.filter((file) => file.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      setUploadError('One or more files exceed the 10MB attachment limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const nextSelected = [...selectedFiles, ...nextFiles].slice(0, 6);
    setSelectedFiles(nextSelected);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async () => {
    const trimmedText = inputText.trim();
    const hasAttachmentPayload = selectedFiles.length > 0;

    if ((!trimmedText && !hasAttachmentPayload) || !selectedChatUserId || !user?.uid) return;
    if (!socket || !socketConnected) {
      setUploadError('Chat is disconnected. Please try again when the connection is restored.');
      return;
    }

    try {
      setUploadingFiles(true);
      setUploadError('');

      const uploadedAttachments = hasAttachmentPayload ? await uploadAttachments(selectedFiles) : [];
      if (hasAttachmentPayload && uploadedAttachments.length === 0) {
        throw new Error('No attachments were uploaded.');
      }

      socket.emit('message:send', {
        from: user.uid,
        to: selectedChatUserId,
        ...(isGroupChat ? { threadId: activeThread.id } : {}),
        text: trimmedText,
        attachments: uploadedAttachments,
      });

      setInputText('');
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Chat message send failed:', error);
      setUploadError(error?.message || 'Unable to send the message. Please try again.');
    } finally {
      setUploadingFiles(false);
    }
  };

  if (selectedChatUserId && (activeChatUser || isGroupChat)) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <div className={selectionMode ? 'hidden' : 'flex items-center gap-3'}>
            <button
              onClick={() => setSelectedChatUserId(null)}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-500"
            >
              <X size={20} />
            </button>
            {isGroupChat ? (
              <button type="button" onClick={() => setShowGroupInfo(true)} className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  {activeThread.group?.image
                    ? <img src={activeThread.group.image} alt="" className="h-full w-full rounded-full object-cover" />
                    : <Users size={18} />}
                </div>
                <div>
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">{activeThread.group?.name || 'Group chat'}</p>
                  <p className="text-[12px] text-slate-500">{activeThread.participants?.length || 0} participants · View group info</p>
                </div>
              </button>
            ) : (
              <button
                onClick={() => { setSelectedProfileId(activeChatUser.uid); setCurrentView('profile'); }}
                className="flex items-center gap-3 text-left"
              >
                <img src={activeChatUser.photoURL} alt={activeChatUser.displayName} className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">{activeChatUser.displayName}</p>
                  <p className="text-[12px] text-slate-500">{recipientOnline ? 'Online' : 'Offline'}</p>
                </div>
              </button>
            )}
          </div>
          {activeThread && (
            <div className={`relative flex items-center gap-2 ${selectionMode ? 'w-full' : ''}`}>
              {selectionMode ? (
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={cancelMessageSelection}
                    disabled={deletingMessages}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 disabled:opacity-50 dark:hover:bg-slate-800"
                    title="Cancel message selection"
                    aria-label="Cancel message selection"
                  >
                    <X size={20} />
                  </button>
                  <span aria-live="polite" className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                    {selectedMessageIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMessageDeleteDialog(true)}
                    disabled={selectedMessageIds.length === 0 || deletingMessages}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                    title="Delete selected messages"
                    aria-label="Delete selected messages"
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              ) : (
                <button
                  ref={deleteMenuButtonRef}
                  type="button"
                  onClick={() => setShowDeleteMenu((open) => !open)}
                  className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  title="Message deletion options"
                  aria-label="Message deletion options"
                  aria-expanded={showDeleteMenu}
                >
                  <Trash2 size={20} />
                </button>
              )}
              {showDeleteMenu && !selectionMode && (
                <PositionedPopover
                  anchorRef={deleteMenuButtonRef}
                  onClose={() => setShowDeleteMenu(false)}
                  className="z-[100] w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteMenu(false);
                      handleClearChatForMe();
                    }}
                    disabled={!activeThread.messages?.length || clearingChat}
                    className="w-full px-4 py-3 text-left text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Clear Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      startMessageSelection();
                    }}
                    className="w-full border-t border-slate-100 px-4 py-3 text-left text-[13px] font-semibold text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Delete Chat
                  </button>
                </PositionedPopover>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fffdfa] dark:bg-[#1a1512]">
          {chatActionError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {chatActionError}
            </div>
          )}
          {chatActionNotice && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              {chatActionNotice}
            </div>
          )}
          {selectionMode && (
            <div className="text-[12px] text-slate-500">
              Select messages to delete.
            </div>
          )}
          {!activeThread?.messages?.length ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p className="text-[14px]">Send a message to start the conversation.</p>
            </div>
          ) : (
            activeThread.messages.map((msg, idx) => {
              const isOwnMessage = (msg.authorId || msg.senderId) === user?.uid;
              const messageTimestamp = readMessageTimestamp(msg);
              const attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
              const needsText = typeof msg.text === 'string' && msg.text.trim().length > 0;
              const isSelected = selectedMessageIds.includes(msg.id);

              return (
                <div
                  key={msg.id || idx}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${selectionMode ? 'cursor-pointer' : ''}`}
                  onClick={() => selectionMode && toggleMessageSelection(msg.id)}
                  onKeyDown={(event) => {
                    if (selectionMode && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      toggleMessageSelection(msg.id);
                    }
                  }}
                  role={selectionMode ? 'button' : undefined}
                  tabIndex={selectionMode ? 0 : undefined}
                  aria-pressed={selectionMode ? isSelected : undefined}
                >
                  <div className={`relative max-w-[72%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-sm'
                  } ${isSelected ? 'ring-2 ring-amber-400' : ''}`}>
                    {selectionMode && (
                      <span className={`absolute -top-2 ${isOwnMessage ? '-left-2' : '-right-2'} flex h-5 w-5 items-center justify-center rounded-full border ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400 bg-white text-transparent dark:bg-slate-700'}`}>
                        {isSelected && <Check size={12} />}
                      </span>
                    )}
                    {isGroupChat && (
                      <p className={`mb-1 text-[11px] font-semibold ${isOwnMessage ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}>
                        {isOwnMessage ? 'You' : (usersInfo[msg.authorId]?.displayName || 'Group member')}
                      </p>
                    )}
                    {msg.forwardedFrom && (
                      <p className={`mb-1 flex items-center gap-1 text-[10px] italic ${isOwnMessage ? 'text-blue-100' : 'text-slate-500'}`}>
                        <Forward size={12} /> Forwarded
                        {usersInfo[msg.forwardedFrom.userId]?.displayName
                          ? ` from ${usersInfo[msg.forwardedFrom.userId].displayName}`
                          : ''}
                      </p>
                    )}
                    {attachments.length > 0 && (
                      <div className="mb-2 space-y-2">
                        {attachments.map((attachment, attachmentIndex) => {
                          const isImage = (attachment?.mimeType || attachment?.type || '').startsWith('image/') || attachment?.type === 'image';
                          const isVideo = (attachment?.mimeType || attachment?.type || '').startsWith('video/') || attachment?.type === 'video';
                          const attachmentUrl = getChatAttachmentUrl(attachment?.url || '');
                          const fileName = attachment?.filename || attachment?.storedName || `Attachment ${attachmentIndex + 1}`;

                          if (isImage && attachmentUrl) {
                            return (
                              <button
                                key={`${attachment?.id || attachmentIndex}-image`}
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!selectionMode) setPreviewImage(attachmentUrl);
                                }}
                                className="block overflow-hidden rounded-xl border border-white/20 bg-white/10"
                              >
                                <img src={attachmentUrl} alt={fileName} className="max-h-52 w-full object-cover" />
                              </button>
                            );
                          }

                          if (isVideo && attachmentUrl) {
                            return (
                              <video
                                key={`${attachment?.id || attachmentIndex}-video`}
                                src={attachmentUrl}
                                controls
                                preload="metadata"
                                className="max-h-64 w-full rounded-xl border border-white/20 bg-black"
                              />
                            );
                          }

                          return (
                            <a
                              key={`${attachment?.id || attachmentIndex}-file`}
                              href={attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (selectionMode) event.preventDefault();
                              }}
                              className="flex items-center gap-3 rounded-xl border border-current/10 bg-white/10 px-3 py-2 text-left"
                            >
                              <div className="rounded-lg bg-white/10 p-2"><FileText size={16} /></div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-medium">{fileName}</p>
                                <p className="text-[10px] opacity-75">{formatFileSize(Number(attachment?.size) || 0)}</p>
                              </div>
                              <Download size={14} className="opacity-70" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                    {needsText && <p className="text-[14px] leading-relaxed break-words">{msg.text}</p>}
                    <p className={`text-[10px] mt-1 text-right ${isOwnMessage ? 'text-blue-200' : 'text-slate-400'}`}>
                      {messageTimestamp ? formatSafeTime(messageTimestamp) : ''}
                    </p>
                    {!selectionMode && !msg.deletedForEveryone && (
                      <div className="absolute -bottom-2 right-1 z-10">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMessageActionId((current) => current === msg.id ? null : msg.id);
                          }}
                          className="rounded-full bg-white/90 p-1 text-slate-500 shadow-sm hover:text-blue-600 dark:bg-slate-900/90 dark:text-slate-300"
                          title="Message actions"
                          aria-label="Message actions"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {messageActionId === msg.id && (
                          <div
                            className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setForwardMessageId(msg.id);
                                setSelectedForwardRecipientIds([]);
                                setForwardError('');
                                setMessageActionId(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <Forward size={14} /> Forward
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {socketError && (
            <div className="mb-2 text-[12px] text-red-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Disconnected from chat server
            </div>
          )}
          {uploadError && (
            <div className="mb-2 text-[12px] text-red-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> {uploadError}
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((file, index) => {
                const previewUrl = typeof file.type === 'string' && file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
                return (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                      {previewUrl ? <img src={previewUrl} alt={file.name} className="h-10 w-10 rounded-md object-cover" /> : <FileText size={16} className="text-slate-400" />}
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">{file.name}</p>
                        <p className="text-[10px] text-slate-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      className="rounded-full p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={handleAttachmentSelection}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Add attachment"
            >
              <Paperclip size={18} />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-full px-4 py-2.5 text-[14px] text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <button
              onClick={handleSendMessage}
              disabled={(!inputText.trim() && selectedFiles.length === 0) || !socketConnected || uploadingFiles}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploadingFiles ? <ImageIcon size={18} /> : <MessageSquare size={18} />}
            </button>
          </div>
          {uploadingFiles && (
            <div className="mt-2 text-[11px] text-slate-500">Uploading attachments...</div>
          )}
        </div>

        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setPreviewImage(null)}>
            <button type="button" className="absolute right-4 top-4 rounded-full bg-slate-800 p-2 text-white" onClick={() => setPreviewImage(null)}>
              <X size={20} />
            </button>
            <img src={previewImage} alt="Preview" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
          </div>
        )}

        {showMessageDeleteDialog && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"
            onClick={cancelSelectedMessageDeletion}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-message-title"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancelSelectedMessageDeletion();
              }}
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:p-6"
            >
              <h3 id="delete-message-title" className="mb-5 text-center text-lg font-bold text-slate-900 dark:text-white">
                {selectedMessageIds.length === 1 ? 'Delete message?' : 'Delete messages?'}
              </h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleDeleteSelectedMessages(false)}
                  disabled={deletingMessages}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-[14px] font-semibold text-slate-800 transition-colors hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  {deletingMessages ? 'Deleting...' : 'Delete for me'}
                </button>
                {canDeleteSelectedForEveryone && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSelectedMessages(true)}
                    disabled={deletingMessages}
                    className="min-h-12 w-full rounded-xl bg-red-600 px-4 py-3 text-center text-[14px] font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {deletingMessages ? 'Deleting...' : 'Delete for everyone'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={cancelSelectedMessageDeletion}
                  disabled={deletingMessages}
                  className="min-h-11 w-full rounded-xl px-4 py-2.5 text-center text-[14px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </section>
          </div>
        )}

        {showGroupInfo && isGroupChat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setShowGroupInfo(false)}>
            <section className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{activeThread.group?.name || 'Group chat'}</h3>
                  <p className="text-[12px] text-slate-500">{activeThread.participants.length} participants</p>
                </div>
                <div className="flex items-center gap-2">
                  {isGroupAdmin && (
                    <button type="button" onClick={handleUpdateGroupName} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Edit group name">
                      <Pencil size={16} />
                    </button>
                  )}
                  <button type="button" onClick={() => setShowGroupInfo(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close group information">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {groupManageError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">{groupManageError}</p>}
              {groupInviteNotice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{groupInviteNotice}</p>}
              {isGroupAdmin && (
                <div className="mb-5 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><LinkIcon size={15} /> Share Invite Link</h4>
                    <button
                      type="button"
                      onClick={handleCreateGroupInvitation}
                      disabled={groupInviteBusy}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {groupInviteBusy ? 'Working...' : groupInviteUrl ? 'Regenerate' : 'Generate'}
                    </button>
                  </div>
                  {groupInviteUrl && (
                    <div className="flex gap-2">
                      <input aria-label="Group invitation link" readOnly value={groupInviteUrl} className="min-w-0 flex-1 rounded-lg bg-slate-100 px-2 py-2 text-[11px] text-slate-700 outline-none dark:bg-slate-800 dark:text-slate-200" />
                      <button type="button" onClick={handleCopyGroupInvitation} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                        <Copy size={13} /> Copy
                      </button>
                      <button type="button" onClick={handleRevokeGroupInvitation} disabled={groupInviteBusy} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10">
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">Participants</h4>
                {isGroupAdmin && <span className="text-[11px] text-slate-500">You are the admin</span>}
              </div>
              <div className="space-y-2">
                {activeThread.participants.map((participantId) => {
                  const participant = usersInfo[participantId] || {};
                  const isAdmin = participantId === activeThread.group?.adminId;
                  const online = !!presenceMap[participantId];
                  return (
                    <div key={participantId} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <img src={participant.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(participant.displayName || 'Member')}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-100">{participant.displayName || participant.name || participantId}</p>
                        <p className="text-[11px] text-slate-500">{online ? 'Online' : 'Offline'}</p>
                      </div>
                      {isAdmin && <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"><Shield size={12} /> Admin</span>}
                      {isGroupAdmin && !isAdmin && (
                        <button type="button" onClick={() => handleRemoveGroupMember(participantId)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10">Remove</button>
                      )}
                    </div>
                  );
                })}
              </div>

              {isGroupAdmin && (
                <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200"><UserPlus size={15} /> Add participants</h4>
                  <input value={groupMemberSearch} onChange={(event) => setGroupMemberSearch(event.target.value)} placeholder="Search people..." className="mb-2 w-full rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-900 outline-none dark:bg-slate-800 dark:text-white" />
                  <div className="max-h-36 space-y-1 overflow-y-auto">
                    {Object.values(usersInfo)
                      .filter((person) => person.uid !== user?.uid && !activeThread.participants.includes(person.uid))
                      .filter((person) => `${person.displayName || ''} ${person.username || ''} ${person.email || ''}`.toLowerCase().includes(groupMemberSearch.toLowerCase()))
                      .map((person) => (
                        <button key={person.uid} type="button" onClick={() => handleAddGroupMember(person.uid)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                          <img src={person.photoURL} alt="" className="h-7 w-7 rounded-full object-cover" />
                          <span className="flex-1 truncate text-[12px] text-slate-700 dark:text-slate-200">{person.displayName || person.name}</span>
                          <UserPlus size={14} className="text-blue-600" />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {forwardMessageId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => !forwardingMessage && setForwardMessageId(null)}>
            <section className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Forward message</h3>
                <button type="button" onClick={() => setForwardMessageId(null)} disabled={forwardingMessage} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
              </div>
              {forwardError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">{forwardError}</p>}
              <p className="mb-2 text-[12px] text-slate-500">Choose people or groups:</p>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {Object.values(usersInfo).filter((person) => person.uid !== user?.uid).map((person) => (
                  <label key={person.uid} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={selectedForwardRecipientIds.includes(person.uid)} onChange={() => toggleForwardRecipientSelection(person.uid)} />
                    <img src={person.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <span className="text-[13px] text-slate-800 dark:text-slate-100">{person.displayName || person.name}</span>
                  </label>
                ))}
                {messageThreads.filter((thread) => thread.type === 'group').map((thread) => (
                  <label key={thread.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={selectedForwardRecipientIds.includes(thread.id)} onChange={() => toggleForwardRecipientSelection(thread.id)} />
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"><Users size={15} /></span>
                    <span className="text-[13px] text-slate-800 dark:text-slate-100">{thread.group?.name || 'Group chat'}</span>
                  </label>
                ))}
              </div>
              {selectedForwardRecipientIds.length > 0 && <p className="mt-3 text-[11px] text-slate-500">{selectedForwardRecipientIds.length} recipient{selectedForwardRecipientIds.length === 1 ? '' : 's'} selected</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setForwardMessageId(null)} disabled={forwardingMessage} className="rounded-full px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button type="button" onClick={handleForwardMessage} disabled={!selectedForwardRecipientIds.length || forwardingMessage} className="rounded-full bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{forwardingMessage ? 'Forwarding...' : 'Forward'}</button>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  // Inbox View
  return (
    <div className="pb-12">
      <div className="px-2 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageCircle size={24} className="text-blue-500"/> Messages
          </h2>
          <div className="flex items-center gap-2">
            {chatSelectionMode ? (
              <>
                <button
                  type="button"
                  onClick={handleDeleteSelectedChats}
                  disabled={!selectedThreadIds.length || deletingThreads}
                  className="flex items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 size={15} /> {deletingThreads ? 'Deleting...' : `Delete${selectedThreadIds.length ? ` (${selectedThreadIds.length})` : ''}`}
                </button>
                <button
                  type="button"
                  onClick={() => { setChatSelectionMode(false); setSelectedThreadIds([]); }}
                  disabled={deletingThreads}
                  className="rounded-full px-3 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setShowGroupCreate(true); setGroupCreateError(''); }} className="flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-700 sm:px-4">
                  <Users size={15} /><span className="hidden sm:inline">New Group</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setChatSelectionMode(true); setSelectedThreadIds([]); }}
                  disabled={!messageThreads.length}
                  aria-label="Select conversations to delete"
                  title="Select conversations to delete"
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 size={15} /><span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
        {socketError && <p className="text-[12px] text-red-500 mt-1">Disconnected. Reconnecting...</p>}
        {chatActionError && <p className="text-[12px] text-red-500 mt-1">{chatActionError}</p>}
        {chatActionNotice && <p className="text-[12px] text-emerald-600 mt-1 dark:text-emerald-400">{chatActionNotice}</p>}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {messageThreads.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <MessageSquare size={48} className="text-slate-300 dark:text-slate-700 mb-4" />
            <p className="text-[15px] font-semibold text-slate-700 dark:text-slate-300">No messages yet</p>
            <p className="text-[13px] text-slate-500 mt-1 mb-6">Connect with friends to start chatting.</p>
            <button 
              onClick={() => setCurrentView('friends')}
              className="px-6 py-2 bg-blue-600 text-white rounded-full text-[13px] font-semibold hover:bg-blue-700 transition-colors"
            >
              Find Friends
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {messageThreads.map(thread => {
              const isGroup = thread.type === 'group';
              const otherUserId = thread.participants?.find(id => id !== user?.uid);
              const otherUser = usersInfo[otherUserId];
              if (!isGroup && !otherUser) return null;
              const title = isGroup ? (thread.group?.name || 'Group chat') : otherUser.displayName;
              const subtitle = thread.lastMessage || 'Start a conversation';

              return (
                <div
                  key={thread.id}
                  className={`relative group flex items-center p-4 transition-colors cursor-pointer ${selectedThreadIds.includes(thread.id) ? 'bg-red-50 dark:bg-red-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  onClick={() => chatSelectionMode
                    ? toggleThreadSelection(thread.id)
                    : setSelectedChatUserId(isGroup ? thread.id : otherUserId)}
                  onKeyDown={(event) => {
                    if (chatSelectionMode && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      toggleThreadSelection(thread.id);
                    }
                  }}
                  role={chatSelectionMode ? 'checkbox' : undefined}
                  tabIndex={chatSelectionMode ? 0 : undefined}
                  aria-checked={chatSelectionMode ? selectedThreadIds.includes(thread.id) : undefined}
                >
                  {chatSelectionMode && (
                    <span className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selectedThreadIds.includes(thread.id) ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {selectedThreadIds.includes(thread.id) && <Check size={12} />}
                    </span>
                  )}
                  {isGroup ? (
                    <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-blue-50 text-blue-600 dark:border-slate-700 dark:bg-blue-500/10 dark:text-blue-400">
                      {thread.group?.image ? <img src={thread.group.image} alt="" className="h-full w-full rounded-full object-cover" /> : <Users size={19} />}
                    </div>
                  ) : (
                    <img src={otherUser.photoURL} alt={otherUser.displayName} className="w-12 h-12 rounded-full object-cover mr-4 border border-slate-200 dark:border-slate-700" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h3 className="text-[15px] font-bold text-slate-900 dark:text-white truncate pr-2">{title}</h3>
                      <span className="text-[11px] text-slate-400 whitespace-nowrap">
                        {thread.messages?.length > 0 ? formatConversationDate(readMessageTimestamp(thread.messages[thread.messages.length - 1])) : '—'}
                      </span>
                    </div>
                    <p className="text-[13px] text-slate-500 truncate pr-8">
                      {subtitle}
                    </p>
                  </div>
                  
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showGroupCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => !creatingGroup && setShowGroupCreate(false)}>
          <section className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Create group</h3>
              <button type="button" onClick={() => setShowGroupCreate(false)} disabled={creatingGroup} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
            </div>
            {groupCreateError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:bg-red-500/10 dark:text-red-400">{groupCreateError}</p>}
            <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="new-group-name">Group name</label>
            <input id="new-group-name" value={groupNameInput} onChange={(event) => setGroupNameInput(event.target.value)} maxLength={80} placeholder="Enter a group name" className="mb-4 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40 dark:bg-slate-800 dark:text-white" />
            <label className="mb-1 block text-[12px] font-semibold text-slate-600 dark:text-slate-300" htmlFor="new-group-search">Add participants</label>
            <input id="new-group-search" value={groupSearchInput} onChange={(event) => setGroupSearchInput(event.target.value)} placeholder="Search people..." className="mb-2 w-full rounded-xl bg-slate-100 px-3 py-2.5 text-[13px] text-slate-900 outline-none dark:bg-slate-800 dark:text-white" />
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {Object.values(usersInfo)
                .filter((person) => person.uid !== user?.uid)
                .filter((person) => `${person.displayName || ''} ${person.username || ''} ${person.email || ''}`.toLowerCase().includes(groupSearchInput.toLowerCase()))
                .map((person) => (
                  <label key={person.uid} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input type="checkbox" checked={selectedGroupMemberIds.includes(person.uid)} onChange={() => toggleGroupMemberSelection(person.uid)} />
                    <img src={person.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <span className="flex-1 text-[13px] text-slate-800 dark:text-slate-100">{person.displayName || person.name}</span>
                  </label>
                ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">{selectedGroupMemberIds.length} selected · You will be the group administrator.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowGroupCreate(false)} disabled={creatingGroup} className="rounded-full px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={handleCreateGroup} disabled={!groupNameInput.trim() || selectedGroupMemberIds.length === 0 || creatingGroup} className="rounded-full bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{creatingGroup ? 'Creating...' : 'Create group'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
