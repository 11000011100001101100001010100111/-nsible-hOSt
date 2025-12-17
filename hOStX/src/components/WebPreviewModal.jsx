
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { X, ExternalLink, Code, Phone } from 'lucide-react'; // Assuming Phone is used for 'tel'

const WebPreviewModal = ({ data, onClose, onViewSource }) => {
  const { theme } = useTheme();

  if (!data) return null;
  
  const transparencyClass = `bg-black/${theme.transparency}`;

  const protocol = data.url.split(':')[0].toLowerCase();
  let buttonText = 'Launch';
  let ButtonIcon = ExternalLink;

  if (['http', 'https'].includes(protocol)) {
    buttonText = 'Open';
  } else if (protocol === 'tel') {
    buttonText = 'Connect';
    ButtonIcon = Phone;
  } else if (protocol === 'sms') {
    buttonText = 'Transmit'; // Changed for SMS protocol
    ButtonIcon = ExternalLink; // Defaulting to ExternalLink, user did not specify a new icon for SMS.
  }


  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 ${transparencyClass} backdrop-blur-sm flex items-center justify-center z-50 p-4`}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 30, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="relative bg-black/80 border themed-border-secondary rounded-lg shadow-2xl w-full max-w-lg terminal-text flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start p-4 border-b themed-border-secondary">
            {data.image && (
              <div className="flex-shrink-0 w-16 h-16 mr-4 bg-black/30 rounded-md flex items-center justify-center overflow-hidden">
                <img src={data.image} alt={data.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-grow min-w-0">
              <h2 className="text-lg font-bold themed-text-primary truncate">{data.title}</h2>
              <p className="text-xs themed-text-secondary truncate">{data.url}</p>
              <div className="mt-2 text-sm themed-text-accent leading-snug max-h-24 overflow-y-auto pr-2">
                 <p className="whitespace-pre-wrap">{data.description}</p>
              </div>
            </div>
            <Button onClick={onClose} variant="ghost" size="icon" className="ml-4 -mt-2 -mr-2 flex-shrink-0 text-gray-400 hover:themed-text-accent h-8 w-8">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex justify-end space-x-2 p-3 bg-black/20">
            <Button onClick={onViewSource} variant="outline" size="sm" className="themed-border-secondary themed-text-secondary hover:themed-bg-secondary hover:text-black">
              <Code className="w-4 h-4 mr-2" />
              Source
            </Button>
            <Button 
              onClick={() => {
                if (['http', 'https'].includes(protocol)) {
                  window.open(data.url, '_blank');
                } else {
                  window.location.href = data.url;
                }
              }} 
              size="sm"
              className="themed-bg-primary hover:themed-bg-accent text-black"
            >
              <ButtonIcon className="w-4 h-4 mr-2" />
              {buttonText}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WebPreviewModal;
