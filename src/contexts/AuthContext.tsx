import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, refreshSessionIfNeeded } from '../lib/supabase';
import { performCompleteLogout } from '../lib/logoutService';

interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  displayName: string | null;
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INITIAL_STATE: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  displayName: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);
  const mountedRef = useRef(true);
  const initializingRef = useRef(false);
  const loaderRemovedRef = useRef(false);

  const safeSetState = useCallback((updater: Partial<AuthState> | ((prev: AuthState) => AuthState)) => {
    if (mountedRef.current) {
      setState(prev => typeof updater === 'function' ? updater(prev) : { ...prev, ...updater });
    }
  }, []);

  const removeInitialLoader = useCallback(() => {
    if (typeof window !== 'undefined' && !loaderRemovedRef.current) {
      const loader = document.getElementById("initial-loader");
      if (loader) {
        loaderRemovedRef.current = true;
        loader.style.opacity = "0";
        loader.style.transition = "opacity 0.3s ease-out";
        setTimeout(() => {
          loader.remove();
          // Add loaded class to app root
          const appElement = document.getElementById("app");
          if (appElement) {
            appElement.classList.add("app-loaded");
          }
        }, 300);
      }
    }
  }, []);

  const updateAuthState = useCallback(async (session: Session | null) => {
    const user = session?.user ?? null;

    let displayName: string | null = null;
    if (user?.id) {
      try {
        const { data } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle();
        displayName = data?.display_name || null;
      } catch (error) {
        console.error('[AuthContext] Error fetching display name:', error);
      }
    }

    safeSetState({
      user,
      session,
      isAuthenticated: !!user,
      isLoading: false,
      isInitialized: true,
      displayName,
    });

    // Remove initial loader once auth is initialized
    removeInitialLoader();
  }, [safeSetState, removeInitialLoader]);

  const initializeAuth = useCallback(async () => {
    if (initializingRef.current) return;
    initializingRef.current = true;

    try {
      safeSetState({ isLoading: true });

      await refreshSessionIfNeeded();

      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthContext] Error getting initial session:', error);
        if (error.message?.includes('Invalid Refresh Token') ||
            error.message?.includes('refresh_token_not_found')) {
          updateAuthState(null);
        } else {
          safeSetState({ isLoading: false, isInitialized: true });
          removeInitialLoader();
        }
        return;
      }

      if (session?.user) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.warn('[AuthContext] Session exists but user validation failed');
          updateAuthState(null);
          return;
        }
        updateAuthState(session);
      } else {
        updateAuthState(null);
      }
    } catch (error) {
      console.error('[AuthContext] Error during initialization:', error);
      safeSetState({ isLoading: false, isInitialized: true });
      removeInitialLoader();
    } finally {
      initializingRef.current = false;
    }
  }, [safeSetState, updateAuthState, removeInitialLoader]);

  useEffect(() => {
    mountedRef.current = true;
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        console.log('[AuthContext] Auth state change:', event, session ? 'has session' : 'no session');

        // Skip INITIAL_SESSION event since we handle it in initializeAuth
        if (event === 'INITIAL_SESSION') {
          return;
        }

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
          case 'USER_UPDATED':
            if (session) {
              updateAuthState(session);
            }
            break;

          case 'SIGNED_OUT':
            safeSetState({
              user: null,
              session: null,
              isAuthenticated: false,
              isLoading: false,
              isInitialized: true,
              displayName: null,
            });
            // Remove loader if still present
            removeInitialLoader();
            break;

          default:
            break;
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [initializeAuth, updateAuthState, safeSetState, removeInitialLoader]);

  const signOut = useCallback(async () => {
    try {
      safeSetState({ isLoading: true });

      const { success, error } = await performCompleteLogout();

      if (!success) {
        console.error('[AuthContext] Sign out error:', error);
      }

      console.log('[AuthContext] Complete logout performed, clearing auth state');
    } catch (error) {
      console.error('[AuthContext] Sign out failed:', error);
    } finally {
      safeSetState({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: true,
        displayName: null,
      });
    }
  }, [safeSetState]);

  const refreshAuth = useCallback(async () => {
    try {
      const refreshed = await refreshSessionIfNeeded();
      if (!refreshed) {
        console.warn('[AuthContext] Session refresh failed');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        updateAuthState(session);
      }
    } catch (error) {
      console.error('[AuthContext] Error refreshing auth:', error);
    }
  }, [updateAuthState]);

  const contextValue: AuthContextType = {
    ...state,
    signOut,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser(): User | null {
  const { user } = useAuth();
  return user;
}

export function useSession(): Session | null {
  const { session } = useAuth();
  return session;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated, isInitialized } = useAuth();
  return isInitialized && isAuthenticated;
}
