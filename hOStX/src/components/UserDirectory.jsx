import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const PasswordUpdateModal = ({ onPasswordUpdated }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handlePasswordUpdate = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters long.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsLoading(false);

    if (error) {
      toast({ title: "Password Update Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Your password has been updated." });
      onPasswordUpdated();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-black border border-green-500 rounded-lg p-8 w-96 terminal-text"
      >
        <h2 className="text-2xl font-bold text-green-400 mb-4">Mandatory Password Update</h2>
        <p className="text-green-300 mb-6">For security reasons, you must update your password upon first login.</p>
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-black/50 border-green-400 text-green-400"
            disabled={isLoading}
          />
          <Input
            type="password"
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-black/50 border-green-400 text-green-400"
            disabled={isLoading}
          />
          <Button
            onClick={handlePasswordUpdate}
            disabled={isLoading}
            className="w-full h-12 bg-green-600 hover:bg-green-500 text-black font-semibold"
          >
            {isLoading ? 'UPDATING...' : 'Update Password'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const UserDirectory = () => {
  const { subdomain } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (user) {
      const lastSignIn = new Date(user.last_sign_in_at);
      const createdAt = new Date(user.created_at);
      // If last sign-in is very close to creation time, it's likely the first login.
      if (Math.abs(lastSignIn - createdAt) < 5000) {
        setShowPasswordModal(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && user.profile.username !== subdomain) {
      navigate(`/user/${user.profile.username}`);
    }
  }, [user, subdomain, navigate]);

  if (!user) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Directory: {subdomain} - @nsible</title>
        <meta name="description" content={`User directory space for ${subdomain}`} />
      </Helmet>
      {showPasswordModal && <PasswordUpdateModal onPasswordUpdated={() => setShowPasswordModal(false)} />}
      <div className="h-screen w-screen flex items-center justify-center terminal-text text-green-400">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold">Welcome, {user.profile.username}</h1>
          <p className="mt-2">You have successfully accessed your personal directory.</p>
          <p className="mt-1 text-sm text-green-500">User ID: {user.id}</p>
        </motion.div>
      </div>
    </>
  );
};

export default UserDirectory;