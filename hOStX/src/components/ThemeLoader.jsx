import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const ThemeLoader = () => {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (user && user.profile && user.profile.theme_settings) {
      setTheme(user.profile.theme_settings);
    }
  }, [user, setTheme]);

  return null;
};

export default ThemeLoader;