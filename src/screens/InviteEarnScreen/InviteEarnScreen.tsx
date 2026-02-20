import { useState, useEffect } from 'react';
import { ArrowLeft, Copy, Check, Gift, Users, Share2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { supabase } from '../../lib/supabase';
import { shareContent } from '../../lib/shareService';
import { useNavigate } from 'react-router-dom';

interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  activeReferrals: number;
  rewardedReferrals: number;
  totalEarned: number;
}

export const InviteEarnScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralLink, setReferralLink] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    totalReferrals: 0,
    pendingReferrals: 0,
    activeReferrals: 0,
    rewardedReferrals: 0,
    totalEarned: 0,
  });
  const [rewardPerReferral, setRewardPerReferral] = useState<number>(100);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      setIsLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/profile');
        return;
      }

      const { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (codeError) throw codeError;

      if (codeData) {
        setReferralCode(codeData.code);
        const appUrl = window.location.origin;
        setReferralLink(`${appUrl}?ref=${codeData.code}`);
      } else {
        const { data, error } = await supabase.rpc('generate_referral_code', {
          p_user_id: user.id,
        });

        if (error) throw error;

        if (data) {
          setReferralCode(data);
          const appUrl = window.location.origin;
          setReferralLink(`${appUrl}?ref=${data}`);
        }
      }

      const { data: referrals, error: referralsError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id);

      if (referralsError) throw referralsError;

      if (referrals) {
        const stats = {
          totalReferrals: referrals.length,
          pendingReferrals: referrals.filter((r) => r.status === 'pending').length,
          activeReferrals: referrals.filter((r) => r.status === 'active').length,
          rewardedReferrals: referrals.filter((r) => r.status === 'rewarded').length,
          totalEarned: referrals.reduce((sum, r) => sum + (r.reward_amount || 0), 0),
        };
        setReferralStats(stats);
      }

      const { data: settings } = await supabase
        .from('referral_settings')
        .select('reward_per_referral')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (settings) {
        setRewardPerReferral(settings.reward_per_referral);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShare = async () => {
    try {
      await shareContent({
        title: 'Join Airaplay',
        text: `Join me on Airaplay! Use my referral code ${referralCode} to sign up and we both earn rewards!`,
        url: referralLink,
        dialogTitle: 'Share Referral Link'
      });
    } catch (error) {
      console.error('Error sharing:', error);
      handleCopyLink(); // Fallback to copy if share fails
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000]">
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-white/10 sticky top-0 z-10 bg-[#000]">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </button>
        <h1 className="font-['Inter',sans-serif] font-bold text-white text-lg">
          Invite & Earn
        </h1>
        <div className="w-9"></div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="font-['Inter',sans-serif] text-white/70 text-sm">
            Loading...
          </p>
        </div>
      ) : (
        <div className="flex-1 px-6 py-6 space-y-5 mb-36">
        <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="font-['Inter',sans-serif] font-semibold text-white text-lg mb-1">
                  Earn Treats
                </h2>
                <p className="font-['Inter',sans-serif] text-gray-400 text-sm leading-relaxed">
                  Share your unique referral link with friends. When they sign up and become active users, you'll earn <span className="font-semibold text-[#309605]">{rewardPerReferral} Treats</span> for each successful referral.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10">
          <CardContent className="p-5">
            <h3 className="font-['Inter',sans-serif] font-medium text-white text-sm mb-3">
              Your Referral Code
            </h3>
            <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
              <p className="font-['Inter',sans-serif] text-center text-white text-xl font-semibold tracking-widest">
                {referralCode || '- - - - - -'}
              </p>
            </div>
            <h3 className="font-['Inter',sans-serif] font-medium text-white text-sm mb-3">
              Your Referral Link
            </h3>
            <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/10 break-all">
              <p className="font-['Inter',sans-serif] text-gray-400 text-xs">
                {referralLink || '...'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCopyLink}
                className="h-11 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-['Inter',sans-serif] font-medium text-sm text-white transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className="h-11 bg-white hover:bg-white/90 rounded-xl font-['Inter',sans-serif] font-medium text-sm text-black transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10">
          <CardContent className="p-5">
            <h3 className="font-['Inter',sans-serif] font-medium text-white text-sm mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              Referral Stats
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="font-['Inter',sans-serif] text-gray-400 text-xs mb-1.5">
                  Total Invites
                </p>
                <p className="font-['Inter',sans-serif] text-white text-xl font-semibold">
                  {referralStats.totalReferrals}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="font-['Inter',sans-serif] text-gray-400 text-xs mb-1.5">
                  Pending
                </p>
                <p className="font-['Inter',sans-serif] text-white text-xl font-semibold">
                  {referralStats.pendingReferrals}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="font-['Inter',sans-serif] text-gray-400 text-xs mb-1.5">
                  Active
                </p>
                <p className="font-['Inter',sans-serif] text-white text-xl font-semibold">
                  {referralStats.activeReferrals}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="font-['Inter',sans-serif] text-gray-400 text-xs mb-1.5">
                  Rewarded
                </p>
                <p className="font-['Inter',sans-serif] text-white text-xl font-semibold">
                  {referralStats.rewardedReferrals}
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#309605]/10 to-[#3ba208]/10 rounded-xl p-4 border border-[#309605]/20">
              <p className="font-['Inter',sans-serif] text-gray-400 text-xs mb-1.5">
                Total Treats Earned
              </p>
              <p className="font-['Inter',sans-serif] text-white text-2xl font-semibold">
                {referralStats.totalEarned}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10">
          <CardContent className="p-5">
            <h3 className="font-['Inter',sans-serif] font-medium text-white text-sm mb-4">
              How It Works
            </h3>
            <div className="space-y-3.5">
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="font-['Inter',sans-serif] text-white text-xs font-semibold">1</span>
                </div>
                <div>
                  <p className="font-['Inter',sans-serif] text-white text-sm font-medium mb-0.5">
                    Share Your Link
                  </p>
                  <p className="font-['Inter',sans-serif] text-gray-400 text-xs leading-relaxed">
                    Send your referral link to friends via social media, messaging apps, or email.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="font-['Inter',sans-serif] text-white text-xs font-semibold">2</span>
                </div>
                <div>
                  <p className="font-['Inter',sans-serif] text-white text-sm font-medium mb-0.5">
                    They Sign Up
                  </p>
                  <p className="font-['Inter',sans-serif] text-gray-400 text-xs leading-relaxed">
                    Your friends use your link to create an account on Airaplay.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="font-['Inter',sans-serif] text-white text-xs font-semibold">3</span>
                </div>
                <div>
                  <p className="font-['Inter',sans-serif] text-white text-sm font-medium mb-0.5">
                    They Get Active
                  </p>
                  <p className="font-['Inter',sans-serif] text-gray-400 text-xs leading-relaxed">
                    Once they listen to music and engage with the app, they become active users.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-gradient-to-r from-[#309605] to-[#3ba208] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md shadow-[#309605]/20">
                  <span className="font-['Inter',sans-serif] text-white text-xs font-semibold">4</span>
                </div>
                <div>
                  <p className="font-['Inter',sans-serif] text-white text-sm font-medium mb-0.5">
                    You Earn Treats
                  </p>
                  <p className="font-['Inter',sans-serif] text-gray-400 text-xs leading-relaxed">
                    Get {rewardPerReferral} Treats added to your wallet for each successful referral.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
};
