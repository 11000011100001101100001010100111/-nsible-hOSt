import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Helmet } from 'react-helmet';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('id, username, requested_at, is_approved')
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
    fetchUsers();
  }, [fetchUsers]);

  const handleApprove = async (id) => {
    const { error } = await supabase
      .from('users')
      .update({ is_approved: true, approved_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'User Approved',
        description: 'The user can now log in.',
      });
      fetchUsers();
    }
  };

  return (
    <>
      <Helmet>
        <title>Admin Panel - @nsible</title>
        <meta name="description" content="Manage user account approvals." />
      </Helmet>
      <div className="h-screen w-screen flex flex-col items-center justify-center p-4 terminal-text text-green-400">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-4xl bg-black/80 border border-green-500 p-6 rounded-lg backdrop-blur-sm"
        >
          <h1 className="text-3xl font-bold mb-4 text-center">ADMINISTRATION_PANEL</h1>
          <p className="text-center mb-6">Approve or manage user account requests.</p>
          
          <div className="overflow-auto h-[60vh]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-green-700">
                  <th className="p-2">Username</th>
                  <th className="p-2">Requested At</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center p-4">Loading user requests...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center p-4">No pending user requests.</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-green-800/50"
                    >
                      <td className="p-2">{user.username}</td>
                      <td className="p-2">{new Date(user.requested_at).toLocaleString()}</td>
                      <td className={`p-2 ${user.is_approved ? 'text-cyan-400' : 'text-yellow-400'}`}>
                        {user.is_approved ? 'Approved' : 'Pending'}
                      </td>
                      <td className="p-2 text-right">
                        {!user.is_approved && (
                          <Button
                            onClick={() => handleApprove(user.id)}
                            className="bg-green-600 hover:bg-green-500 text-black text-xs h-8"
                          >
                            Approve
                          </Button>
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

export default AdminPanel;