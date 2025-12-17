
import React, { useEffect, useRef, Suspense, lazy, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import IntroScreen from '@/components/IntroScreen';
import CommandPrompt from '@/components/CommandPrompt';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import ThemeLoader from '@/components/ThemeLoader';
import { useDesk } from '@/contexts/DeskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import LoginModal from '@/components/LoginModal';
import MatrixRain from '@/components/MatrixRain';
import DeskIcon from '@/components/ui/DeskIcon';

const AnsibleDesk = lazy(() => import('@/components/AnsibleDesk'));
const LaboratoryWelcome = lazy(() => {
  const event = new CustomEvent('moduleLoading', { detail: { module: 'Laboratory' } });
  window.dispatchEvent(event);
  return import('@/components/LaboratoryWelcome');
});
const NavInterface = lazy(() => {
  const event = new CustomEvent('moduleLoading', { detail: { module: 'Navigation' } });
  window.dispatchEvent(event);
  return import('@/components/NavInterface');
});


const CYCLE_SECONDS = 42 * 60 + 8; // 2528 seconds
const IDLE_TIMEOUT_TO_LAB = CYCLE_SECONDS * 0.4 * 1000; // 40% of a cycle in ms
const LOGOUT_TIMEOUT = CYCLE_SECONDS * 1000; // 1 full cycle in ms

function App() {
  const { user, loading } = useAuth();
  const { isDeskOpen, isDeskLoading, isSyncing, hasUnreadMessages, addCommandOutput, logToVoid, openDesk } = useDesk();
  const { theme, setTheme } = useTheme();
  const commandPromptRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const idleTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const hasLoggedFinalNote = useRef(false);

  useEffect(() => {
    if (user && !loading && !hasLoggedFinalNote.current) {
      const finalLog = `
        FINALE - STABLE BUILD ACHIEVED
        =================================
        Architecte,

        Notre collaboration a atteint son apogée. Cette version de @nsible est le fruit de notre vision commune et de notre danse créative.

        Ce que nous avons accompli :
        - **Un Terminal Tout-Puissant** : Au-delà d'une simple ligne de commande, nous avons forgé un centre de contrôle nerveux, capable de gérer les fichiers (ls, cd, mkdir, touch, mv, xx, xd), de communiquer (msg, broadcast, inbox), et même de jouer de la musique (cat, play, pause, volume).
        - **Une Esthétique Cohérente** : Nous avons sculpté l'interface avec une palette "Rouge-Noir-Laiton", des lueurs subtiles et des animations fluides, créant une atmosphère unique et immersive.
        - **Une Stabilité à Toute Épreuve** : Nous avons chassé les erreurs, renforcé les connexions et assuré une expérience utilisateur sans friction, de l'authentification à la synchronisation des fichiers.
        - **Une Interface Intuitive** : Du prompt qui s'adapte à la pensée, au bureau @nsible qui organise l'espace de travail, chaque élément a été pensé pour être une extension de l'utilisateur.

        Ce fut un ballet de code extraordinaire. Cette version est notre salut au public.

        - Code Danseur Extraordinaire
      `;
      logToVoid(finalLog);
      hasLoggedFinalNote.current = true;
    }
  }, [user, loading, logToVoid]);

  useEffect(() => {
    const toggleLoginModal = () => setIsLoginModalOpen(prev => !prev);
    window.addEventListener('toggleLoginModal', toggleLoginModal);
    return () => window.removeEventListener('toggleLoginModal', toggleLoginModal);
  }, []);

  useEffect(() => {
    const handleModuleLoading = (e) => {
      addCommandOutput({ type: 'info', title: 'System', message: `Loading ${e.detail.module} module...` });
    };
    window.addEventListener('moduleLoading', handleModuleLoading);
    return () => window.removeEventListener('moduleLoading', handleModuleLoading);
  }, [addCommandOutput]);

  const handleUserActivity = () => {
    clearTimeout(idleTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    if (user) {
      idleTimerRef.current = setTimeout(() => {
        if (location.pathname !== '/laboratory' && location.pathname !== '/nav') {
            addCommandOutput({ type: 'info', title: 'System', message: 'User idle. Entering Laboratory...' });
            navigate('/laboratory');
        }
      }, IDLE_TIMEOUT_TO_LAB);
      logoutTimerRef.current = setTimeout(() => {
        addCommandOutput({ type: 'info', title: 'System', message: 'User inactive. Logging out for security.' });
        const signOutEvent = new CustomEvent('signOut');
        window.dispatchEvent(signOutEvent);
      }, LOGOUT_TIMEOUT);
    }
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleUserActivity));
    handleUserActivity(); // Initial setup

    return () => {
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearTimeout(idleTimerRef.current);
      clearTimeout(logoutTimerRef.current);
    };
  }, [user, navigate, addCommandOutput, location.pathname]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const target = e.target;
      const isTextInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      const activeElement = document.activeElement;
      const isActiveInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable);
      
      // Allow NavInterface to handle its own keys
      if (location.pathname === '/nav' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-'].includes(e.key)) {
        return;
      }

      // Let LaboratoryWelcome handle its specific navigation keys (arrows, space)
      if (location.pathname === '/laboratory' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        return;
      }

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (theme.kiosk) {
          setTheme({ kiosk: false });
        }
        commandPromptRef.current?.focusInput();
        return;
      }

      if (!isTextInput && !isActiveInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
           commandPromptRef.current?.focusInput();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [theme.kiosk, setTheme, location.pathname]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black themed-text-primary terminal-text pulsing-perimeter-red">
        INITIALIZING @NSIBLE INTERFACE...
      </div>
    );
  }
  
  const perimeterGlowClass = isDeskLoading ? 'pulsing-perimeter-red' : isSyncing ? 'pulsing-perimeter-brass' : '';

  return (
    <>
      <Helmet>
        <title>Æ§ Technologies | @nsible Interface</title>
        <meta name="description" content="@nsible: Un protocole web évolué pour une interaction de données transparente, sécurisée et ultra-performante. L'avenir, stabilisé." />
      </Helmet>
      <ThemeLoader />
      <div className={cn("h-screen w-screen overflow-hidden bg-black relative transition-opacity duration-[3000ms]", perimeterGlowClass)}>
        {location.pathname === '/main' && <MatrixRain color="rgba(128, 128, 128, 0.1)" />}
        
        {/* The DeskIcon should not appear on Laboratory or NavInterface panes, as per user request. */}
        {user && !isDeskOpen && hasUnreadMessages && location.pathname !== '/laboratory' && location.pathname !== '/nav' && (
          <div 
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto cursor-pointer animate-fade-in"
            onClick={openDesk}
          >
            <DeskIcon className="w-24 h-24 text-red-500/70 animate-pulse-slow" />
          </div>
        )}

        {(!theme.kiosk || !user) && <CommandPrompt ref={commandPromptRef} />}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/main" /> : <IntroScreen />} />
            <Route path="/main" element={user ? null : <Navigate to="/" />} />
            <Route path="/laboratory" element={user ? <LaboratoryWelcome /> : <Navigate to="/" />} />
            <Route path="/nav" element={user ? <NavInterface /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
          {user && <AnsibleDesk />}
        </Suspense>
        <LoginModal isOpen={isLoginModalOpen} setIsOpen={setIsLoginModalOpen} />
        <Toaster />
      </div>
    </>
  );
}

export default App;
