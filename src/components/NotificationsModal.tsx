import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCircle, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '../lib/supabase'; // Assuming supabase is exported from here

interface NotificationsModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

interface Notification {
  id: string;
  user_id: string;
  title?: string;
  type: string;
  message: string;
  metadata: any;
  creator_request_id?: string;
  is_read: boolean;
  created_at: string;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null); // To track which notification is being updated/deleted

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated.');
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    setIsUpdating(id);
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (updateError) {
        throw new Error(updateError.message);
      }
      setNotifications(prev => prev.map(notif =>
        notif.id === id ? { ...notif, is_read: true } : notif
      ));
      onSuccess?.();
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    } finally {
      setIsUpdating(null);
    }
  };

  const deleteNotification = async (id: string) => {
    setIsUpdating(id);
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
      setNotifications(prev => prev.filter(notif => notif.id !== id));
      onSuccess?.();
    } catch (err) {
      console.error('Error deleting notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    } finally {
      setIsUpdating(null);
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl border border-white/20 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <Bell className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-['Inter',sans-serif] font-bold text-white text-xl">
                Notifications
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
            >
              <X className="w-5 h-5 text-white/80" />
            </button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="font-['Inter',sans-serif] text-white/70 text-sm ml-3">
                Loading notifications...
              </p>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-center">
                <p className="font-['Inter',sans-serif] text-red-400 text-sm">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="mt-4 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 rounded-lg text-red-400 text-sm transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <Card className="bg-white/5 backdrop-blur-sm border border-white/10 w-full">
                <CardContent className="p-8 text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bell className="w-8 h-8 text-white/60" />
                  </div>
                  <h3 className="font-['Inter',sans-serif] font-semibold text-white text-lg mb-2">
                    No new notifications
                  </h3>
                  <p className="font-['Inter',sans-serif] text-white/70 text-sm">
                    You&apos;re all caught up!
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {notifications.map((notif) => {
                  const getBgColor = () => {
                    if (notif.type === 'creator_request') {
                      const status = notif.metadata?.request_status;
                      if (status === 'approved') return 'bg-green-500/10 border-green-500/20';
                      if (status === 'rejected') return 'bg-red-500/10 border-red-500/20';
                      if (status === 'banned') return 'bg-gray-500/10 border-gray-500/20';
                    }
                    return 'bg-white/5 border-white/10';
                  };

                  const getIconColor = () => {
                    if (notif.type === 'creator_request') {
                      const status = notif.metadata?.request_status;
                      if (status === 'approved') return 'bg-green-600/20 text-green-400';
                      if (status === 'rejected') return 'bg-red-600/20 text-red-400';
                      if (status === 'banned') return 'bg-gray-600/20 text-gray-400';
                    }
                    return 'bg-purple-600/20 text-purple-400';
                  };

                  return (
                    <Card
                      key={notif.id}
                      className={`backdrop-blur-sm border ${
                        notif.is_read ? `${getBgColor()} opacity-70` : `${getBgColor()}`
                      } hover:bg-white/10 transition-all duration-300`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getIconColor()}`}>
                            <Bell className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {notif.title && (
                              <p className={`font-['Inter',sans-serif] text-white text-xs font-semibold uppercase tracking-wide mb-1 ${
                                notif.is_read ? 'text-white/50' : 'text-white/80'
                              }`}>
                                {notif.title}
                              </p>
                            )}
                            <p className={`font-['Inter',sans-serif] text-white text-sm font-medium mb-2 ${
                              notif.is_read ? 'text-white/60' : 'text-white'
                            }`}>
                              {notif.message}
                            </p>
                            <p className="font-['Inter',sans-serif] text-white/60 text-xs">
                              {formatTimeAgo(notif.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notif.is_read && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                disabled={isUpdating === notif.id}
                                className="p-2 hover:bg-purple-500/20 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Mark as read"
                              >
                                {isUpdating === notif.id ? (
                                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-purple-400" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notif.id)}
                              disabled={isUpdating === notif.id}
                              className="p-2 hover:bg-red-500/20 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete notification"
                            >
                              {isUpdating === notif.id ? (
                                <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-400" />
                              )}
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};