import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getUserLocation } from '../lib/locationDetection';

interface UserCountryResult {
  countryCode: string | null;
  isLoading: boolean;
}

const CACHE_KEY = 'user_country_code';
const CACHE_DURATION = 30 * 60 * 1000;

let cachedCountry: string | null = null;
let cacheTimestamp = 0;

export const useUserCountry = (): UserCountryResult => {
  const { user, isAuthenticated, isInitialized } = useAuth();
  const [countryCode, setCountryCode] = useState<string | null>(cachedCountry);
  const [isLoading, setIsLoading] = useState(!cachedCountry);

  useEffect(() => {
    if (!isInitialized) return;

    if (cachedCountry && Date.now() - cacheTimestamp < CACHE_DURATION) {
      setCountryCode(cachedCountry);
      setIsLoading(false);
      return;
    }

    const resolve = async () => {
      try {
        if (isAuthenticated && user?.id) {
          const { data } = await supabase
            .from('users')
            .select('country')
            .eq('id', user.id)
            .maybeSingle();

          if (data?.country) {
            cachedCountry = data.country;
            cacheTimestamp = Date.now();
            setCountryCode(data.country);
            setIsLoading(false);
            return;
          }
        }

        const location = await getUserLocation();
        if (location?.detected && location.location?.countryCode) {
          cachedCountry = location.location.countryCode;
          cacheTimestamp = Date.now();
          setCountryCode(location.location.countryCode);
        }
      } catch (err) {
        console.error('[useUserCountry] Error resolving country:', err);
      } finally {
        setIsLoading(false);
      }
    };

    resolve();
  }, [isInitialized, isAuthenticated, user?.id]);

  return { countryCode, isLoading };
};
