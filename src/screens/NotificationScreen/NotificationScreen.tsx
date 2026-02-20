import { useState, useEffect, useMemo, useCallback } from 'react';
import { Spinner } from '../../components/Spinner';
import { ArrowLeft, Send, DollarSign, XCircle, CheckCircle, FileText, AlertCircle, X, Trash2, MessageCircle, CheckCheck, UserPlus, Users, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { CustomConfirmDialog } from '../../components/CustomConfirmDialog';
import { ToastNotification } from '../../components/ToastNotification';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  metadata: any;
  is_read: boolean;
  created_at: string;
  message_id?: string;
  thread_id?: string;
  sender_id?: string;
  sender?: {
    id: string;
    display_name: string;
    username: string | null;
    avatar_url: string | null;
  };
}

export const NotificationScreen = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [processingCollabRequestId, setProcessingCollabRequestId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
    setupRealtimeSubscription();

    return () => {
      const channel = supabase.channel('notifications');
      channel.unsubscribe();
    };
  }, []);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        async (payload) => {
          const newNotif = payload.new as any;

          let sender = null;
          if ((newNotif.type === 'message' || newNotif.type === 'reply') && newNotif.sender_id) {
            const { data: senderData } = await supabase
              .from('users')
              .select('id, display_name, username, avatar_url')
              .eq('id', newNotif.sender_id)
              .maybeSingle();
            sender = senderData;
          }

          setNotifications(prev => [{ ...newNotif, sender }, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const updated = payload.new as any;
          setNotifications(prev => prev.map(n => n.id === updated.id ? { ...n, ...updated } : n));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const deleted = payload.old as any;
          setNotifications(prev => prev.filter(n => n.id !== deleted.id));
        }
      )
      .subscribe();
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:users!sender_id(
            id,
            display_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        const { data: notificationsData, error: notifError } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (notifError) throw notifError;

        const senderIds = [...new Set(
          (notificationsData || [])
            .filter((n: any) => (n.type === 'message' || n.type === 'reply') && n.sender_id)
            .map((n: any) => n.sender_id)
        )];

        const { data: sendersData } = await supabase
          .from('users')
          .select('id, display_name, username, avatar_url')
          .in('id', senderIds);

        const sendersMap = new Map(sendersData?.map(s => [s.id, s]) || []);

        const notificationsWithSenders = (notificationsData || []).map((notif: any) => ({
          ...notif,
          sender: sendersMap.get(notif.sender_id) || null,
        }));

        setNotifications(notificationsWithSenders);
        return;
      }

      const transformedData = (data || []).map((notif: any) => ({
        ...notif,
        sender: notif.sender || null,
      }));

      setNotifications(transformedData);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setToast({
        message: 'Failed to load notifications',
        type: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(notif =>
      notif.id === id ? { ...notif, is_read: true } : notif
    ));

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setNotifications(prev => prev.map(notif =>
        notif.id === id ? { ...notif, is_read: false } : notif
      ));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setIsMarkingAllRead(true);
    setNotifications(prev => prev.map(notif => ({ ...notif, is_read: true })));

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setToast({
        message: 'All notifications marked as read',
        type: 'success',
      });
    } catch (err) {
      console.error('Error marking all as read:', err);
      fetchNotifications();
      setToast({
        message: 'Failed to mark all as read',
        type: 'error',
      });
    } finally {
      setIsMarkingAllRead(false);
    }
  }, []);

  const handleAcceptCollabRequest = async (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();

    const requestId = notif.metadata?.request_id;
    if (!requestId) {
      setToast({ message: 'Invalid request', type: 'error' });
      return;
    }

    setProcessingCollabRequestId(requestId);

    try {
      const { data: request } = await supabase
        .from('collaboration_requests')
        .select(`
          sender_artist_id,
          recipient_artist_id,
          sender_artist:artist_profiles!collaboration_requests_sender_artist_id_fkey(stage_name),
          recipient_artist:artist_profiles!collaboration_requests_recipient_artist_id_fkey(stage_name)
        `)
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Request not found');

      const { error: updateError } = await supabase
        .from('collaboration_requests')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { data: senderUserData } = await supabase
        .from('artist_profiles')
        .select('user_id')
        .eq('id', request.sender_artist_id)
        .single();

      if (senderUserData) {
        await supabase
          .from('notifications')
          .insert({
            user_id: senderUserData.user_id,
            title: 'Collaboration Request Accepted',
            message: `${request.recipient_artist?.stage_name || 'An artist'} accepted your collaboration request!`,
            type: 'collaboration_accepted',
            is_read: false
          });
      }

      await supabase
        .from('notifications')
        .delete()
        .eq('id', notif.id);

      setToast({ message: 'Collaboration request accepted!', type: 'success' });
      fetchNotifications();
    } catch (error) {
      console.error('Error accepting collaboration request:', error);
      setToast({ message: 'Failed to accept request', type: 'error' });
    } finally {
      setProcessingCollabRequestId(null);
    }
  };

  const handleDeclineCollabRequest = async (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();

    const requestId = notif.metadata?.request_id;
    if (!requestId) {
      setToast({ message: 'Invalid request', type: 'error' });
      return;
    }

    setProcessingCollabRequestId(requestId);

    try {
      const { data: request } = await supabase
        .from('collaboration_requests')
        .select(`
          sender_artist_id,
          recipient_artist_id,
          sender_artist:artist_profiles!collaboration_requests_sender_artist_id_fkey(stage_name),
          recipient_artist:artist_profiles!collaboration_requests_recipient_artist_id_fkey(stage_name)
        `)
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Request not found');

      const { error: updateError } = await supabase
        .from('collaboration_requests')
        .update({
          status: 'declined',
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { data: senderUserData } = await supabase
        .from('artist_profiles')
        .select('user_id')
        .eq('id', request.sender_artist_id)
        .single();

      if (senderUserData) {
        await supabase
          .from('notifications')
          .insert({
            user_id: senderUserData.user_id,
            title: 'Collaboration Request Declined',
            message: `${request.recipient_artist?.stage_name || 'An artist'} declined your collaboration request`,
            type: 'collaboration_declined',
            is_read: false
          });
      }

      await supabase
        .from('notifications')
        .delete()
        .eq('id', notif.id);

      setToast({ message: 'Request declined', type: 'success' });
      fetchNotifications();
    } catch (error) {
      console.error('Error declining collaboration request:', error);
      setToast({ message: 'Failed to decline request', type: 'error' });
    } finally {
      setProcessingCollabRequestId(null);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }

    if ((notif.type === 'message' || notif.type === 'reply') && notif.thread_id) {
      navigate(`/messages/${notif.thread_id}`);
    } else if (notif.type === 'collaboration_request' || notif.type === 'collaboration_accepted' || notif.type === 'collaboration_declined') {
      navigate('/collaboration-inbox');
    }
  };

  const handleDeleteClick = (notif: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotificationToDelete(notif);
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!notificationToDelete) return;

    setDeletingId(notificationToDelete.id);
    setShowConfirmDelete(false);

    try {
      // Check if this is a collapsed message notification with multiple IDs
      const allIds = notificationToDelete.metadata?.allNotificationIds;

      if (allIds && allIds.length > 1) {
        // Delete all notifications from this conversation
        const { error } = await supabase
          .from('notifications')
          .delete()
          .in('id', allIds);

        if (error) throw error;

        setNotifications(prev => prev.filter(notif => !allIds.includes(notif.id)));
        setToast({
          message: `Deleted ${allIds.length} notifications`,
          type: 'success',
        });
      } else {
        // Delete single notification
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationToDelete.id);

        if (error) throw error;

        setNotifications(prev => prev.filter(notif => notif.id !== notificationToDelete.id));
        setToast({
          message: 'Notification deleted',
          type: 'success',
        });
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      setToast({
        message: 'Failed to delete notification',
        type: 'error',
      });
    } finally {
      setDeletingId(null);
      setNotificationToDelete(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'message':
      case 'reply':
        return <MessageCircle className="w-5 h-5 text-[#309605]" />;
      case 'collaboration_request':
        return <UserPlus className="w-5 h-5 text-[#309605]" />;
      case 'collaboration_accepted':
        return <Users className="w-5 h-5 text-green-400" />;
      case 'collaboration_declined':
        return <XCircle className="w-5 h-5 text-orange-400" />;
      case 'donation':
      case 'donation_successful':
        return <Send className="w-5 h-5 text-green-400" />;
      case 'deposit':
      case 'usdt_deposit':
        return <DollarSign className="w-5 h-5 text-blue-400" />;
      case 'donation_cancelled':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'campaign':
      case 'campaign_completed':
        return <CheckCircle className="w-5 h-5 text-orange-400" />;
      case 'campaign_published':
      case 'ongoing':
        return <FileText className="w-5 h-5 text-orange-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'message':
      case 'reply':
        return 'bg-[#309605]/10';
      case 'collaboration_request':
        return 'bg-[#309605]/10';
      case 'collaboration_accepted':
        return 'bg-green-500/10';
      case 'collaboration_declined':
        return 'bg-orange-500/10';
      case 'donation':
      case 'donation_successful':
        return 'bg-green-500/10';
      case 'deposit':
      case 'usdt_deposit':
        return 'bg-blue-500/10';
      case 'donation_cancelled':
      case 'cancelled':
        return 'bg-red-500/10';
      case 'campaign':
      case 'campaign_completed':
      case 'campaign_published':
      case 'ongoing':
        return 'bg-orange-500/10';
      default:
        return 'bg-gray-500/10';
    }
  };

  const getNotificationTitle = (notif: Notification) => {
    if ((notif.type === 'message' || notif.type === 'reply') && notif.sender) {
      return notif.sender.display_name || notif.sender.username || 'Someone';
    }

    const message = notif.message;
    const firstLine = message.split('\n')[0] || message.substring(0, 50);
    return firstLine;
  };

  const getNotificationDescription = (notif: Notification) => {
    if (notif.type === 'message' || notif.type === 'reply') {
      return notif.message;
    }

    const message = notif.message;
    const lines = message.split('\n');
    return lines.length > 1 ? lines.slice(1).join(' ') : message.substring(50);
  };

  const collapseMessageNotifications = useCallback((notifs: Notification[]): Notification[] => {
    // Group message notifications by sender (conversation)
    const messagesByConversation = new Map<string, Notification[]>();
    const otherNotifications: Notification[] = [];

    notifs.forEach(notif => {
      if (notif.type === 'message' || notif.type === 'reply') {
        const conversationKey = notif.thread_id || notif.sender_id || 'unknown';
        if (!messagesByConversation.has(conversationKey)) {
          messagesByConversation.set(conversationKey, []);
        }
        messagesByConversation.get(conversationKey)!.push(notif);
      } else {
        otherNotifications.push(notif);
      }
    });

    // For each conversation, keep only the latest message but track unread count
    const collapsedMessages: Notification[] = [];
    messagesByConversation.forEach((messages) => {
      // Sort by created_at descending (latest first)
      const sortedMessages = messages.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestMessage = sortedMessages[0];
      const unreadCount = messages.filter(m => !m.is_read).length;

      // Add unread count to metadata for display
      collapsedMessages.push({
        ...latestMessage,
        metadata: {
          ...latestMessage.metadata,
          unreadCount,
          totalMessages: messages.length,
          allNotificationIds: messages.map(m => m.id), // For batch deletion
        },
      });
    });

    // Combine and sort all notifications by created_at
    return [...collapsedMessages, ...otherNotifications].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, []);

  const groupNotifications = useCallback((notifs: Notification[]) => {
    const groups: { title: string; notifications: Notification[] }[] = [];

    const todayNotifs = notifs.filter(n => isToday(new Date(n.created_at)));
    const yesterdayNotifs = notifs.filter(n => isYesterday(new Date(n.created_at)));
    const thisWeekNotifs = notifs.filter(n => {
      const date = new Date(n.created_at);
      return isThisWeek(date, { weekStartsOn: 1 }) && !isToday(date) && !isYesterday(date);
    });
    const olderNotifs = notifs.filter(n => {
      const date = new Date(n.created_at);
      return !isThisWeek(date, { weekStartsOn: 1 });
    });

    if (todayNotifs.length > 0) groups.push({ title: 'Today', notifications: todayNotifs });
    if (yesterdayNotifs.length > 0) groups.push({ title: 'Yesterday', notifications: yesterdayNotifs });
    if (thisWeekNotifs.length > 0) groups.push({ title: 'This Week', notifications: thisWeekNotifs });
    if (olderNotifs.length > 0) groups.push({ title: 'Earlier', notifications: olderNotifs });

    return groups;
  }, []);

  const filteredNotifications = useMemo(
    () => activeTab === 'unread' ? notifications.filter(n => !n.is_read) : notifications,
    [activeTab, notifications]
  );

  const collapsedNotifications = useMemo(
    () => collapseMessageNotifications(filteredNotifications),
    [filteredNotifications]
  );

  const groupedNotifications = useMemo(
    () => groupNotifications(collapsedNotifications),
    [collapsedNotifications]
  );

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.is_read).length,
    [notifications]
  );

  const NotificationCard = ({ notif }: { notif: Notification }) => {
    const unreadCount = notif.metadata?.unreadCount || 0;
    const totalMessages = notif.metadata?.totalMessages || 1;
    const isMessageNotif = notif.type === 'message' || notif.type === 'reply';
    const isCollabRequest = notif.type === 'collaboration_request';
    const requestId = notif.metadata?.request_id;

    return (
      <div key={notif.id} className="space-y-2">
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl transition-all ${
            !isCollabRequest ? 'active:scale-[0.98]' : ''
          } ${
            notif.is_read ? 'bg-white/5 active:bg-white/10' : 'bg-white/10 active:bg-white/[0.12]'
          }`}
          onClick={() => !isCollabRequest && handleNotificationClick(notif)}
        >
        {/* Icon/Avatar */}
        {isMessageNotif && notif.sender?.avatar_url ? (
          <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden">
            <img
              src={notif.sender.avatar_url}
              alt={notif.sender.display_name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative ${getNotificationColor(notif.type)}`}>
            {getNotificationIcon(notif.type)}
            {isMessageNotif && unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-gradient-to-r from-[#309605] to-[#3ba208] rounded-full flex items-center justify-center px-1.5 shadow-md shadow-[#309605]/20">
                <span className="text-[10px] font-bold text-white">{unreadCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 pr-2">
          <div className="flex items-start gap-2 mb-1">
            <h3 className={`text-base ${notif.is_read ? 'font-medium text-white/80' : 'font-semibold text-white'} flex-1 break-words`}>
              {getNotificationTitle(notif)}
            </h3>
            {isMessageNotif && totalMessages > 1 && (
              <span className="text-xs text-white/40 font-medium flex-shrink-0">
                ({totalMessages})
              </span>
            )}
          </div>
          <p className="text-xs text-white/40">
            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }).replace('about ', '')}
          </p>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!notif.is_read && !isCollabRequest && (
            <div className="w-2 h-2 bg-[#309605] rounded-full"></div>
          )}
          {!isCollabRequest && (
            <button
              onClick={(e) => handleDeleteClick(notif, e)}
              disabled={deletingId === notif.id}
              className="p-2.5 hover:bg-red-500/20 active:bg-red-500/30 rounded-full transition-all disabled:opacity-50"
              aria-label="Delete notification"
            >
              {deletingId === notif.id ? (
                <Spinner size={16} className="text-white" />
              ) : (
                <Trash2 className="w-4 h-4 text-white/50" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collaboration Request Action Buttons */}
      {isCollabRequest && requestId && (
        <div className="flex gap-2 px-4">
          <button
            onClick={(e) => handleAcceptCollabRequest(notif, e)}
            disabled={processingCollabRequestId === requestId}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-[#309605]/20"
          >
            {processingCollabRequestId === requestId ? (
              <Spinner size={16} className="text-white" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Accept
              </>
            )}
          </button>
          <button
            onClick={(e) => handleDeclineCollabRequest(notif, e)}
            disabled={processingCollabRequestId === requestId}
            className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95"
          >
            {processingCollabRequestId === requestId ? (
              <Spinner size={16} className="text-white" />
            ) : (
              <>
                <X className="w-4 h-4" />
                Decline
              </>
            )}
          </button>
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] text-white content-with-nav overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#1a1a1a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-4 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 active:bg-white/10 rounded-full transition-all active:scale-95"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-2xl font-bold flex-1">Notifications</h1>
          {unreadCount > 0 && (
            <div className="min-w-[28px] h-7 px-2.5 bg-gradient-to-r from-[#309605] to-[#3ba208] rounded-full flex items-center justify-center shadow-md shadow-[#309605]/20">
              <span className="text-xs font-bold text-white">{unreadCount}</span>
            </div>
          )}
        </div>

        {/* Tabs and Mark All Read */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                activeTab === 'all'
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-white/5 text-white/60 active:bg-white/10'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${
                activeTab === 'unread'
                  ? 'bg-white text-black shadow-lg'
                  : 'bg-white/5 text-white/60 active:bg-white/10'
              }`}
            >
              Unread
              {unreadCount > 0 && activeTab !== 'unread' && (
                <span className="min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-[#309605] to-[#3ba208] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md shadow-[#309605]/20">
                  {unreadCount}
                </span>
              )}
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={isMarkingAllRead}
                className="p-3 bg-white/5 active:bg-white/10 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                aria-label="Mark all as read"
              >
                {isMarkingAllRead ? (
                  <Spinner size={20} className="text-white" />
                ) : (
                  <CheckCheck className="w-5 h-5 text-white/60" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size={40} className="text-white" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-white/40" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">
              {activeTab === 'unread' ? "All Caught Up!" : 'No Notifications'}
            </h3>
            <p className="text-sm text-white/50 max-w-xs mx-auto leading-relaxed">
              {activeTab === 'unread'
                ? 'No unread notifications. Check back later for updates!'
                : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedNotifications.map((group, groupIndex) => (
              <div key={groupIndex}>
                <h2 className="text-xs font-bold text-white/50 mb-3 px-1 uppercase tracking-wider">{group.title}</h2>
                <div className="space-y-2">
                  {group.notifications.map((notif) => (
                    <NotificationCard key={notif.id} notif={notif} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <CustomConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Notification?"
        message="This notification will be permanently deleted. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowConfirmDelete(false);
          setNotificationToDelete(null);
        }}
        isLoading={deletingId !== null}
      />

      {/* Toast Notification */}
      {toast && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};
