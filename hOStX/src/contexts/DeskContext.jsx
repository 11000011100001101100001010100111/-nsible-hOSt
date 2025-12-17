
import React, { createContext, useContext, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useFileSystem } from '@/hooks/useFileSystem';
import { supabase } from '@/lib/customSupabaseClient';
import AudioPlayer from '@/components/AudioPlayer';

const DeskContext = createContext(undefined);

const b64DecodeUnicode = (str) => {
  if (typeof str !== 'string') return str;
  try {
    return decodeURIComponent(atob(str).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    console.error("b64DecodeUnicode error:", e);
    return atob(str); // Fallback for safety
  }
};


export const DeskProvider = ({ children }) => {
  const { user, loading: isAuthLoading } = useAuth();
  const [isDeskOpen, setIsDeskOpen] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [timelinePosition, setTimelinePosition] = useState(100);
  const [audioQueue, setAudioQueue] = useState([]);
  const [audioHistory, setAudioHistory] = useState([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(null);
  const [activeAudioPlayerId, setActiveAudioPlayerId] = useState(null);
  const [activePanel, setActivePanel] = useState('terminal'); // 'terminal' or 'forum'
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  const addCommandOutput = useCallback((output) => {
    const event = { ...output, timestamp: new Date().toISOString() };
    setTimelineEvents(prev => [...prev, event]);
  }, []);

  const playAudio = useCallback((track, index) => {
    const playerId = Date.now();
    setActiveAudioPlayerId(playerId);
    setCurrentAudioIndex(index);
    
    const onEnded = () => {
      // Only proceed if this player is still the active one
      if (activeAudioPlayerId === playerId) {
        playNextInQueue(index);
      }
    };

    const playerComponent = <AudioPlayer src={track.src} mimeType={track.mimeType} title={track.title} onEnded={onEnded} autoPlay={true} />;
    addCommandOutput({
      type: 'audio',
      component: playerComponent,
    });
    
    setAudioHistory(prev => [track, ...prev]);
  }, [addCommandOutput, activeAudioPlayerId]);

  const playNextInQueue = useCallback((currentIndex = currentAudioIndex) => {
    const nextIndex = currentIndex !== null ? currentIndex + 1 : 0;
    if (nextIndex < audioQueue.length) {
      playAudio(audioQueue[nextIndex], nextIndex);
    } else {
      addCommandOutput({ type: 'info', title: 'Audio', message: 'End of queue reached.' });
      setCurrentAudioIndex(null);
      setActiveAudioPlayerId(null);
    }
  }, [audioQueue, currentAudioIndex, playAudio, addCommandOutput]);

  const playPreviousInQueue = useCallback(() => {
    const prevIndex = currentAudioIndex !== null ? currentAudioIndex - 1 : -1;
    if (prevIndex >= 0) {
      playAudio(audioQueue[prevIndex], prevIndex);
    } else {
      addCommandOutput({ type: 'info', title: 'Audio', message: 'Start of queue reached.' });
    }
  }, [audioQueue, currentAudioIndex, playAudio, addCommandOutput]);

  const addToAudioQueue = useCallback((track) => {
    setAudioQueue(prev => [...prev, track]);
    addCommandOutput({ type: 'success', title: 'Audio', message: `Added '${track.title}' to the queue.` });
  }, [addCommandOutput]);

  useEffect(() => {
    if (!user) return;
    
    const checkUnread = async () => {
        const { error, count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .or(`and(recipient_id.eq.${user.id},is_read.eq.false),is_broadcast.eq.true`);
            
        if (!error && count > 0) {
            setHasUnreadMessages(true);
        } else if (error) {
            console.error("Error checking unread messages:", error);
        }
    };
    
    checkUnread();

    const channel = supabase.channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMessage = payload.new;
        if (newMessage.recipient_id === user.id || newMessage.is_broadcast) {
           setHasUnreadMessages(true);
           if (activePanel !== 'forum') {
            addCommandOutput({
              type: 'message',
              title: `New Message from ${newMessage.sender_username}`,
              message: newMessage.content
            });
           }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addCommandOutput, activePanel]);

  const { 
    fileSystem, 
    updateFileSystem, 
    isLoading: isFsLoading, 
    isSyncing,
    catFile,
    moveFile,
    removeFile,
    removeDirectory,
    currentPath,
    setCurrentPath,
    getCurrentDirectory,
    editingFile,
    setEditingFile,
    logToMessageCenter,
    triggerRemoteSyncCheck,
    fetchFileSystemFromDB
  } = useFileSystem(user, isAuthLoading, addCommandOutput, addToAudioQueue);
  
  const handleLs = useCallback((pathArg) => {
    // Note: We ignore pathArg for now and strictly list currentPath to ensure consistency with Codex.
    // If we want to support 'ls folder', we would need to resolve that path against currentPath.
    const targetPath = currentPath;
    const dir = getCurrentDirectory(fileSystem, targetPath);
    
    const decodedPathString = `/${targetPath.map(b64DecodeUnicode).join('/')}`;

    if (!dir) {
      addCommandOutput({ type: 'error', title: 'ls Error', message: `Cannot read directory contents of ${decodedPathString}. Directory may not exist.` });
      return;
    }

    const items = Object.entries(dir).map(([encodedName, data]) => ({
      name: b64DecodeUnicode(encodedName),
      type: data.type,
    }));

    addCommandOutput({
      type: 'ls',
      path: decodedPathString,
      items: items,
    });
  }, [currentPath, fileSystem, getCurrentDirectory, addCommandOutput]);


  const voidLogBufferRef = useRef([]);
  const voidLogTimeoutRef = useRef(null);

  const openDesk = useCallback(() => {
    if (!isFsLoading && fileSystem) {
      setIsDeskOpen(true);
      setTimelinePosition(100);
      setHasUnreadMessages(false);
    } else {
      addCommandOutput({ type: 'info', title: "Desk syncryption is working in the background..." });
    }
  }, [isFsLoading, fileSystem, addCommandOutput]);

  const closeDesk = useCallback(() => {
    setIsDeskOpen(false);
    setEditingFile(null);
    setActivePanel('terminal');
  }, [setEditingFile]);

  const processVoidLogBuffer = useCallback(async () => {
    if (voidLogBufferRef.current.length === 0 || !user) return;
  
    const entriesToLog = voidLogBufferRef.current.splice(0);
    const logContent = entriesToLog.map(log => {
      const timestamp = new Date().toISOString();
      return `**ENTRY: ${timestamp}**\n${log}`;
    }).join('\n\n');
  
    const { error } = await supabase.rpc('log_to_void', {
      p_user_id: user.id,
      p_content: logContent,
    });
  
    if (error) {
      console.error('Failed to log to void:', error);
      // Put entries back in the buffer to retry
      voidLogBufferRef.current.unshift(...entriesToLog);
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (voidLogTimeoutRef.current) {
        clearTimeout(voidLogTimeoutRef.current);
      }
    };
  }, []);

  const logToVoid = useCallback((logContent) => {
    voidLogBufferRef.current.push(logContent);
    if (voidLogTimeoutRef.current) {
      clearTimeout(voidLogTimeoutRef.current);
    }
    voidLogTimeoutRef.current = setTimeout(processVoidLogBuffer, 1500);
  }, [processVoidLogBuffer]);

  const value = useMemo(() => ({
    isDeskOpen,
    openDesk,
    closeDesk,
    fileSystem,
    updateFileSystem,
    isDeskLoading: isFsLoading,
    isSyncing,
    catFile,
    moveFile,
    removeFile,
    removeDirectory,
    currentPath,
    setCurrentPath,
    getCurrentDirectory,
    editingFile,
    setEditingFile,
    logToMessageCenter,
    triggerRemoteSyncCheck,
    logToVoid,
    timelineEvents,
    addCommandOutput,
    timelinePosition,
    setTimelinePosition,
    fetchFileSystemFromDB,
    audioQueue,
    audioHistory,
    currentAudioIndex,
    addToAudioQueue,
    playNextInQueue,
    playPreviousInQueue,
    activePanel,
    setActivePanel,
    handleLs,
    hasUnreadMessages,
    setHasUnreadMessages,
  }), [
    isDeskOpen, 
    openDesk,
    closeDesk,
    fileSystem, 
    updateFileSystem, 
    isFsLoading, 
    isSyncing, 
    catFile, 
    moveFile, 
    removeFile,
    removeDirectory,
    currentPath, 
    setCurrentPath, 
    getCurrentDirectory, 
    editingFile,
    setEditingFile,
    logToMessageCenter,
    triggerRemoteSyncCheck,
    logToVoid,
    timelineEvents,
    addCommandOutput,
    timelinePosition,
    setTimelinePosition,
    fetchFileSystemFromDB,
    audioQueue,
    audioHistory,
    currentAudioIndex,
    addToAudioQueue,
    playNextInQueue,
    playPreviousInQueue,
    activePanel,
    setActivePanel,
    handleLs,
    hasUnreadMessages,
    setHasUnreadMessages,
  ]);

  return <DeskContext.Provider value={value}>{children}</DeskContext.Provider>;
};

export const useDesk = () => {
  const context = useContext(DeskContext);
  if (context === undefined) {
    throw new Error('useDesk must be used within a DeskProvider');
  }
  return context;
};
