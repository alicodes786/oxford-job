'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Task, User } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { 
  PlusCircle, 
  Edit, 
  X, 
  Search, 
  Filter, 
  ChevronUp, 
  ChevronDown, 
  MoreHorizontal,
  LayoutGrid,
  LayoutList,
  Layers,
  Eye,
  Pencil,
  EyeOff,
  Trash2,
  Mail
} from 'lucide-react';
import { toast } from "sonner";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import JobCompletionNotifications from '@/components/JobCompletionNotifications';
import RecentEvents from '@/components/RecentEvents';

// Define the view types
type ViewType = 'table' | 'grid' | 'card';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('table');
  const [editMode, setEditMode] = useState(true);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const router = useRouter();
  
  // Filter states
  const [filters, setFilters] = useState({
    clientName: '',
    pipeline: 'all',
    bucket: 'all',
    priority: 'all',
    progress: 'all',
    assignee: '',
  });

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        let query = supabase
          .from('tasks')
          .select('*')
          .order('job_id', { ascending: true });

        // Filter tasks by assignee for regular users
        if (user && user.role !== 'admin') {
          query = query.eq('assignee', user.username);
        }

        const { data, error } = await query;

        if (error) throw error;
        setTasks(data || []);
        setFilteredTasks(data || []);
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchTasks();
    }
  }, [user]);

  // Apply filters whenever the filters state changes
  useEffect(() => {
    let result = [...tasks];
    
    if (filters.clientName) {
      result = result.filter(task => 
        task.client_name.toLowerCase().includes(filters.clientName.toLowerCase())
      );
    }
    
    if (filters.pipeline !== 'all') {
      result = result.filter(task => task.pipeline === filters.pipeline);
    }
    
    if (filters.bucket !== 'all') {
      result = result.filter(task => task.bucket === filters.bucket);
    }
    
    if (filters.priority !== 'all') {
      result = result.filter(task => task.priority === filters.priority);
    }
    
    if (filters.progress !== 'all') {
      result = result.filter(task => task.progress === filters.progress);
    }
    
    if (filters.assignee && user?.role === 'admin') {
      result = result.filter(task => 
        task.assignee.toLowerCase().includes(filters.assignee.toLowerCase())
      );
    }
    
    setFilteredTasks(result);
  }, [filters, tasks, user]);

  // Function to detect if we're on a mobile device - moved outside of component body
  const isMobile = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  };

  // Set default view to card on mobile - placing this with other useEffect hooks
  useEffect(() => {
    // Check if we're on mobile and set the view accordingly
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewType('card');
    }
  }, []);

  const updateTaskField = async (jobId: number, field: string, value: string) => {
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('tasks')
        .update({ 
          [field]: value,
          last_updated: now
        })
        .eq('job_id', jobId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.job_id === jobId ? { 
          ...task, 
          [field]: value, 
          last_updated: now 
        } : task
      ));
      
      toast.success("Success", {
        description: "Task updated successfully"
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error("Error", {
        description: "Failed to update task"
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      clientName: '',
      pipeline: 'all',
      bucket: 'all',
      priority: 'all',
      progress: 'all',
      assignee: '',
    });
  };

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

  const getBucketColor = (bucket: string) => {
    switch (bucket) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'submission': return 'bg-blue-100 text-blue-800';
      case 'reviews': return 'bg-green-100 text-green-800';
      case 'VAT': return 'bg-purple-100 text-purple-800';
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

  const deleteTask = async (jobId: number) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('job_id', jobId);

      if (error) throw error;

      setTasks(tasks.filter(task => task.job_id !== jobId));
      setFilteredTasks(filteredTasks.filter(task => task.job_id !== jobId));
      
      toast.success("Success", {
        description: "Task deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error("Error", {
        description: "Failed to delete task"
      });
    }
  };

  const requestUpdate = (jobId: number, assignee: string) => {
    // In a real app, this would trigger an API call to send an email
    // For this demo, we'll just show a toast notification
    toast.success("Update Requested", {
      description: `Email sent to ${assignee} requesting update on job ID ${jobId}`
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Calculate the column span based on user role
  const colSpan = user?.role === 'admin' ? 11 : 9;

  return (
    <div className="p-3 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-gray-500">{filteredTasks.length} jobs found</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* View options toggle group */}
          <div className="hidden md:flex border border-gray-200 rounded-md mr-2">
            <Button 
              variant={viewType === 'table' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewType('table')}
              className={`rounded-r-none px-2 ${viewType === 'table' ? 'bg-black text-white hover:bg-gray-800' : 'text-gray-700 hover:text-gray-900'}`}
              title="Table View"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewType === 'grid' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewType('grid')}
              className={`rounded-none px-2 border-x border-gray-200 ${viewType === 'grid' ? 'bg-black text-white hover:bg-gray-800' : 'text-gray-700 hover:text-gray-900'}`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewType === 'card' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewType('card')}
              className={`rounded-l-none px-2 ${viewType === 'card' ? 'bg-black text-white hover:bg-gray-800' : 'text-gray-700 hover:text-gray-900'}`}
              title="Card View"
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center flex-1 md:flex-none justify-center"
          >
            <Filter className="mr-2 h-4 w-4" /> 
            Filters
            {showFilters ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>
          <Button 
            onClick={() => router.push('/dashboard/new-task')}
            className="flex-1 md:flex-none justify-center bg-black hover:bg-gray-800 text-white"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> New Task
          </Button>
        </div>
      </div>

      {/* Filters (toggleable) */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow border p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <Search className="mr-2 h-4 w-4" /> Filters
            </h2>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label htmlFor="client-filter" className="text-xs mb-1">Client Name</Label>
              <Input
                id="client-filter"
                value={filters.clientName}
                onChange={(e) => handleFilterChange('clientName', e.target.value)}
                placeholder="Client name..."
                className="h-9"
              />
            </div>
            
            <div>
              <Label htmlFor="pipeline-filter" className="text-xs mb-1">Pipeline</Label>
              <Select
                value={filters.pipeline}
                onValueChange={(value) => handleFilterChange('pipeline', value)}
              >
                <SelectTrigger id="pipeline-filter" className="h-9">
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pipelines</SelectItem>
                  <SelectItem value="chase information">Chase Information</SelectItem>
                  <SelectItem value="awaiting info">Awaiting Info</SelectItem>
                  <SelectItem value="task allocated">Task Allocated (WIP)</SelectItem>
                  <SelectItem value="ready for review">Ready for Review</SelectItem>
                  <SelectItem value="client approval">Client Approval</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="bucket-filter" className="text-xs mb-1">Bucket</Label>
              <Select
                value={filters.bucket}
                onValueChange={(value) => handleFilterChange('bucket', value)}
              >
                <SelectTrigger id="bucket-filter" className="h-9">
                  <SelectValue placeholder="Bucket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Buckets</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="submission">Submission</SelectItem>
                  <SelectItem value="reviews">Reviews</SelectItem>
                  <SelectItem value="VAT">VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="priority-filter" className="text-xs mb-1">Priority</Label>
              <Select
                value={filters.priority}
                onValueChange={(value) => handleFilterChange('priority', value)}
              >
                <SelectTrigger id="priority-filter" className="h-9">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="progress-filter" className="text-xs mb-1">Progress</Label>
              <Select
                value={filters.progress}
                onValueChange={(value) => handleFilterChange('progress', value)}
              >
                <SelectTrigger id="progress-filter" className="h-9">
                  <SelectValue placeholder="Progress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Progress</SelectItem>
                  <SelectItem value="not started">Not Started</SelectItem>
                  <SelectItem value="in progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {user?.role === 'admin' && (
              <div>
                <Label htmlFor="assignee-filter" className="text-xs mb-1">Assignee</Label>
                <Input
                  id="assignee-filter"
                  value={filters.assignee}
                  onChange={(e) => handleFilterChange('assignee', e.target.value)}
                  placeholder="Assignee name..."
                  className="h-9"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card View - Always shown on mobile and optional on desktop */}
      {(viewType === 'card' || isMobile()) && (
        <div className={`${viewType !== 'card' && !isMobile() ? 'hidden' : 'block'}`}>
          <div className="flex justify-end items-center mb-3">
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
              <Label htmlFor="mobile-edit-mode" className="text-sm font-medium text-gray-600">
                {editMode ? (
                  <span className="text-gray-900">
                    Quick Edit Mode
                  </span>
                ) : (
                  <span className="text-gray-900">
                    View Mode
                  </span>
                )}
              </Label>
              <Switch
                id="mobile-edit-mode"
                checked={editMode}
                onCheckedChange={setEditMode}
              />
            </div>
          </div>
          
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow border p-8 text-center text-gray-500">
              No tasks found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => (
                <div key={task.job_id} className="bg-white rounded-lg shadow border p-4">
                  {/* Header with Client Name, ID and Menu */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-full">
                      <div className="font-semibold text-lg">{task.client_name}</div>
                      <div className="text-xs text-gray-500">Job #{task.job_id}</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/dashboard/edit-task/${task.job_id}`)}>
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        {user?.role === 'admin' && (
                          <DropdownMenuItem onClick={() => requestUpdate(task.job_id, task.assignee)}>
                            <Mail className="h-4 w-4 mr-2" /> Request Update
                          </DropdownMenuItem>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="h-4 w-4 mr-2 text-red-500" /> 
                              <span className="text-red-500">Delete</span>
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this task and remove it from our servers.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-red-500 hover:bg-red-600"
                                onClick={() => deleteTask(task.job_id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  {/* Job Specification */}
                  <div className="text-sm break-words mb-4 border-t border-b py-3 my-2">
                    <div className="line-clamp-3" title={task.job_spec}>
                      {task.job_spec}
                    </div>
                  </div>
                  
                  {/* Start and Due Dates */}
                  <div className="mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Start Date</div>
                        <div className="text-sm">{format(new Date(task.start_date), 'dd/MM/yyyy')}</div>
                        </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Due Date</div>
                        <div className="text-sm">{format(new Date(task.due_date), 'dd/MM/yyyy')}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pipeline and Bucket */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Pipeline</div>
                      {editMode ? (
                        <Select
                          defaultValue={task.pipeline}
                          onValueChange={(value) => updateTaskField(task.job_id, 'pipeline', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue>
                              <Badge className={`${getPipelineColor(task.pipeline)} text-xs py-0 px-1`}>
                                {task.pipeline}
                              </Badge>
                            </SelectValue>
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
                      ) : (
                        <Badge className={getPipelineColor(task.pipeline)}>
                          {task.pipeline}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Bucket</div>
                      {editMode ? (
                        <Select
                          defaultValue={task.bucket}
                          onValueChange={(value) => updateTaskField(task.job_id, 'bucket', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue>
                              <Badge className={`${getBucketColor(task.bucket)} text-xs py-0 px-1`}>
                                {task.bucket}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="submission">Submission</SelectItem>
                            <SelectItem value="reviews">Reviews</SelectItem>
                            <SelectItem value="VAT">VAT</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getBucketColor(task.bucket)}>
                          {task.bucket}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Priority and Progress */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Priority</div>
                      {editMode ? (
                        <Select
                          defaultValue={task.priority || 'medium'}
                          onValueChange={(value) => updateTaskField(task.job_id, 'priority', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue>
                              <Badge className={`${getPriorityColor(task.priority || 'medium')} text-xs py-0 px-1`}>
                                {task.priority || 'medium'}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getPriorityColor(task.priority || 'medium')}>
                          {task.priority || 'medium'}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Progress</div>
                      {editMode ? (
                        <Select
                          defaultValue={task.progress || 'not started'}
                          onValueChange={(value) => updateTaskField(task.job_id, 'progress', value)}
                        >
                          <SelectTrigger className="w-full h-8 text-xs">
                            <SelectValue>
                              <Badge className={`${getProgressColor(task.progress || 'not started')} text-xs py-0 px-1`}>
                                {task.progress || 'not started'}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not started">Not Started</SelectItem>
                            <SelectItem value="in progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getProgressColor(task.progress || 'not started')}>
                          {task.progress || 'not started'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {user?.role === 'admin' && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      <div>Assignee: {task.assignee}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Updated: {task.last_updated ? format(new Date(task.last_updated), 'dd/MM/yyyy HH:mm') : '-'}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid View - Desktop only option */}
      {viewType === 'grid' && (
        <div className="hidden md:block">
          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow border p-8 text-center text-gray-500">
              No tasks found
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => (
                <div key={task.job_id} className="bg-white rounded-lg shadow border p-4 h-full flex flex-col">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-lg">{task.client_name}</div>
                      <div className="text-xs text-gray-500">Job #{task.job_id}</div>
                    </div>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/edit-task/${task.job_id}`)}
                        className="mr-1"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => requestUpdate(task.job_id, task.assignee)}
                          className="mr-1"
                          title="Request update"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete this task and remove it from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-red-500 hover:bg-red-600"
                              onClick={() => deleteTask(task.job_id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  <div className="text-sm break-words my-2 py-2 border-t border-b flex-grow">
                    <div className="line-clamp-3" title={task.job_spec}>
                    {task.job_spec}
                    </div>
                  </div>
                  
                  <div className="mt-auto">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Start Date</div>
                        <div className="text-sm">{format(new Date(task.start_date), 'dd/MM/yyyy')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Due Date</div>
                        <div className="text-sm">{format(new Date(task.due_date), 'dd/MM/yyyy')}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Pipeline</div>
                        <Badge className={getPipelineColor(task.pipeline)}>
                          {task.pipeline}
                        </Badge>
                      </div>
                      <div className="ml-2">
                        <div className="text-xs text-gray-500 mb-1">Bucket</div>
                        <Badge className={getBucketColor(task.bucket)}>
                          {task.bucket}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Priority</div>
                        <Badge className={getPriorityColor(task.priority || 'medium')}>
                          {task.priority || 'medium'}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Progress</div>
                        <Badge className={getProgressColor(task.progress || 'not started')}>
                          {task.progress || 'not started'}
                        </Badge>
                      </div>
                    </div>
                    
                    {user?.role === 'admin' && (
                      <div className="text-xs text-gray-500 mt-3 pt-3 border-t">
                        <div>Assignee: {task.assignee}</div>
                    </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table View - Desktop only option */}
      {viewType === 'table' && (
        <div className="hidden md:block">
          <div className="flex justify-end items-center mb-3">
            <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md border shadow-sm">
              <Label htmlFor="edit-mode" className="text-sm font-medium text-gray-600">
                {editMode ? (
                  <span className="text-gray-900">
                    Quick Edit Mode
                  </span>
                ) : (
                  <span className="text-gray-900">
                    View Mode
                  </span>
                )}
              </Label>
              <Switch
                id="edit-mode"
                checked={editMode}
                onCheckedChange={setEditMode}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden border">
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader className="bg-blue-500 text-white">
                  <TableRow className="hover:bg-blue-600 border-none">
                    <TableHead className="font-semibold border-blue-400 text-white w-[80px]">ID</TableHead>
                    <TableHead className="font-semibold border-blue-400 text-white w-[150px]">Client</TableHead>
                    <TableHead className="font-semibold border-blue-400 text-white w-[250px]">Job Spec</TableHead>
                    <TableHead className="font-semibold border-blue-400 text-white w-[120px]">Bucket</TableHead>
                    <TableHead className="font-semibold border-blue-400 text-white w-[200px]">Status</TableHead>
                    <TableHead className="font-semibold border-blue-400 text-white w-[130px]">Dates</TableHead>
                    {user?.role === 'admin' && (
                      <>
                        <TableHead className="font-semibold border-blue-400 text-white w-[120px]">Assignee</TableHead>
                        <TableHead className="font-semibold border-blue-400 text-white w-[120px] rounded-tr-lg">Last Updated</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task, index) => (
                    <TableRow 
                      key={task.job_id} 
                      className="bg-white hover:bg-blue-50/50 border-b"
                    >
                      <TableCell className="border-r border-gray-200 font-medium py-2">
                        <div className="flex items-center">
                          <span className="mr-2">{task.job_id}</span>
                          <div className="flex ml-auto">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => router.push(`/dashboard/edit-task/${task.job_id}`)}
                              className="h-6 w-6"
                              title="Edit task"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => requestUpdate(task.job_id, task.assignee)}
                                className="h-6 w-6 text-blue-500 hover:text-blue-700"
                                title="Request update"
                              >
                                <Mail className="h-3 w-3" />
                              </Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-500 hover:text-red-700"
                                  title="Delete task"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this task #{task.job_id} and remove it from our servers.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => deleteTask(task.job_id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-gray-200 break-words py-2">{task.client_name}</TableCell>
                      <TableCell className="border-r border-gray-200 whitespace-normal break-words py-2">
                        <div className="line-clamp-3" title={task.job_spec}>
                          {task.job_spec}
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-gray-200 py-2">
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 w-16 shrink-0">Bucket:</span>
                          <div className="flex-1 min-w-0">
                            {editMode ? (
                              <Select
                                defaultValue={task.bucket}
                                onValueChange={(value) => updateTaskField(task.job_id, 'bucket', value)}
                              >
                                <SelectTrigger className="w-full h-7 text-xs">
                                  <SelectValue>
                                    <Badge className={`${getBucketColor(task.bucket)} text-xs py-0 px-1`}>
                                      {task.bucket}
                                    </Badge>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="submission">Submission</SelectItem>
                                  <SelectItem value="reviews">Reviews</SelectItem>
                                  <SelectItem value="VAT">VAT</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={`${getBucketColor(task.bucket)} text-xs py-0 px-1`}>
                                {task.bucket}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-gray-200 py-2">
                        <div className="space-y-1">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center">
                              <span className="text-xs text-gray-500 w-20 shrink-0">Pipeline:</span>
                              <div className="flex-1 min-w-0">
                              {editMode ? (
                                <Select
                                  defaultValue={task.pipeline}
                                  onValueChange={(value) => updateTaskField(task.job_id, 'pipeline', value)}
                                >
                                  <SelectTrigger className="w-full h-7 text-xs">
                                    <SelectValue>
                                      <Badge className={`${getPipelineColor(task.pipeline)} text-xs py-0 px-1`}>
                                        {task.pipeline}
                                      </Badge>
                                    </SelectValue>
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
                              ) : (
                                <Badge className={`${getPipelineColor(task.pipeline)} text-xs py-0 px-1`}>
                                  {task.pipeline}
                                </Badge>
                              )}
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <span className="text-xs text-gray-500 w-20 shrink-0">Priority:</span>
                              <div className="flex-1 min-w-0">
                              {editMode ? (
                                <Select
                                  defaultValue={task.priority || 'medium'}
                                  onValueChange={(value) => updateTaskField(task.job_id, 'priority', value)}
                                >
                                  <SelectTrigger className="w-full h-7 text-xs">
                                    <SelectValue>
                                      <Badge className={`${getPriorityColor(task.priority || 'medium')} text-xs py-0 px-1`}>
                                        {task.priority || 'medium'}
                                      </Badge>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge className={`${getPriorityColor(task.priority || 'medium')} text-xs py-0 px-1`}>
                                  {task.priority || 'medium'}
                                </Badge>
                              )}
                              </div>
                            </div>
                            
                            <div className="flex items-center">
                              <span className="text-xs text-gray-500 w-20 shrink-0">Progress:</span>
                              <div className="flex-1 min-w-0">
                              {editMode ? (
                                <Select
                                  defaultValue={task.progress || 'not started'}
                                  onValueChange={(value) => updateTaskField(task.job_id, 'progress', value)}
                                >
                                  <SelectTrigger className="w-full h-7 text-xs">
                                    <SelectValue>
                                      <Badge className={`${getProgressColor(task.progress || 'not started')} text-xs py-0 px-1`}>
                                        {task.progress || 'not started'}
                                      </Badge>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not started">Not Started</SelectItem>
                                    <SelectItem value="in progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge className={`${getProgressColor(task.progress || 'not started')} text-xs py-0 px-1`}>
                                  {task.progress || 'not started'}
                                </Badge>
                              )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="border-r border-gray-200 whitespace-nowrap py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 w-12 shrink-0">Start:</span>
                            <span className="text-xs">{format(new Date(task.start_date), 'dd/MM/yyyy')}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 w-12 shrink-0">Due:</span>
                            <span className="text-xs">{format(new Date(task.due_date), 'dd/MM/yyyy')}</span>
                          </div>
                        </div>
                      </TableCell>
                      {user?.role === 'admin' && (
                        <>
                          <TableCell className="border-r border-gray-200 break-words py-2">{task.assignee}</TableCell>
                          <TableCell className="border-r border-gray-200 whitespace-nowrap py-2 text-xs">{task.last_updated ? format(new Date(task.last_updated), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={user?.role === 'admin' ? 8 : 6} className="text-center py-6 text-gray-500">
                        No tasks found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Remove the Recent Job Completions and Recent Events sections */}
    </div>
  );
} 