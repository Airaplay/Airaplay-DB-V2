/**
 * Prefetch user-related data on login so Library/Profile show instantly on navigation.
 * Runs in background; does not block. Reduces Supabase egress on first nav after login.
 */

import { persistentCache } from './persistentCache';
import { supabase, getUserPlaylists } from './supabase';

const LIBRARY_PLAYLISTS_CACHE_KEY = 'library_playlists_processed';
const LIBRARY_UPLOADS_CACHE_KEY = 'library_uploads_processed';
const PROFILE_CACHE_KEY = 'profile-data';
const CACHE_TTL = 5 * 60 * 1000;

export async function prefetchOnLogin(userId: string): Promise<void> {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => runPrefetch(userId), { timeout: 5000 });
  } else {
    setTimeout(() => runPrefetch(userId), 500);
  }
}

async function runPrefetch(userId: string): Promise<void> {
  try {
    const [playlists, profileData] = await Promise.allSettled([
      prefetchLibraryPlaylists(),
      prefetchProfileData(userId),
    ]);
    if (playlists.status === 'rejected') console.debug('[prefetchOnLogin] Playlists failed:', playlists.reason);
    if (profileData.status === 'rejected') console.debug('[prefetchOnLogin] Profile failed:', profileData.reason);
  } catch (e) {
    // Silent
  }
}

async function prefetchLibraryPlaylists(): Promise<void> {
  const playlists = await getUserPlaylists();
  await persistentCache.set(LIBRARY_PLAYLISTS_CACHE_KEY, playlists || [], CACHE_TTL);
}

async function prefetchProfileData(userId: string): Promise<void> {
  const [
    userRes,
    artistRes,
    followerRes,
    followingRes,
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('artist_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);

  if (userRes.error || !userRes.data) return;

  const profile = {
    userProfile: userRes.data,
    artistProfile: artistRes.data ?? null,
    socialLinks: [] as any[],
    followerCount: followerRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
  };
  await persistentCache.set(PROFILE_CACHE_KEY, profile, CACHE_TTL);
}
