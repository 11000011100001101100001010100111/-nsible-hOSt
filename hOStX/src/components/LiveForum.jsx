import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useDesk } from '@/contexts/DeskContext';
import { MessageSquare, Users, Activity, Send, Wifi, WifiOff, Rss } from 'lucide-react';
import DeskIcon from '@/components/ui/DeskIcon';
import { cn } from '@/lib/utils';

const LiveForum = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { openDesk, isDeskLoading, addCommandOutput, setActivePanel } = useDesk();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [systemMetrics, setSystemMetrics] = useState({ load: 0, connections: 0, uptime: 99.9 });
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const fetchInitialMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .filter('is_broadcast', 'eq', true)
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (error) {
      addCommandOutput({ title: "Forum Error", description: "Could not fetch messages.", type: "error" });
    } else {
      setMessages(data);
    }
  }, [addCommandOutput]);

  const setupRealtime = useCallback(() => {
    if (!user || channelRef.current) return;

    const channel = supabase.channel('live-forum', {
      config: {
        presence: {
          key: user.profile.username,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.keys(newState).map(key => ({ username: key, ...newState[key][0] }));
        setOnlineUsers(users);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'is_broadcast=eq.true' }, (payload) => {
        setMessages((prevMessages) => [...prevMessages, payload.new]);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await channel.track({ online_at: new Date().toISOString() });
        } else {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;
  }, [user]);

  useEffect(() => {
    fetchInitialMessages();
    setupRealtime();

    const metricsInterval = setInterval(() => {
      setSystemMetrics(prev => ({
        load: Math.max(10, Math.min(90, prev.load + (Math.random() - 0.5) * 5)),
        connections: onlineUsers.length + Math.floor(Math.random() * 10),
        uptime: Math.min(99.99, prev.uptime + 0.001),
      }));
    }, 3000);

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      clearInterval(metricsInterval);
    };
  }, [fetchInitialMessages, setupRealtime, onlineUsers.length]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || !user || !isConnected) return;

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      sender_username: user.profile.username,
      content: message,
      is_broadcast: true,
      is_read: false,
    });

    if (error) {
      addCommandOutput({ title: "Error", description: "Could not send message.", type: "error" });
    } else {
      setMessage('');
    }
  };
  
  const formatSender = (senderUsername, isBroadcast) => {
    if (senderUsername === '@nsible_System') {
      return '@://sys.net';
    }
    if (isBroadcast) {
      return `@://${senderUsername}.io.net`;
    }
    return `@://${senderUsername}.io.user`;
  };

  return (
    <div className="h-full w-full flex overflow-hidden bg-black/50">
      <motion.div
        initial={{ x: -300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-80 bg-transparent border-r themed-border-primary p-4 flex flex-col"
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold terminal-text themed-text-primary mb-2">
            @NSIBLE.NET
          </h2>
          <p className="themed-text-secondary terminal-text text-sm">
            Decentralized Comms Hub
          </p>
        </div>

        <div className="mb-6">
          <h3 className="themed-text-primary terminal-text text-sm font-semibold mb-3 flex items-center">
            <Users className="w-4 h-4 mr-2" />
            ACTIVE USERS ({onlineUsers.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {onlineUsers.map(u => (
              <p key={u.username} className="themed-text-accent text-xs truncate">{formatSender(u.username, false)}</p>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="themed-text-primary terminal-text text-sm font-semibold mb-3 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            NETWORK STATUS
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm terminal-text">
              <span className="themed-text-secondary">Network Load:</span>
              <span className="themed-text-primary">{systemMetrics.load.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm terminal-text">
              <span className="themed-text-secondary">Active Nodes:</span>
              <span className="themed-text-primary">{systemMetrics.connections}</span>
            </div>
            <div className="flex justify-between text-sm terminal-text">
              <span className="themed-text-secondary">Sync Integrity:</span>
              <span className="themed-text-primary">{systemMetrics.uptime.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="mt-auto">
           <Button
            onClick={() => setActivePanel('terminal')}
            variant="outline"
            className="w-full themed-border-primary themed-text-primary themed-bg-hover themed-bg-hover-text terminal-text"
          >
            Return to Terminal
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex-1 bg-transparent p-6 flex flex-col"
      >
        <div className="mb-4">
          <h1 className="text-2xl font-bold terminal-text themed-text-primary mb-2 flex items-center">
            <Rss className="w-6 h-6 mr-2 animate-pulse" />
            Live Broadcast Feed
          </h1>
          <p className="themed-text-secondary terminal-text text-sm">
            Real-time data stream from all connected nodes.
          </p>
        </div>

        <div className="flex-1 bg-black/50 border themed-border-primary rounded p-4 overflow-y-auto mb-4">
          <div className="space-y-3">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "p-3 rounded transition-colors",
                  msg.is_broadcast 
                    ? "bg-black border-l-2 border-amber-400 broadcast-flicker" 
                    : `bg-cyan-400/10 hover:bg-cyan-400/20 border-l-2 ${msg.sender_username === (user ? user.profile.username : '') ? 'themed-border-accent' : 'themed-border-secondary'}`
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "terminal-text text-sm font-semibold",
                    msg.is_broadcast ? "text-red-500 italic" : (msg.sender_username === (user ? user.profile.username : '') ? 'themed-text-accent' : 'themed-text-secondary')
                  )}>
                    {formatSender(msg.sender_username, msg.is_broadcast)}
                  </span>
                  <span className={cn("terminal-text text-xs", msg.is_broadcast ? "text-amber-400" : "text-cyan-500")}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className={cn("terminal-text text-sm", msg.is_broadcast ? "text-red-500 italic" : "themed-text-accent")}>
                  {msg.content}
                </p>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={handleSendMessage} className="flex space-x-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={user ? `Broadcasting as ${formatSender(user.profile.username, true)}...` : "You must be logged in to broadcast..."}
            className="flex-1 bg-black/50 border themed-border-primary rounded px-4 py-2 themed-text-primary terminal-text text-sm focus:themed-border-secondary focus:outline-none"
            disabled={!user || !isConnected}
          />
          <Button
            type="submit"
            className="themed-bg-primary hover:themed-bg-secondary text-black font-semibold terminal-text px-6"
            disabled={!user || !isConnected}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>

        <div className="mt-2 text-center">
          <span className={`terminal-text text-xs flex items-center justify-center ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
            {isConnected ? <Wifi className="w-4 h-4 mr-2" /> : <WifiOff className="w-4 h-4 mr-2" />}
            {user ? `@://forum.${user.profile.username}.${isConnected ? 'live' : 'void'}` : 'Connecting...'}
            {isConnected && <span className="typing-cursor ml-1">_</span>}
          </span>
        </div>
      </motion.div>
    </div>
  );
};

export default LiveForum;