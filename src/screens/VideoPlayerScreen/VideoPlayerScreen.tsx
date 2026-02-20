import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { Spinner } from '../../components/Spinner';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchOptimizedVideo } from '../../lib/optimizedDataFetcher';
import { backgroundPrefetcher } from '../../lib/backgroundPrefetch';
import { videoCache } from '../../lib/videoCache';
import {
  X, Play, Pause, Maximize, Share2, UserPlus, UserMinus,
  MessageCircle, Eye, Calendar, ChevronDown, ChevronUp, Heart, Gift, Settings, Flag, Send,
  Edit2, Trash2, Check, X as XIcon
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { Card, CardContent } from '../../components/ui/card';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { shareVideo } from '../../lib/shareService';

// Lazy load modals for faster initial render
const CommentsModal = lazy(() => import('../../components/CommentsModal').then(m => ({ default: m.CommentsModal })));
const TippingModal = lazy(() => import('../../components/TippingModal').then(m => ({ default: m.TippingModal })));
const ReportModal = lazy(() => import('../../components/ReportModal').then(m => ({ default: m.ReportModal })));
const AuthModal = lazy(() => import('../../components/AuthModal').then(m => ({ default: m.AuthModal })));
import {
  supabase,
  getVideoDetails,
  getClipLikesCount,
  isClipLiked,
  toggleClipLike,
  getClipComments,
  addClipComment,
  updateClipComment,
  deleteClipComment,
  isFollowing,
  followUser,
  unfollowUser,
  recordShareEvent
} from '../../lib/supabase';
import { videoRecommendationService } from '../../lib/videoRecommendationService';
import { formatDistanceToNowStrict } from 'date-fns';
import { recordPlayback } from '../../lib/playbackTracker';
import { useHLSPlayer } from '../../hooks/useHLSPlayer';
import { recordContribution } from '../../lib/contributionService';

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  playCount: number;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    avatar: string | null;
    followerCount: number;
  };
}

interface MoreVideo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  creatorName: string;
  userId: string;
  playCount: number;
  duration: number;
}

interface Comment {
  id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  parent_comment_id: string | null;
  users: {
    display_name: string;
    avatar_url: string | null;
  };
  likes_count?: number;
  is_liked?: boolean;
  replies?: Comment[];
}

interface VideoPlayerScreenProps {
  onPlayerVisibilityChange?: (isVisible: boolean) => void;
}

