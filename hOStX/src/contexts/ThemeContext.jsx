import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState({
    color: 'red',
    fontSize: 'base',
    promptPosition: 'top-right',
    transparency: 58,
    editorTransparency: 80,
    kiosk: false,
    labGrid: true,
    labSky: true,
    labShadows: true,
    timeFormat: 'cycle',
    collapseSysNet: true,
  });

  const colorClasses = {
    green: 'theme-green',
    cyan: 'theme-cyan',
    amber: 'theme-amber',
    red: 'theme-red',
  };

  const fontSizes = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const promptPositions = {
    'top-right': 'prompt-top-right',
    'bottom': 'prompt-bottom',
  };

  const timeFormats = ['24h', '12h', 'cycle'];

  useEffect(() => {
    const root = window.document.documentElement;
    Object.values(colorClasses).forEach(cls => root.classList.remove(cls));
    root.classList.add(colorClasses[theme.color] || colorClasses.red);
    
    const body = window.document.body;
    Object.values(fontSizes).forEach(cls => body.classList.remove(cls));
    body.classList.add(fontSizes[theme.fontSize] || fontSizes.base);
  }, [theme.color, theme.fontSize]);

  const value = useMemo(() => ({
    theme,
    setTheme: (newTheme) => setTheme(prev => ({ ...prev, ...newTheme })),
    availableThemes: {
      colors: Object.keys(colorClasses),
      fontSizes: Object.keys(fontSizes),
      promptPositions: Object.keys(promptPositions),
      timeFormats: timeFormats,
    }
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};