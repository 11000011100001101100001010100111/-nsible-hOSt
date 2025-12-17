import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setLoading(false);
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    const handleSignOutEvent = async (event) => {
      if (event.detail?.message) {
        toast({
          title: "Session Terminated",
          description: event.detail.message,
          variant: "destructive",
        });
      }
      await signOut();
    };

    window.addEventListener('signOut', handleSignOutEvent);
    return () => window.removeEventListener('signOut', handleSignOutEvent);
  }, [signOut, toast]);

  const verifyAndSetUser = useCallback(async (currentSession) => {
    if (!currentSession?.user) {
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    const { data: profile, error } = await supabase
      .from('users')
      .select('is_approved, username, theme_settings, profile_info, public_page_html')
      .eq('id', currentSession.user.id)
      .single();

    if (error && !error.message.includes('JSON object requested')) {
      // An actual error occurred, not just no rows found
      toast({
        title: "Profile Error",
        description: "Could not retrieve your user profile. Logging out for security.",
        variant: "destructive",
      });
      await signOut();
      return;
    }

    if (!profile) {
        toast({
            title: "Profile Incomplete",
            description: "User profile not found. Logging out.",
            variant: "destructive",
        });
        await signOut();
        return;
    }

    if (!profile.is_approved) {
      toast({
        title: "Account Pending",
        description: "Your account is awaiting approval from a network architect.",
        duration: 9000,
      });
      await signOut();
      return;
    }

    const userWithProfile = { ...currentSession.user, profile };
    setSession(currentSession);
    setUser(userWithProfile);
    setLoading(false);
    if (window.location.pathname === '/login' || window.location.pathname === '/') {
      navigate('/main');
    }
  }, [toast, signOut, navigate]);

  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setLoading(false);
          navigate('/');
          return;
        }
        
        if (session) {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            await verifyAndSetUser(session);
          }
        } else {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [verifyAndSetUser, navigate]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signOut,
  }), [user, session, loading, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};