export const VideoPlayerScreen: React.FC<VideoPlayerScreenProps> = ({ onPlayerVisibilityChange }) => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { confirm } = useConfirm();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const newCommentRef = useRef<HTMLTextAreaElement>(null);

  // Video state
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<MoreVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<'360p' | '480p' | '720p' | '1080p' | 'auto'>('auto');
  const availableQualities = ['360p', '480p', '720p', '1080p', 'auto'];

  // Interaction state
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'watchNext'>('comments');
  const [isFollowingCreator, setIsFollowingCreator] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showTippingModal, setShowTippingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [likingComments, setLikingComments] = useState<Set<string>>(new Set());
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Touch/swipe state
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [playbackStartTime, setPlaybackStartTime] = useState<number | null>(null);
  const hasRecordedPlaybackRef = useRef(false);

  // Initialize HLS player with mobile-friendly autoplay
  const { setQuality, getCurrentQuality, getAvailableQualities } = useHLSPlayer(videoRef.current, videoData?.videoUrl || null, {
    autoplay: false,
    onError: (error) => {
      console.error('HLS playback error:', error);
      console.error('Video URL was:', videoData?.videoUrl);
      setError('Failed to load video. Please try again or check your connection.');
    },
    onLoadedMetadata: () => {
      console.log('HLS video metadata loaded');
      console.log('Video URL:', videoData?.videoUrl);

      // Auto-start playback with sound on mobile after metadata loads
      if (videoRef.current) {
        videoRef.current.muted = false;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[VideoPlayerScreen] Video autoplay with sound started');
              setIsPlaying(true);
            })
            .catch((err) => {
              console.log('[VideoPlayerScreen] Autoplay with sound blocked, starting muted:', err.message);
              // Fallback: try muted autoplay
              if (videoRef.current) {
                videoRef.current.muted = true;
                videoRef.current.play().catch(e => console.error('Muted autoplay failed:', e));
              }
            });
        }
      }
    },
  });

  // Log when videoData changes
  useEffect(() => {
    if (videoData) {
      console.log('[VideoPlayerScreen] Video data loaded:', {
        id: videoData.id,
        title: videoData.title,
        videoUrl: videoData.videoUrl,
        hasVideoUrl: !!videoData.videoUrl
      });
    }
  }, [videoData]);

  useEffect(() => {
    if (!videoId) {
      setError('Video ID is required');
      setIsLoading(false);
      return;
    }

    console.log('VideoPlayerScreen mounted with videoId:', videoId);

    // Notify parent that video player is active
    onPlayerVisibilityChange?.(true);

    // Try to load from cache first for instant display
    const cached = videoCache.get(videoId);
    if (cached) {
      setVideoData(cached);
      setRelatedVideos(cached.relatedVideos || []);
      setIsLoading(false);
      // Refresh in background
      checkAuthAndLoadData();
    } else {
      // Load immediately if not cached
      checkAuthAndLoadData();
    }
    
    // Add touch event listeners for swipe
    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleContainerTouchStart, { passive: true });
      container.addEventListener('touchend', handleContainerTouchEnd, { passive: true });
    }

    return () => {
      recordPlaybackOnUnmount();
      // Notify parent that video player is no longer active
      onPlayerVisibilityChange?.(false);
      if (container) {
        container.removeEventListener('touchstart', handleContainerTouchStart);
        container.removeEventListener('touchend', handleContainerTouchEnd);
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (videoData && isAuthenticated) {
      checkFollowingStatus();
      checkLikeStatus();
    } else if (!isAuthenticated) {
      setIsLiked(false);
    }
  }, [videoData, isAuthenticated]);

  useEffect(() => {
    if (!videoData?.creator.id) return;

    const channel = supabase
      .channel(`user_follows:${videoData.creator.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_follows',
          filter: `following_id=eq.${videoData.creator.id}`
        },
        async () => {
          console.log('[VideoPlayerScreen] Follow status changed, refreshing follower count');
          try {
            const { getFollowerCount } = await import('../../lib/supabase');
            const newCount = await getFollowerCount(videoData.creator.id);
            setVideoData(prev => prev ? {
              ...prev,
              creator: {
                ...prev.creator,
                followerCount: newCount
              }
            } : null);
          } catch (error) {
            console.error('[VideoPlayerScreen] Error refreshing follower count:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoData?.creator.id]);

  useEffect(() => {
    // Auto-hide controls after 3 seconds of inactivity
    if (showControls && isPlaying) {
      const timer = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showControls, isPlaying]);

  const checkAuthAndLoadData = async () => {
    try {
      setError(null);

      // Try optimized cache first for instant display
      const cachedData = await fetchOptimizedVideo(videoId!);
      if (cachedData && cachedData.video) {
        // Immediately show video - don't wait for anything else
        setVideoData(cachedData.video);
        setIsLoading(false);
        
        // Show cached related videos if available
        if (cachedData.relatedVideos?.length) {
          setRelatedVideos(cachedData.relatedVideos);
          setIsLoadingRelated(false);
        }

        // Cache in our video cache
        videoCache.set(videoId!, {
          ...cachedData.video,
          relatedVideos: cachedData.relatedVideos || [],
        });

        // Load cached like state immediately (no await)
        const cachedLikeState = videoCache.getLikeState(videoId!);
        if (cachedLikeState) {
          setLikesCount(cachedLikeState.likesCount);
          setIsLiked(cachedLikeState.isLiked);
        }

        // Defer all secondary data loading - don't block video display
        setTimeout(() => {
          // Load interactions in background
          if (user) {
            Promise.all([
              getClipLikesCount(videoId!),
              isClipLiked(videoId!)
            ]).then(([likesCount, liked]) => {
              setLikesCount(likesCount);
              setIsLiked(liked);
              videoCache.setLikeState(videoId!, liked, likesCount);
            }).catch(err => console.error('Error loading interactions:', err));
          }
          
          // Load comments without individual likes (faster)
          loadCommentsLite();
          
          // Load related videos if not cached
          if (!cachedData.relatedVideos?.length) {
            loadRelatedVideosInBackground(cachedData.video.creator.id);
          }
        }, 100);

        backgroundPrefetcher.prefetchVideoData(videoId!);
        return;
      }

      // No cache - fetch fresh data
      let video: any;
      try {
        video = await getVideoDetails(videoId!);
        setVideoData(video);
        setIsLoading(false); // Show video immediately
        console.log('Video data loaded successfully:', video);
      } catch (videoError) {
        console.error('Failed to load video:', videoError);
        setError(videoError instanceof Error ? videoError.message : 'Video not found');
        setIsLoading(false);
        return;
      }

      // Defer non-critical data loading
      setTimeout(() => {
        // Load related videos in background
        loadRelatedVideosInBackground(video.creator.id);
        
        // Load interactions
        loadVideoInteractions().catch(err => 
          console.warn('Failed to load video interactions:', err)
        );
        
        // Load comments (lite version without individual likes)
        loadCommentsLite();
      }, 100);

      // Cache the loaded data
      videoCache.set(videoId!, { ...video, relatedVideos: [] });

    } catch (err) {
      console.error('Error loading video data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
      setIsLoading(false);
    }
  };

  // Load related videos in background without blocking
  const loadRelatedVideosInBackground = async (creatorId: string) => {
    try {
      setIsLoadingRelated(true);
      const videos = await videoRecommendationService.getRecommendations(
        videoId!,
        creatorId,
        user?.id || null,
        6
      );
      setRelatedVideos(videos);
      console.log('Smart recommendations loaded:', videos.length);
    } catch (error) {
      console.warn('Failed to load recommendations:', error);
      setRelatedVideos([]);
    } finally {
      setIsLoadingRelated(false);
    }
  };

  // Lite version of loadComments - skip individual like queries for speed
  const loadCommentsLite = async () => {
    if (!videoId) return;

    try {
      const fetchedComments = await getClipComments(videoId);
      // Set comments without individual likes - much faster
      // Likes will be loaded on-demand when user expands comments
      setComments(fetchedComments.map((c: Comment) => ({ ...c, likes_count: 0, is_liked: false })));
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const loadVideoInteractions = async () => {
    if (!videoId) return;

    try {
      const currentLikesCount = await getClipLikesCount(videoId);
      setLikesCount(currentLikesCount);

      if (isAuthenticated) {
        const liked = await isClipLiked(videoId);
        setIsLiked(liked);
      }
    } catch (error) {
      console.error('Error loading video interactions:', error);
    }
  };

  const loadComments = async () => {
    if (!videoId) return;

    try {
      const fetchedComments = await getClipComments(videoId);

      // Load likes count and status for each comment
      const commentsWithLikes = await Promise.all(
        fetchedComments.map(async (comment: Comment) => {
          try {
            const { data: likesData } = await supabase.rpc('get_comment_likes_count', { comment_uuid: comment.id });
            const likesCount = likesData || 0;

            let isLiked = false;
            if (isAuthenticated) {
              const { data: likedData } = await supabase.rpc('is_comment_liked_by_user', { comment_uuid: comment.id });
              isLiked = likedData || false;
            }

            return { ...comment, likes_count: likesCount, is_liked: isLiked };
          } catch (err) {
            console.error('Error loading comment likes:', err);
            return { ...comment, likes_count: 0, is_liked: false };
          }
        })
      );

      setComments(commentsWithLikes);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const checkFollowingStatus = async () => {
    if (!videoData?.creator.id || !isAuthenticated) return;

    try {
      const following = await isFollowing(videoData.creator.id);
      setIsFollowingCreator(following);
    } catch (error) {
      console.error('Error checking following status:', error);
    }
  };

  const checkLikeStatus = async () => {
    if (!videoId || !isAuthenticated) return;

    try {
      const liked = await isClipLiked(videoId);
      const likesCount = await getClipLikesCount(videoId);
      setIsLiked(liked);
      setLikesCount(likesCount);
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const recordPlaybackOnUnmount = () => {
    if (videoRef.current && playbackStartTime && !hasRecordedPlaybackRef.current) {
      const durationListened = Math.floor((Date.now() - playbackStartTime) / 1000);
      recordPlayback(videoId!, durationListened, true, false);
      hasRecordedPlaybackRef.current = true;
    }
  };

  const handleContainerTouchStart = (e: TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleContainerTouchEnd = (e: TouchEvent) => {
    if (touchStartY === null) return;

    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;

    // Threshold for swipe detection (100px)
    if (deltaY > 100) {
      // Swipe down - close video
      handleClose();
    }

    setTouchStartY(null);
  };

  const handleClose = () => {
    recordPlaybackOnUnmount();
    // Notify parent that video player is closing
    onPlayerVisibilityChange?.(false);
    navigate(-1);
  };

  const handleVideoClick = () => {
    setShowControls(true);
    togglePlayPause();
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      const video = videoRef.current;

      console.log('[togglePlayPause] Attempting to play. Video state:', {
        readyState: video.readyState,
        networkState: video.networkState,
        paused: video.paused,
        currentTime: video.currentTime,
        duration: video.duration
      });

      const attemptPlay = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[togglePlayPause] Video playback started successfully');
            })
            .catch(err => {
              console.error('[togglePlayPause] Error playing video:', err);
              console.error('[togglePlayPause] Error details:', {
                name: err.name,
                message: err.message
              });
              setError('Failed to play video. Please try again.');
            });
        }
      };

      if (video.readyState === 0) {
        console.log('[togglePlayPause] Loading video before playing');
        video.load();
        video.addEventListener('canplay', attemptPlay, { once: true });
      } else {
        attemptPlay();
      }

      if (!playbackStartTime) {
        setPlaybackStartTime(Date.now());
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    hasRecordedPlaybackRef.current = false;
    if (!playbackStartTime) {
      setPlaybackStartTime(Date.now());
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    recordPlaybackOnUnmount();
  };

  const handleEnded = () => {
    setIsPlaying(false);
    recordPlaybackOnUnmount();
    setPlaybackStartTime(null);

    // Auto-play next video in Watch Next list
    if (relatedVideos.length > 0) {
      const nextVideo = relatedVideos[0];
      handleVideoChange(nextVideo.id);
    }
  };

  const handleProgressClick = (e: React.MouseEvent | MouseEvent) => {
    if (!videoRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressDrag = (e: MouseEvent) => {
    if (!videoRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const dragX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, dragX / rect.width));
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    // Attach global event listeners for smooth dragging
    const handleMouseMove = (e: MouseEvent) => {
      handleProgressDrag(e);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Handle initial click
    handleProgressClick(e);
  };

  const handleProgressTouch = (e: TouchEvent | React.TouchEvent) => {
    if (!videoRef.current || !progressRef.current || e.touches.length === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, touchX / rect.width));
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Attach global event listeners for smooth touch dragging
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleProgressTouch(e);
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Handle initial touch
    handleProgressTouch(e);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;

    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleQualityChange = (quality: '360p' | '480p' | '720p' | '1080p' | 'auto') => {
    console.log(`Quality changed to: ${quality}`);
    setSelectedQuality(quality);
    setShowQualityMenu(false);

    // Actually change the video quality using HLS.js
    if (quality === 'auto') {
      setQuality(-1); // -1 = auto quality selection
    } else {
      // Map quality strings to HLS level indices
      const qualityMap: Record<string, number> = {
        '360p': 0,
        '480p': 1,
        '720p': 2,
        '1080p': 3,
      };
      const level = qualityMap[quality] ?? -1;
      setQuality(level);
      console.log(`[VideoPlayer] Set HLS quality level to ${level} (${quality})`);
    }
  };

  const handleLikeToggle = useCallback(async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    const previousLikedState = isLiked;
    const previousLikesCount = likesCount;
    const newLikedState = !isLiked;
    const newLikesCount = newLikedState ? likesCount + 1 : Math.max(0, likesCount - 1);

    setIsLiked(newLikedState);
    setLikesCount(newLikesCount);

    // Update cache immediately
    videoCache.setLikeState(videoId!, newLikedState, newLikesCount);

    toggleClipLike(videoId!).then(() => {
      // Track engagement contribution when user likes content
      if (newLikedState && !previousLikedState) {
        recordContribution('video_like', videoId!, 'video').catch(console.error);
      }
    }).catch(error => {
      setIsLiked(previousLikedState);
      setLikesCount(previousLikesCount);
      // Revert cache on error
      videoCache.setLikeState(videoId!, previousLikedState, previousLikesCount);
      console.error('Error toggling like:', error);
    });
  }, [isAuthenticated, isLiked, likesCount, videoId]);

  const handleFollowToggle = async () => {
    if (!videoData?.creator.id) return;

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsLoadingFollow(true);
    try {
      if (isFollowingCreator) {
        await unfollowUser(videoData.creator.id);
        setIsFollowingCreator(false);
      } else {
        await followUser(videoData.creator.id);
        setIsFollowingCreator(true);
        // Track artist follow for contribution rewards
        recordContribution('artist_follow', videoData.creator.id, 'artist').catch(console.error);
      }

      const { getFollowerCount } = await import('../../lib/supabase');
      const newCount = await getFollowerCount(videoData.creator.id);
      setVideoData(prev => prev ? {
        ...prev,
        creator: {
          ...prev.creator,
          followerCount: newCount
        }
      } : null);
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert('Failed to update follow status.');
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleTipSuccess = () => {
    setShowTippingModal(false);
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmittingComment(true);
    try {
      await addClipComment(videoId!, newComment.trim());
      setNewComment('');
      // Reset textarea height after clearing
      if (newCommentRef.current) {
        newCommentRef.current.style.height = 'auto';
      }
      await loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleReplyToComment = async (parentCommentId: string) => {
    if (!replyText.trim()) return;

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmittingComment(true);
    try {
      await addClipComment(videoId!, replyText.trim(), parentCommentId);
      setReplyingTo(null);
      setReplyText('');
      await loadComments();
    } catch (error) {
      console.error('Error replying to comment:', error);
      alert('Failed to add reply');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (likingComments.has(commentId)) return;

    setLikingComments(prev => new Set([...prev, commentId]));

    try {
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      if (comment.is_liked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId);
      } else {
        await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId });
      }

      // Update local state
      setComments(prevComments =>
        prevComments.map(c =>
          c.id === commentId
            ? {
                ...c,
                is_liked: !c.is_liked,
                likes_count: (c.likes_count || 0) + (c.is_liked ? -1 : 1)
              }
            : c
        )
      );
    } catch (error) {
      console.error('Error toggling comment like:', error);
      alert('Failed to update like status');
    } finally {
      setLikingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const handleEditComment = (commentId: string, currentText: string) => {
    setEditingCommentId(commentId);
    setEditingCommentText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingCommentText.trim()) return;

    try {
      setIsSubmittingComment(true);
      const updatedComment = await updateClipComment(commentId, editingCommentText.trim());

      // Update local state
      setComments(prevComments =>
        prevComments.map(c =>
          c.id === commentId
            ? { ...c, comment_text: updatedComment.comment_text }
            : c
        )
      );

      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const confirmed = await confirm({
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      await deleteClipComment(commentId);

      // Remove from local state
      setComments(prevComments =>
        prevComments.filter(c => c.id !== commentId)
      );
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  const handleShare = async () => {
    if (!videoData) return;

    // Record share event in database
    try {
      await recordShareEvent(videoId!, 'video');
      // Track share for contribution rewards
      recordContribution('content_share', videoId!, 'video').catch(console.error);
    } catch (error) {
      console.error('Error recording share event:', error);
      // Don't block sharing if analytics fails
    }

    try {
      await shareVideo(videoId!, videoData.title);
    } catch (error) {
      console.error('Error sharing video:', error);
    }
  };

  const handleVideoChange = async (newVideoId: string) => {
    // Record playback for current video
    recordPlaybackOnUnmount();
    
    // Navigate to new video
    navigate(`/video/${newVideoId}`, { replace: true });
  };

  const autoResizeTextarea = (textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
  };

  useEffect(() => {
    autoResizeTextarea(newCommentRef.current);
  }, [newComment]);

  const formatTime = useCallback((time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const formatNumber = useCallback((num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }, []);

  const displayedComments = useMemo(() => {
    return showAllComments ? comments : comments.slice(0, 1);
  }, [showAllComments, comments]);

  // Only show error state if loading is complete and there's an error or no data
  if (!isLoading && (error || !videoData)) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4">
        <Card className="bg-white/10 backdrop-blur-sm border border-white/20">
          <CardContent className="p-8 text-center">
            <h3 className="font-['Inter',sans-serif] font-bold text-white text-xl mb-4">
              Video Not Found
            </h3>
            <p className="font-['Inter',sans-serif] text-white/70 text-sm mb-6">
              {error || 'The video you\'re looking for doesn\'t exist or has been removed.'}
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-xl font-['Inter',sans-serif] font-medium text-white transition-all duration-200 shadow-lg shadow-[#309605]/25"
            >
              Go Back
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading screen while fetching video data
  if (!videoData) {
    return <LoadingScreen variant="premium" />;
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] z-50 flex flex-col"
      onMouseMove={() => setShowControls(true)}
    >
      {/* Header - Matches Music Player Design */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 via-black/50 to-transparent backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-95"
            aria-label="Close player"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div
            className="flex items-center gap-3 flex-1 min-w-0 mx-4 cursor-pointer active:scale-95 transition-transform"
            onClick={() => {
              if (videoData.creator.id) {
                handleClose();
                navigate(`/user/${videoData.creator.id}`);
              }
            }}
          >
            <Avatar className="w-10 h-10 border-2 border-white/20 ring-2 ring-white/10">
              <AvatarImage src={videoData.creator.avatar || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-[#309605] to-[#3ba208] text-white font-semibold">
                {videoData.creator.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm truncate">
                {videoData.creator.name}
              </h3>
              <p className="text-white/70 text-xs">
                {formatNumber(videoData.creator.followerCount)} followers
              </p>
            </div>
          </div>

          {user?.id !== videoData.creator.id && (
            <button
              onClick={handleFollowToggle}
              disabled={isLoadingFollow}
              aria-label={isAuthenticated && isFollowingCreator ? "Unfollow creator" : "Follow creator"}
              className={`inline-flex items-center px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                isAuthenticated && isFollowingCreator
                  ? 'bg-white/100 text-grey border border-white/30 hover:bg-white/30'
                  : 'bg-white text-black hover:bg-white/90'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoadingFollow ? (
                <Spinner size={14} className="text-white" />
              ) : isAuthenticated && isFollowingCreator ? (
                <>
                  <UserMinus className="w-3.5 h-3.5 mr-1" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Follow
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Video Player - Mobile Optimized */}
      <div
        className="relative w-full h-[45vh] bg-black flex items-center justify-center"
        onClick={handleVideoClick}
      >
        {videoData.videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            poster={videoData.thumbnailUrl || undefined}
            crossOrigin="anonymous"
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={(e) => {
              console.error('Video playback error:', e);
              console.error('Video element state:', {
                readyState: videoRef.current?.readyState,
                networkState: videoRef.current?.networkState,
                currentSrc: videoRef.current?.currentSrc
              });
              setError('Failed to load video. Please check your connection and try again.');
            }}
            onClick={handleVideoClick}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Play className="w-8 h-8 text-white/60" />
              </div>
              <p className="text-white/60 text-sm">Video not available</p>
            </div>
          </div>
        )}

        {/* Play Button Overlay - Shows when video is not playing */}
        {videoData.videoUrl && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-2xl">
              <Play className="w-10 h-10 text-black ml-1" />
            </div>
          </div>
        )}

        {/* Video Controls Overlay - Mobile Optimized */}
        {videoData.videoUrl && (
          <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3 safe-bottom transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
            {/* Progress Bar */}
            <div
              ref={progressRef}
              className="relative w-full h-1 bg-white/20 rounded-full mb-2 cursor-pointer touch-none"
              onClick={handleProgressClick}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <div
                className="absolute top-0 left-0 h-full bg-[#ffffff] rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all duration-100"
                style={{ left: `${(currentTime / duration) * 100}%`, transform: 'translateX(-50%) translateY(-50%)' }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayPause}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors duration-200"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 text-white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  )}
                </button>

                <div className="text-white text-xs font-['Inter',sans-serif]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowQualityMenu(!showQualityMenu);
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors duration-200 flex items-center gap-1"
                  >
                    <Settings className="w-4 h-4 text-white" />
                    <span className="text-[10px] text-white font-medium">{selectedQuality}</span>
                  </button>

                  {showQualityMenu && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/95 rounded-lg overflow-hidden shadow-xl border border-white/20">
                      {availableQualities.map((quality) => (
                        <button
                          key={quality}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQualityChange(quality as any);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            selectedQuality === quality
                              ? 'bg-[#309605] text-white'
                              : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {quality === 'auto' ? 'Auto (HLS)' : quality}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleFullscreen}
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors duration-200"
                >
                  <Maximize className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Details and More Videos - Mobile Optimized */}
      <div className="bg-black border-t border-white/10 flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="px-4 py-5 space-y-5 pb-24">
            {/* Video Details - Mobile Optimized */}
            <div className="space-y-2">
              <h1 className="font-['Inter',sans-serif] font-bold text-white text-base leading-snug">
                {videoData.title}
              </h1>

              <div className="flex items-center gap-3 text-white/60 text-xs">
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{formatNumber(videoData.playCount)} views</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDistanceToNowStrict(new Date(videoData.createdAt), { addSuffix: true })}</span>
                </div>
              </div>

              {/* Action Buttons - Mobile Optimized with Treat */}
              <div className="grid grid-cols-4 gap-3 py-2">
                <div className="flex flex-col items-center">
                  <button
                    onClick={handleLikeToggle}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-none active:scale-90 ${
                      isLiked
                        ? 'bg-red-500/20 text-red-500'
                        : 'bg-white/10 text-white/80 active:bg-white/20'
                    }`}
                  >
                    <Heart className={`w-5 h-5 transition-none ${isLiked ? 'text-red-500 fill-red-500 scale-110' : 'text-white'}`} />
                  </button>
                  <span className="mt-0.5 font-['Inter',sans-serif] text-[10px] text-white/70">
                    {formatNumber(likesCount)}
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    onClick={handleShare}
                    className="w-11 h-11 rounded-full bg-white/10 active:bg-white/20 text-white/80 flex items-center justify-center transition-colors duration-200"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <span className="mt-0.5 font-['Inter',sans-serif] text-[10px] text-white/70">
                    Share
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        setShowAuthModal(true);
                        return;
                      }
                      setShowTippingModal(true);
                    }}
                    className="w-11 h-11 rounded-full bg-white/10 active:bg-white/20 text-white/80 flex items-center justify-center transition-colors duration-200"
                  >
                    <Gift className="w-5 h-5" />
                  </button>
                  <span className="mt-0.5 font-['Inter',sans-serif] text-[10px] text-white/70">
                    Treat
                  </span>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    onClick={() => setShowReportModal(true)}
                    className="w-11 h-11 rounded-full bg-red-500/10 active:bg-red-500/20 text-red-400 flex items-center justify-center transition-colors duration-200"
                  >
                    <Flag className="w-5 h-5" />
                  </button>
                  <span className="mt-0.5 font-['Inter',sans-serif] text-[10px] text-red-400">
                    Report
                  </span>
                </div>
              </div>

              {/* Description */}
              {videoData.description && (
                <p className="font-['Inter',sans-serif] text-white/70 text-xs leading-relaxed">
                  {videoData.description}
                </p>
              )}
            </div>

            {/* Tabbed Section - Comments & Watch Next */}
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="flex gap-2 border-b border-white/10">
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-200 relative ${
                    activeTab === 'comments'
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Comments ({comments.length})
                  {activeTab === 'comments' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
                
                <button
                  onClick={() => setActiveTab('watchNext')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all duration-200 relative ${
                    activeTab === 'watchNext'
                      ? 'text-white'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Watch Next
                  {activeTab === 'watchNext' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                {/* Comments Tab Content */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {/* Add Comment Form - Inline */}
                    {isAuthenticated && (
                      <form onSubmit={handleAddComment} className="flex items-end gap-2">
                        <Avatar className="w-8 h-8 flex-shrink-0 mb-0.5">
                          <AvatarImage src={user?.user_metadata?.avatar_url} />
                          <AvatarFallback className="bg-white/10 text-white/70 text-xs">
                            {user?.email?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 flex items-end gap-2 bg-white/[0.06] rounded-full px-4 py-2 min-h-[40px]">
                          <textarea
                            ref={newCommentRef}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Add a comment..."
                            rows={1}
                            className="flex-1 bg-transparent text-white text-sm placeholder-white/35 focus:outline-none resize-none py-0.5 max-h-[80px] leading-[1.4] overflow-hidden"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (newComment.trim() && !isSubmittingComment) {
                                  handleAddComment(e as any);
                                }
                              }
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!newComment.trim() || isSubmittingComment}
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white disabled:bg-white/15 disabled:cursor-not-allowed active:scale-95 transition-all"
                          >
                            {isSubmittingComment ? (
                              <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5 text-black" />
                            )}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Comments List */}
                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageCircle className="w-12 h-12 text-white/20 mx-auto mb-2" />
                          <p className="text-white/50 text-sm">
                            No comments yet. Be the first!
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* First Comment (always shown) */}
                          {comments[0] && (
                            <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarImage src={comments[0].users.avatar_url || undefined} />
                                <AvatarFallback className="bg-[#309605] text-white text-xs">
                                  {comments[0].users.display_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5 mb-0.5">
                                  <span className="font-['Inter',sans-serif] font-medium text-white text-xs truncate">
                                    {comments[0].users.display_name}
                                  </span>
                                  <span className="font-['Inter',sans-serif] text-white/40 text-[10px] flex-shrink-0">
                                    {formatDistanceToNowStrict(new Date(comments[0].created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                {editingCommentId === comments[0].id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editingCommentText}
                                      onChange={(e) => setEditingCommentText(e.target.value)}
                                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 text-xs focus:outline-none focus:ring-1 focus:ring-[#309605]/50 focus:border-[#309605]/50 resize-none"
                                      rows={3}
                                      autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleSaveEdit(comments[0].id)}
                                        disabled={!editingCommentText.trim() || isSubmittingComment}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 rounded-full text-white text-xs font-medium"
                                      >
                                        <Check className="w-3 h-3" />
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white text-xs"
                                      >
                                        <XIcon className="w-3 h-3" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-['Inter',sans-serif] text-white/75 text-xs leading-relaxed break-words">
                                      {comments[0].comment_text}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      <button
                                        onClick={() => handleToggleCommentLike(comments[0].id)}
                                        disabled={likingComments.has(comments[0].id)}
                                        className={`flex items-center gap-0.5 text-[10px] transition-colors duration-200 ${
                                          comments[0].is_liked ? 'text-red-500' : 'text-white/50 active:text-white'
                                        } disabled:opacity-50`}
                                      >
                                        <Heart className={`w-2.5 h-2.5 ${comments[0].is_liked ? 'fill-red-500' : ''}`} />
                                        <span>{comments[0].likes_count || 0}</span>
                                      </button>
                                      {isAuthenticated && (
                                        <button
                                          onClick={() => {
                                            setReplyingTo(comments[0].id);
                                            setReplyText('');
                                          }}
                                          className="text-white/50 active:text-white text-[10px]"
                                        >
                                          Reply
                                        </button>
                                      )}
                                      {isAuthenticated && user && comments[0].user_id === user.id && (
                                        <>
                                          <button
                                            onClick={() => handleEditComment(comments[0].id, comments[0].comment_text)}
                                            className="flex items-center gap-0.5 text-white/50 active:text-white text-[10px]"
                                          >
                                            <Edit2 className="w-2.5 h-2.5" />
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteComment(comments[0].id)}
                                            className="flex items-center gap-0.5 text-red-500/70 active:text-red-500 text-[10px]"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
                                {replyingTo === comments[0].id && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <input
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Write a reply..."
                                      className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white placeholder-white/50 text-xs focus:outline-none focus:ring-1 focus:ring-[#309605]/50 focus:border-[#309605]/50"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleReplyToComment(comments[0].id)}
                                      disabled={!replyText.trim() || isSubmittingComment}
                                      className="px-2 py-1 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 rounded-full text-white text-[10px] font-medium"
                                    >
                                      Send
                                    </button>
                                    <button
                                      onClick={() => {
                                        setReplyingTo(null);
                                        setReplyText('');
                                      }}
                                      className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-full text-white text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Additional Comments */}
                          {showAllComments && comments.slice(1).map((comment) => (
                            <div key={comment.id} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                              <Avatar className="w-8 h-8 flex-shrink-0">
                                <AvatarImage src={comment.users.avatar_url || undefined} />
                                <AvatarFallback className="bg-[#309605] text-white text-xs">
                                  {comment.users.display_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5 mb-0.5">
                                  <span className="font-['Inter',sans-serif] font-medium text-white text-xs truncate">
                                    {comment.users.display_name}
                                  </span>
                                  <span className="font-['Inter',sans-serif] text-white/40 text-[10px] flex-shrink-0">
                                    {formatDistanceToNowStrict(new Date(comment.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                                {editingCommentId === comment.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={editingCommentText}
                                      onChange={(e) => setEditingCommentText(e.target.value)}
                                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/50 text-xs focus:outline-none focus:ring-1 focus:ring-[#309605]/50 focus:border-[#309605]/50 resize-none"
                                      rows={3}
                                      autoFocus
                                    />
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleSaveEdit(comment.id)}
                                        disabled={!editingCommentText.trim() || isSubmittingComment}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 rounded-full text-white text-xs font-medium"
                                      >
                                        <Check className="w-3 h-3" />
                                        Save
                                      </button>
                                      <button
                                        onClick={handleCancelEdit}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white text-xs"
                                      >
                                        <XIcon className="w-3 h-3" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-['Inter',sans-serif] text-white/75 text-xs leading-relaxed break-words">
                                      {comment.comment_text}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1.5">
                                      <button
                                        onClick={() => handleToggleCommentLike(comment.id)}
                                        disabled={likingComments.has(comment.id)}
                                        className={`flex items-center gap-0.5 text-[10px] transition-colors duration-200 ${
                                          comment.is_liked ? 'text-red-500' : 'text-white/50 active:text-white'
                                        } disabled:opacity-50`}
                                      >
                                        <Heart className={`w-2.5 h-2.5 ${comment.is_liked ? 'fill-red-500' : ''}`} />
                                        <span>{comment.likes_count || 0}</span>
                                      </button>
                                      {isAuthenticated && (
                                        <button
                                          onClick={() => {
                                            setReplyingTo(comment.id);
                                            setReplyText('');
                                          }}
                                          className="text-white/50 active:text-white text-[10px]"
                                        >
                                          Reply
                                        </button>
                                      )}
                                      {isAuthenticated && user && comment.user_id === user.id && (
                                        <>
                                          <button
                                            onClick={() => handleEditComment(comment.id, comment.comment_text)}
                                            className="flex items-center gap-0.5 text-white/50 active:text-white text-[10px]"
                                          >
                                            <Edit2 className="w-2.5 h-2.5" />
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="flex items-center gap-0.5 text-red-500/70 active:text-red-500 text-[10px]"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                            Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </>
                                )}
                                {replyingTo === comment.id && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <input
                                      type="text"
                                      value={replyText}
                                      onChange={(e) => setReplyText(e.target.value)}
                                      placeholder="Write a reply..."
                                      className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-white placeholder-white/50 text-xs focus:outline-none focus:ring-1 focus:ring-[#309605]/50 focus:border-[#309605]/50"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleReplyToComment(comment.id)}
                                      disabled={!replyText.trim() || isSubmittingComment}
                                      className="px-2 py-1 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 rounded-full text-white text-[10px] font-medium"
                                    >
                                      Send
                                    </button>
                                    <button
                                      onClick={() => {
                                        setReplyingTo(null);
                                        setReplyText('');
                                      }}
                                      className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded-full text-white text-[10px]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* View More Button */}
                          {comments.length > 1 && (
                            <button
                              onClick={() => setShowAllComments(!showAllComments)}
                              className="w-full py-2 text-center text-[#309605] hover:text-[#3ba208] text-xs font-medium transition-colors duration-200"
                            >
                              {showAllComments ? 'Show Less' : `View ${comments.length - 1} More Comments`}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Watch Next Tab Content */}
                {activeTab === 'watchNext' && (
                  <div>
                    {isLoadingRelated ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[1, 2, 3, 4].map((i) => (
                          <Card key={i} className="bg-transparent border border-white/10 overflow-hidden">
                            <CardContent className="p-0">
                              <Skeleton className="w-full aspect-video bg-white/10" />
                              <div className="p-2.5 bg-black/40 space-y-2">
                                <Skeleton className="h-3 w-full bg-white/10" />
                                <Skeleton className="h-2 w-3/4 bg-white/10" />
                                <Skeleton className="h-2 w-1/2 bg-white/10" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : relatedVideos.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4 bg-gradient-to-br from-[#309605]/10 to-transparent rounded-xl border border-[#309605]/20">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#309605]/20 to-[#3ba208]/20 rounded-full flex items-center justify-center mb-3">
                          <Play className="w-8 h-8 text-[#309605]" />
                        </div>
                        <h4 className="text-white font-semibold text-base mb-1">You've caught up!</h4>
                        <p className="text-white/60 text-sm text-center mb-4 max-w-xs">
                          Discover more amazing content from creators worldwide
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate('/')}
                            className="px-4 py-2 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-lg text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-[#309605]/25"
                          >
                            Explore Home
                          </button>
                          <button
                            onClick={() => navigate('/explore')}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-medium transition-all duration-200"
                          >
                            Browse Genres
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {relatedVideos.map((video) => {
                          if (!video?.id || !video?.title) return null;

                          return (
                            <Card
                              key={video.id}
                              className="bg-transparent border border-white/10 cursor-pointer overflow-hidden group hover:border-white/20 active:border-[#309605]/50 transition-colors duration-200"
                              onClick={() => handleVideoChange(video.id)}
                            >
                              <CardContent className="p-0">
                                <div className="relative aspect-video overflow-hidden bg-black">
                                  {video.thumbnailUrl ? (
                                    <img
                                      src={video.thumbnailUrl}
                                      alt={video.title}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.parentElement!.innerHTML = `
                                          <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#309605]/20 to-black/80">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-white/60">
                                              <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                            </svg>
                                          </div>
                                        `;
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#309605]/20 to-black/80">
                                      <Play className="w-6 h-6 text-white/60" />
                                    </div>
                                  )}

                                  {/* Play Icon Overlay */}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-active:opacity-100 transition-opacity duration-150 flex items-center justify-center">
                                    <div className="w-10 h-10 bg-[#309605] rounded-full flex items-center justify-center shadow-lg">
                                      <Play className="w-5 h-5 text-white ml-0.5" />
                                    </div>
                                  </div>

                                  {/* Duration Badge */}
                                  {video.duration > 0 && (
                                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/90 rounded text-white text-[10px] font-semibold">
                                      {formatTime(video.duration)}
                                    </div>
                                  )}
                                </div>

                                <div className="p-2.5 bg-black/40">
                                  <h4 className="font-['Inter',sans-serif] font-semibold text-white text-xs leading-tight mb-1 line-clamp-2">
                                    {video.title}
                                  </h4>
                                  <p className="font-['Inter',sans-serif] text-white/60 text-[10px] mb-0.5 truncate">
                                    {video.creatorName || 'Unknown Creator'}
                                  </p>
                                  <p className="font-['Inter',sans-serif] text-white/50 text-[10px] flex items-center gap-1">
                                    <Eye className="w-2.5 h-2.5" />
                                    {formatNumber(video.playCount || 0)} views
                                  </p>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Lazy-loaded Modals with Suspense */}
      <Suspense fallback={null}>
        {/* Comments Modal */}
        {showCommentsModal && videoData && (
          <CommentsModal
            contentId={videoId!}
            contentType="video"
            contentTitle={videoData.title}
            onClose={() => setShowCommentsModal(false)}
          />
        )}

        {/* Tipping Modal */}
        {showTippingModal && videoData && (
          <TippingModal
            onClose={() => setShowTippingModal(false)}
            onSuccess={handleTipSuccess}
            recipientId={videoData.creator.id}
            contentId={videoId}
            contentType="video"
            recipientName={videoData.creator.name}
            recipientAvatar={videoData.creator.avatar || null}
          />
        )}

        {/* Report Modal */}
        {showReportModal && videoData && (
          <ReportModal
            contentType="video"
            contentId={videoId!}
            contentTitle={videoData.title}
            reportedUserId={videoData.creator.id}
            onClose={() => setShowReportModal(false)}
            onSuccess={() => {
              setShowReportModal(false);
            }}
          />
        )}

        {/* Auth Modal */}
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={async () => {
              setShowAuthModal(false);
              await checkAuthAndLoadData();
            }}
          />
        )}
      </Suspense>
    </div>
  );
};
