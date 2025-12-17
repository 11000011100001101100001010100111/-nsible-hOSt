import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';

const ArchXPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isArchX, setIsArchX] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, username, requested_at, is_approved, approved_at')
      .order('requested_at', { ascending: true });

    if (error) {
      toast({
        title: 'Error Fetching Users',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setUsers(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (user) {
      if (user.profile && user.profile.is_approved) {
        setIsArchX(true);
        fetchUsers();
      } else {
        toast({ title: "Access Denied", description: "You do not have ArchX privileges.", variant: "destructive" });
        navigate(`/desk/${user.profile.username}`);
      }
    }
  }, [user, toast, navigate, fetchUsers]);

  const handleApproval = async (id, shouldApprove) => {
    const { error } = await supabase
      .from('users')
      .update({ is_approved: shouldApprove, approved_at: shouldApprove ? new Date().toISOString() : null })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Action Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success',
        description: `User has been ${shouldApprove ? 'approved' : 'revoked'}.`,
      });
      fetchUsers();
    }
  };

  if (!user || !isArchX) {
    return <div className="h-screen w-screen flex items-center justify-center bg-black text-green-400 terminal-text">VERIFYING ARCHX CREDENTIALS...</div>;
  }

  return (
    <>
      <Helmet>
        <title>ArchX Panel - @nsible</title>
        <meta name="description" content="Manage user account approvals as ArchX." />
      </Helmet>
      <div className="h-screen w-screen flex flex-col items-center justify-center p-4 terminal-text text-green-400">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-6xl bg-black/80 border border-green-500 p-6 rounded-lg backdrop-blur-sm"
        >
          <h1 className="text-3xl font-bold mb-4 text-center">ARCHX_PANEL</h1>
          <p className="text-center mb-6">Approve or manage user account requests.</p>
          
          <div className="overflow-auto h-[60vh]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-green-700">
                  <th className="p-2">Username</th>
                  <th className="p-2">Requested At</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Approved At</th>
                  <th className="p-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center p-4">Loading user requests...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center p-4">No user accounts exist.</td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-green-800/50"
                    >
                      <td className="p-2">{u.username}</td>
                      <td className="p-2">{new Date(u.requested_at).toLocaleString()}</td>
                      <td className={`p-2 font-bold ${u.is_approved ? 'text-cyan-400' : 'text-yellow-400'}`}>
                        {u.is_approved ? 'Approved' : 'Pending'}
                      </td>
                      <td className="p-2">{u.approved_at ? new Date(u.approved_at).toLocaleString() : 'N/A'}</td>
                      <td className="p-2 text-right space-x-2">
                        {user && u.id !== user.id && (
                          u.is_approved ? (
                            <Button
                              onClick={() => handleApproval(u.id, false)}
                              variant="destructive"
                              className="text-xs h-8"
                            >
                              Revoke
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleApproval(u.id, true)}
                              className="bg-green-600 hover:bg-green-500 text-black text-xs h-8"
                            >
                              Approve
                            </Button>
                          )
                        )}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
           <div className="text-center mt-4">
             <Button onClick={fetchUsers} variant="outline" className="bg-transparent border-green-400 text-green-400 hover:bg-green-400 hover:text-black terminal-text">
                Refresh List
              </Button>
           </div>
        </motion.div>
      </div>
    </>
  );
};

export default ArchXPanel;