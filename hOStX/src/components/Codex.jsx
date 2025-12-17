
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDesk } from '@/contexts/DeskContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { 
  Save, X, FilePlus, Code, Folder, File, Trash2, Edit2, 
  Home, ArrowUp, Loader2, Image as ImageIcon, 
  Music, Video, Eye, FileText, FileTerminal, Globe, 
  FileCode, RefreshCw, AlertCircle, FileType, Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';

// --- Utilities ---

const b64EncodeUnicode = (str) => {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  }));
};

const b64DecodeUnicode = (str) => {
  try {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    return str;
  }
};

const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
};

const getFileType = (filename) => {
  const ext = getFileExtension(filename).toLowerCase();
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac', 'wma'].includes(ext)) return 'audio';
  if (['mp4', 'avi', 'mkv', 'mov', 'flv', 'wmv', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['js', 'jsx', 'ts', 'tsx', 'json'].includes(ext)) return 'javascript';
  if (['html', 'xml', 'htm', 'rss', 'css'].includes(ext)) return 'network';
  if (['c', 'cpp', 'h', 'cc', 'cs', 'java', 'py', 'rb', 'php', 'go', 'rs', 'swift'].includes(ext)) return 'code';
  if (['log', 'bin', 'sh', 'exe', 'iso', 'bat', 'cmd', 'ps1'].includes(ext)) return 'system';
  if (['txt', 'doc', 'md', 'rtf', 'pdf', 'odt'].includes(ext)) return 'text';
  
  return 'unknown';
};

const getLanguage = (filename) => {
  const ext = getFileExtension(filename).toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx': 
    case 'ts':
    case 'tsx': return 'javascript';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'html': 
    case 'htm': return 'html';
    case 'md': return 'markdown';
    case 'xml': 
    case 'rss': return 'xml';
    case 'py': return 'python';
    case 'c':
    case 'cpp':
    case 'h': return 'cpp';
    default: return 'text';
  }
};

const getFileIcon = (type) => {
  switch (type) {
    case 'image': return <ImageIcon className="mr-3 h-4 w-4 text-purple-400 flex-shrink-0" />;
    case 'audio': return <Music className="mr-3 h-4 w-4 text-pink-400 flex-shrink-0" />;
    case 'video': return <Video className="mr-3 h-4 w-4 text-blue-400 flex-shrink-0" />;
    case 'javascript': return <FileCode className="mr-3 h-4 w-4 text-yellow-400 flex-shrink-0" />;
    case 'network': return <Globe className="mr-3 h-4 w-4 text-cyan-400 flex-shrink-0" />;
    case 'code': return <Code className="mr-3 h-4 w-4 text-green-400 flex-shrink-0" />;
    case 'system': return <FileTerminal className="mr-3 h-4 w-4 text-red-400 flex-shrink-0" />;
    case 'text': return <FileText className="mr-3 h-4 w-4 text-slate-300 flex-shrink-0" />;
    default: return <File className="mr-3 h-4 w-4 text-slate-500 flex-shrink-0" />;
  }
};

