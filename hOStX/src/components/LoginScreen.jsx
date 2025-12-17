import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const MatrixRain = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nums = '0123456789';
    const alphabet = katakana + latin + nums;

    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const rainDrops = Array.from({ length: columns }).map(() => 1);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0F0';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
        
        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
      animationFrameId = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full" />;
};

const LoginScreen = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden">
      <div className="matrix-bg">
        <MatrixRain />
      </div>
      <div className="absolute inset-0 bg-black/75 z-10"></div>

      <motion.div
        key={isLoginView ? 'login' : 'register'}
        initial={{ opacity: 0, y: 20, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-20 bg-black/80 border border-green-400/50 rounded-lg p-8 w-96 backdrop-blur-md"
      >
        {isLoginView ? <LoginForm setIsLoginView={setIsLoginView} navigate={navigate} /> : <RequestAccountForm setIsLoginView={setIsLoginView} />}
        
        <div className="mt-6 text-center">
          <div className="text-green-500 terminal-text text-xs">
            <span className="typing-cursor">_</span> Secure connection established
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LoginForm = ({ setIsLoginView, navigate }) => {
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
    }
    setIsLoading(false);
  };

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold terminal-text text-green-400 mb-2">DIRECTORY ACCESS</h1>
        <p className="text-green-300 terminal-text text-sm">Enter credentials to access your allocated space</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 border-green-700/50 text-green-300 terminal-text focus:ring-green-400 focus:border-green-400" placeholder="EMAIL" disabled={isLoading} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-black/50 border-green-700/50 text-green-300 terminal-text focus:ring-green-400 focus:border-green-400" placeholder="PASSWORD" disabled={isLoading} />
        </div>
        <div className="space-y-4">
          <Button type="submit" disabled={isLoading} className="w-full h-12 bg-green-600/75 hover:bg-green-500/75 text-white font-semibold terminal-text border border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-400/50">
            {isLoading ? 'ACCESSING...' : 'ACCESS DIRECTORY'}
          </Button>
          <Button type="button" onClick={() => setIsLoginView(false)} variant="outline" className="w-full h-12 bg-transparent border-green-400/50 text-green-400 hover:bg-green-400/50 hover:text-black terminal-text">
            REQUEST ACCOUNT
          </Button>
          <Button type="button" onClick={() => navigate('/')} variant="outline" className="w-full h-12 bg-transparent border-green-400/50 text-green-400 hover:bg-green-400/50 hover:text-black terminal-text">
            BACK TO MAIN
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
        <h1 className="text-3xl font-bold terminal-text text-green-400 mb-2">REQUEST ACCESS</h1>
        <p className="text-green-300 terminal-text text-sm">Submit a request for a new directory space</p>
      </div>
      <form onSubmit={handleRequest} className="space-y-6">
        <div className="space-y-4">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} className="bg-black/50 border-green-700/50 text-green-300 terminal-text focus:ring-green-400 focus:border-green-400" placeholder="USERNAME" disabled={isLoading} />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 border-green-700/50 text-green-300 terminal-text focus:ring-green-400 focus:border-green-400" placeholder="EMAIL" disabled={isLoading} />
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-black/50 border-green-700/50 text-green-300 terminal-text focus:ring-green-400 focus:border-green-400" placeholder="PASSWORD" disabled={isLoading} />
        </div>
        <div className="space-y-4">
          <Button type="submit" disabled={isLoading} className="w-full h-12 bg-green-600/75 hover:bg-green-500/75 text-white font-semibold terminal-text border border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-400/50">
            {isLoading ? 'SUBMITTING...' : 'SUBMIT REQUEST'}
          </Button>
          <Button type="button" onClick={() => setIsLoginView(true)} variant="outline" className="w-full h-12 bg-transparent border-green-400/50 text-green-400 hover:bg-green-400/50 hover:text-black terminal-text">
            BACK TO LOGIN
          </Button>
        </div>
      </form>
    </>
  );
};

export default LoginScreen;