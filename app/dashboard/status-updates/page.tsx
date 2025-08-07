'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Task } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { format, differenceInDays } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertCircle, 
  ArrowRight, 
  Clock, 
  Edit, 
  AlertTriangle, 
  FileBarChart,
  Mail
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function StatusUpdatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [recentlyUpdated, setRecentlyUpdated] = useState<Task[]>([]);
  const [stagnantJobs, setStagnantJobs] = useState<Task[]>([]);
  const [highPriorityJobs, setHighPriorityJobs] = useState<Task[]>([]);

  const handleEditClick = (jobId: number) => {
    router.push(`/dashboard/edit-task/${jobId}`);
  };
  
  const handleDashboardClick = () => {
    router.push('/dashboard');
  };

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      handleDashboardClick();
    }
  }, [user, loading, router]);

  // Fetch tasks with different criteria
  useEffect(() => {
    const fetchTasks = async () => {
      if (!user || user.role !== 'admin') return;
      
      try {
        // Get all tasks
        const { data: allTasks, error } = await supabase
          .from('tasks')
          .select('*')
          .order('last_updated', { ascending: false });

        if (error) throw error;
        
        if (allTasks) {
          const now = new Date();
          
          // Recently updated (last 3 days)
          const recent = allTasks.filter(task => 
            differenceInDays(now, new Date(task.last_updated)) <= 3
          ).slice(0, 10); // Top 10 most recent
          
          // Stagnant jobs (not updated in 14+ days)
          const stagnant = allTasks.filter(task => 
            task.progress !== 'completed' && 
            differenceInDays(now, new Date(task.last_updated)) >= 14
          );
          
          // High priority incomplete jobs
          const highPriority = allTasks.filter(task => 
            task.priority === 'high' && 
            task.progress !== 'completed'
          );
          
          setRecentlyUpdated(recent);
          setStagnantJobs(stagnant);
          setHighPriorityJobs(highPriority);
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && user.role === 'admin') {
      fetchTasks();
    }
  }, [user]);

  const getPipelineColor = (pipeline: string) => {
    switch (pipeline) {
      case 'chase information': return 'bg-yellow-100 text-yellow-800';
      case 'awaiting info': return 'bg-orange-100 text-orange-800';
      case 'task allocated': return 'bg-blue-100 text-blue-800';
      case 'ready for review': return 'bg-purple-100 text-purple-800';
      case 'client approval': return 'bg-green-100 text-green-800';
      case 'submission': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progress: string) => {
    switch (progress) {
      case 'not started': return 'bg-gray-100 text-gray-800';
      case 'in progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const requestUpdate = (jobId: number, assignee: string) => {
    toast.success("Update Requested", {
      description: `Email sent to ${assignee} requesting update on job ID ${jobId}`
    });
  };

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-3 md:p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6 flex items-center">
        <AlertCircle className="mr-2 h-6 w-6" /> Status Updates
      </h1>
      
      <div className="space-y-8">
        {/* Recently Updated Jobs */}
        <Card>
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-xl flex items-center">
              <Clock className="mr-2 h-5 w-5 text-blue-600" /> Recently Updated Jobs
            </CardTitle>
            <CardDescription>
              Jobs that have been updated in the last 3 days
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-gray-100">
                  <TableHead className="w-[80px]">Job ID</TableHead>
                  <TableHead className="w-[150px]">Client</TableHead>
                  <TableHead className="w-[120px]">Pipeline</TableHead>
                  <TableHead className="w-[120px]">Assignee</TableHead>
                  <TableHead className="w-[150px]">Last Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentlyUpdated.length > 0 ? (
                  recentlyUpdated.map((task) => (
                    <TableRow key={task.job_id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{task.job_id}</TableCell>
                      <TableCell>{task.client_name}</TableCell>
                      <TableCell>
                        <Badge className={getPipelineColor(task.pipeline)}>
                          {task.pipeline}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.assignee}</TableCell>
                      <TableCell>{format(new Date(task.last_updated), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(task.job_id)}
                            className="h-8 w-8"
                            title="Edit task"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestUpdate(task.job_id, task.assignee)}
                            className="h-8 w-8 text-blue-600"
                            title="Request update"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-gray-500">
                      No recently updated jobs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="bg-gray-50 py-2">
            <Button variant="link" onClick={handleDashboardClick} className="ml-auto">
              View All Jobs <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        {/* Stagnant Jobs */}
        <Card>
          <CardHeader className="bg-amber-50">
            <CardTitle className="text-xl flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5 text-amber-600" /> Stagnant Jobs
            </CardTitle>
            <CardDescription>
              Jobs that haven't been updated in the last 14 days and are not yet completed
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-gray-100">
                  <TableHead className="w-[80px]">Job ID</TableHead>
                  <TableHead className="w-[150px]">Client</TableHead>
                  <TableHead className="w-[120px]">Priority</TableHead>
                  <TableHead className="w-[120px]">Progress</TableHead>
                  <TableHead className="w-[120px]">Assignee</TableHead>
                  <TableHead className="w-[150px]">Last Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagnantJobs.length > 0 ? (
                  stagnantJobs.map((task) => (
                    <TableRow key={task.job_id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{task.job_id}</TableCell>
                      <TableCell>{task.client_name}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority || 'medium')}>
                          {task.priority || 'medium'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getProgressColor(task.progress || 'not started')}>
                          {task.progress || 'not started'}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.assignee}</TableCell>
                      <TableCell>
                        {format(new Date(task.last_updated), 'dd/MM/yyyy HH:mm')}
                        <div className="text-xs text-amber-600">
                          {differenceInDays(new Date(), new Date(task.last_updated))} days ago
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(task.job_id)}
                            className="h-8 w-8"
                            title="Edit task"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => requestUpdate(task.job_id, task.assignee)}
                            className="h-8 w-8 text-blue-600"
                            title="Request update"
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                      No stagnant jobs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* High Priority Jobs */}
        <Card>
          <CardHeader className="bg-red-50">
            <CardTitle className="text-xl flex items-center">
              <FileBarChart className="mr-2 h-5 w-5 text-red-600" /> High Priority Incomplete Jobs
            </CardTitle>
            <CardDescription>
              High priority jobs that have not been completed yet
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-gray-100">
                  <TableHead className="w-[80px]">Job ID</TableHead>
                  <TableHead className="w-[150px]">Client</TableHead>
                  <TableHead className="w-[120px]">Progress</TableHead>
                  <TableHead className="w-[120px]">Pipeline</TableHead>
                  <TableHead className="w-[120px]">Assignee</TableHead>
                  <TableHead className="w-[120px]">Due Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highPriorityJobs.length > 0 ? (
                  highPriorityJobs.map((task) => {
                    const isOverdue = new Date(task.due_date) < new Date();
                    
                    return (
                      <TableRow key={task.job_id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                        <TableCell className="font-medium">{task.job_id}</TableCell>
                        <TableCell>{task.client_name}</TableCell>
                        <TableCell>
                          <Badge className={getProgressColor(task.progress || 'not started')}>
                            {task.progress || 'not started'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPipelineColor(task.pipeline)}>
                            {task.pipeline}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.assignee}</TableCell>
                        <TableCell>
                          {format(new Date(task.due_date), 'dd/MM/yyyy')}
                          {isOverdue && (
                            <div className="text-xs text-red-600 font-medium">
                              OVERDUE
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(task.job_id)}
                              className="h-8 w-8"
                              title="Edit task"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => requestUpdate(task.job_id, task.assignee)}
                              className="h-8 w-8 text-blue-600"
                              title="Request update"
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-gray-500">
                      No high priority incomplete jobs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 