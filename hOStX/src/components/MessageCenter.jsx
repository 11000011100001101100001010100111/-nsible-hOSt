import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { History, Eye, EyeOff, Trash2, ChevronDown, ChevronRight, Clock, Archive, Star } from 'lucide-react';
import { useDesk } from '@/contexts/DeskContext';
import { useTheme } from '@/contexts/ThemeContext';

const CYCLE_SECONDS = 42 * 60 + 8; // 2528 seconds
const COLLECTION_FILE = 'collection.log';

const b64EncodeUnicode = (str) => {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  }));
};

const b64DecodeUnicode = (str) => {
  try {
    return decodeURIComponent(atob(str).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return str;
  }
};

const formatTime = (date, format) => {
  if (!date) return '';
  const d = new Date(date);
  if (format === '12h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (format === 'cycle') {
    const secondsInDay = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const cycles = (secondsInDay / CYCLE_SECONDS).toFixed(3);
    return `${cycles}c`;
  }
  // Default to 24h
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const RealtimeClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timerId = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  return (
    <div className="relative" style={{ top: '12px' }}>
      <div className="text-xs font-mono themed-text-primary bg-black/50 border-2 themed-border-primary rounded px-2 py-1 whitespace-nowrap">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
      </div>
    </div>
  );
};


const MessageCenter = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [collectedMessages, setCollectedMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsedSenders, setCollapsedSenders] = useState({});
  const { timelinePosition, setTimelinePosition, fileSystem, updateFileSystem } = useDesk();
  const [timeFilter, setTimeFilter] = useState(timelinePosition === 100 ? [24] : [Math.ceil(24 * (timelinePosition / 100))]);
  const { toast } = useToast();
  const { theme } = useTheme();

  useEffect(() => {
    setTimelinePosition(100);
  }, [setTimelinePosition]);

  useEffect(() => {
    const initialCollapsedState = { 'COLLECTED': false };
    if (theme.collapseSysNet) {
      initialCollapsedState['@://sys.net'] = true;
    }
    setCollapsedSenders(initialCollapsedState);
  }, [theme.collapseSysNet]);

  const fetchCollectionLog = useCallback(() => {
    if (!fileSystem) return [];
    const documents = fileSystem['documents']?.content;
    if (!documents) return [];
    const encodedFileName = b64EncodeUnicode(COLLECTION_FILE);
    const collectionFile = documents[encodedFileName];
    if (collectionFile && collectionFile.content) {
      return collectionFile.content.trim().split('\n').map((line, index) => {
        const match = line.match(/\[(.*?)\] <(.*?)>: (.*)/);
        if (match) {
          return {
            id: `collected-${index}`,
            created_at: match[1],
            sender_username: match[2],
            content: match[3],
            is_collected: true,
          };
        }
        return null;
      }).filter(Boolean);
    }
    return [];
  }, [fileSystem]);

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`recipient_id.eq.${user.id},is_broadcast.eq.true`)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast({ title: "Error", description: "Could not fetch messages.", variant: "destructive" });
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (!user) return; // Guard clause
    fetchMessages();
    const channel = supabase.channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, payload => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;
          if (newMessage.recipient_id === user.id || newMessage.is_broadcast) {
            setMessages(currentMessages => [newMessage, ...currentMessages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
          }
        } else if (payload.eventType === 'UPDATE') {
          setMessages(currentMessages => currentMessages.map(msg => msg.id === payload.new.id ? payload.new : msg));
        } else if (payload.eventType === 'DELETE') {
          setMessages(currentMessages => currentMessages.filter(msg => msg.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, user]);

  useEffect(() => {
    setCollectedMessages(fetchCollectionLog());
  }, [fileSystem, fetchCollectionLog]);
  
  const handleSliderChange = (value) => {
    const hours = Math.ceil(24 * (value[0] / 100));
    setTimeFilter([hours]);
    setTimelinePosition(value[0]);
  };

  const toggleReadStatus = async (id, currentStatus) => {
    const { error } = await supabase.from('messages').update({ is_read: !currentStatus }).eq('id', id);
    if (error) toast({ title: "Error", description: `Could not update message status: ${error.message}`, variant: "destructive" });
  };

  const deleteMessage = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) toast({ title: "Error", description: "Could not delete message.", variant: "destructive" });
  };

  const collectMessage = async (msg) => {
    if (!fileSystem) return;
    const newFileSystem = JSON.parse(JSON.stringify(fileSystem));
    const documents = newFileSystem['documents']?.content;
    if (!documents) {
      toast({ title: "Error", description: "Documents folder not found.", variant: "destructive" });
      return;
    }

    const encodedFileName = b64EncodeUnicode(COLLECTION_FILE);
    const collectionEntry = `[${msg.created_at}] <${formatSender(msg)}>: ${msg.content}\n`;

    if (documents[encodedFileName]) {
      if (documents[encodedFileName].content.includes(collectionEntry)) {
        toast({ title: "Already Collected", description: "This message is already in your collection." });
        return;
      }
      documents[encodedFileName].content += collectionEntry;
    } else {
      documents[encodedFileName] = { type: 'file', content: collectionEntry };
    }

    await updateFileSystem(newFileSystem, `Collected message to ${COLLECTION_FILE}`);
    toast({ title: "Message Collected", description: "The message has been saved to your collection.log." });
  };

  const formatSender = (msg) => {
    if (msg.is_collected) return msg.sender_username;
    if (msg.sender_username === '@nsible_System') return '@://sys.net';
    if (msg.is_broadcast) return `@://${msg.sender_username}.io.net`;
    if (msg.sender_id === msg.recipient_id) return `@://${msg.sender_username}.io.${msg.sender_username}`;
    return `@://${msg.sender_username}.io.user`;
  };

  const filteredMessages = useMemo(() => {
    const now = new Date();
    const filterMillis = timeFilter[0] * 60 * 60 * 1000;
    const cutoffDate = new Date(now.getTime() - filterMillis);
    return messages.filter(msg => new Date(msg.created_at) >= cutoffDate);
  }, [messages, timeFilter]);

  const groupedMessages = useMemo(() => {
    const groups = {};
    if (collectedMessages.length > 0) {
      groups['COLLECTED'] = collectedMessages;
    }
    filteredMessages.forEach(msg => {
      const sender = formatSender(msg);
      if (!groups[sender]) {
        groups[sender] = [];
      }
      groups[sender].push(msg);
    });
    return Object.entries(groups).sort((a, b) => a[0] === 'COLLECTED' ? -1 : b[0] === 'COLLECTED' ? 1 : a[0].localeCompare(b[0]));
  }, [filteredMessages, collectedMessages]);

  const toggleCollapse = (sender) => {
    setCollapsedSenders(prev => ({ ...prev, [sender]: !prev[sender] }));
  };
  
  if (!user) {
    return <div className="p-4">Authenticating...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <h2 className="text-2xl font-bold flex items-center mr-4"><History className="mr-3" />TIMELINE</h2>
        <div className="flex items-center space-x-2 flex-grow">
          <Clock className="w-4 h-4 themed-text-secondary" />
          <Slider
            value={[timelinePosition]}
            max={100}
            step={1}
            onValueChange={handleSliderChange}
            className="w-full"
            customThumb={<RealtimeClock />}
          />
          <span className="text-xs themed-text-secondary w-20 text-right">
            Last {timeFilter[0]}h
          </span>
        </div>
      </div>
      <div className="font-mono text-sm flex-grow overflow-y-auto border themed-border-accent p-2">
        {loading && <p>Loading messages...</p>}
        {!loading && messages.length === 0 && collectedMessages.length === 0 && <p>No messages found.</p>}
        {!loading && groupedMessages.length === 0 && <p>No messages in the selected time frame.</p>}
        {groupedMessages.map(([sender, msgs]) => {
          const isCollapsed = collapsedSenders[sender];
          const isCollectedGroup = sender === 'COLLECTED';
          return (
            <div key={sender} className={`p-2 my-1 rounded ${isCollectedGroup ? 'bg-amber-900/30' : 'bg-black/30'}`}>
              <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleCollapse(sender)}>
                <p className="font-bold flex items-center">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                  {isCollectedGroup && <Star className="w-4 h-4 mr-2 text-amber-400" />}
                  {sender} ({msgs.length})
                </p>
                {!isCollectedGroup && <span className="text-xs themed-text-secondary">{new Date(msgs[0].created_at).toLocaleDateString()}</span>}
              </div>
              {!isCollapsed && (
                <div className="pl-6 mt-2 border-l-2 themed-border-accent">
                  {msgs.map(msg => (
                    <div key={msg.id} className={`p-2 my-1 rounded ${msg.is_read || isCollectedGroup ? 'bg-black/20' : 'bg-green-900/40'}`}>
                      <div className="flex justify-between items-center">
                         <p className="themed-text-accent py-1">{msg.content}</p>
                         <span className="text-xs themed-text-secondary">{formatTime(msg.created_at, theme.timeFormat)}</span>
                      </div>
                      {!isCollectedGroup && (
                        <div className="flex items-center space-x-4 mt-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleReadStatus(msg.id, msg.is_read)} className="p-1 h-auto">{msg.is_read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMessage(msg.id)} className="p-1 h-auto text-red-500"><Trash2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => collectMessage(msg)} className="p-1 h-auto text-yellow-500"><Archive className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MessageCenter;