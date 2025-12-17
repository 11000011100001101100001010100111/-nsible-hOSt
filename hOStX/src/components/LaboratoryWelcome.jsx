import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDesk } from '@/contexts/DeskContext';
import { useTheme } from '@/contexts/ThemeContext';

const b64DecodeUnicode = (str) => {
  try {
    return decodeURIComponent(atob(str).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  } catch (e) {
    return str;
  }
};

const getObjectSize = (item) => {
  if (item.type === 'file') {
    return item.content?.length || 100;
  }
  if (item.type === 'folder' && item.content) {
    return Object.keys(item.content).reduce((acc, key) => acc + getObjectSize(item.content[key]), 100);
  }
  return 0;
};

const Grid = () => {
  const size = 4000;
  const divisions = 40;
  const step = size / divisions;
  const lines = [];

  for (let i = 0; i <= divisions; i++) {
    const pos = -size / 2 + i * step;
    lines.push(<line key={`v${i}`} x1={pos} y1={-size / 2} x2={pos} y2={size / 2} stroke="hsl(var(--theme-primary) / 0.2)" />);
    lines.push(<line key={`h${i}`} x1={-size / 2} y1={pos} x2={size / 2} y2={pos} stroke="hsl(var(--theme-primary) / 0.2)" />);
  }

  return (
    <svg width={size} height={size} className="absolute" style={{ transform: 'translate(-50%, -50%) rotateX(90deg)' }}>
      {lines}
    </svg>
  );
};

const CodeColumn = ({ name, item, position, onNodeClick, isSelected }) => {
  const size = getObjectSize(item);
  const height = 50 + Math.log(size + 1) * 20;
  const decodedName = b64DecodeUnicode(name);
  const isFolder = item.type === 'folder';
  const color = isFolder ? 'hsl(var(--theme-cyan-override))' : 'hsl(var(--theme-primary))';
  const selectedColor = 'hsl(var(--theme-amber-override))';

  const handleClick = (e) => {
    e.stopPropagation();
    onNodeClick(name, item.type);
  };

  return (
    <motion.group
      style={{
        position: 'absolute',
        transformStyle: 'preserve-3d',
        transform: `translate3d(${position.x}px, ${position.y}px, ${position.z}px)`,
        pointerEvents: 'auto',
      }}
      onClick={handleClick}
      whileHover={{ scale: 1.1, z: 10 }}
    >
      <div style={{
        width: '20px',
        height: `${height}px`,
        backgroundColor: isSelected ? selectedColor : color,
        opacity: isSelected ? 1 : 0.7,
        boxShadow: `0 0 15px 5px ${isSelected ? selectedColor : color}`,
        transform: `translateY(${height / -2}px)`,
        transition: 'background-color 0.3s, box-shadow 0.3s, opacity 0.3s',
      }} />
      <div style={{
        position: 'absolute',
        top: `-${height / 2 + 20}px`,
        left: '10px',
        transform: 'translateX(-50%)',
        color: isSelected ? selectedColor : 'white',
        fontSize: '12px',
        width: '128px',
        textAlign: 'center',
        textShadow: isSelected ? `0 0 8px ${selectedColor}` : 'none',
      }}>
        {decodedName}
      </div>
    </motion.group>
  );
};

const LaboratoryWelcome = () => {
  const { toast } = useToast();
  const { user, loading: isAuthLoading } = useAuth();
  const { openDesk, fileSystem, isDeskLoading, setCurrentPath, setEditingFile, getCurrentDirectory, isDeskOpen } = useDesk();
  const { theme } = useTheme();
  const [camera, setCamera] = useState({ x: 0, y: -100, z: 1200, rotateX: -15, rotateY: 0, zoom: 1000 });
  const controls = useAnimation();
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(-1);
  const fileSystemItems = useMemo(() => (fileSystem ? Object.entries(fileSystem) : []), [fileSystem]);

  useEffect(() => {
    controls.start({
      x: -camera.x,
      y: -camera.y,
      z: -camera.z,
      rotateX: camera.rotateX,
      rotateY: camera.rotateY,
      transition: { duration: 0.5, ease: "easeInOut" }
    });
  }, [camera, controls]);

  const handleNodeClick = useCallback((name, type) => {
    if (type === 'folder') {
      setCurrentPath([name]);
      openDesk();
    } else {
      const dir = getCurrentDirectory(fileSystem, []);
      if (dir && dir[name]) {
        setEditingFile({ name, ...dir[name] });
        openDesk();
      }
    }
  }, [setCurrentPath, openDesk, getCurrentDirectory, fileSystem, setEditingFile]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere if desk is open or a text input is focused
      if (isDeskOpen || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (fileSystemItems.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedNodeIndex(prev => (prev + 1) % fileSystemItems.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedNodeIndex(prev => (prev - 1 + fileSystemItems.length) % fileSystemItems.length);
      } else if (e.key === ' ' && selectedNodeIndex !== -1) { // Changed from 'Enter' to ' ' (space)
        e.preventDefault();
        const [name, item] = fileSystemItems[selectedNodeIndex];
        handleNodeClick(name, item.type);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setSelectedNodeIndex(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIndex, fileSystemItems, handleNodeClick, isDeskOpen]);

  useEffect(() => {
    const handleLabCommand = (event) => {
      if (isDeskOpen) return;
      const [command, value, countStr] = event.detail;
      const count = parseInt(countStr, 10) || 1;
      const moveAmount = 50 * count;
      const rotateAmount = 15 * count;

      setCamera(prev => {
        let newCamera = { ...prev };
        const angleRadY = (newCamera.rotateY * Math.PI) / 180;
        const angleRadX = (newCamera.rotateX * Math.PI) / 180;

        switch (command) {
          case 'move':
            if (value === 'fwd') {
              newCamera.x -= Math.sin(angleRadY) * Math.cos(angleRadX) * moveAmount;
              newCamera.y += Math.sin(angleRadX) * moveAmount;
              newCamera.z -= Math.cos(angleRadY) * Math.cos(angleRadX) * moveAmount;
            } else { // 'back'
              newCamera.x += Math.sin(angleRadY) * Math.cos(angleRadX) * moveAmount;
              newCamera.y -= Math.sin(angleRadX) * moveAmount;
              newCamera.z += Math.cos(angleRadY) * Math.cos(angleRadX) * moveAmount;
            }
            break;
          case 'rotate':
            if (value === 'left') newCamera.rotateY += rotateAmount;
            if (value === 'right') newCamera.rotateY -= rotateAmount;
            if (value === 'up') newCamera.rotateX -= rotateAmount;
            if (value === 'down') newCamera.rotateX += rotateAmount;
            break;
          case 'pan': // Using pan for strafing
            if (value === 'up') newCamera.y -= moveAmount;
            if (value === 'down') newCamera.y += moveAmount;
            if (value === 'left') newCamera.x -= moveAmount;
            if (value === 'right') newCamera.x += moveAmount;
            break;
          case 'reset':
            return { x: 0, y: -100, z: 1200, rotateX: -15, rotateY: 0, zoom: 1000 };
          default:
            toast({ title: "Unknown Lab Command", description: `Command '${command}' not recognized.`, variant: "destructive" });
            return prev;
        }
        return newCamera;
      });
    };

    window.addEventListener('labCommand', handleLabCommand);
    return () => window.removeEventListener('labCommand', handleLabCommand);
  }, [toast, isDeskOpen]);

  const renderFileSystem = () => {
    if (isDeskLoading || !fileSystem) return null;
    const radius = 400;
    return fileSystemItems.map(([name, item], index) => {
      const angle = (index / fileSystemItems.length) * 2 * Math.PI;
      const position = {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
      };
      return (
        <CodeColumn
          key={name}
          name={name}
          item={item}
          position={position}
          onNodeClick={() => handleNodeClick(name, item.type)}
          isSelected={index === selectedNodeIndex}
        />
      );
    });
  };

  return (
    <>
      <Helmet>
        <title>The Data Grid | @nsible</title>
        <meta name="description" content="An interactive, 3-dimensional space for file system visualization." />
      </Helmet>
      <div className="h-screen w-screen relative overflow-hidden bg-black flex items-center justify-center" style={{ perspective: `${camera.zoom}px` }}>
        <motion.div
          className="absolute w-full h-full"
          style={{ transformStyle: 'preserve-3d' }}
          animate={controls}
        >
          {theme.labGrid && <Grid />}
          {renderFileSystem()}
        </motion.div>
        <AnimatePresence>
          {!isDeskOpen && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: [0, 1, 1, 0], y: [50, 0, 0, -20] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 5, times: [0, 0.2, 0.8, 1], ease: "easeInOut" }}
              className="relative text-center z-10 pointer-events-none"
            >
              <h1 className="text-4xl font-bold terminal-text themed-text-primary mb-4">
                Entering the Data Grid
              </h1>
              <p className="text-xl terminal-text themed-text-secondary">
                Use arrow keys to navigate. Press Space to select.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default LaboratoryWelcome;