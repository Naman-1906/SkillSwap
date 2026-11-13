import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Bookmark,
  Flag,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Send,
  Smile,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { toggleSavedPost } from '../services/mongoApi';
import { deletePost, notifyPostsChanged, updatePost, uploadPostMedia } from '../services/postsApi';
import { getMediaFileError } from '../utils/mediaFiles';

export default function PostCard({ post, user, usersInfo, setCurrentView, setSelectedProfileId }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showCommentEmojiPicker, setShowCommentEmojiPicker] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const commentImageInputRef = useRef(null);
  const lastClickRef = useRef(0);

  const author = usersInfo[post.authorId] || {
    displayName: 'Unknown User',
    photoURL: `https://i.pravatar.cc/150?u=${post.authorId}`,
    role: 'Member'
  };

  const currentUserData = usersInfo[user?.uid] || {};
  const isSaved = currentUserData.savedPosts?.includes(post.id);
  const media = post.mediaUrl || post.imageUrl;
  const isVideo = Boolean(media && (
    (post.mediaType || '').startsWith('video') ||
    /\.(mp4|webm|ogg)(?:$|[?#])/i.test(media) ||
    media.startsWith('data:video')
  ));
  const reactions = post.reactions || (post.likes || []).map((userId) => ({ userId, type: 'like' }));
  const currentReaction = reactions.find((reaction) => reaction.userId === user?.uid)?.type || null;
  const isLiked = currentReaction === 'like';
  const reactionCount = reactions.length;
  const reports = post.reports || [];
  const isReported = user?.uid ? reports.includes(user.uid) : false;
  const commentCount = (post.comments || []).length;
  const topReactionTypes = [...new Set(reactions.map((reaction) => reaction.type))].slice(0, 3);

  useEffect(() => {
    setVideoLoading(Boolean(isVideo));
    setVideoError(false);
  }, [media, isVideo]);
  

  const reactionPalette = [
    { id: 'like', emoji: '👍', label: 'Like', color: 'bg-blue-500' },
    { id: 'celebrate', emoji: '👏', label: 'Celebrate', color: 'bg-green-500' },
    { id: 'support', emoji: '🤝', label: 'Support', color: 'bg-purple-500' },
    { id: 'love', emoji: '❤️', label: 'Love', color: 'bg-rose-500' },
    { id: 'insightful', emoji: '💡', label: 'Insightful', color: 'bg-amber-500' },
    { id: 'funny', emoji: '😄', label: 'Funny', color: 'bg-cyan-500' },
  ];
  const visibleReactionPalette = isLiked
    ? reactionPalette.filter((reaction) => reaction.id !== 'like')
    : reactionPalette;
  const commentEmojiPalette = ['😀', '😂', '😍', '👏', '🔥', '👍', '🎉', '💡'];

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const timeAgo = (timestamp) => {
    const safeTimestamp = Number(timestamp) || 0;
    const diff = Math.max(0, now - safeTimestamp);
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  const handleLike = async (event) => {
    const clickTimestamp = event?.timeStamp || 0;
    const isDoubleClick = clickTimestamp - lastClickRef.current < 300;
    lastClickRef.current = clickTimestamp;

    if (isDoubleClick && !isLiked) {

      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 600);
    }

    await handleReactionSelect(currentReaction === 'like' ? null : 'like');
  };

  const handleReactionSelect = async (type) => {
    if (!user) return;
    try {
      const existing = reactions.find((reaction) => reaction.userId === user.uid);
      let nextReactions;

      if (!type && existing) {
        nextReactions = reactions.filter((reaction) => reaction.userId !== user.uid);
      } else if (existing) {
        nextReactions = reactions.map((reaction) =>
          reaction.userId === user.uid ? { ...reaction, type } : reaction
        );
      } else {
        nextReactions = [...reactions, { userId: user.uid, type }];
      }

      await updatePost(post.id, {
        reactions: nextReactions,
        likes: nextReactions.map((reaction) => reaction.userId),
      });
      notifyPostsChanged();
      setShowReactionPicker(false);
    } catch (error) {
      console.error('Reaction update failed:', error);
    }
  };

  const handleDelete = async () => {
    if (!user || user.uid !== post.authorId) return;
    try {
      await deletePost(post.id);
      notifyPostsChanged();
    } catch (error) {
      console.error('Post deletion failed:', error);
    }
  };

  const handleAddComment = async () => {
    if (!user || (!commentText.trim() && !commentImage)) return;
    setIsCommenting(true);
    try {
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        authorId: user.uid,
        text: commentText.trim(),
        imageUrl: commentImage,
        createdAt: Date.now()
      };
      await updatePost(post.id, { comments: [...(post.comments || []), newComment] });
      notifyPostsChanged();
      setCommentText('');
      setCommentImage('');
      setShowCommentEmojiPicker(false);
    } catch (error) {
      console.error('Comment creation failed:', error);
    }
    setIsCommenting(false);
  };

  const handleCommentImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formatError = getMediaFileError(file, { allowAttachments: false });
    if (formatError || !/\.(jpe?g|png|webp|gif)$/i.test(file.name || '')) {
      alert(formatError || 'Please choose a supported image file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Comment image is too large (Max 10MB).');
      return;
    }
    try {
      const uploaded = await uploadPostMedia(file);
      setCommentImage(uploaded.url);
      setShowComments(true);
    } catch (error) {
      alert(error?.message || 'Could not upload comment image.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!user) return;
    const targetComment = (post.comments || []).find((comment) => comment.id === commentId);
    if (!targetComment || targetComment.authorId !== user.uid) return;

    try {
      await updatePost(post.id, {
        comments: (post.comments || []).filter((comment) => comment.id !== commentId),
      });
      notifyPostsChanged();
    } catch (error) {
      console.error('Comment deletion failed:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    try {
      await toggleSavedPost(user.uid, post.id);
    } catch (error) {
      console.error('Save post failed:', error);
    }
  };

  const handleReport = async () => {
    if (!user) return;
    if (isReported) return;
    try {
      await updatePost(post.id, {
        reports: [...reports, user.uid],
      });
      notifyPostsChanged();
      alert('Report submitted. Thanks for helping keep the feed safe.');
    } catch (error) {
      console.error('Report update failed:', error);
    }
  };

  const handleSend = async () => {
    const url = `${window.location.origin}/#post-${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || 'Check out this post',
          text: post.content?.slice(0, 120) || 'Take a look at this post',
          url,
        });
        return;
      } catch (error) {
        console.error('Share action failed:', error);
      }
    }

    try {
      await navigator.clipboard?.writeText(url);
    } catch (error) {
      console.error('Clipboard copy failed:', error);
    }
  };

  const getTypeStyle = (type) => {
    switch (type) {
      case 'sharing':
        return { color: 'text-emerald-600', icon: BookOpen, label: 'Sharing', bg: 'bg-emerald-50 dark:bg-emerald-500/10' };
      case 'discussion':
        return { color: 'text-orange-500', icon: MessageCircle, label: 'Discussion', bg: 'bg-orange-50 dark:bg-orange-500/10' };
      case 'interested':
        return { color: 'text-blue-600', icon: UserPlus, label: 'Interested', bg: 'bg-blue-50 dark:bg-blue-500/10' };
      default:
        return null;
    }
  };

  const typeStyle = getTypeStyle(post.postType);

  const openAuthorProfile = (authorId) => {
    if (!authorId) return;
    setSelectedProfileId?.(authorId);
    setCurrentView?.('profile');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} whileHover={{ y: -2, boxShadow: '0 20px 48px rgba(90,101,195,0.2)' }} className="rounded-[1.7rem] border border-[#dbe2ff] bg-[#f9fbff] p-6 shadow-[0_16px_36px_rgba(90,101,195,0.12)] dark:border-[#2d2b4f] dark:bg-[#16152a]">
      <div className="mb-2 flex items-start gap-3">
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => openAuthorProfile(post.authorId)} className="shrink-0 cursor-pointer">
          <img src={author.photoURL} alt={author.displayName} className="h-10 w-10 rounded-full border border-[#dbe2ff] bg-[#eef4ff] object-cover dark:border-[#3c3866] dark:bg-[#1d1c35]" />
        </motion.button>

        <div className="flex flex-1 items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} onClick={() => openAuthorProfile(post.authorId)} className="cursor-pointer text-[15px] font-bold text-[#1d2342] hover:underline dark:text-slate-100">
                {author.displayName}
              </motion.button>
            </div>
            <div className="text-[12px] font-medium text-[#928679] dark:text-stone-400">{timeAgo(post.createdAt)}</div>
          </div>
          <div className="relative">
            <motion.button whileHover={{ rotate: 90 }} whileTap={{ scale: 0.95 }} onClick={() => setIsMenuOpen(!isMenuOpen)} className="rounded-full p-1.5 text-[#8a92b8] transition-colors hover:bg-[#eef3ff] hover:text-[#56608b] dark:hover:bg-[#201f39]">
              <MoreHorizontal size={18} />
            </motion.button>
            {isMenuOpen && (
              <motion.div initial={{ opacity: 0, scale: 0.95, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-[#dbe2ff] bg-[#f9fbff] py-1 shadow-[0_18px_36px_rgba(90,101,195,0.14)] dark:border-[#2d2b4f] dark:bg-[#16152a]">
                {user?.uid === post.authorId && (
                  <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }} onClick={() => { handleDelete(); setIsMenuOpen(false); }} className="flex w-full items-center gap-3 px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <Trash2 size={14} /> Delete Post
                  </motion.button>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {typeStyle && (
        <div className={`mb-3 mt-1 flex items-center gap-1.5 text-[13px] font-semibold ${typeStyle.color}`}>
          <typeStyle.icon size={14} /> {typeStyle.label}
        </div>
      )}

      <div className="mb-4">
        {post.title && <h3 className="mb-1 text-[16px] font-bold text-[#1d2342] dark:text-slate-100">{post.title}</h3>}
        <p className="whitespace-pre-wrap text-[14px] text-[#534a42] dark:text-stone-200">{post.content}</p>

        {post.skills && post.skills.length > 0 && post.skills[0] !== 'Feed' && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.skills.map((skill) => (
              <span key={skill} className="cursor-pointer text-[13px] text-[#6d49f4] hover:underline dark:text-[#c4b5fd]">
                #{skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {post.attachment?.url && (
        <div className="mb-4">
          <a
            href={post.attachment.url}
            download={post.attachment.name || 'attachment'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          >
            <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Paperclip size={14} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {post.attachment.name || 'Attachment'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Open or download attachment</p>
            </div>
          </a>
        </div>
      )}

      {media && (
        <div className="relative mb-4 flex max-h-[460px] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
          {isVideo ? (
            <>
              <video
                src={media}
                controls
                playsInline
                preload="metadata"
                onCanPlay={() => setVideoLoading(false)}
                onError={() => {
                  setVideoLoading(false);
                  setVideoError(true);
                }}
                className="max-h-[460px] w-full object-contain"
              />
              {(videoLoading || videoError) && (
                <span role={videoError ? 'alert' : 'status'} className="absolute rounded-lg bg-black/70 px-3 py-2 text-sm text-white">
                  {videoError ? 'This video could not be loaded.' : 'Loading video…'}
                </span>
              )}
            </>
          ) : (
            <img src={media} alt="Post media" className="max-h-[460px] w-full object-contain" />
          )}
        </div>
      )}

      {(reactionCount > 0 || commentCount > 0) && (
        <div className="flex items-center justify-between pb-3 text-[12px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            {reactionCount > 0 && (
              <>
                <div className="flex -space-x-1">
                  {topReactionTypes.map((type) => {
                    const reaction = reactionPalette.find((option) => option.id === type);
                    return (
                      <span key={type} className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[12px] shadow-sm dark:border-slate-900 ${reaction?.color || 'bg-slate-400'}`}>
                        {reaction?.emoji || '👍'}
                      </span>
                    );
                  })}
                </div>
                <span>{reactionCount}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {commentCount > 0 && <span>{commentCount} comment{commentCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
      )}

      <div className="relative grid grid-cols-4 items-center gap-2 border-t border-slate-100 pt-3 text-slate-500 dark:border-slate-800">
        {showReactionPicker && (
          <div className="absolute -top-16 left-0 z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            {visibleReactionPalette.map((reaction) => (
              <motion.button
                key={reaction.id}
                whileHover={{ scale: 1.3, rotateZ: 10 }}
                whileTap={{ scale: 1.1 }}
                onClick={() => handleReactionSelect(reaction.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-[20px] transition-transform"
                title={reaction.label}
              >
                {reaction.emoji}
              </motion.button>
            ))}
          </div>
        )}

        <motion.button 
          whileHover={{ y: -2 }} 
          whileTap={{ scale: 0.96 }} 
          animate={likeAnimating && isLiked ? { scale: [1, 1.4, 1.2] } : { scale: 1 }}
          transition={likeAnimating && isLiked ? { duration: 0.6, ease: 'easeOut' } : {}}
          onClick={handleLike} 
          onContextMenu={(e) => { e.preventDefault(); setShowReactionPicker((value) => !value); }} 
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors ${isLiked ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
        >
          <motion.div animate={isLiked ? { rotate: [0, -15, 15, -5, 0] } : {}} transition={{ duration: 0.4 }}>
            <Heart size={18} className={isLiked ? 'fill-current' : ''} />
          </motion.div>
          {!isLiked && <span>{currentReaction ? reactionPalette.find((reaction) => reaction.id === currentReaction)?.label || 'Like' : 'Like'}</span>}
          {reactionCount > 0 && <span className="ml-1 text-xs">({reactionCount})</span>}
        </motion.button>

        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => setShowComments((value) => !value)} className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
          <MessageCircle size={18} />
          <span>Comment</span>
        </motion.button>

        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={handleReport} disabled={isReported} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors ${isReported ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <Flag size={18} className={isReported ? 'fill-current' : ''} />
          <span>{isReported ? 'Reported' : 'Report'}</span>
        </motion.button>

        <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={handleSend} className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[13px] font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
          <Send size={18} />
          <span>Send</span>
        </motion.button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          ref={commentImageInputRef}
          onChange={handleCommentImageUpload}
        />
        <img src={usersInfo[user?.uid]?.photoURL || `https://i.pravatar.cc/150?u=${user?.uid}`} className="h-9 w-9 rounded-full border border-slate-200 object-cover dark:border-slate-700" />
        <div className="relative flex-1">
          {showCommentEmojiPicker && (
            <div className="absolute -top-14 right-0 z-20 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              {commentEmojiPalette.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.3, rotateZ: 10 }}
                  whileTap={{ scale: 1.1 }}
                  onClick={() => {
                    setCommentText((value) => `${value}${emoji}`);
                    setShowCommentEmojiPicker(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[18px] transition-transform"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={commentText}
            onFocus={() => setShowComments(true)}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            placeholder="Add a comment..."
            className="w-full rounded-full border border-slate-300 bg-white py-2.5 pl-4 pr-24 text-[13px] outline-none transition-colors focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-3 text-slate-400">
            <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.95 }} onClick={() => setShowCommentEmojiPicker((value) => !value)} className="transition-colors hover:text-slate-600 dark:hover:text-slate-200">
              <Smile size={18} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.95 }} onClick={() => commentImageInputRef.current?.click()} className="transition-colors hover:text-slate-600 dark:hover:text-slate-200">
              <ImageIcon size={18} />
            </motion.button>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleAddComment} disabled={(!commentText.trim() && !commentImage) || isCommenting} className="rounded-full bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
          Post
        </motion.button>
      </div>

      {commentImage && (
        <div className="ml-11 mt-3 max-w-[220px]">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <img src={commentImage} alt="Comment attachment" className="w-full object-cover" />
            <button
              onClick={() => setCommentImage('')}
              className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white transition-colors hover:bg-slate-900/90"
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }} onClick={handleSave} className={`ml-auto transition-colors hover:text-slate-700 dark:hover:text-slate-300 ${isSaved ? 'text-blue-500' : 'text-slate-500'}`}>
          <Bookmark size={20} className={isSaved ? 'fill-current text-blue-500' : ''} />
        </motion.button>
      </div>

      {showComments && (
        <div className="animate-in slide-in-from-top-2 mt-4 border-t border-slate-100 pt-4 fade-in duration-200 dark:border-slate-800">
          <div className="scrollbar-hide max-h-[300px] space-y-3 overflow-y-auto pr-2">
            {[...(post.comments || [])].sort((a, b) => b.createdAt - a.createdAt).map((c) => {
              const cAuthor = usersInfo[c.authorId] || { displayName: 'User', photoURL: `https://i.pravatar.cc/150?u=${c.authorId}` };
              return (
                <div key={c.id} className="flex gap-2">
                  <img src={cAuthor.photoURL} className="mt-0.5 h-8 w-8 rounded-full border border-slate-200 object-cover dark:border-slate-700" />
                  <div className="flex-1">
                    <div className="inline-block rounded-[16px] rounded-tl-sm bg-slate-100 px-3.5 py-2 dark:bg-slate-800">
                      <span className="mr-2 text-[13px] font-bold text-slate-900 dark:text-slate-100">{cAuthor.displayName}</span>
                      <span className="text-[13px] text-slate-700 dark:text-slate-300">{c.text}</span>
                      {c.imageUrl && (
                        <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                          <img src={c.imageUrl} alt="Comment attachment" className="max-w-[220px] object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="ml-2 mt-1 flex items-center gap-3 text-[11px] font-medium text-slate-500">
                      <span>{timeAgo(c.createdAt)}</span>
                      {c.authorId === user?.uid && (
                        <button onClick={() => handleDeleteComment(c.id)} className="text-rose-500 transition-colors hover:text-rose-600">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
