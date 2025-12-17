import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { X } from 'lucide-react';

const LoginModal = ({ isOpen, setIsOpen }) => {
  const [isLoginView, setIsLoginView] = useState(true);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-end z-50 pr-16"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            key={isLoginView ? 'login' : 'register'}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-black/80 border themed-border-primary/50 rounded-lg p-8 w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <Button onClick={() => setIsOpen(false)} variant="ghost" className="absolute top-2 right-2 p-2 h-auto z-10 text-gray-400 hover:themed-text-accent"><X className="w-6 h-6" /></Button>
            {isLoginView ? <LoginForm setIsLoginView={setIsLoginView} setIsOpen={setIsOpen} /> : <RequestAccountForm setIsLoginView={setIsLoginView} />}
            
            <div className="mt-6 text-center">
              <div className="themed-text-primary terminal-text text-xs">
                <span className="typing-cursor">_</span> Secure connection established
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const LoginForm = ({ setIsLoginView, setIsOpen }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Error", description: "Please enter email and password", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Access granted. Welcome back." });
      setIsOpen(false);
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold terminal-text themed-text-primary mb-2">DIRECTORY ACCESS</h1>
        <p className="themed-text-secondary terminal-text text-sm">Enter credentials to access your allocated space</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 themed-border-secondary/50 themed-text-accent terminal-text focus:ring-themed-accent focus:themed-border-accent" placeholder="EMAIL" disabled={isLoading} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-black/50 themed-border-secondary/50 themed-text-accent terminal-text focus:ring-themed-accent focus:themed-border-accent" placeholder="PASSWORD" disabled={isLoading} />
        </div>
        <div className="space-y-4">
          <Button type="submit" disabled={isLoading} className="w-full h-12 bg-black/75 hover:themed-bg-primary text-white font-semibold terminal-text border themed-border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-[hsl(var(--theme-primary))]">
            {isLoading ? 'ACCESSING...' : 'ACCESS DIRECTORY'}
          </Button>
          <Button type="button" onClick={() => setIsLoginView(false)} variant="outline" className="w-full h-12 bg-transparent themed-border-primary/50 themed-text-primary hover:themed-bg-primary/50 hover:text-white terminal-text">
            REQUEST ACCOUNT
          </Button>
        </div>
      </form>
    </>
  );
};

const RequestAccountForm = ({ setIsLoginView }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRequest = async (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase().replace(/[^a-z0-9]/g, ''),
        }
      }
    });

    if (signUpError) {
      toast({ title: "Request Failed", description: signUpError.message, variant: "destructive" });
    } else if (signUpData.user) {
      toast({ title: "Request Sent", description: "Your account request has been submitted for approval.", duration: 9000 });
      setIsLoginView(true);
    }
    
    setIsLoading(false);
  };

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold terminal-text themed-text-primary mb-2">REQUEST ACCESS</h1>
        <p className="themed-text-secondary terminal-text text-sm">Submit a request for a new directory space</p>
      </div>
      <form onSubmit={handleRequest} className="space-y-6">
        <div className="space-y-4">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-black/50 themed-border-secondary/50 themed-text-accent terminal-text focus:ring-themed-accent focus:themed-border-accent" placeholder="USERNAME" disabled={isLoading} />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 themed-border-secondary/50 themed-text-accent terminal-text focus:ring-themed-accent focus:themed-border-accent" placeholder="EMAIL" disabled={isLoading} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-black/50 themed-border-secondary/50 themed-text-accent terminal-text focus:ring-themed-accent focus:themed-border-accent" placeholder="PASSWORD" disabled={isLoading} />
        </div>
        <div className="space-y-4">
          <Button type="submit" disabled={isLoading} className="w-full h-12 themed-bg-primary/75 hover:themed-bg-primary text-white font-semibold terminal-text border themed-border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-[hsl(var(--theme-primary))]">
            {isLoading ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
          </Button>
          <Button type="button" onClick={() => setIsLoginView(true)} variant="outline" className="w-full h-12 bg-transparent themed-border-primary/50 themed-text-primary hover:themed-bg-primary/50 hover:text-white terminal-text">
            BACK TO LOGIN
          </Button>
        </div>
      </form>
    </>
  );
};

export default LoginModal;