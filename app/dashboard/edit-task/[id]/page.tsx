'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Task, User } from '@/lib/supabase';
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

export default function EditTaskPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  
  if (!params?.id) {
    router.push('/dashboard');
    return null;
  }
  
  const taskId = params.id as string;
  
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<Task | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('job_id', taskId)
          .single();

        if (error) throw error;
        
        // If user is not admin and not the assignee, redirect
        if (user?.role !== 'admin' && data.assignee !== user?.username) {
          router.push('/dashboard');
          toast.error("Access denied", { description: "You can only edit tasks assigned to you" });
          return;
        }
        
        setFormData(data);
      } catch (error) {
        console.error('Error fetching task:', error);
        toast.error("Error", { description: "Failed to fetch task details" });
        router.push('/dashboard');
      }
    };

    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, username, role, email');

        if (error) throw error;
        setAllUsers(data || []);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && taskId) {
      fetchTask();
      fetchUsers();
    }
  }, [user, taskId, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (formData) {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    if (formData) {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData) return;
    
    try {
      // Update the last_updated timestamp
      const updatedFormData = {
        ...formData,
        last_updated: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('tasks')
        .update(updatedFormData)
        .eq('job_id', taskId);

      if (error) throw error;

      toast.success("Success", {
        description: "Task updated successfully"
      });
      
      // Show toast for email notification
      toast.success("Email Notification", {
        description: `Email sent to ${updatedFormData.assignee} with update details`
      });
      
      router.push('/dashboard');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error("Error", {
        description: "Failed to update task"
      });
    }
  };

  if (loading || isLoading || !formData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading...
      </div>
    );
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
            <CardTitle className="text-xl md:text-2xl">Edit Task #{taskId}</CardTitle>
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
                    value={formData.priority || 'medium'}
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
                    value={formData.progress || 'not started'}
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
                    value={formData.start_date.split('T')[0]}
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
                    value={formData.due_date.split('T')[0]}
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
                    value={formData.assignee}
                    readOnly
                    disabled
                    className="w-full"
                  />
                )}
              </div>
              
              {user?.role === 'admin' && (
                <div className="space-y-2">
                  <Label>Last Updated</Label>
                  <Input
                    value={new Date(formData.last_updated).toLocaleString()}
                    readOnly
                    disabled
                    className="w-full"
                  />
                </div>
              )}
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
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
} 