import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import MatrixRain from '@/components/MatrixRain';
import DeskIcon from '@/components/ui/DeskIcon';

const IntroScreen = () => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleMantraClick = () => {
    window.open('https://hostinger.com/horizons?REFERRALCODE=FCQ010001RH8', '_blank');
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-black relative overflow-hidden">
      <MatrixRain />
      {showContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="relative z-10 text-center p-4"
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="flex justify-center items-center mb-8"
          >
            <DeskIcon className="w-24 h-24 themed-text-primary" />
          </motion.div>
          <motion.h1
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
            className="text-4xl md:text-6xl font-bold terminal-text themed-text-primary mb-4"
          >
            @NSIBLE
          </motion.h1>
          <motion.p
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="text-lg md:text-xl terminal-text themed-text-secondary mb-8"
          >
            L'avenir de demain, aujourd'hui!
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 2 }}
            className="text-sm terminal-text text-red-500 cursor-pointer hover:text-red-400 hover:animate-pulse"
            onClick={handleMantraClick}
          >
            ILLUMINATUS AEQUATUS @ EVOCATUS SALARARIUS
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default IntroScreen;