// --- Syntax Highlighter Logic ---
const highlightCode = (code, language) => {
  if (!code) return '';
  
  // Escape HTML to prevent injection
  let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const patterns = {
    javascript: [
      { regex: /\/\/.*|\/\*[\s\S]*?\*\//g, class: 'text-gray-500 italic' }, // Comments
      { regex: /\b(const|let|var|function|return|if|else|for|while|import|export|default|class|extends|true|false|null|undefined|async|await|new|this|try|catch|from|switch|case|break)\b/g, class: 'text-purple-400 font-bold' },
      { regex: /(['"`])(?:(?=(\\?))\2.)*?\1/g, class: 'text-green-400' }, // Strings
      { regex: /\b\d+\b/g, class: 'text-orange-400' }, // Numbers
      { regex: /\b[A-Z][a-zA-Z0-9_]*\b/g, class: 'text-yellow-300' }, // Types
      { regex: /\b[a-z][a-zA-Z0-9_]*(?=\()/g, class: 'text-blue-400' }, // Functions
    ],
    json: [
      { regex: /(['"])(?:(?=(\\?))\2.)*?\1(?=\s*:)/g, class: 'text-blue-300 font-bold' }, // Keys
      { regex: /(['"])(?:(?=(\\?))\2.)*?\1(?!\s*:)/g, class: 'text-green-400' }, // String Values
      { regex: /\b(true|false|null)\b/g, class: 'text-purple-400' },
      { regex: /\b\d+\b/g, class: 'text-orange-400' },
    ],
    css: [
      { regex: /\/\*[\s\S]*?\*\//g, class: 'text-gray-500 italic' },
      { regex: /([a-zA-Z0-9_-]+)(?=\s*:)/g, class: 'text-blue-300' },
      { regex: /(:)([\s\S]+?)(;)/g, class: 'text-green-300' },
      { regex: /([.#][a-zA-Z0-9_-]+)/g, class: 'text-yellow-300 font-bold' },
    ],
    html: [
       { regex: /(&lt;\/?[a-z0-9-]+)(&gt;)?/gi, class: 'text-blue-400' },
       { regex: /([a-z0-9-]+)(==?)/gi, class: 'text-purple-300' },
       { regex: /(&lt;!--[\s\S]*?--&gt;)/g, class: 'text-gray-500 italic' },
    ],
    markdown: [
       { regex: /^(&lt;h[1-6]&gt;|#+).*/gm, class: 'text-blue-400 font-bold' }, // Headers (approx)
       { regex: /(\*\*|__)(.*?)\1/g, class: 'text-yellow-300 font-bold' },
       { regex: /(`)(.*?)\1/g, class: 'text-green-400' },
    ],
    cpp: [
        { regex: /\/\/.*|\/\*[\s\S]*?\*\//g, class: 'text-gray-500 italic' }, // Comments
        { regex: /#include\s+&lt;.*?&gt;/g, class: 'text-green-300' },
        { regex: /\b(int|float|double|char|void|bool|long|short|unsigned|signed|struct|class|enum|namespace|using|public|private|protected|virtual|static|const|auto)\b/g, class: 'text-blue-400 font-bold' },
        { regex: /\b(if|else|for|while|do|switch|case|break|continue|return|new|delete)\b/g, class: 'text-purple-400 font-bold' },
    ],
    python: [
         { regex: /#.*/g, class: 'text-gray-500 italic' },
         { regex: /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|pass|break|continue|lambda|yield|global|nonlocal|assert|del|raise)\b/g, class: 'text-purple-400 font-bold' },
         { regex: /(['"])(?:(?=(\\?))\2.)*?\1/g, class: 'text-green-400' }, 
    ],
    text: [] // No highlighting for plain text
  };

  const activePatterns = patterns[language] || patterns.text;

  let result = '';
  let index = 0;
  
  while (index < escaped.length) {
    let bestMatch = null;
    let bestPattern = null;
    let minIndex = escaped.length;
    
    for (let p of activePatterns) {
        p.regex.lastIndex = index;
        const match = p.regex.exec(escaped);
        if (match && match.index < minIndex) {
            minIndex = match.index;
            bestMatch = match;
            bestPattern = p;
        }
    }
    
    if (bestMatch && minIndex === index) {
        result += `<span class="${bestPattern.class}">${bestMatch[0]}</span>`;
        index += bestMatch[0].length;
    } else {
        if (bestMatch) {
            result += escaped.substring(index, minIndex);
            index = minIndex;
        } else {
            result += escaped.substring(index);
            index = escaped.length;
        }
    }
  }
  
  return result;
};


// --- Components ---

const SyntaxEditor = ({ content, language, onChange }) => {
  const [text, setText] = useState(content);
  const textareaRef = useRef(null);
  const preRef = useRef(null);

  useEffect(() => {
    setText(content);
  }, [content]);

  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    onChange(newText);
  };

  const highlightedHTML = useMemo(() => highlightCode(text, language), [text, language]);

  return (
    <div className="relative flex-grow h-full w-full overflow-hidden bg-[#1e1e1e] rounded-b-md">
      {/* Background Highlighter */}
      <pre
        ref={preRef}
        className="absolute inset-0 p-4 font-mono text-sm leading-6 whitespace-pre pointer-events-none overflow-hidden"
        style={{ fontFamily: "'Fira Code', 'Roboto Mono', monospace" }}
        dangerouslySetInnerHTML={{ __html: highlightedHTML + '<br />' }}
      />
      
      {/* Foreground Editor (Transparent) */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onScroll={handleScroll}
        spellCheck="false"
        className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 whitespace-pre bg-transparent text-transparent caret-white resize-none focus:outline-none focus:ring-0 selection:bg-white/20"
        style={{ fontFamily: "'Fira Code', 'Roboto Mono', monospace" }}
      />
    </div>
  );
};

const MediaPreview = ({ file, url, type }) => {
    if (!url) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 text-center">
                <AlertCircle className="w-16 h-16 mb-4 text-red-500/50 mx-auto" />
                <p className="text-sm font-mono text-red-400">Unable to load media</p>
                <p className="text-xs opacity-50 mt-2 max-w-xs mx-auto">
                    The file could not be accessed. It may have been moved or deleted from the cloud storage.
                </p>
            </div>
        );
    }

    if (type === 'image') {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-black/50 p-4 overflow-hidden relative group">
                <div className="absolute inset-0 opacity-20 pointer-events-none" 
                     style={{ 
                         backgroundImage: 'linear-gradient(45deg, #222 25%, transparent 25%), linear-gradient(-45deg, #222 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #222 75%), linear-gradient(-45deg, transparent 75%, #222 75%)',
                         backgroundSize: '20px 20px',
                         backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' 
                     }} 
                />
                
                <img 
                  src={url} 
                  alt={file.name} 
                  className="relative z-10 max-h-full max-w-full object-contain rounded shadow-lg border border-white/10" 
                  onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}
                />
                <div className="hidden absolute inset-0 flex items-center justify-center text-red-500">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <span>Preview Failed</span>
                    </div>
                </div>

                <div className="absolute bottom-4 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-black/70 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">{file.name}</span>
                </div>
            </div>
        );
    }
    if (type === 'audio') {
        return (
             <div className="flex flex-col items-center justify-center h-full bg-black/50 p-4 space-y-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900 via-gray-900 to-black pointer-events-none"></div>
                
                <div className="w-40 h-40 rounded-full bg-gradient-to-br from-gray-900 to-black border-4 themed-border-accent flex items-center justify-center relative shadow-2xl shadow-purple-900/20">
                    <div className="absolute inset-0 rounded-full border border-white/5 animate-ping-slow"></div>
                    <Music className="w-16 h-16 themed-text-primary animate-pulse-slow" />
                </div>
                
                <div className="text-center z-10">
                   <div className="text-lg font-bold font-mono text-white mb-1">{file.name}</div>
                   <div className="text-xs text-muted-foreground uppercase tracking-widest">Audio Playback</div>
                </div>
                
                <div className="w-full max-w-md bg-black/40 p-4 rounded-lg border border-white/10 backdrop-blur-sm z-10">
                   <audio controls src={url} className="w-full h-8" autoPlay />
                </div>
             </div>
        );
    }
    if (type === 'video') {
         return (
            <div className="flex flex-col items-center justify-center h-full bg-black p-0 relative group">
                <video 
                  controls 
                  autoPlay 
                  playsInline
                  src={url} 
                  className="max-h-full w-full object-contain focus:outline-none" 
                >
                  Your browser does not support the video tag.
                </video>
                 <div className="absolute bottom-4 left-0 right-0 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="bg-black/70 text-white px-2 py-1 rounded text-xs font-mono backdrop-blur-sm">{file.name}</span>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10">
             <FileType className="w-16 h-16 mb-4 opacity-50" />
             <p className="text-sm font-mono">Preview not available for this file type.</p>
             <p className="text-xs opacity-50 mt-2">{file.name}</p>
        </div>
    );
};

const FileEditor = () => {
  const { editingFile, setEditingFile, updateFileSystem, addCommandOutput } = useDesk();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState(null);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  
  const fileType = useMemo(() => getFileType(editingFile?.name || ''), [editingFile]);
  const language = useMemo(() => getLanguage(editingFile?.name || ''), [editingFile]);

  // Determine initial view mode
  const initialMode = useMemo(() => {
    return ['image', 'audio', 'video'].includes(fileType) ? 'preview' : 'code';
  }, [fileType]);

  const [viewMode, setViewMode] = useState(initialMode); // 'preview' | 'code'

  // Reset view mode when file changes
  useEffect(() => {
    setViewMode(['image', 'audio', 'video'].includes(fileType) ? 'preview' : 'code');
  }, [editingFile, fileType]);

  useEffect(() => {
    if (!editingFile) return;

    const loadFileContent = async () => {
       setIsMediaLoading(true);
       setMediaUrl(null);
       setContent('');

       // Determine the effective storage path.
       // Instead of blind guessing, we LIST the directory to find the exact filename stored in Supabase.
       // This handles encoding differences or mismatches in the JSON.

       try {
           if (!user) throw new Error("User not authenticated");

           let actualStorageKey = null;

           // 1. Construct parent path in storage
           const folderPath = editingFile.path.map(p => b64DecodeUnicode(p)).join('/');
           const parentStoragePath = `${user.id}/${folderPath}`;

           // 2. If it's a media file (Preview Mode), we need the exact key for signed URL
           if (viewMode === 'preview') {
               // List files in the parent directory
               const { data: listData, error: listError } = await supabase.storage
                   .from('user_files')
                   .list(parentStoragePath);

               if (!listError && listData && listData.length > 0) {
                   // Try to find exact match or normalized match
                   const match = listData.find(f => f.name === editingFile.name || f.name === encodeURIComponent(editingFile.name));
                   if (match) {
                       actualStorageKey = `${parentStoragePath}/${match.name}`;
                   }
               }

               // Fallback: If listing failed or didn't find it, try the explicit storagePath from JSON if available
               if (!actualStorageKey && editingFile.storagePath) {
                   // Ensure it has user prefix if needed
                   actualStorageKey = editingFile.storagePath.startsWith(user.id) ? editingFile.storagePath : `${user.id}/${editingFile.storagePath}`;
               }
               
               // Final Fallback: Construct blindly
               if (!actualStorageKey) {
                   actualStorageKey = `${parentStoragePath}/${editingFile.name}`;
               }

               // Generate Signed URL
               const { data, error } = await supabase.storage.from('user_files').createSignedUrl(actualStorageKey, 3600);
               if (!error && data?.signedUrl) {
                   setMediaUrl(data.signedUrl);
               } else {
                   // If signed URL generation fails, it usually means the path is still wrong or bucket permissions.
                   // But createSignedUrl usually returns success even for missing files.
                   // The check is implicit: if the URL loads, it's good.
                   console.error("Signed URL generation error:", error);
               }

           } else {
               // CODE MODE: We download the text content
               // We can be more aggressive here since we can handle errors
               
               // Try exact storagePath first if present
               let downloadSuccess = false;
               
               if (editingFile.storagePath) {
                   const key = editingFile.storagePath.startsWith(user.id) ? editingFile.storagePath : `${user.id}/${editingFile.storagePath}`;
                   const { data } = await supabase.storage.from('user_files').download(key);
                   if (data) {
                       setContent(await data.text());
                       downloadSuccess = true;
                   }
               }

               // If failed, try constructed path
               if (!downloadSuccess) {
                    const key = `${user.id}/${folderPath ? folderPath + '/' : ''}${editingFile.name}`;
                    const { data } = await supabase.storage.from('user_files').download(key);
                    if (data) {
                        setContent(await data.text());
                        downloadSuccess = true;
                    }
               }

               // If still failed, check inline content
               if (!downloadSuccess && typeof editingFile.content === 'string') {
                   setContent(editingFile.content);
               }
           }
       } catch (err) {
           console.error("Error loading file data:", err);
           addCommandOutput({ 
               type: 'error', 
               title: 'Load Error', 
               message: `Failed to load data for ${viewMode} mode.` 
           });
       } finally {
           setIsMediaLoading(false);
       }
    };

    loadFileContent();
  }, [editingFile, viewMode, fileType, addCommandOutput, user]);

  const handleSave = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    
    let fsPath = editingFile.path.reduce((acc, val) => [...acc, val, 'content'], []);

    // Construct storage key for saving
    let storageKey = editingFile.storagePath;
    if (user) {
        if (!storageKey) {
            const folderPath = editingFile.path.map(p => b64DecodeUnicode(p)).join('/');
            storageKey = `${user.id}/${folderPath ? folderPath + '/' : ''}${editingFile.name}`;
        } else if (!storageKey.startsWith(user.id)) {
            storageKey = `${user.id}/${storageKey}`;
        }
    }

    try {
        if (storageKey) {
            // Re-upload to storage
            // Note: If we are in code mode and save, we are overwriting the blob with text/plain
            const { error } = await supabase.storage.from('user_files').upload(storageKey, content, {
                upsert: true,
                contentType: 'text/plain' 
            });
            
            if (error) throw error;
            
            // Update FS to point to this storage key explicitly if it wasn't before
            if (!editingFile.storagePath) {
                await updateFileSystem(`Saved '${editingFile.name}'`, { 
                    key: editingFile.encodedName,
                    value: { type: 'file', storagePath: storageKey, mimeType: 'text/plain' }, 
                    path: editingFile.path,
                    append: false // Overwrite
                 });
            } else {
                await updateFileSystem(`Saved '${editingFile.name}'`, { silent: false });
            }

        } else {
            // Update direct JSON content
            await updateFileSystem(`Saved '${editingFile.name}'`, {
                key: editingFile.encodedName || b64EncodeUnicode(editingFile.name),
                value: { type: 'file', content: content },
                path: fsPath,
                append: false
            });
        }
    } catch (err) {
        addCommandOutput({ type: 'error', title: 'Save Failed', message: err.message });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl); 
    setEditingFile(null);
  };

  const editorVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 10 }
  };

  if (!editingFile) return null;

  const isMediaFile = ['image', 'audio', 'video'].includes(fileType);

  return (
    <motion.div
      key={editingFile.encodedName}
      variants={editorVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 h-full w-full flex flex-col shadow-2xl bg-[#0d0d0d]"
    >
      <div className="flex justify-between items-center p-2 border-b themed-border-accent bg-black/40 backdrop-blur-md">
        <div className="flex items-center space-x-2 pl-2 overflow-hidden">
            {getFileIcon(fileType)}
            
            <div className="flex flex-col min-w-0">
                <h3 className="font-bold font-mono text-sm truncate text-white max-w-[200px]" title={editingFile.name}>
                {editingFile.name}
                </h3>
                <span className="text-[10px] uppercase text-muted-foreground flex items-center space-x-1">
                    <span>{fileType}</span>
                    <span className="opacity-50">•</span>
                    <span>{language}</span>
                </span>
            </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Mode Toggle for Media Files */}
          {isMediaFile && (
              <div className="flex bg-black/50 rounded-md border border-white/10 p-0.5 mr-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                        "h-6 w-6 p-0 hover:bg-white/10",
                        viewMode === 'preview' ? "bg-white/20 text-white" : "text-muted-foreground"
                    )}
                    onClick={() => setViewMode('preview')}
                    title="Preview Mode"
                  >
                      <Eye className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                        "h-6 w-6 p-0 hover:bg-white/10",
                        viewMode === 'code' ? "bg-white/20 text-white" : "text-muted-foreground"
                    )}
                    onClick={() => setViewMode('code')}
                    title="Raw Edit Mode"
                  >
                      <Code className="h-3 w-3" />
                  </Button>
              </div>
          )}

          {viewMode === 'code' && (
              <Button onClick={handleSave} disabled={isSaving} variant="outline" size="sm" className="h-7 text-xs border-green-800 hover:bg-green-900/30 text-green-500">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1"/> : <Save className="mr-1 h-3 w-3" />}
                Save
              </Button>
          )}
          <Button onClick={handleClose} variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-900/20">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-grow relative overflow-hidden flex flex-col bg-[#111]">
        {isMediaLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-xs font-mono animate-pulse">Fetching Data...</span>
            </div>
        ) : (
             <>
                {viewMode === 'code' ? (
                    <SyntaxEditor content={content} language={language} onChange={setContent} />
                ) : (
                    <div className="flex-grow overflow-auto relative h-full">
                        <MediaPreview file={editingFile} url={mediaUrl} type={fileType} />
                    </div>
                )}
             </>
        )}
      </div>
    </motion.div>
  );
};

const Codex = () => {
  const { fileSystem, currentPath, setCurrentPath, getCurrentDirectory, updateFileSystem, addCommandOutput, editingFile, setEditingFile } = useDesk();
  const { user } = useAuth();
  const [newFileName, setNewFileName] = useState('');
  const [isCreating, setIsCreating] = useState(null); // 'file' | 'folder' | null
  const fileInputRef = useRef(null);

  // Resolve current directory content
  const currentDirContent = useMemo(() => {
    return getCurrentDirectory(fileSystem, currentPath);
  }, [fileSystem, currentPath, getCurrentDirectory]);

  // Transform to array and sort
  const items = useMemo(() => {
      if (!currentDirContent) return [];
      return Object.entries(currentDirContent).map(([encodedName, data]) => ({
          name: b64DecodeUnicode(encodedName),
          encodedName,
          type: data.type, // 'folder' or 'file'
          content: data.content,
          storagePath: data.storagePath
      })).sort((a, b) => {
          // Directories first, then alphabetical
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : 1;
      });
  }, [currentDirContent]);

  const changeDirectory = (encodedName) => {
      setCurrentPath(prev => [...prev, encodedName]);
  };

  const navigateUp = () => {
      setCurrentPath(prev => prev.slice(0, -1));
  };
  
  const navigateRoot = () => {
      setCurrentPath([]);
  };

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    const cleanName = newFileName.trim();
    const encodedName = b64EncodeUnicode(cleanName);

    if (currentDirContent && currentDirContent[encodedName]) {
        addCommandOutput({ type: 'error', title: 'Codex Error', message: `'${cleanName}' already exists.` });
        return;
    }

    const value = isCreating === 'file' ? { type: 'file', content: '' } : { type: 'folder', content: {} };
    
    // NOTE: currentPath is array of encoded names. 
    // updateFileSystem expects 'path' to point to the parent content object.
    const updatePath = currentPath.reduce((acc, val) => [...acc, val, 'content'], []);

    await updateFileSystem(`Created ${isCreating} '${cleanName}'`, {
        key: encodedName,
        value: value,
        path: updatePath
    });
    
    setNewFileName('');
    setIsCreating(null);
  };

  const handleDelete = async (e, item) => {
     e.stopPropagation();
     if (window.confirm(`Are you sure you want to delete '${item.name}'?`)) {
        
        // Calculate path to parent
        const updatePath = currentPath.reduce((acc, val) => [...acc, val, 'content'], []);

        await updateFileSystem(`Deleted '${item.name}'`, {
            key: item.encodedName,
            delete: true,
            path: updatePath
        });
     }
  };

  const handleItemClick = (item) => {
      if (item.type === 'folder') {
          changeDirectory(item.encodedName);
      } else {
          setEditingFile({
              name: item.name,
              encodedName: item.encodedName,
              content: typeof item.content === 'string' ? item.content : '',
              path: currentPath, // Pass current path so editor knows where file lives
              isNew: false,
              storagePath: item.storagePath
          });
      }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!user) {
        addCommandOutput({ type: 'error', title: 'Upload Error', message: 'User not authenticated.' });
        return;
    }

    const fileName = file.name;
    const encodedName = b64EncodeUnicode(fileName);
    
    // Check if file exists in current directory
    if (currentDirContent && currentDirContent[encodedName]) {
        addCommandOutput({ type: 'error', title: 'Upload Error', message: `'${fileName}' already exists.` });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    // Construct storage path
    // decode currentPath for folder structure
    const folderPath = currentPath.map(p => b64DecodeUnicode(p)).join('/');
    const fullStoragePath = `${user.id}/${folderPath ? folderPath + '/' : ''}${fileName}`;

    addCommandOutput({ type: 'info', title: 'Upload', message: `Uploading '${fileName}'...` });

    try {
        const { error } = await supabase.storage
            .from('user_files')
            .upload(fullStoragePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;

        // Update File System
        const updatePath = currentPath.reduce((acc, val) => [...acc, val, 'content'], []);
        
        await updateFileSystem(`Uploaded '${fileName}'`, {
            key: encodedName,
            value: { 
                type: 'file', 
                storagePath: fullStoragePath, 
                mimeType: file.type, 
                size: file.size,
                content: '' 
            },
            path: updatePath
        });

    } catch (error) {
         addCommandOutput({ type: 'error', title: 'Upload Failed', message: error.message });
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={cn("relative h-full w-full flex flex-col overflow-hidden border-r themed-border-accent")}
      style={{
        backgroundColor: `rgba(var(--color-secondary-bg-val), 0.3)`
      }}
    >
      <AnimatePresence mode="wait">
        {editingFile && <FileEditor />}
      </AnimatePresence>

      {/* Header / Toolbar */}
      <div className="flex flex-col border-b themed-border-accent bg-black/20 backdrop-blur-sm">
         <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-1 overflow-hidden min-w-0">
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={navigateRoot} disabled={currentPath.length === 0}>
                    <Home className="h-3 w-3" />
                </Button>
                {currentPath.length > 0 && (
                     <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={navigateUp}>
                        <ArrowUp className="h-3 w-3" />
                    </Button>
                )}
                {/* Breadcrumbs */}
                <div className="flex items-center text-xs font-mono ml-2 overflow-x-auto no-scrollbar mask-fade-right whitespace-nowrap">
                    <span className="themed-text-muted opacity-50">/</span>
                    {currentPath.map((p, i) => (
                        <React.Fragment key={i}>
                             <span className="mx-0.5 cursor-pointer hover:themed-text-accent" 
                                   onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}>
                                {b64DecodeUnicode(p)}
                             </span>
                             <span className="themed-text-muted opacity-50">/</span>
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                {isCreating ? (
                    <div className="flex items-center bg-black/40 rounded border themed-border-dim px-1 animate-in slide-in-from-right-5 fade-in duration-200">
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            placeholder={`Name...`}
                            className="bg-transparent border-none focus:outline-none w-24 text-xs font-mono py-1"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreate();
                                if (e.key === 'Escape') setIsCreating(null);
                            }}
                            autoFocus
                        />
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-green-500 hover:text-green-400" onClick={handleCreate}>
                            <Save className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-red-500 hover:text-red-400" onClick={() => setIsCreating(null)}>
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                ) : (
                    <>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:themed-bg-accent" onClick={() => setIsCreating('file')} title="New File">
                            <FilePlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:themed-bg-accent" onClick={() => setIsCreating('folder')} title="New Folder">
                            <Folder className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:themed-bg-accent" onClick={() => fileInputRef.current?.click()} title="Upload File">
                            <Upload className="h-4 w-4" />
                        </Button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handleFileUpload}
                        />
                    </>
                )}
            </div>
         </div>
      </div>

      {/* File List */}
      <div className="flex-grow overflow-y-auto p-2 space-y-1">
         {currentPath.length > 0 && (
             <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center p-2 rounded-md hover:bg-white/5 cursor-pointer text-muted-foreground transition-colors group"
                onClick={navigateUp}
             >
                 <ArrowUp className="mr-3 h-4 w-4 opacity-50 group-hover:opacity-100" />
                 <span className="text-sm font-mono">..</span>
             </motion.div>
         )}
         
         {items.length === 0 && (
             <div className="flex flex-col items-center justify-center h-48 opacity-30">
                 <Code className="h-12 w-12 mb-2" />
                 <span className="text-xs font-mono uppercase tracking-widest">Directory Empty</span>
             </div>
         )}

         {items.map((item) => {
             const type = getFileType(item.name);
             const isFolder = item.type === 'folder';
             
             return (
             <motion.div
                key={item.encodedName}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                    "flex items-center justify-between p-2 rounded-md cursor-pointer group transition-all duration-200 border border-transparent",
                    "hover:bg-white/5 hover:border-white/10 hover:shadow-sm"
                )}
                onClick={() => handleItemClick(item)}
             >
                <div className="flex items-center overflow-hidden min-w-0">
                    {isFolder ? (
                        <Folder className="mr-3 h-4 w-4 themed-text-accent flex-shrink-0" />
                    ) : getFileIcon(type)}
                    
                    <span className="text-sm font-mono truncate transition-colors group-hover:text-white">
                        {item.name}
                    </span>
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity space-x-1 flex-shrink-0">
                    {!isFolder && (
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-slate-400 hover:text-white"
                            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                            title={['javascript', 'json', 'css', 'html', 'code', 'system', 'text'].includes(type) ? "Edit" : "View/Play"}
                        >
                            {['javascript', 'json', 'css', 'html', 'code', 'system', 'text'].includes(type) ? <Edit2 className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-red-500/70 hover:text-red-500 hover:bg-red-950/30"
                        onClick={(e) => handleDelete(e, item)}
                        title="Delete"
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
             </motion.div>
             );
         })}
      </div>
      
      {/* Footer Status */}
      <div className="p-1 border-t themed-border-dim text-[10px] font-mono opacity-50 text-center bg-black/40">
        {items.length} object(s) in view
      </div>
    </div>
  );
};

export default Codex;
