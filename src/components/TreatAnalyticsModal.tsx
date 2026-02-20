import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Coins, Gift, ShoppingCart } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { supabase } from '../lib/supabase';

interface TreatAnalyticsModalProps {
  onClose: () => void;
}

interface AnalyticsData {
  totalPurchased: number;
  totalSpent: number;
  totalEarned: number;
  totalTipped: number;
  totalReceived: number;
  currentBalance: number;
  purchaseCount: number;
  spendCount: number;
  tipsSentCount: number;
  tipsReceivedCount: number;
}

interface SpendingCategory {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export const TreatAnalyticsModal: React.FC<TreatAnalyticsModalProps> = ({ onClose }) => {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalPurchased: 0,
    totalSpent: 0,
    totalEarned: 0,
    totalTipped: 0,
    totalReceived: 0,
    currentBalance: 0,
    purchaseCount: 0,
    spendCount: 0,
    tipsSentCount: 0,
    tipsReceivedCount: 0
  });
  const [spendingCategories, setSpendingCategories] = useState<SpendingCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timePeriod]);

  // Dispatch event when modal is mounted/unmounted to hide mini player
  useEffect(() => {
    const event = new CustomEvent('treatAnalyticsModalVisibilityChange', {
      detail: { isVisible: true }
    });
    window.dispatchEvent(event);

    return () => {
      const closeEvent = new CustomEvent('treatAnalyticsModalVisibilityChange', {
        detail: { isVisible: false }
      });
      window.dispatchEvent(closeEvent);
    };
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = getStartDate();
      let transactionQuery = supabase
        .from('treat_transactions')
        .select('*')
        .eq('user_id', user.id);

      if (timePeriod !== 'all') {
        transactionQuery = transactionQuery.gte('created_at', startDate);
      }

      const { data: transactions, error: transactionError } = await transactionQuery;

      if (transactionError) throw transactionError;

      const { data: wallet, error: walletError } = await supabase
        .from('treat_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) throw walletError;

      const totalPurchased = transactions
        ?.filter(t => t.transaction_type === 'purchase')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const totalSpent = transactions
        ?.filter(t => t.transaction_type === 'spend')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const totalEarned = transactions
        ?.filter(t => t.transaction_type === 'earn')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const totalTipped = transactions
        ?.filter(t => t.transaction_type === 'tip_sent')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const totalReceived = transactions
        ?.filter(t => t.transaction_type === 'tip_received')
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const purchaseCount = transactions?.filter(t => t.transaction_type === 'purchase').length || 0;
      const spendCount = transactions?.filter(t => t.transaction_type === 'spend').length || 0;
      const tipsSentCount = transactions?.filter(t => t.transaction_type === 'tip_sent').length || 0;
      const tipsReceivedCount = transactions?.filter(t => t.transaction_type === 'tip_received').length || 0;

      setAnalytics({
        totalPurchased,
        totalSpent,
        totalEarned,
        totalTipped,
        totalReceived,
        currentBalance: Number(wallet?.balance) || 0,
        purchaseCount,
        spendCount,
        tipsSentCount,
        tipsReceivedCount
      });

      const categories: { [key: string]: { amount: number; count: number } } = {
        'Tips Sent': { amount: totalTipped, count: tipsSentCount },
        'Promotions': { amount: totalSpent, count: spendCount }
      };

      const totalSpending = totalTipped + totalSpent;

      const categoriesArray: SpendingCategory[] = Object.entries(categories)
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
          count: data.count
        }))
        .filter(cat => cat.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      setSpendingCategories(categoriesArray);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const getStartDate = (): string => {
    const date = new Date();
    if (timePeriod === '7d') {
      date.setDate(date.getDate() - 7);
    } else if (timePeriod === '30d') {
      date.setDate(date.getDate() - 30);
    }
    return date.toISOString();
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const totalInflow = analytics.totalPurchased + analytics.totalEarned + analytics.totalReceived;
  const totalOutflow = analytics.totalSpent + analytics.totalTipped;
  const netChange = totalInflow - totalOutflow;

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-black/90 via-[#0d0d0d]/95 to-black/95 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-gradient-to-b from-[#1a1a1a]/90 via-[#0d0d0d]/90 to-[#000000]/90 backdrop-blur-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="font-['Inter',sans-serif] font-bold text-white text-2xl mb-1 tracking-tight">
                  Treat Analytics
                </h2>
                <p className="font-['Inter',sans-serif] text-white/60 text-sm">
                  Your spending insights
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
              <div className="flex space-x-3">
                {[
                  { value: '7d' as const, label: '7 Days' },
                  { value: '30d' as const, label: '30 Days' },
                  { value: 'all' as const, label: 'All Time' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimePeriod(option.value)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-200 whitespace-nowrap active:scale-95 font-['Inter',sans-serif] shadow-lg ${
                      timePeriod === option.value
                        ? 'bg-white text-black'
                        : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <span className="font-semibold text-sm">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {isLoading ? (
                <div className="space-y-6">
                  {/* Skeleton for summary cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
                          <div className="w-8 h-8 bg-white/10 rounded-full animate-pulse"></div>
                        </div>
                        <div className="h-8 w-32 bg-white/10 rounded animate-pulse"></div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-4 w-24 bg-white/10 rounded animate-pulse"></div>
                          <div className="w-8 h-8 bg-white/10 rounded-full animate-pulse"></div>
                        </div>
                        <div className="h-8 w-32 bg-white/10 rounded animate-pulse"></div>
                      </CardContent>
                    </Card>
                  </div>
                  {/* Skeleton for quick stats */}
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Card key={i} className="bg-white/5 backdrop-blur-sm border-white/10">
                        <CardContent className="p-4">
                          <div className="h-3 w-16 bg-white/10 rounded animate-pulse mb-2"></div>
                          <div className="h-6 w-20 bg-white/10 rounded animate-pulse"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {/* Skeleton for income breakdown */}
                  <div>
                    <div className="h-6 w-40 bg-white/10 rounded animate-pulse mb-4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="bg-white/5 backdrop-blur-sm border-white/10">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white/10 rounded-full animate-pulse"></div>
                              <div className="flex-1">
                                <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-2"></div>
                                <div className="h-3 w-32 bg-white/10 rounded animate-pulse"></div>
                              </div>
                              <div className="h-6 w-20 bg-white/10 rounded animate-pulse"></div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : error ? (
                <Card className="bg-red-500/20 border border-red-500/30">
                  <CardContent className="p-6 text-center">
                    <p className="font-['Inter',sans-serif] text-red-400 text-sm">{error}</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Hero Summary Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 backdrop-blur-sm border-yellow-500/20 hover:border-yellow-500/30 hover:bg-gradient-to-br hover:from-yellow-500/15 hover:to-orange-500/10 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-['Inter',sans-serif] text-white/70 text-sm font-medium">
                            Current Balance
                          </span>
                          <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center shadow-lg">
                            <Coins className="w-5 h-5 text-yellow-500" />
                          </div>
                        </div>
                        <p className="font-['Inter',sans-serif] font-bold text-white text-3xl tracking-tight">
                          {formatNumber(analytics.currentBalance)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className={`bg-gradient-to-br backdrop-blur-sm border hover:border-opacity-30 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] ${
                      netChange >= 0 
                        ? 'from-green-500/10 to-emerald-500/5 border-green-500/20 hover:border-green-500/30 hover:from-green-500/15 hover:to-emerald-500/10'
                        : 'from-red-500/10 to-rose-500/5 border-red-500/20 hover:border-red-500/30 hover:from-red-500/15 hover:to-rose-500/10'
                    }`}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-['Inter',sans-serif] text-white/70 text-sm font-medium">
                            Net Change
                          </span>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                            netChange >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            {netChange >= 0 ? (
                              <TrendingUp className="w-5 h-5 text-green-500" />
                            ) : (
                              <TrendingDown className="w-5 h-5 text-red-500" />
                            )}
                          </div>
                        </div>
                        <p className={`font-['Inter',sans-serif] font-bold text-3xl tracking-tight ${
                          netChange >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {netChange >= 0 ? '+' : ''}{formatNumber(netChange)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="grid grid-cols-4 gap-3">
                    <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-md hover:shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingCart className="w-4 h-4 text-green-500" />
                          <span className="font-['Inter',sans-serif] text-white/60 text-xs font-medium">
                            Purchased
                          </span>
                        </div>
                        <p className="font-['Inter',sans-serif] font-bold text-green-400 text-lg">
                          +{formatNumber(analytics.totalPurchased)}
                        </p>
                        <p className="font-['Inter',sans-serif] text-white/50 text-xs mt-1">
                          {analytics.purchaseCount} txns
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-md hover:shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Coins className="w-4 h-4 text-[#309605]" />
                          <span className="font-['Inter',sans-serif] text-white/60 text-xs font-medium">
                            Earned
                          </span>
                        </div>
                        <p className="font-['Inter',sans-serif] font-bold text-[#309605] text-lg">
                          +{formatNumber(analytics.totalEarned)}
                        </p>
                        <p className="font-['Inter',sans-serif] text-white/50 text-xs mt-1">
                          Ad revenue
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-md hover:shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift className="w-4 h-4 text-pink-500" />
                          <span className="font-['Inter',sans-serif] text-white/60 text-xs font-medium">
                            Received
                          </span>
                        </div>
                        <p className="font-['Inter',sans-serif] font-bold text-pink-400 text-lg">
                          +{formatNumber(analytics.totalReceived)}
                        </p>
                        <p className="font-['Inter',sans-serif] text-white/50 text-xs mt-1">
                          {analytics.tipsReceivedCount} tips
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-md hover:shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingDown className="w-4 h-4 text-red-500" />
                          <span className="font-['Inter',sans-serif] text-white/60 text-xs font-medium">
                            Spent
                          </span>
                        </div>
                        <p className="font-['Inter',sans-serif] font-bold text-red-400 text-lg">
                          -{formatNumber(analytics.totalSpent + analytics.totalTipped)}
                        </p>
                        <p className="font-['Inter',sans-serif] text-white/50 text-xs mt-1">
                          {analytics.spendCount + analytics.tipsSentCount} txns
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h3 className="font-['Inter',sans-serif] font-bold text-white text-xl mb-5 tracking-tight">
                      Income Breakdown
                    </h3>
                    <div className="space-y-4">
                      <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01]">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                              <ShoppingCart className="w-5 h-5 text-green-500" />
                            </div>
                            <div className="flex-1">
                              <p className="font-['Inter',sans-serif] text-white text-base font-semibold mb-1">
                                Purchased
                              </p>
                              <p className="font-['Inter',sans-serif] text-white/60 text-sm">
                                {analytics.purchaseCount} transaction{analytics.purchaseCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <p className="font-['Inter',sans-serif] font-bold text-green-400 text-2xl">
                              +{formatNumber(analytics.totalPurchased)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01]">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#309605]/20 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                              <Coins className="w-6 h-6 text-[#309605]" />
                            </div>
                            <div className="flex-1">
                              <p className="font-['Inter',sans-serif] text-white text-base font-semibold mb-1">
                                Earned
                              </p>
                              <p className="font-['Inter',sans-serif] text-white/60 text-sm">
                                From ad revenue
                              </p>
                            </div>
                            <p className="font-['Inter',sans-serif] font-bold text-[#309605] text-2xl">
                              +{formatNumber(analytics.totalEarned)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01]">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-pink-500/20 rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
                              <Gift className="w-6 h-6 text-pink-500" />
                            </div>
                            <div className="flex-1">
                              <p className="font-['Inter',sans-serif] text-white text-base font-semibold mb-1">
                                Tips Received
                              </p>
                              <p className="font-['Inter',sans-serif] text-white/60 text-sm">
                                {analytics.tipsReceivedCount} tip{analytics.tipsReceivedCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <p className="font-['Inter',sans-serif] font-bold text-pink-400 text-2xl">
                              +{formatNumber(analytics.totalReceived)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-['Inter',sans-serif] font-bold text-white text-xl mb-5 tracking-tight">
                      Spending Breakdown
                    </h3>
                    {spendingCategories.length > 0 ? (
                      <div className="space-y-3">
                        {spendingCategories.map((category, index) => (
                          <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.01]">
                            <CardContent className="p-6">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center shadow-md">
                                    <Gift className="w-5 h-5 text-orange-500" />
                                  </div>
                                  <span className="font-['Inter',sans-serif] text-white text-base font-semibold">
                                    {category.category}
                                  </span>
                                </div>
                                <span className="font-['Inter',sans-serif] font-bold text-orange-400 text-2xl">
                                  {formatNumber(category.amount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm text-white/60 mb-3">
                                <span className="font-['Inter',sans-serif] font-medium">{category.count} transaction{category.count !== 1 ? 's' : ''}</span>
                                <span className="font-['Inter',sans-serif] font-medium">{category.percentage.toFixed(1)}% of spending</span>
                              </div>
                              <div className="w-full bg-white/10 rounded-full h-2 shadow-inner">
                                <div
                                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full shadow-lg transition-all duration-500"
                                  style={{ width: `${category.percentage}%` }}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <Card className="bg-white/5 backdrop-blur-sm border-white/10">
                        <CardContent className="p-12 text-center">
                          <div className="w-20 h-20 bg-gradient-to-br from-orange-500/20 to-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <DollarSign className="w-10 h-10 text-orange-400/60" />
                          </div>
                          <h3 className="font-['Inter',sans-serif] font-bold text-white text-lg mb-2 tracking-tight">
                            No Spending Yet
                          </h3>
                          <p className="font-['Inter',sans-serif] text-white/60 text-sm mb-4">
                            You haven't spent any treats in this period
                          </p>
                          <p className="font-['Inter',sans-serif] text-white/40 text-xs">
                            Start by tipping artists or promoting your music
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Card className="bg-white/5 backdrop-blur-sm border-white/10 shadow-lg hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <p className="font-['Inter',sans-serif] text-white/70 text-sm font-medium">
                              Total Inflow
                            </p>
                          </div>
                          <p className="font-['Inter',sans-serif] font-bold text-green-400 text-2xl">
                            +{formatNumber(totalInflow)}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingDown className="w-4 h-4 text-red-500" />
                            <p className="font-['Inter',sans-serif] text-white/70 text-sm font-medium">
                              Total Outflow
                            </p>
                          </div>
                          <p className="font-['Inter',sans-serif] font-bold text-red-400 text-2xl">
                            -{formatNumber(totalOutflow)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
