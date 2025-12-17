
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const b64EncodeUnicode = (str) => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode('0x' + p1);
    }));
  } catch (e) {
    return btoa(str);
  }
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

export const useFileSystem = (user, isAuthLoading, addCommandOutput, addToAudioQueue) => {
  const [fileSystem, setFileSystem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [editingFile, setEditingFile] = useState(null);
  const lastUpdatedRef = useRef(null);
  const fetchControllerRef = useRef(null);
  const isInitializedRef = useRef(false);
  const syncQueueRef = useRef(Promise.resolve());
  const hasCreatedCmdxRef = useRef(false);

  const handleAuthError = useCallback(async (error) => {
    if (error.message.includes('refresh_token_not_found') || error.message.includes('JWT expired')) {
      window.dispatchEvent(new CustomEvent('signOut', { detail: { message: 'Your session has expired. Please log in again.' }}));
      return true;
    }
    return false;
  }, []);

  const logToMessageCenter = useCallback(async (logContent, isError = false) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        sender_username: '@nsible_System',
        recipient_id: user.id,
        content: `${isError ? 'ERROR: ' : 'LOG: '}${logContent}`,
        is_broadcast: false,
        is_read: false,
      });
      if (error) {
        console.error("Failed to log to message center:", error.message);
        await handleAuthError(error);
      }
    } catch (e) {
      console.error("Exception while logging to message center:", e.message);
    }
  }, [user, handleAuthError]);

  const updateFileSystem = useCallback(async (operationDescription, options = {}) => {
      if (!user) return;

      const syncOperation = async () => {
          setIsSyncing(true);
          if (!options.silent) {
            addCommandOutput({ type: 'info', title: "Syncing...", message: operationDescription });
          }

          const now = new Date();
          
          const path = options.path === undefined ? currentPath.reduce((acc, val) => [...acc, val, 'content'], []) : options.path;

          const { error } = await supabase.rpc('upsert_filesystem_entry', {
              p_user_id: user.id,
              p_path: path, 
              p_key: options.key || null, 
              p_value: options.value || null,
              p_delete: options.delete || false,
              p_append: options.append || false,
              p_updated_at: now.toISOString()
          });
              
          if (error) {
              if (await handleAuthError(error)) {
                setIsSyncing(false);
                return;
              }
              console.error("Supabase sync error:", error);
              if (error.message.includes('statement timeout')) {
                  addCommandOutput({ type: 'error', title: "Sync State", message: "Negotiating with server; Please Stand-by..." });
              } else {
                  addCommandOutput({ type: 'error', title: "Sync Error", message: `Failed to save changes: ${error.message}` });
              }
              await logToMessageCenter(`Sync failed for operation: '${operationDescription}'. Reason: ${error.message}`, true);
              await fetchFileSystemFromDB();
          } else {
              lastUpdatedRef.current = now;
              setFileSystem(prevFS => {
                  const newFS = JSON.parse(JSON.stringify(prevFS || {}));
                  let parent = newFS;
                  for (const segment of path) {
                      if (parent[segment]) {
                          parent = parent[segment];
                      } else {
                           return prevFS;
                      }
                  }

                  if (options.delete) {
                      delete parent[options.key];
                  } else if (options.append && parent[options.key]?.content) {
                      parent[options.key].content += options.value.content;
                  } else {
                      parent[options.key] = options.value;
                  }
                  return newFS;
              });
              
              if (!options.silent) {
                  addCommandOutput({ type: 'success', title: "Sync Complete", message: "Your desk is up to date." });
              }
              if (!options.silent) {
                 await logToMessageCenter(`Operation successful: '${operationDescription}'.`);
              }
          }
          setIsSyncing(false);
      };
      
      syncQueueRef.current = syncQueueRef.current.then(syncOperation, syncOperation);
      return syncQueueRef.current;
  }, [user, addCommandOutput, logToMessageCenter, handleAuthError, currentPath]);

  const ensureCmdxFileExists = useCallback(async (currentFS) => {
      if (!currentFS || hasCreatedCmdxRef.current) return currentFS;

      let docFolder = currentFS['documents'];

      if (!docFolder || docFolder.type !== 'folder') {
          await updateFileSystem('Creating documents directory.', {
            path: [],
            key: 'documents',
            value: { type: 'folder', content: {} },
            silent: true
          });
          // After updating, we need to get the new state of the filesystem
          // This is tricky without a full re-fetch. We'll assume the update worked for now.
          currentFS['documents'] = { type: 'folder', content: {} };
          docFolder = currentFS['documents'];
      }
      
      const cmdxFileName = b64EncodeUnicode('cmdx.txt');
      if (!docFolder.content[cmdxFileName]) {
          const cmdxContent = `
@nsible Command Extension Manifest (CMDX)
Version: 1.0

This file serves as a manifest for defining and extending @nsible's command architecture.
By modifying this file, you can propose new commands or alter existing ones.

Syntax:
<command_name>|<type>|<description>|<usage_pattern>|[alias1,alias2]

Types:
- SYS: System-level command
- NET: Network/Communication command
- F_S: Filesystem command
- ADM: Administrative command

Example:
ping|NET|Send an echo request to a host|ping <host>|[echo]
`;
          await updateFileSystem('Initializing command manifest.', {
            path: ['documents', 'content'],
            key: cmdxFileName,
            value: { type: 'file', content: cmdxContent.trim() },
            silent: true
          });
          hasCreatedCmdxRef.current = true;
      } else {
        hasCreatedCmdxRef.current = true;
      }
      return currentFS;
  }, [updateFileSystem]);

  const ensureBucketExists = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.storage.getBucket('user_files');
    if (error && error.message === 'Bucket not found') {
      const { error: createError } = await supabase.storage.createBucket('user_files', {
        public: false,
        allowedMimeTypes: ['image/*', 'video/*', 'audio/*', 'text/*', 'application/*'],
      });
      if (createError) {
        if (await handleAuthError(createError)) return;
        throw new Error(`Failed to create storage bucket: ${createError.message}`);
      }
      await logToMessageCenter("Storage bucket 'user_files' created.");
    } else if (error) {
      if (await handleAuthError(error)) return;
      console.error("Error checking for bucket:", error.message);
    }
  }, [user, logToMessageCenter, handleAuthError]);

  const fetchFileSystemFromDB = useCallback(async (isInitialLoad = false) => {
    if (!user) return null;
    
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort('New fetch initiated');
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    if(isInitialLoad) setIsLoading(true);

    try {
      if (isInitialLoad) {
        await ensureBucketExists();
      }

      const { data, error, status } = await supabase
        .from('user_filesystems')
        .select('filesystem, updated_at')
        .eq('user_id', user.id)
        .abortSignal(controller.signal)
        .single();

      if (error && status !== 406) {
        if (error.name === 'AbortError') return null;
        if (await handleAuthError(error)) return null;
        throw error;
      }
      
      if (data) {
        lastUpdatedRef.current = new Date(data.updated_at);
        const checkedFS = await ensureCmdxFileExists(data.filesystem);
        setFileSystem(checkedFS);
        return checkedFS;
      } else {
        // If no filesystem exists, create one.
        const initialFS = {};
        await ensureCmdxFileExists(initialFS);
        setFileSystem(initialFS);
        return initialFS;
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        addCommandOutput({ type: 'error', title: "Desk Sync Error", message: `Could not retrieve desk state. ${error.message}` });
        await logToMessageCenter(`Failed to load desk: ${error.message}`, true);
      }
      return null;
    } finally {
      if (controller === fetchControllerRef.current) fetchControllerRef.current = null;
      if(isInitialLoad) setIsLoading(false);
    }
  }, [user, addCommandOutput, logToMessageCenter, ensureBucketExists, handleAuthError, ensureCmdxFileExists]);

  const triggerRemoteSyncCheck = useCallback(async () => {
    if (!user || isSyncing) return;
    addCommandOutput({ type: 'info', title: "Syncing...", message: "Checking for remote updates." });
    await fetchFileSystemFromDB();
    addCommandOutput({ type: 'success', title: "Sync Complete", message: "Desk is up to date." });
  }, [user, isSyncing, fetchFileSystemFromDB, addCommandOutput]);

  useEffect(() => {
    if (isAuthLoading || !user) {
      setIsLoading(!user);
      setFileSystem(null);
      isInitializedRef.current = false;
      return;
    }

    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchFileSystemFromDB(true);
    }

    const channel = supabase.channel(`filesystem:${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_filesystems',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.new?.updated_at) {
          const remoteUpdate = new Date(payload.new.updated_at);
          if (!lastUpdatedRef.current || remoteUpdate > lastUpdatedRef.current) {
            addCommandOutput({ type: 'info', title: "Desk Synced", message: "Your desk has been updated from another session. Fetching changes..." });
            logToMessageCenter("Desk synced from a remote session.");
            fetchFileSystemFromDB();
          }
        }
      })
      .subscribe();

    return () => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort('Component unmounting');
        fetchControllerRef.current = null;
      }
      supabase.removeChannel(channel);
      isInitializedRef.current = false;
    };
  }, [user, isAuthLoading, addCommandOutput, logToMessageCenter, fetchFileSystemFromDB]);

  const getCurrentDirectory = useCallback((fs, path) => {
    if (!fs) return null;
    let current = fs;
    for (const part of path) {
      if (current[part]?.type === 'folder') {
        current = current[part].content;
      } else {
        return null;
      }
    }
    return current;
  }, []);

  const findPath = (fs, targetName) => {
    const search = (current, path, contentPath) => {
        for (const encodedName in current) {
            if (b64DecodeUnicode(encodedName) === targetName) {
                return { parent: current, encodedName, path, contentPath };
            }
            if (current[encodedName].type === 'folder') {
                const result = search(current[encodedName].content, [...path, encodedName], [...contentPath, encodedName, 'content']);
                if (result) return result;
            }
        }
        return null;
    };
    return search(fs, [], []);
  };

  const catFile = async (fileName) => {
    const fs = fileSystem;
    if (!fs) return;
    const result = findPath(fs, fileName);

    if (result && result.parent[result.encodedName].type === 'file') {
      const file = result.parent[result.encodedName];
      let contentPreview = "Cannot display content.";

      // Determine effective storage path logic (replicated from Codex for consistency)
      let storageKey = file.storagePath;
      if (user) {
         if (!storageKey) {
            const folderPath = result.path.map(p => b64DecodeUnicode(p)).join('/');
            storageKey = `${user.id}/${folderPath ? folderPath + '/' : ''}${fileName}`;
         } else if (!storageKey.startsWith(user.id)) {
            storageKey = `${user.id}/${storageKey}`;
         }
      }

      if (storageKey) {
        const { data, error } = await supabase.storage.from('user_files').download(storageKey);
        
        let effectiveData = data;
        if (error) {
            // If main logic fails, fallback to original storagePath just in case logic was wrong
            if (file.storagePath && file.storagePath !== storageKey) {
                const { data: retryData, error: retryError } = await supabase.storage.from('user_files').download(file.storagePath);
                if (retryError) {
                    if (await handleAuthError(error)) return;
                    contentPreview = "Error downloading file content.";
                } else {
                    effectiveData = retryData;
                }
            } else {
                if (await handleAuthError(error)) return;
                contentPreview = "Error downloading file content.";
            }
        } 
        
        if (effectiveData) {
            if (file.mimeType && file.mimeType.startsWith('audio/')) {
                const url = URL.createObjectURL(effectiveData);
                addToAudioQueue({
                    src: url,
                    mimeType: file.mimeType,
                    title: fileName,
                });
                return;
            }
            contentPreview = await effectiveData.text();
        }
      } else if (typeof file.content === 'string') {
        contentPreview = file.content;
      }
      addCommandOutput({
        type: 'info',
        title: `Content of ${fileName}`,
        message: contentPreview.substring(0, 200) + (contentPreview.length > 200 ? '...' : ''),
      });
    } else {
      addCommandOutput({ type: 'error', title: "Error", message: `File '${fileName}' not found or is a directory.` });
    }
  };

  const moveFile = async (source, destination) => {
    addCommandOutput({ type: 'error', title: "Command Deprecated", message: `The 'mv' command is currently being overhauled for stability. Please use 'xx' and 'touch'/'codex' to recreate the file.` });
  };

  const removeFile = async (fileName) => {
    if (!fileSystem) return;
    const dir = getCurrentDirectory(fileSystem, currentPath);
    const encodedFileName = b64EncodeUnicode(fileName);

    if (dir && dir[encodedFileName] && dir[encodedFileName].type === 'file') {
        const fileToDelete = dir[encodedFileName];
        
        // Use consistent path logic for deletion
        let storageKey = fileToDelete.storagePath;
        if (user) {
             if (!storageKey) {
                const folderPath = currentPath.map(p => b64DecodeUnicode(p)).join('/');
                storageKey = `${user.id}/${folderPath ? folderPath + '/' : ''}${fileName}`;
             } else if (!storageKey.startsWith(user.id)) {
                storageKey = `${user.id}/${storageKey}`;
             }
        }

        if (storageKey) {
            const { error: storageError } = await supabase.storage.from('user_files').remove([storageKey]);
            if (storageError) {
                // If constructed key fails, try original if different
                if (fileToDelete.storagePath && fileToDelete.storagePath !== storageKey) {
                    await supabase.storage.from('user_files').remove([fileToDelete.storagePath]);
                }
                
                if (await handleAuthError(storageError)) return;
                // Log but continue to delete from JSON
                await logToMessageCenter(`Failed to delete file from storage: ${fileName}. Reason: ${storageError.message}`, true);
            }
        }
        
        await updateFileSystem(`Deleting '${fileName}'.`, {
            key: encodedFileName,
            delete: true
        });
    } else {
        addCommandOutput({ type: 'error', title: "Error", message: `File '${fileName}' not found in the current directory or is not a file.` });
    }
  };

  const removeDirectory = async (dirName) => {
    if (!fileSystem) return;
    const dir = getCurrentDirectory(fileSystem, currentPath);
    const encodedDirName = b64EncodeUnicode(dirName);

    if (dir && dir[encodedDirName] && dir[encodedDirName].type === 'folder') {
        const dirToDelete = dir[encodedDirName];
        
        if (Object.keys(dirToDelete.content).length > 0) {
            addCommandOutput({ type: 'error', title: "Error", message: `Directory '${dirName}' is not empty. Please remove its contents first.` });
            return;
        }

        await updateFileSystem(`Deleting directory '${dirName}'.`, {
            key: encodedDirName,
            delete: true
        });
    } else {
        addCommandOutput({ type: 'error', title: "Error", message: `Directory '${dirName}' not found in the current directory or is not a directory.` });
    }
  };

  return { fileSystem, updateFileSystem, isLoading, isSyncing, catFile, moveFile, removeFile, removeDirectory, currentPath, setCurrentPath, getCurrentDirectory, editingFile, setEditingFile, logToMessageCenter, triggerRemoteSyncCheck, fetchFileSystemFromDB };
};
