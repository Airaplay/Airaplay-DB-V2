import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, ArrowUpRight, ArrowDownLeft, Gift, Download, ShoppingCart, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { supabase } from '../lib/supabase';
import { formatDistanceToNowStrict, format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

interface TreatTransactionsModalProps {
  onClose: () => void;
}

interface TreatTransaction {
  id: string;
  user_id?: string;
  transaction_type: 'purchase' | 'spend' | 'earn' | 'withdraw' | 'tip_sent' | 'tip_received';
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  metadata: any;
  payment_method: string | null;
  payment_reference: string | null;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: string;
}

export const TreatTransactionsModal: React.FC<TreatTransactionsModalProps> = ({
  onClose
}) => {
  const [transactions, setTransactions] = useState<TreatTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  // Dispatch event when modal is mounted/unmounted to hide mini player
  useEffect(() => {
    const event = new CustomEvent('treatTransactionsModalVisibilityChange', {
      detail: { isVisible: true }
    });
    window.dispatchEvent(event);

    return () => {
      const closeEvent = new CustomEvent('treatTransactionsModalVisibilityChange', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(closeEvent);
    };
  }, []);

  useEffect(() => {
    loadTransactions();

    // Listen for new transactions in real-time
    const transactionsChannel = supabase
      .channel('transactions_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'treat_transactions'
        },
        (payload) => {
          const newTransaction = payload.new as TreatTransaction;
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user && user.id === newTransaction.user_id) {
              setTransactions((prev) => [newTransaction, ...prev].slice(0, 50));
            }
          });
        }
      )
      .subscribe();

    return () => {
      transactionsChannel.unsubscribe();
    };
  }, [filter]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('treat_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('transaction_type', filter);
      }

      const { data, error: transactionError } = await query;

      if (transactionError) throw transactionError;

      setTransactions(data || []);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <ShoppingCart className="w-5 h-5 text-green-500" />;
      case 'spend':
        return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case 'earn':
        return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
      case 'withdraw':
        return <Download className="w-5 h-5 text-orange-500" />;
      case 'tip_sent':
        return <Gift className="w-5 h-5 text-pink-500" />;
      case 'tip_received':
        return <Gift className="w-5 h-5 text-green-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'earn':
      case 'tip_received':
        return 'text-green-400';
      case 'spend':
      case 'withdraw':
      case 'tip_sent':
        return 'text-red-400';
      default:
        return 'text-white';
    }
  };

  const getAmountPrefix = (type: string) => {
    switch (type) {
      case 'purchase':
      case 'earn':
      case 'tip_received':
        return '+';
      case 'spend':
      case 'withdraw':
      case 'tip_sent':
        return '-';
      default:
        return '';
    }
  };

  const formatTransactionType = (type: string): string => {
    switch (type) {
      case 'purchase':
        return 'Purchase';
      case 'spend':
        return 'Spent';
      case 'earn':
        return 'Earned';
      case 'withdraw':
        return 'Withdrawal';
      case 'tip_sent':
        return 'Treat Sent';
      case 'tip_received':
        return 'Treat Received';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'pending':
        return <Clock className="w-3.5 h-3.5" />;
      case 'failed':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'cancelled':
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const groupTransactionsByDate = (transactions: TreatTransaction[]) => {
    const groups: { [key: string]: TreatTransaction[] } = {};
    
    transactions.forEach((transaction) => {
      const date = new Date(transaction.created_at);
      let groupKey: string;
      
      if (isToday(date)) {
        groupKey = 'Today';
      } else if (isYesterday(date)) {
        groupKey = 'Yesterday';
      } else if (isThisWeek(date)) {
        groupKey = 'This Week';
      } else if (isThisMonth(date)) {
        groupKey = 'This Month';
      } else {
        groupKey = format(date, 'MMMM yyyy');
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(transaction);
    });
    
    return groups;
  };

  const groupedTransactions = useMemo(() => {
    return groupTransactionsByDate(transactions);
  }, [transactions]);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-black/90 via-[#0d0d0d]/95 to-black/95 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-to-b from-[#1a1a1a]/90 via-[#0d0d0d]/90 to-[#000000]/90 backdrop-blur-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="font-['Inter',sans-serif] font-bold text-white text-2xl mb-1 tracking-tight">
                  Transaction History
                </h2>
                <p className="font-['Inter',sans-serif] text-white/60 text-sm">
                  Track your treat activity
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-all duration-200 active:scale-95"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>

            <div className="px-6 pb-4">
              <ScrollArea className="w-full">
                <div className="flex space-x-3 pb-2">
                  {[
                    { value: 'all', label: 'All' },
                    { value: 'purchase', label: 'Purchases' },
                    { value: 'tip_sent', label: 'Treats' },
                    { value: 'tip_received', label: 'Received' },
                    { value: 'withdraw', label: 'Withdrawals' }
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => setFilter(tab.value)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 whitespace-nowrap active:scale-95 font-['Inter',sans-serif] shadow-lg ${
                        filter === tab.value
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      <span className="font-semibold text-sm">
                        {tab.label}
                      </span>
                    </button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="opacity-0" />
              </ScrollArea>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Card key={i} className="bg-white/5 backdrop-blur-sm border border-white/10">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse"></div>
                          <div className="flex-1">
                            <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2"></div>
                            <div className="h-3 w-48 bg-white/10 rounded animate-pulse mb-2"></div>
                            <div className="h-3 w-24 bg-white/10 rounded animate-pulse"></div>
                          </div>
                          <div className="h-6 w-20 bg-white/10 rounded animate-pulse"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : error ? (
                <Card className="bg-red-500/20 border border-red-500/30">
                  <CardContent className="p-6 text-center">
                    <p className="font-['Inter',sans-serif] text-red-400 text-sm mb-4">
                      {error}
                    </p>
                    <button
                      onClick={loadTransactions}
                      className="px-4 py-2 bg-red-500/30 hover:bg-red-500/40 rounded-xl text-red-400 text-sm transition-all duration-200 font-['Inter',sans-serif] font-semibold active:scale-95"
                    >
                      Try Again
                    </button>
                  </CardContent>
                </Card>
              ) : transactions.length === 0 ? (
                <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                  <CardContent className="p-12 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <Clock className="w-10 h-10 text-blue-400/60" />
                    </div>
                    <h3 className="font-['Inter',sans-serif] font-bold text-white text-lg mb-2 tracking-tight">
                      No Transactions Yet
                    </h3>
                    <p className="font-['Inter',sans-serif] text-white/70 text-sm mb-4">
                      {filter === 'all'
                        ? 'Your treat transactions will appear here once you start using treats'
                        : `No ${filter.replace('_', ' ')} transactions found in this period`
                      }
                    </p>
                    {filter === 'all' && (
                      <p className="font-['Inter',sans-serif] text-white/40 text-xs">
                        Purchase treats, tip artists, or promote your music to see activity
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupedTransactions).map(([dateGroup, groupTransactions]) => (
                    <div key={dateGroup}>
                      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a1a] to-transparent pb-2 mb-3">
                        <h3 className="font-['Inter',sans-serif] font-bold text-white/80 text-sm uppercase tracking-wider">
                          {dateGroup}
                        </h3>
                        <div className="h-px bg-white/10 mt-2"></div>
                      </div>
                      <div className="space-y-4">
                        {groupTransactions.map((transaction) => (
                          <Card
                            key={transaction.id}
                            className="relative z-10 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 active:scale-[0.99] shadow-lg hover:shadow-xl hover:z-20 hover:scale-[1.01]"
                          >
                            <CardContent className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                                  {getTransactionIcon(transaction.transaction_type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-['Inter',sans-serif] font-semibold text-white text-base">
                                      {formatTransactionType(transaction.transaction_type)}
                                    </h4>
                                    <span className={`font-['Inter',sans-serif] font-bold text-lg ${getTransactionColor(transaction.transaction_type)}`}>
                                      {getAmountPrefix(transaction.transaction_type)}{transaction.amount.toLocaleString()}
                                    </span>
                                  </div>

                                  <p className="font-['Inter',sans-serif] text-white/70 text-sm mb-2 line-clamp-1">
                                    {transaction.description}
                                  </p>

                                  <div className="flex items-center justify-between">
                                    <span className="font-['Inter',sans-serif] text-white/60 text-xs font-medium">
                                      {formatDistanceToNowStrict(new Date(transaction.created_at), { addSuffix: true })}
                                    </span>

                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border font-['Inter',sans-serif] ${getStatusBadgeClass(transaction.status)}`}>
                                      {getStatusIcon(transaction.status)}
                                      <span className="capitalize">{transaction.status}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};