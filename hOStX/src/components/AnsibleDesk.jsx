import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDesk } from '@/contexts/DeskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Terminal, History } from 'lucide-react';

import MessageCenter from '@/components/MessageCenter';
import Codex from '@/components/Codex';
import TerminalOutput from '@/components/TerminalOutput';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import DeskIcon from '@/components/ui/DeskIcon';
import CodexIcon from '@/components/ui/CodexIcon'; // FORGED

const IconButton = ({ icon: Icon, label, active, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "relative flex items-center p-2 rounded-md transition-colors",
        active ? 'themed-bg-accent themed-text-primary' : 'hover:themed-bg-accent/50'
      )}
    >
      <Icon size={18} />
      <AnimatePresence>
        {(isHovered || active) && (
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="ml-2 text-sm whitespace-nowrap"
            transition={{ duration: 0.2 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

const AnsibleDesk = () => {
  const { user } = useAuth();
  const { isDeskOpen, closeDesk, isDeskLoading, editingFile, setEditingFile, activePanel, setActivePanel, timelineEvents } = useDesk();
  const { theme } = useTheme();

  useEffect(() => {
    if (!isDeskOpen) {
      setEditingFile(null);
    }
  }, [isDeskOpen, setEditingFile]);

  if (!isDeskOpen) {
    return null;
  }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const deskVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 150 } },
    exit: { y: '100%', opacity: 0, transition: { duration: 0.3 } },
  };

  const showCodexPanel = activePanel === 'codex';

  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black/50"
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={closeDesk}
    >
      <motion.div
        className={cn(
          "fixed bottom-0 left-0 right-0 h-full flex flex-col terminal-text themed-bg-primary border-t-2 themed-border-primary shadow-2xl shadow-black rounded-t-lg overflow-hidden",
        )}
        style={{
          '--desk-transparency': `${theme.transparency || 0}%`,
          backgroundColor: `rgba(var(--color-primary-bg-val), calc(1 - var(--desk-transparency) / 100))`,
        }}
        variants={deskVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-start p-2 border-b-2 themed-border-secondary flex-shrink-0 space-x-4">
           <div 
             className="flex items-center space-x-2 cursor-pointer p-1 rounded-full hover:themed-bg-accent"
             onClick={closeDesk}
             title="Close Desk"
           >
            <DeskIcon className="w-6 h-6 themed-text-accent" />
            <h1 className="text-xl font-bold">@nsible Desk</h1>
          </div>
          
          <div className="flex space-x-1">
             <IconButton
              icon={Terminal}
              label="Terminal"
              active={activePanel === 'terminal'}
              onClick={() => setActivePanel('terminal')}
            />
            <IconButton
              icon={CodexIcon}
              label="Codex"
              active={activePanel === 'codex'}
              onClick={() => setActivePanel('codex')}
            />
            <IconButton
              icon={History}
              label="Timeline"
              active={activePanel === 'forum'}
              onClick={() => setActivePanel('forum')}
            />
          </div>

          {isDeskLoading && <div className="ml-2 h-4 w-4 border-2 border-dashed themed-border-accent rounded-full animate-spin"></div>}
        </header>

        <main className="flex-grow p-4 overflow-hidden">
          <div className="flex flex-col h-full min-h-0 overflow-hidden">
             {activePanel === 'terminal' && <TerminalOutput events={timelineEvents} />}
             {activePanel === 'forum' && <MessageCenter user={user} />}
             {activePanel === 'codex' && <Codex />}
          </div>
        </main>
      </motion.div>
    </motion.div>
  );
};

export default AnsibleDesk;