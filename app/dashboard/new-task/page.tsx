'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, User } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from "sonner";
import { Loader2, ArrowLeft } from 'lucide-react';

export default function NewTaskPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  const [formData, setFormData] = useState({
    client_name: '',
    job_spec: '',
    pipeline: 'chase information',
    bucket: 'admin',
    start_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    assignee: '',
    priority: 'medium',
    progress: 'not started',
    last_updated: new Date().toISOString(),
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, role, email');

        if (error) throw error;
        setAllUsers(data || []);
        
        // Set default assignee
        if (data && data.length > 0) {
          if (user?.role === 'admin') {
            // Admin can assign to any user
            setFormData(prev => ({ ...prev, assignee: data[0].username }));
          } else {
            // Regular user assigns to themselves
            setFormData(prev => ({ ...prev, assignee: user?.username || '' }));
          }
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Update the last_updated timestamp
      const updatedFormData = {
        ...formData,
        last_updated: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('tasks')
        .insert([updatedFormData]);

      if (error) throw error;

      toast.success("Success", {
        description: "Task created successfully"
      });
      
      // Show toast for email notification
      toast.success("Email Notification", {
        description: `Email sent to ${updatedFormData.assignee}`
      });
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error("Error", {
        description: "Failed to create task"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="p-3 md:p-6 lg:p-8">
      <Button 
        variant="ghost" 
        onClick={() => router.push('/dashboard')}
        className="mb-4 px-2"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
      
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Create New Task</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="client_name">Client Name</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  className="w-full"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="job_spec">Job Specification</Label>
                <Textarea
                  id="job_spec"
                  name="job_spec"
                  value={formData.job_spec}
                  onChange={handleChange}
                  className="min-h-[100px] w-full"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pipeline">Pipeline</Label>
                  <Select
                    value={formData.pipeline}
                    onValueChange={(value) => handleSelectChange('pipeline', value)}
                  >
                    <SelectTrigger id="pipeline" className="w-full">
                      <SelectValue placeholder="Select pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chase information">Chase Information</SelectItem>
                      <SelectItem value="awaiting info">Awaiting Info</SelectItem>
                      <SelectItem value="task allocated">Task Allocated (WIP)</SelectItem>
                      <SelectItem value="ready for review">Ready for Review</SelectItem>
                      <SelectItem value="client approval">Client Approval</SelectItem>
                      <SelectItem value="submission">Submission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bucket">Bucket</Label>
                  <Select
                    value={formData.bucket}
                    onValueChange={(value) => handleSelectChange('bucket', value)}
                  >
                    <SelectTrigger id="bucket" className="w-full">
                      <SelectValue placeholder="Select bucket" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="submission">Submission</SelectItem>
                      <SelectItem value="reviews">Reviews</SelectItem>
                      <SelectItem value="VAT">VAT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => handleSelectChange('priority', value)}
                  >
                    <SelectTrigger id="priority" className="w-full">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="progress">Progress</Label>
                  <Select
                    value={formData.progress}
                    onValueChange={(value) => handleSelectChange('progress', value)}
                  >
                    <SelectTrigger id="progress" className="w-full">
                      <SelectValue placeholder="Select progress" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not started">Not Started</SelectItem>
                      <SelectItem value="in progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="w-full"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    name="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={handleChange}
                    className="w-full"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assignee">Assignee</Label>
                {user?.role === 'admin' ? (
                  <Select
                    value={formData.assignee}
                    onValueChange={(value) => handleSelectChange('assignee', value)}
                  >
                    <SelectTrigger id="assignee" className="w-full">
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers.map(user => (
                        <SelectItem key={user.id} value={user.username}>
                          {user.username} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="assignee"
                    name="assignee"
                    value={user.username}
                    readOnly
                    disabled
                    className="w-full"
                  />
                )}
              </div>
            </CardContent>
            
            <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 px-6 pb-6">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => router.push('/dashboard')}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="w-full sm:w-auto"
              >
                Create Task
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
} 