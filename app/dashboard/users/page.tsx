'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'sub-admin' | 'user';
}

interface Cleaner {
  id: string;
  name: string;
  external_id: string;
  role: 'viewer' | 'editor';
  hourly_rate: number;
  password?: string;
}

interface NewUser {
  username: string;
  email: string;
  password: string;
  role: 'sub-admin' | 'user';
}

interface NewCleaner {
  name: string;
  external_id: string;
  hourly_rate: number;
  password: string;
  role: 'viewer' | 'editor';
}

interface CleanerChanges {
  [key: string]: {
    name?: string;
    role?: 'viewer' | 'editor';
    hourly_rate?: number;
  };
}

export default function UsersPage() {
  const { user, loading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [cleaners, setCleaners] = useState<Cleaner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingCleaner, setEditingCleaner] = useState<Cleaner | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [newUser, setNewUser] = useState<NewUser>({
    username: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [showNewCleanerDialog, setShowNewCleanerDialog] = useState(false);
  const [newCleaner, setNewCleaner] = useState<NewCleaner>({
    name: '',
    external_id: '',
    hourly_rate: 20,
    password: '',
    role: 'viewer'
  });
  const [cleanerChanges, setCleanerChanges] = useState<CleanerChanges>({});
  const [cleanerToDelete, setCleanerToDelete] = useState<Cleaner | null>(null);

  // Load data
  useEffect(() => {
    if (!loading && user?.role === 'admin') {
      loadUsers();
      loadCleaners();
    }
  }, [loading, user]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, role')
        .order('username');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadCleaners = async () => {
    try {
      const { data, error } = await supabase
        .from('cleaners')
        .select('id, name, external_id, role, hourly_rate')
        .order('name');

      if (error) throw error;
      setCleaners(data || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading cleaners:', error);
      toast.error('Failed to load cleaners');
      setIsLoading(false);
    }
  };

  const updateUserRole = async (userId: number, newRole: 'admin' | 'sub-admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast.success('User role updated successfully');
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    }
  };

  const updateCleanerRole = async (cleanerId: string, newRole: 'viewer' | 'editor') => {
    try {
      const { error } = await supabase
        .from('cleaners')
        .update({ role: newRole })
        .eq('id', cleanerId);

      if (error) throw error;

      setCleaners(cleaners.map(c => 
        c.id === cleanerId ? { ...c, role: newRole } : c
      ));

      toast.success('Cleaner role updated successfully');
    } catch (error) {
      console.error('Error updating cleaner role:', error);
      toast.error('Failed to update cleaner role');
    }
  };

  const updatePassword = async () => {
    if (!newPassword) {
      toast.error('Please enter a new password');
      return;
    }

    try {
      const response = await fetch('/api/users/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUser?.id,
          cleanerId: editingCleaner?.id,
          password: newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update password');
      }

      toast.success('Password updated successfully');
      setNewPassword('');
      setEditingUser(null);
      setEditingCleaner(null);
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .insert([{
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role
        }]);

      if (error) throw error;

      toast.success('User created successfully');
      setShowNewUserDialog(false);
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  const deleteUser = async (userId: number) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.filter(u => u.id !== userId));
      setUserToDelete(null);
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const createCleaner = async () => {
    if (!newCleaner.name || !newCleaner.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Generate external_id in the format: cleaner-timestamp-randomstring
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 11);
      const external_id = `cleaner-${timestamp}-${randomString}`;

      const { error } = await supabase
        .from('cleaners')
        .insert([{
          name: newCleaner.name,
          external_id: external_id,
          hourly_rate: newCleaner.hourly_rate,
          password: newCleaner.password,
          role: newCleaner.role
        }]);

      if (error) throw error;

      toast.success('Cleaner created successfully');
      setShowNewCleanerDialog(false);
      setNewCleaner({ name: '', external_id: '', hourly_rate: 20, password: '', role: 'viewer' });
      loadCleaners();
    } catch (error) {
      console.error('Error creating cleaner:', error);
      toast.error('Failed to create cleaner');
    }
  };

  const updateCleanerField = (cleanerId: string, field: string, value: any) => {
    setCleanerChanges(prev => ({
      ...prev,
      [cleanerId]: {
        ...(prev[cleanerId] || {}),
        [field]: value
      }
    }));
  };

  const saveAllChanges = async () => {
    try {
      // Save each cleaner's changes
      for (const [cleanerId, changes] of Object.entries(cleanerChanges)) {
        const { error } = await supabase
          .from('cleaners')
          .update(changes)
          .eq('id', cleanerId);

        if (error) throw error;

        // Update local state
        setCleaners(cleaners.map(c => 
          c.id === cleanerId ? { ...c, ...changes } : c
        ));
      }

      // Clear all changes
      setCleanerChanges({});
      toast.success('All changes saved successfully');
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save some changes');
    }
  };

  const hasAnyUnsavedChanges = () => {
    return Object.keys(cleanerChanges).length > 0;
  };

  const deleteCleaner = async (cleanerId: string) => {
    try {
      const { error } = await supabase
        .from('cleaners')
        .delete()
        .eq('id', cleanerId);

      if (error) throw error;

      setCleaners(cleaners.filter(c => c.id !== cleanerId));
      toast.success('Cleaner deleted successfully');
    } catch (error) {
      console.error('Error deleting cleaner:', error);
      toast.error('Failed to delete cleaner');
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="space-x-2">
          <Button onClick={() => setShowNewUserDialog(true)} className="bg-black hover:bg-gray-800">
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Button>
          <Button onClick={() => setShowNewCleanerDialog(true)} className="bg-black hover:bg-gray-800">
            <Plus className="h-4 w-4 mr-2" />
            New Cleaner
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">System Users</TabsTrigger>
          <TabsTrigger value="cleaners">Cleaners</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map(user => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Select
                          value={user.role}
                          onValueChange={(value: 'admin' | 'sub-admin' | 'user') => updateUserRole(user.id, value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="sub-admin">Sub-Admin</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setEditingUser(user)}
                        >
                          Change Password
                        </Button>
                        {user.role !== 'admin' && (
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => setUserToDelete(user)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cleaners" className="mt-6">
          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">External ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hourly Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cleaners.map(cleaner => (
                    <tr key={cleaner.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Input
                          value={cleanerChanges[cleaner.id]?.name ?? cleaner.name}
                          onChange={(e) => updateCleanerField(cleaner.id, 'name', e.target.value)}
                          className="max-w-[200px]"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {cleaner.external_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Select
                          value={cleanerChanges[cleaner.id]?.role ?? cleaner.role}
                          onValueChange={(value: 'viewer' | 'editor') => updateCleanerField(cleaner.id, 'role', value)}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="mr-2">£</span>
                          <Input
                            type="number"
                            value={cleanerChanges[cleaner.id]?.hourly_rate ?? cleaner.hourly_rate}
                            onChange={(e) => updateCleanerField(cleaner.id, 'hourly_rate', parseFloat(e.target.value))}
                            className="max-w-[100px]"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setEditingCleaner(cleaner)}
                        >
                          Change Password
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => setCleanerToDelete(cleaner)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasAnyUnsavedChanges() && (
              <div className="p-4 border-t bg-gray-50 flex justify-end">
                <Button
                  onClick={saveAllChanges}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Save All Changes
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* New User Dialog */}
      <Dialog open={showNewUserDialog} onOpenChange={setShowNewUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Enter username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Enter email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: 'sub-admin' | 'user') => setNewUser({ ...newUser, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sub-admin">Sub-Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowNewUserDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={createUser}>
                Create User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={!!editingUser || !!editingCleaner} onOpenChange={() => { setEditingUser(null); setEditingCleaner(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => { setEditingUser(null); setEditingCleaner(null); }}
              >
                Cancel
              </Button>
              <Button onClick={updatePassword}>
                Update Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {userToDelete?.username}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => userToDelete && deleteUser(userToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Cleaner Dialog */}
      <Dialog open={showNewCleanerDialog} onOpenChange={setShowNewCleanerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Cleaner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Enter name"
                value={newCleaner.name}
                onChange={(e) => setNewCleaner({ ...newCleaner, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate (£)</Label>
              <Input
                type="number"
                placeholder="Enter hourly rate"
                value={newCleaner.hourly_rate}
                onChange={(e) => setNewCleaner({ ...newCleaner, hourly_rate: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter password"
                value={newCleaner.password}
                onChange={(e) => setNewCleaner({ ...newCleaner, password: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newCleaner.role}
                onValueChange={(value: 'viewer' | 'editor') => setNewCleaner({ ...newCleaner, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowNewCleanerDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={createCleaner}>
                Create Cleaner
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Cleaner Confirmation Dialog */}
      <AlertDialog open={!!cleanerToDelete} onOpenChange={(open) => !open && setCleanerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cleaner</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {cleanerToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (cleanerToDelete) {
                  deleteCleaner(cleanerToDelete.id);
                  setCleanerToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 