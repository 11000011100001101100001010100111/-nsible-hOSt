
import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useToast } from '@/components/ui/use-toast';
import { useDesk } from '@/contexts/DeskContext';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Compass, Plus, Minus, RotateCw, RotateCcw, 
  Map as MapIcon, Crosshair, LocateFixed, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const NavInterface = () => {
  const { isDeskOpen, openDesk, closeDesk } = useDesk();
  const { theme } = useTheme();
  const { toast } = useToast();
  
  // Viewport State
  const [viewState, setViewState] = useState({
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0
  });

  // State for Detail Mode (Visibility/Duplicate Layer)
  const [isDetailMode, setIsDetailMode] = useState(false);

  // Local state for editable coordinates
  const [coords, setCoords] = useState({
    lat: '0.0000',
    lon: '0.0000',
    zoom: '1.00'
  });

  const mapRef = useRef(null);
  const controls = useAnimation();

  // Sync editable coords with viewState
  useEffect(() => {
    setCoords({
      lat: (viewState.y / 10).toFixed(4),
      lon: (viewState.x / 10).toFixed(4),
      zoom: viewState.scale.toFixed(2)
    });
  }, [viewState]);

  // Sync animation controls with state
  useEffect(() => {
    controls.start({
      x: viewState.x,
      y: viewState.y,
      scale: viewState.scale,
      rotate: viewState.rotate,
      transition: { type: 'spring', stiffness: 300, damping: 30 }
    });
  }, [viewState, controls]);

  // Command Listener
  useEffect(() => {
    const handleNavCommand = (event) => {
      const { command, args } = event.detail;
      const step = 100; // Pixels to pan
      const scaleStep = 0.5;
      const rotateStep = 45;

      setViewState(prev => {
        let newState = { ...prev };
        
        switch (command) {
          case 'zoom':
            if (args[0] === 'in') newState.scale = Math.min(prev.scale * (1 + scaleStep), 5);
            else if (args[0] === 'out') newState.scale = Math.max(prev.scale / (1 + scaleStep), 0.5);
            else if (parseFloat(args[0])) newState.scale = Math.max(0.5, Math.min(parseFloat(args[0]), 5));
            break;
          case 'rotate':
            if (args[0] === 'left') newState.rotate -= rotateStep;
            else if (args[0] === 'right') newState.rotate += rotateStep;
            else if (parseFloat(args[0])) newState.rotate = parseFloat(args[0]);
            break;
          case 'pan':
            if (args[0] === 'up') newState.y += step;
            if (args[0] === 'down') newState.y -= step;
            if (args[0] === 'left') newState.x += step;
            if (args[0] === 'right') newState.x -= step;
            break;
          case 'reset':
            return { x: 0, y: 0, scale: 1, rotate: 0 };
          default:
            break;
        }
        return newState;
      });
    };

    window.addEventListener('navCommand', handleNavCommand);
    return () => window.removeEventListener('navCommand', handleNavCommand);
  }, []);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      const moveAmount = 50 / viewState.scale;
      switch (e.key) {
        case 'ArrowUp': setViewState(p => ({ ...p, y: p.y + moveAmount })); break;
        case 'ArrowDown': setViewState(p => ({ ...p, y: p.y - moveAmount })); break;
        case 'ArrowLeft': setViewState(p => ({ ...p, x: p.x + moveAmount })); break;
        case 'ArrowRight': setViewState(p => ({ ...p, x: p.x - moveAmount })); break;
        case '+': setViewState(p => ({ ...p, scale: Math.min(p.scale * 1.1, 5) })); break;
        case '-': setViewState(p => ({ ...p, scale: Math.max(p.scale / 1.1, 0.5) })); break;
        case 'R': case 'r': setViewState({ x: 0, y: 0, scale: 1, rotate: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewState.scale]);

  const handleCoordInputChange = (e) => {
    const { name, value } = e.target;
    setCoords(prev => ({ ...prev, [name]: value }));
  };

  const applyCoords = () => {
    const newLat = parseFloat(coords.lat);
    const newLon = parseFloat(coords.lon);
    const newZoom = parseFloat(coords.zoom);
    setViewState(prev => ({
      ...prev,
      y: isNaN(newLat) ? prev.y : newLat * 10,
      x: isNaN(newLon) ? prev.x : newLon * 10,
      scale: isNaN(newZoom) ? prev.scale : Math.max(0.5, Math.min(newZoom, 5))
    }));
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      applyCoords();
      e.target.blur();
    }
  };

  const toggleDetailMode = () => {
    setIsDetailMode(prev => {
      const isActivating = !prev;
      const scaleAdjustment = 2; // Changed from 4 to 2
      
      setViewState(currentState => ({
        ...currentState,
        // Add scale 2 when toggled on, scale -2 when toggled off (clamped)
        scale: isActivating 
          ? Math.min(currentState.scale + scaleAdjustment, 5) 
          : Math.max(currentState.scale - scaleAdjustment, 0.5)
      }));
      
      return isActivating;
    });
  };

  return (
    <div className="h-screen w-screen relative bg-seastorm-grey flex items-center justify-center font-mono text-sm overflow-hidden">
      <Helmet>
        <title>Global Navigation | @nsible</title>
        <meta name="description" content="Global Positioning and Visualization Interface." />
      </Helmet>

      {/* Main container for the globe */}
      <div className="relative w-full h-full flex items-center justify-center bg-seastorm-grey">
        <motion.div
            ref={mapRef}
            animate={controls}
            className="relative flex items-center justify-center" 
            style={{ 
                width: '800px', 
                height: '800px',
            }}
        >
             {/* Base Layer */}
             <img 
               alt="An animated GIF of a rotating planet Earth" 
               className="w-full h-full object-contain pointer-events-none"
               src="https://horizons-cdn.hostinger.com/e45574c0-0580-4da8-a53d-0a0d509bd410/3162f86a59532acb8a622f35fce777f9.gif" 
             />

             {/* Duplicate Detail Layer */}
             {isDetailMode && (
                <img 
                  alt="Enhanced detail layer overlay" 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-60 mix-blend-color-dodge contrast-125"
                  src="https://horizons-cdn.hostinger.com/e45574c0-0580-4da8-a53d-0a0d509bd410/3162f86a59532acb8a622f35fce777f9.gif" 
                />
             )}
             
             <div className="absolute inset-0 border border-white/5 rounded-full opacity-20 pointer-events-none"></div>
        </motion.div>
      </div>

      <div className="absolute inset-0 pointer-events-none p-8 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
             <div className="bg-black/60 backdrop-blur-md p-4 border border-white/10 rounded-br-2xl pointer-events-auto">
                 <h1 className="text-xl font-bold themed-text-primary flex items-center gap-2 mb-2">
                    <MapIcon className="w-5 h-5" />
                    NAV://INTERFACE
                 </h1>
                 <div className="text-xs themed-text-secondary mt-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <label htmlFor="lat" className="w-8">LAT:</label>
                      <Input name="lat" id="lat" value={coords.lat} onChange={handleCoordInputChange} onBlur={applyCoords} onKeyDown={handleInputKeyDown} className="nav-coord-input" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="lon" className="w-8">LON:</label>
                      <Input name="lon" id="lon" value={coords.lon} onChange={handleCoordInputChange} onBlur={applyCoords} onKeyDown={handleInputKeyDown} className="nav-coord-input" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="zoom" className="w-8">ZM:</label>
                      <Input name="zoom" id="zoom" value={coords.zoom} onChange={handleCoordInputChange} onBlur={applyCoords} onKeyDown={handleInputKeyDown} className="nav-coord-input" />
                    </div>
                 </div>
             </div>
             <div className="bg-black/60 backdrop-blur-md p-2 border border-white/10 rounded-bl-2xl">
                 <div className="flex items-center gap-4 text-xs themed-text-accent uppercase tracking-widest">
                     <span>Secure Connection</span>
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                 </div>
             </div>
          </div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
              <Crosshair 
                  className={cn("w-16 h-16 text-white stroke-1 brightness-[3]", {
                    'animate-[spin_10s_linear_infinite]': !isDetailMode, // Spin slower or normal normally
                    'animate-[spin_2s_linear_infinite]': isDetailMode // Spin faster in detail mode
                  })} 
              />
          </div>

          <div className="flex justify-between items-end">
              <div className="pointer-events-auto bg-black/60 backdrop-blur-md p-4 border border-white/10 rounded-tr-2xl flex gap-2">
                  <div className="flex flex-col gap-2">
                      <Button variant="outline" size="icon" onClick={() => setViewState(p => ({...p, scale: Math.min(p.scale * 1.1, 5)}))}><Plus className="w-4 h-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => setViewState(p => ({...p, scale: Math.max(p.scale / 1.1, 0.5)}))}><Minus className="w-4 h-4" /></Button>
                  </div>
                  {/* Coarse Rotation */}
                  <div className="flex flex-col gap-2">
                      <Button variant="outline" size="icon" title="Rotate Left 45°" onClick={() => setViewState(p => ({...p, rotate: p.rotate - 45}))}><RotateCcw className="w-4 h-4" /></Button>
                      <Button variant="outline" size="icon" title="Rotate Right 45°" onClick={() => setViewState(p => ({...p, rotate: p.rotate + 45}))}><RotateCw className="w-4 h-4" /></Button>
                  </div>
                  {/* Fine Rotation */}
                  <div className="flex flex-col gap-2">
                      <Button variant="outline" size="icon" title="Rotate Left 1°" onClick={() => setViewState(p => ({...p, rotate: p.rotate - 1}))}><RotateCcw className="w-3 h-3 text-muted-foreground" /></Button>
                      <Button variant="outline" size="icon" title="Rotate Right 1°" onClick={() => setViewState(p => ({...p, rotate: p.rotate + 1}))}><RotateCw className="w-3 h-3 text-muted-foreground" /></Button>
                  </div>
                  <div className="flex flex-col gap-2 border-l border-white/10 pl-2 ml-2">
                      <Button variant="ghost" size="icon" className="themed-text-accent" onClick={() => setViewState({ x: 0, y: 0, scale: 1, rotate: 0 })}><LocateFixed className="w-4 h-4" /></Button>
                      {/* Detail Mode Toggle (formerly Globe Animation) */}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="themed-text-accent" 
                        onClick={toggleDetailMode}
                        title={isDetailMode ? "Hide Detail Layer" : "Show Detail Layer"}
                      >
                        {isDetailMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                  </div>
              </div>
              <div className="bg-black/60 backdrop-blur-md p-4 border border-white/10 rounded-tl-2xl text-right">
                  <Compass className="w-8 h-8 ml-auto mb-2 themed-text-secondary animate-pulse-slow" />
                  <p className="text-[10px] themed-text-secondary uppercase">OpenStreetMap Data<br/>Visualization Layer v4.2</p>
              </div>
          </div>
      </div>
    </div>
  );
};

export default NavInterface;
