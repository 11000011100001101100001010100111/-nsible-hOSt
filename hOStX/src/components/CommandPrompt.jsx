
import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDesk } from '@/contexts/DeskContext';
import { supabase } from '@/lib/customSupabaseClient';
import WebPreviewModal from '@/components/WebPreviewModal';

const b64EncodeUnicode = (str) => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode('0x' + p1);
    }));
  } catch (e) {
    console.error("b64EncodeUnicode error:", e);
    return btoa(str); // Fallback for safety
  }
};

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

const CommandPrompt = forwardRef((props, ref) => {
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastCommand, setLastCommand] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { theme, setTheme, availableThemes } = useTheme();
  const { user, loading: isAuthLoading, signOut } = useAuth();
  const { isDeskOpen, openDesk, closeDesk, addCommandOutput, fileSystem, updateFileSystem, catFile, moveFile, removeFile, currentPath, setCurrentPath, getCurrentDirectory, triggerRemoteSyncCheck, isSyncing, setTimelinePosition, editingFile, setEditingFile, removeDirectory, audioQueue, audioHistory, currentAudioIndex, playNextInQueue, playPreviousInQueue, activePanel, setActivePanel, handleLs, setHasUnreadMessages } = useDesk();
  const [previewData, setPreviewData] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const getCurrentDirectoryItems = useCallback(() => {
    const dir = getCurrentDirectory(fileSystem, currentPath);
    return dir ? Object.keys(dir).map(b64DecodeUnicode) : [];
  }, [fileSystem, currentPath, getCurrentDirectory]);

  useImperativeHandle(ref, () => ({
    focusInput: () => {
      inputRef.current?.focus();
    },
    // Expose the raw input element so App.jsx can check against it if needed
    get inputRef() { return inputRef.current; }
  }));

  const logUnrecognizedCommand = async (command) => {
    if (!fileSystem || !user) return; // Only log for authenticated users
    
    const encodedFileName = b64EncodeUnicode('unr-cmd.log');
    const logEntry = `[${new Date().toISOString()}] Unrecognized: "${command}"\n`;

    const documentsPath = ['documents'];

    // Check if 'documents' folder exists at the root
    if (!fileSystem['documents'] || fileSystem['documents'].type !== 'folder') {
        await updateFileSystem(`Creating documents directory.`, {
            path: [],
            key: 'documents',
            value: { type: 'folder', content: {} }
        });
    }

    const dir = getCurrentDirectory(fileSystem, ['documents']);
    let currentContent = '';
    if (dir && dir[encodedFileName] && dir[encodedFileName].type === 'file') {
        currentContent = dir[encodedFileName].content || '';
    }
    
    await updateFileSystem(`Logged unrecognized command.`, {
        path: documentsPath.reduce((acc, val) => [...acc, val, 'content'], []),
        key: encodedFileName,
        value: { type: 'file', content: currentContent + logEntry },
        append: true, // Use append logic
        silent: true
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTabCompletion();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(newIndex >= 0 ? commandHistory[newIndex] : '');
      }
    }
  };

  const handleTabCompletion = () => {
    const parts = input.split(' ');
    const cmd = parts[0].toLowerCase();
    const currentArg = parts[parts.length - 1];

    if (isDeskOpen && ['cat', 'mv', 'xx', 'xd', 'codex', 'cd', 'ls'].includes(cmd) && currentArg) {
      const items = getCurrentDirectoryItems();
      const matches = items.filter(item => item.startsWith(currentArg));

      if (matches.length === 1) {
        const completedArg = matches[0].includes(' ') ? `"${matches[0]}"` : matches[0];
        const newInput = [...parts.slice(0, -1), completedArg].join(' ');
        setInput(newInput);
      } else if (matches.length > 1) {
        addCommandOutput({ type: 'info', title: "Autocomplete Suggestions", message: matches.join('  ') });
      }
    }
  };

  const handleThemeCommand = (args) => {
    const [property, value] = args;
    if (!property) {
      const currentSettings = Object.entries(theme).map(([k, v]) => `${k}: ${v}`).join('\n');
      addCommandOutput({
        type: 'info',
        title: "Theme Settings",
        message: `Usage: theme <property> <value>\n\nProperties:\n${Object.keys(availableThemes).map(k => `${k}: [${availableThemes[k].join(', ')}]`).join('\n')}\n\nCurrent:\n${currentSettings}`,
      });
      return;
    }

    const numValue = parseInt(value, 10);
    const isValidPercentage = !isNaN(numValue) && numValue >= 0 && numValue <= 100;
    const isOnOff = value === 'on' || value === 'true' || value === 'off' || value === 'false';
    const boolValue = value === 'on' || value === 'true';

    switch (property) {
      case 'color':
        if (availableThemes.colors.includes(value)) {
          setTheme({ color: value });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Color set to ${value}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Color", message: `Available: ${availableThemes.colors.join(', ')}` });
        }
        break;
      case 'fontsize':
        if (availableThemes.fontSizes.includes(value)) {
          setTheme({ fontSize: value });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Font size set to ${value}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Font Size", message: `Available: ${availableThemes.fontSizes.join(', ')}` });
        }
        break;
      case 'position':
        if (availableThemes.promptPositions.includes(value)) {
          setTheme({ promptPosition: value });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Prompt position set to ${value}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Position", message: `Available: ${availableThemes.promptPositions.join(', ')}` });
        }
        break;
      case 'transparency':
        if (isValidPercentage) {
          setTheme({ transparency: numValue });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Desk transparency set to ${numValue}%` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Provide a number between 0 and 100." });
        }
        break;
      case 'editor_transparency':
        if (isValidPercentage) {
          setTheme({ editorTransparency: numValue });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Editor transparency set to ${numValue}%` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Provide a number between 0 and 100." });
        }
        break;
      case 'kiosk':
        if (isOnOff) {
          setTheme({ kiosk: boolValue });
          addCommandOutput({ type: 'success', title: `Kiosk Mode ${boolValue ? 'Enabled' : 'Disabled'}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Use 'on' or 'off'." });
        }
        break;
      case 'lab_grid':
        if (isOnOff) {
          setTheme({ labGrid: boolValue });
          addCommandOutput({ type: 'success', title: `Lab Grid ${boolValue ? 'Enabled' : 'Disabled'}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Use 'on' or 'off'." });
        }
        break;
      case 'lab_sky':
        if (isOnOff) {
          setTheme({ labSky: boolValue });
          addCommandOutput({ type: 'success', title: `Lab Sky ${boolValue ? 'Enabled' : 'Disabled'}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Use 'on' or 'off'." });
        }
        break;
      case 'lab_shadows':
        if (isOnOff) {
          setTheme({ labShadows: boolValue });
          addCommandOutput({ type: 'success', title: `Lab Shadows ${boolValue ? 'Enabled' : 'Disabled'}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Use 'on' or 'off'." });
        }
        break;
      case 'timeformat':
        if (availableThemes.timeFormats.includes(value)) {
          setTheme({ timeFormat: value });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Time format set to ${value}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Time Format", message: `Available: ${availableThemes.timeFormats.join(', ')}` });
        }
        break;
      case 'collapsesysnet':
        if (isOnOff) {
          setTheme({ collapseSysNet: boolValue });
          addCommandOutput({ type: 'success', title: "Theme Updated", message: `Collapse @://sys.net by default: ${boolValue ? 'On' : 'Off'}` });
        } else {
          addCommandOutput({ type: 'error', title: "Invalid Value", message: "Use 'on' or 'off'." });
        }
        break;
      default:
        addCommandOutput({ type: 'error', title: "Invalid Property", message: `Valid: color, fontsize, position, transparency, editor_transparency, kiosk, lab_grid, lab_sky, lab_shadows, timeformat, collapsesysnet` });
    }
  };

  const handleLabCommand = (args) => {
    const event = new CustomEvent('labCommand', { detail: args });
    window.dispatchEvent(event);
  };
  
  const handleNavCommand = (command, args) => {
      if (location.pathname !== '/nav') {
          navigate('/nav');
          // Add small delay to allow component mount before dispatching
          setTimeout(() => {
              const event = new CustomEvent('navCommand', { detail: { command, args } });
              window.dispatchEvent(event);
          }, 300);
      } else {
          const event = new CustomEvent('navCommand', { detail: { command, args } });
          window.dispatchEvent(event);
      }
      
      if (command === 'zoom' || command === 'rotate' || command === 'pan') {
          addCommandOutput({ type: 'success', title: "Nav System", message: `Executing: ${command} ${args.join(' ')}` });
      }
  };

  const handleSecretCommand = async (args) => {
    const [action, name, value] = args;
    if (!user) {
      addCommandOutput({ type: 'error', title: "Access Denied", message: "You must be logged in." });
      return;
    }

    if (action === 'set' && name && value) {
      const { error } = await supabase.from('secrets').upsert({ user_id: user.id, name, secret: value }, { onConflict: 'user_id, name' });
      if (error) {
        addCommandOutput({ type: 'error', title: "Secret Error", message: `Failed to set secret: ${error.message}` });
      } else {
        addCommandOutput({ type: 'success', title: "Secret Set", message: `Secret '${name}' has been securely stored.` });
      }
    } else {
      addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: secret set <name> <value>" });
    }
  };

  const handleWeatherCommand = async (args) => {
    const [zipcode] = args;
    if (!zipcode) {
      addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: wx <zipcode>" });
      return;
    }

    addCommandOutput({ type: 'info', title: "Fetching Weather...", message: `Getting forecast for ${zipcode}` });
    const { data, error } = await supabase.functions.invoke('get-weather', {
      body: { zipcode },
    });

    if (error || data.error) {
      addCommandOutput({ type: 'error', title: "Weather Error", message: error?.message || data.error });
    } else {
      addCommandOutput({
        type: 'success',
        title: `Weather for ${data.city}`,
        message: `${data.temperature}°C, ${data.description}`,
      });
    }
  };

  const handleMessageCommand = async (args) => {
    const [recipient, ...messageParts] = args;
    const message = messageParts.join(' ');

    if (!recipient || !message) {
      addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: msg <recipient_username> <message>" });
      return;
    }

    const { data: recipientData, error: recipientError } = await supabase
      .from('users')
      .select('id')
      .eq('username', recipient)
      .single();

    if (recipientError || !recipientData) {
      addCommandOutput({ type: 'error', title: "Send Error", message: `User '${recipient}' not found.` });
      return;
    }

    const { error: insertError } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_username: user.profile.username,
      recipient_id: recipientData.id,
      is_broadcast: false,
      is_read: false,
      content: message,
    });

    if (insertError) {
      addCommandOutput({ type: 'error', title: "Send Error", message: `Failed to send message: ${insertError.message}` });
    } else {
      addCommandOutput({ type: 'success', title: "Message Sent", message: `To ${recipient}: ${message}` });
    }
  };

  const handleBroadcastCommand = async (args) => {
    const message = args.join(' ');
    if (!message) {
      addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: broadcast <message>" });
      return;
    }

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_username: user.profile.username,
      content: message,
      is_broadcast: true,
      is_read: false,
      content: message,
    });

    if (error) {
      addCommandOutput({ type: 'error', title: "Broadcast Error", message: `Failed to send broadcast: ${error.message}` });
    } else {
      addCommandOutput({ type: 'success', title: "Broadcast Sent", message: `Sent: ${message}` });
    }
  };

  const handleInboxCommand = async (args) => {
    const action = args[0];
    if (action === 'readall') {
      addCommandOutput({ type: 'info', title: 'Inbox', message: 'Marking all messages as read...' });
      const { error } = await supabase.rpc('mark_all_messages_read');
      if (error) {
        addCommandOutput({ type: 'error', title: 'Error', message: `Could not mark all as read: ${error.message}` });
      } else {
        addCommandOutput({ type: 'success', title: 'Inbox', message: 'All messages have been marked as read.' });
        setHasUnreadMessages(false);
      }
      return;
    }
    const limit = parseInt(args[0], 10) || 10;
    const { data, error } = await supabase
      .from('messages')
      .select('created_at, sender_username, content, is_read')
      .or(`recipient_id.eq.${user.id},is_broadcast.eq.true`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      addCommandOutput({ type: 'error', title: "Inbox Error", message: `Failed to fetch messages: ${error.message}` });
      return;
    }

    if (data.length === 0) {
      addCommandOutput({ type: 'info', title: "Inbox", message: "No messages found." });
      return;
    }

    const formattedMessages = data.map(msg => 
      `[${new Date(msg.created_at).toLocaleString()}] From: ${msg.sender_username} ${msg.is_read ? '' : '(unread)'}\n  ${msg.content}`
    ).join('\n\n');
    
    addCommandOutput({ type: 'message', title: `Last ${data.length} Messages`, message: formattedMessages });
  };

  const handleTimelineCommand = (args) => {
    const [direction] = args;
    const step = 10; // Move 10% of the timeline
    if (direction === 'fwd') {
      setTimelinePosition(prev => {
        const newPos = Math.min(100, prev + step);
        addCommandOutput({ type: 'info', title: "Timeline", message: `Moved forward to ${newPos}%` });
        return newPos;
      });
    } else if (direction === 'back') {
      setTimelinePosition(prev => {
        const newPos = Math.max(0, prev - step);
        addCommandOutput({ type: 'info', title: "Timeline", message: `Moved back to ${newPos}%` });
        return newPos;
      });
    } else {
      addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: timeline <fwd|back>" });
    }
  };

  const handleArchXCommand = async (args) => {
    const [action, userId, value] = args;
    if (!user || !user.profile.is_approved) {
      addCommandOutput({ type: 'error', title: "Access Denied", message: "You do not have ArchX privileges." });
      return;
    }

    if (!action || action === 'ls') {
      const { data, error } = await supabase.from('users').select('id, username, is_approved, requested_at');
      if (error) {
        addCommandOutput({ type: 'error', title: "ArchX Error", message: error.message });
        return;
      }
      const userList = data.map(u => `${u.is_approved ? '[A]' : '[P]'} ${u.username.padEnd(20)} ${u.id}`).join('\n');
      addCommandOutput({ type: 'info', title: "User Directory", message: `[Status] Username             User ID\n------------------------------------------------\n${userList}\n\nUsage: archx <approve|revoke> <user_id>` });
    } else if ((action === 'approve' || action === 'revoke') && userId) {
      const shouldApprove = action === 'approve';
      const { error } = await supabase.from('users').update({ is_approved: shouldApprove, approved_at: shouldApprove ? new Date().toISOString() : null }).eq('id', userId);
      if (error) {
        addCommandOutput({ type: 'error', title: "ArchX Error", message: error.message });
      } else {
        addCommandOutput({ type: 'success', title: "ArchX Success", message: `User ${userId} has been ${shouldApprove ? 'approved' : 'revoked'}.` });
        handleArchXCommand(['ls']);
      }
    } else {
      addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: archx [ls|approve|revoke] [user_id]" });
    }
  };

  const handleAudioCommand = (args) => {
    const event = new CustomEvent('audioCommand', { detail: args });
    window.dispatchEvent(event);
  };

  const handleAudioQueueCommand = (args) => {
    const [subCommand] = args;
    switch (subCommand) {
      case 'queue':
        if (audioQueue.length === 0) {
          addCommandOutput({ type: 'info', title: 'Audio Queue', message: 'The queue is empty.' });
        } else {
          const queueList = audioQueue.map((track, index) => `${index + 1}. ${track.title}`).join('\n');
          addCommandOutput({ type: 'info', title: 'Audio Queue', message: queueList });
        }
        break;
      case 'current':
        if (currentAudioIndex !== null && audioQueue[currentAudioIndex]) {
          addCommandOutput({ type: 'info', title: 'Currently Playing', message: audioQueue[currentAudioIndex].title });
        } else {
          addCommandOutput({ type: 'info', title: 'Currently Playing', message: 'Nothing is currently playing.' });
        }
        break;
      case 'history':
        if (audioHistory.length === 0) {
          addCommandOutput({ type: 'info', title: 'Playback History', message: 'No tracks have been played yet.' });
        } else {
          const historyList = audioHistory.map((track, index) => `${index + 1}. ${track.title}`).join('\n');
          addCommandOutput({ type: 'info', title: 'Playback History', message: historyList });
        }
        break;
      default:
        addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: audio <queue|current|history>' });
    }
  };

  const handleTellCommand = async (args) => {
    const [number] = args;
    if (!number) {
        addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: tell <phonenumber>' });
        return;
    }

    if (!fileSystem) {
        addCommandOutput({ type: 'error', title: 'System Error', message: 'File system is initializing. Please try again in a moment.' });
        return;
    }

    const contactName = `contact_${number}.vcf`;
    const contactContent = `BEGIN:VCARD\nVERSION:3.0\nTEL;TYPE=CELL:${number}\nEND:VCARD`;

    // Ensure documents directory exists
    if (!fileSystem['documents']) {
        await updateFileSystem(`Creating documents directory.`, { path: [], key: 'documents', value: { type: 'folder', content: {} }});
    }
    
    await updateFileSystem(`Creating contact file for ${number}.`, {
        path: ['documents', 'content'],
        key: b64EncodeUnicode(contactName),
        value: { type: 'file', content: contactContent }
    });

    addCommandOutput({ type: 'success', title: 'Contact Saved', message: `Contact for ${number} saved to documents. Dialing...` });

    // Open Web Preview for visual feedback
    setPreviewData({
        title: `Outgoing Call`,
        url: `tel://${number}`,
        description: `Initiating secure voice connection to ${number}...`,
        image: 'https://horizons-cdn.hostinger.com/e45574c0-0580-4da8-a53d-0a0d509bd410/a0d1e791ed67ae38f07e1cb0f21cede3.gif',
        source: contactContent
    });

    // Navigate to tel protocol
    setTimeout(() => {
        window.location.href = `tel://${number}`;
    }, 500); 
  };

  const handleSayCommand = (args) => {
    const [number, ...msgParts] = args;
    if (!number) {
        addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: say <phonenumber> [message]' });
        return;
    }
    
    const message = msgParts.join(' ');
    // Construct SMS URI
    const smsUrl = `sms:${number}${message ? `?body=${encodeURIComponent(message)}` : ''}`;

    setPreviewData({
        title: 'Compose SMS',
        url: smsUrl,
        description: `Recipient: ${number}\n${message ? `Message: "${message}"` : ''}\n\nReady to launch messaging application.`,
        image: 'https://horizons-cdn.hostinger.com/e45574c0-0580-4da8-a53d-0a0d509bd410/3f0c98f28dac2cb92b622b75bad11201.gif', // Crimson and white GIF
        source: `Protocol: sms\nTarget: ${number}\nPayload: ${message || '(empty)'}`
    });
  };

  const handleExportCommand = async (args) => {
      const [sender] = args;
      if (!sender) {
          addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: export <sender>' });
          return;
      }

      if (!fileSystem) {
          addCommandOutput({ type: 'error', title: 'System Error', message: 'File system is initializing. Please try again.' });
          return;
      }
      
      const { data, error } = await supabase.from('messages')
          .select('created_at, content')
          .eq('sender_username', sender)
          .or(`recipient_id.eq.${user.id},is_broadcast.eq.true`)
          .order('created_at', { ascending: true });

      if (error) {
          addCommandOutput({ type: 'error', title: 'Export Error', message: `Could not fetch messages: ${error.message}` });
          return;
      }

      const archiveContent = data.map(m => `[${m.created_at}] ${m.content}`).join('\n');
      const archiveName = `archive_${sender}_${new Date().toISOString().split('T')[0]}.log`;

      if (!fileSystem['documents']) {
          await updateFileSystem(`Creating documents directory.`, { path: [], key: 'documents', value: { type: 'folder', content: {} }});
      }

      await updateFileSystem(`Exporting messages from ${sender}.`, {
          path: ['documents', 'content'],
          key: b64EncodeUnicode(archiveName),
          value: { type: 'file', content: archiveContent }
      });
  };

  const handlePurgeCommand = async (args) => {
      const [sender] = args;
      if (!sender) {
          addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: purge <sender>' });
          return;
      }

      const { error } = await supabase.from('messages')
          .delete()
          .eq('sender_username', sender)
          .or(`recipient_id.eq.${user.id},is_broadcast.eq.true`);
      
      if (error) {
          addCommandOutput({ type: 'error', title: 'Purge Error', message: `Could not purge messages: ${error.message}` });
      } else {
          addCommandOutput({ type: 'success', title: 'Purge Complete', message: `All messages from ${sender} have been deleted.` });
          const event = new CustomEvent('forceRefreshMessages');
          window.dispatchEvent(event);
      }
  };

  const handleUrlPreview = async (url) => {
    setIsPreviewLoading(true);
    addCommandOutput({ type: 'info', title: 'Web Preview', message: `Fetching preview for ${url}` });
    const { data, error } = await supabase.functions.invoke('url-preview', {
      body: { url },
    });
    setIsPreviewLoading(false);

    if (error || data.error) {
      addCommandOutput({ type: 'error', title: "Preview Error", message: error?.message || data.error });
    } else {
      setPreviewData(data);
    }
  };

  const handleCommand = useCallback(async (command) => {
    if (!command) return;
  
    setCommandHistory(prev => [command, ...prev.filter(c => c !== command)].slice(0, 50));
    setHistoryIndex(-1);
    
    addCommandOutput({ type: 'command', message: command });
  
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    let cmd = parts[0]?.toLowerCase();
    let args = parts.slice(1).map(arg => arg.replace(/"/g, ''));
    
    const mainUrl = 'https://xn--tatic-rra.tech';
    const aliases = ['nsible', 'nx--tatic-rra.com', 'http://xn--tatic-rra.tech', 'https://xn--tatic-rra.tech', '@://main'];
    if (aliases.includes(command.toLowerCase())) {
        setInput('');
        handleUrlPreview(mainUrl);
        return;
    }
  
    const urlRegex = /^((https?|mailto|sms|tel|intent|spotify|whatsapp|@):[^\s]+)$/i;
    if (urlRegex.test(command)) {
      setInput('');
      const protocol = command.split(':')[0].toLowerCase();
      
      if (['http', 'https'].includes(protocol)) {
          handleUrlPreview(command);
      } else {
          // Generate local preview for non-http protocols
          let title = `Protocol: ${protocol}`;
          let image = 'https://images.unsplash.com/photo-1560617544-b4f287789e24?auto=format&fit=crop&q=80&w=800'; // Generic connection
          let desc = `Opening link for ${protocol} protocol.`;

          switch (protocol) {
              case 'mailto':
                  title = 'Compose Email';
                  image = 'https://images.unsplash.com/photo-1557200130-975928f59b1e?auto=format&fit=crop&q=80&w=800';
                  desc = `Email Link: ${command}`;
                  break;
              case 'sms':
                  title = 'Compose SMS';
                  image = 'https://horizons-cdn.hostinger.com/e45574c0-0580-4da8-a53d-0a0d509bd410/3f0c98f28dac2cb92b622b75bad11201.gif'; // Crimson and white GIF
                  desc = `SMS Link: ${command}`;
                  break;
              case 'tel':
                  title = 'Initiate Call';
                  image = 'https://horizons-cdn.hostinger.com/e45574c0-0580-4da8-a53d-0a0d509bd410/a0d1e791ed67ae38f07e1cb0f21cede3.gif';
                  desc = `Telephone Link: ${command}`;
                  break;
              case 'spotify':
                  title = 'Spotify';
                  image = 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&q=80&w=800';
                  desc = `Spotify Content: ${command}`;
                  break;
              case 'whatsapp':
                  title = 'WhatsApp';
                  image = 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?auto=format&fit=crop&q=80&w=800';
                  desc = `WhatsApp Link: ${command}`;
                  break;
              case '@':
                  title = 'System Link';
                  desc = `Internal/System URI: ${command}`;
                  break;
              default:
                  // intent, etc.
                  break;
          }

          setPreviewData({
              title,
              url: command,
              description: desc + "\n\nClick button to open in default application.",
              image,
              source: `URI: ${command}`
          });
      }
      return;
    }
    
    const allCommands = ['help', 'login', 'logout', 'lab', 'nav', 'forum', 'archx', 'desk', 'theme', 'exit', 'codex', 'cat', 'mv', 'xx', 'xd', 'whois', 'whoami', 'sync', 'horizon', 'time', 'date', 'weather', 'wx', 'secret', 'msg', 'broadcast', 'inbox', 'timeline', 'tl', 'ls', 'cd', 'mkdir', 'touch', 'play', 'pause', 'stop', 'volume', 'next', 'prev', 'audio', 'rm', 'sudo', 'man', 'grep', 'chmod', 'chown', 'tell', 'say', 'export', 'purge'];
  
    const isLabContext = location.pathname === '/laboratory';
    const isNavContext = location.pathname === '/nav';
    const labCommands = ['move', 'rotate', 'pan', 'reset', 'zoom', 'strafe', 'fly'];
    const navCommands = ['zoom', 'rotate', 'pan', 'reset'];
    const deskCommands = ['ls', 'cd', 'mkdir', 'touch', 'codex', 'cat', 'mv', 'xx', 'xd'];
  
    if (deskCommands.includes(cmd)) {
        if (activePanel !== 'terminal') setActivePanel('terminal');
        if (!isDeskOpen) openDesk();
    }
  
    if (isLabContext && labCommands.includes(cmd) && cmd !== 'zoom' && cmd !== 'rotate' && cmd !== 'pan') {
      args.unshift(cmd);
      cmd = 'lab';
    }

    if (isNavContext && navCommands.includes(cmd)) {
       // We handle these specifically in the switch
    }
  
    if (!user && !['help', 'login', 'exit', 'theme'].includes(cmd)) {
      addCommandOutput({ type: 'error', title: "Access Denied", message: "You must be logged in to use this command." });
      setInput('');
      return;
    }
    
    setLastCommand(command);
  
    if (!allCommands.includes(cmd) && !isNavContext) {
      const looksLikeUrl = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?$/.test(command.split(' ')[0]);
      if (looksLikeUrl) {
        handleUrlPreview(`https://${command.split(' ')[0]}`);
      } else {
        addCommandOutput({ type: 'error', title: "Unrecognized Command", message: `Type 'help' for a list of commands.` });
        await logUnrecognizedCommand(command);
      }
      setInput('');
      return;
    }
  
    // Reset input here so the UI feels responsive
    setInput('');

    // Handle desk commands that need the filesystem
    if (deskCommands.includes(cmd)) {
      if (!fileSystem) {
        addCommandOutput({ type: 'error', title: 'Desk Error', message: 'File system not available. Please wait for sync.' });
        return;
      }
    }
  
    switch (cmd) {
      case 'help':
        const helpDesc = `
          --- System Commands ---
          login, logout, lab, nav, forum, desk [close], theme, exit, sync, whoami, horizon, time, date, wx <zipcode>, timeline|tl <fwd|back>

          --- Protocols (Direct Execution) ---
          mailto:<email>   :: Draft Email
          tel:<number>     :: Initiate Call
          sms:<number>     :: Compose SMS
          spotify:<uri>    :: Open Spotify
          whatsapp:<num>   :: WhatsApp Chat
          @://<internal>   :: System Links

          --- Comms Commands ---
          inbox [count|readall], msg <user> <msg>, broadcast <msg>
          tell <phone>     :: Dial number (uses tel:)
          say <phone> [msg]:: Draft SMS (uses sms:)
          export <user>, purge <user>

          --- Desk Commands ---
          ls, cd <dir>, mkdir <dir>, touch <file>, codex [file], cat <file>, mv <src> <dest>, xx <file>, xd <dir>

          --- Admin Commands ---
          archx [ls|approve|revoke], secret set <name> <value>

          --- Audio Commands ---
          play, pause, stop, volume <0-100>, next, prev, audio <queue|current|history>

          --- Nav/Map Commands ---
          nav, zoom <in|out|val>, rotate <left|right|val>, pan <dir>, reset

          --- Lab Commands ---
          move, rotate, pan, zoom, strafe, fly
        `.replace(/  +/g, '');
        addCommandOutput({ type: 'info', title: "Available Commands", message: helpDesc });
        break;
      case 'login':
        const loginEvent = new CustomEvent('toggleLoginModal');
        window.dispatchEvent(loginEvent);
        break;
      case 'logout':
        addCommandOutput({ type: 'info', title: "System", message: "Signing out..." });
        await signOut();
        break;
      case 'lab':
        if (args.length > 0) {
          handleLabCommand(args);
        } else {
          navigate('/laboratory');
        }
        break;
      case 'nav':
        navigate('/nav');
        break;
      case 'zoom':
      case 'rotate':
      case 'pan':
      case 'reset':
         // Dispatch these commands to NavInterface if active, or Lab if active
         if (location.pathname === '/nav') {
             handleNavCommand(cmd, args);
         } else if (location.pathname === '/laboratory') {
             handleLabCommand([cmd, ...args]);
         } else {
             // Default to Nav for these commands if neither is active? 
             // Or just open Nav.
             handleNavCommand(cmd, args);
         }
         break;
      case 'forum':
        if (!isDeskOpen) openDesk();
        setActivePanel('forum');
        break;
      case 'archx':
        await handleArchXCommand(args);
        break;
      case 'desk':
        if (args[0] === 'close') {
          closeDesk();
        } else {
          openDesk();
        }
        break;
      case 'theme':
        handleThemeCommand(args);
        break;
      case 'exit':
        navigate('/');
        break;
      case 'codex':
        if (args.length === 0) {
          setEditingFile(prev => prev ? null : { name: 'untitled', content: '', isNew: true });
        } else {
          const fileName = args.join(' ');
          const items = getCurrentDirectoryItems();
          const fileExists = items.includes(fileName);
          
          if (fileExists) {
             const dir = getCurrentDirectory(fileSystem, currentPath);
             const encodedFileName = b64EncodeUnicode(fileName);
             setEditingFile({ name: fileName, encodedName: encodedFileName, ...dir[encodedFileName] });
          } else {
            setEditingFile({ name: fileName, content: '', isNew: true });
          }
        }
        break;
      case 'cat':
        if (args.length === 1) {
          await catFile(args[0]);
        } else {
          addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: cat [filename]" });
        }
        break;
      case 'mv':
        if (args.length === 2) {
          await moveFile(args[0], args[1]);
        } else {
          addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: mv [source] [destination]" });
        }
        break;
      case 'xx':
        if (args.length === 1) {
          await removeFile(args[0]);
        } else {
          addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: xx [filename]" });
        }
        break;
      case 'xd':
        if (args.length === 1) {
          await removeDirectory(args[0]);
        } else {
          addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: xd [directory]" });
        }
        break;
      case 'whois':
        if (args.length === 1) {
          addCommandOutput({ type: 'info', title: "Feature In Development", message: `Web preview for user '${args[0]}' is not yet implemented.` });
        } else {
          addCommandOutput({ type: 'error', title: "Usage Error", message: "Usage: whois [username]" });
        }
        break;
      case 'whoami':
        addCommandOutput({ type: 'info', title: "User Info", message: `Logged in as ${user.profile.username} (UID: ${user.id})` });
        break;
      case 'sync':
        addCommandOutput({ type: 'info', title: "Syncing...", message: "Forcing a check for remote updates." });
        await triggerRemoteSyncCheck();
        break;
      case 'horizon':
        window.open('https://hostinger.com/horizons?REFERRALCODE=FCQ010001RH8', '_blank');
        addCommandOutput({ type: 'info', title: "Hostinger Horizons", message: "Opening your personalized Horizons link in a new tab!" });
        break;
      case 'time':
        addCommandOutput({ type: 'info', title: "Current Time", message: new Date().toLocaleTimeString() });
        break;
      case 'date':
        addCommandOutput({ type: 'info', title: "Current Date", message: new Date().toLocaleDateString() });
        break;
      case 'weather':
      case 'wx':
        await handleWeatherCommand(args);
        break;
      case 'secret':
        await handleSecretCommand(args);
        break;
      case 'msg':
        await handleMessageCommand(args);
        break;
      case 'broadcast':
        await handleBroadcastCommand(args);
        break;
      case 'inbox':
        await handleInboxCommand(args);
        break;
      case 'timeline':
      case 'tl':
        handleTimelineCommand(args);
        break;
      case 'ls':
        handleLs(args[0] ? args[0] : null);
        break;
      case 'cd':
        if (args.length >= 1) {
          const path = args[0];
          if (path === '..') {
            const newPath = currentPath.slice(0, -1);
            setCurrentPath(newPath);
          } else if (path === '/') {
            setCurrentPath([]);
          } else {
            const dir = getCurrentDirectory(fileSystem, currentPath);
            const encodedPath = b64EncodeUnicode(path);
            if (dir && dir[encodedPath]?.type === 'folder') {
              const newPath = [...currentPath, encodedPath];
              setCurrentPath(newPath);
            } else {
              addCommandOutput({ type: 'error', title: 'cd Error', message: `Directory not found: ${path}` });
            }
          }
        } else {
            addCommandOutput({ type: 'info', title: 'cd', message: `Current path: /${currentPath.map(b64DecodeUnicode).join('/')}` });
        }
        break;
      case 'mkdir':
        if (args.length === 1) {
          const dirName = args[0];
          const encodedDirName = b64EncodeUnicode(dirName);
          let currentDir = getCurrentDirectory(fileSystem, currentPath);
          
          if (currentDir === null) {
              addCommandOutput({ type: 'error', title: 'mkdir Error', message: `Current path does not exist.` });
              return;
          }

          if (currentDir && !currentDir[encodedDirName]) {
             let pathParts = currentPath.reduce((acc, val) => [...acc, val, 'content'], []);
            await updateFileSystem(`Creating directory '${dirName}'.`, {
              path: pathParts,
              key: encodedDirName,
              value: { type: 'folder', content: {} }
            });
          } else {
            addCommandOutput({ type: 'error', title: 'mkdir Error', message: `'${dirName}' already exists.` });
          }
        } else {
          addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: mkdir <directory_name>' });
        }
        break;
      case 'touch':
        if (args.length === 1) {
          const fileName = args[0];
          const encodedFileName = b64EncodeUnicode(fileName);
          let currentDir = getCurrentDirectory(fileSystem, currentPath);
          if (currentDir && !currentDir[encodedFileName]) {
            let pathParts = currentPath.reduce((acc, val) => [...acc, val, 'content'], []);
            await updateFileSystem(`Creating file '${fileName}'.`, {
              path: pathParts,
              key: encodedFileName,
              value: { type: 'file', content: '' }
            });
          } else {
            addCommandOutput({ type: 'error', title: 'touch Error', message: `'${fileName}' already exists.` });
          }
        } else {
          addCommandOutput({ type: 'error', title: 'Usage Error', message: 'Usage: touch <file_name>' });
        }
        break;
      case 'tell':
        await handleTellCommand(args);
        break;
      case 'say':
        handleSayCommand(args);
        break;
      case 'export':
        await handleExportCommand(args);
        break;
      case 'purge':
        await handlePurgeCommand(args);
        break;
      case 'play':
        if (currentAudioIndex === null && audioQueue.length > 0) {
          playNextInQueue();
        } else {
          handleAudioCommand([cmd]);
        }
        break;
      case 'pause':
      case 'stop':
        handleAudioCommand([cmd]);
        break;
      case 'volume':
        handleAudioCommand([cmd, args[0]]);
        break;
      case 'next':
        playNextInQueue();
        break;
      case 'prev':
        playPreviousInQueue();
        break;
      case 'audio':
        handleAudioQueueCommand(args);
        break;
      case 'rm':
        addCommandOutput({ type: 'info', title: "File System Command", message: `Please use the 'xx' command to remove files.` });
        break;
      case 'sudo':
        addCommandOutput({ type: 'info', title: "Privilege Escalation", message: "Root access is managed by ArchX. Privileges are pre-authorized." });
        break;
      case 'man':
      case 'grep':
      case 'chmod':
      case 'chown':
        addCommandOutput({ type: 'info', title: "Command Not Implemented", message: `The '${cmd}' command is not yet available in this environment.` });
        await logUnrecognizedCommand(command);
        break;
      default:
        // This case should not be reached due to the check at the top
        addCommandOutput({ type: 'error', title: "Unrecognized Command", message: `Type 'help' for a list of commands.` });
        await logUnrecognizedCommand(command);
    }
  }, [navigate, location, user, isDeskOpen, openDesk, closeDesk, setTheme, availableThemes, catFile, moveFile, removeFile, removeDirectory, currentPath, setCurrentPath, getCurrentDirectory, getCurrentDirectoryItems, triggerRemoteSyncCheck, updateFileSystem, fileSystem, isSyncing, isAuthLoading, addCommandOutput, setTimelinePosition, editingFile, setEditingFile, signOut, audioQueue, currentAudioIndex, playNextInQueue, playPreviousInQueue, activePanel, setActivePanel, handleLs, setHasUnreadMessages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const commandToRun = input.trim();
    if (commandToRun) {
      handleCommand(commandToRun);
    } else if (lastCommand) {
      handleCommand(lastCommand);
    }
  };

  const handlePromptClick = (e) => {
    // If the user clicked the input itself, let the browser handle it.
    // This allows cursor placement and text selection to work normally on mobile.
    if (e.target === inputRef.current) return;

    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.focus();
      // Ensure mobile keyboard appears by triggering a click if we are clicking the background
      inputRef.current.click();
    }
  };

  const promptPositionClass = theme.promptPosition === 'bottom' ? 'prompt-bottom' : 'prompt-top-right';

  return (
    <>
      <div className={`command-prompt-wrapper ${promptPositionClass}`}>
        <form 
          onSubmit={handleSubmit} 
          className="command-prompt" 
          data-has-input={!!input}
          onClick={handlePromptClick}
        >
          <span className="command-prompt-prefix">@://</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="command-input"
            autoFocus
            disabled={isPreviewLoading || isSyncing}
            inputMode="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </form>
      </div>
      {previewData && (
        <WebPreviewModal
          data={previewData}
          onClose={() => setPreviewData(null)}
          onViewSource={() => {
            const sourceFileName = `${new URL(previewData.url).hostname || 'source'}.html`;
            if (user) {
              setEditingFile({
                name: sourceFileName,
                content: previewData.source,
                isNew: true, // Treat as new unsaved file
              });
              if (!isDeskOpen) openDesk();
            } else {
              toast({
                variant: "destructive",
                title: "Login Required",
                description: "You must be logged in to save or edit files.",
              });
            }
            setPreviewData(null);
          }}
        />
      )}
    </>
  );
});

export default CommandPrompt;
