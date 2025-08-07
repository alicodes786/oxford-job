'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Task } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AnalyticsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    notStartedTasks: 0,
    highPriorityTasks: 0,
    mediumPriorityTasks: 0,
    lowPriorityTasks: 0,
    tasksByBucket: {} as Record<string, number>,
  });

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*');

        if (error) throw error;
        setTasks(data || []);

        // Calculate stats
        const tasksByBucket: Record<string, number> = {};
        let completedTasks = 0;
        let inProgressTasks = 0;
        let notStartedTasks = 0;
        let highPriorityTasks = 0;
        let mediumPriorityTasks = 0;
        let lowPriorityTasks = 0;

        data?.forEach(task => {
          // Count by bucket
          if (tasksByBucket[task.bucket]) {
            tasksByBucket[task.bucket]++;
          } else {
            tasksByBucket[task.bucket] = 1;
          }

          // Count by progress
          if (task.progress === 'completed') completedTasks++;
          else if (task.progress === 'in progress') inProgressTasks++;
          else notStartedTasks++;

          // Count by priority
          if (task.priority === 'high') highPriorityTasks++;
          else if (task.priority === 'medium') mediumPriorityTasks++;
          else if (task.priority === 'low') lowPriorityTasks++;
        });

        setStats({
          totalTasks: data?.length || 0,
          completedTasks,
          inProgressTasks,
          notStartedTasks,
          highPriorityTasks,
          mediumPriorityTasks,
          lowPriorityTasks,
          tasksByBucket,
        });
      } catch (error) {
        console.error('Error fetching tasks for analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user && user.role === 'admin') {
      fetchTasks();
    }
  }, [user]);

  if (loading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user || user.role !== 'admin') {
    return null;
  }

  const completionPercentage = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="p-3 md:p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{stats.totalTasks}</CardTitle>
            <CardDescription>Total Tasks</CardDescription>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{completionPercentage}%</CardTitle>
            <CardDescription>Completion Rate</CardDescription>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{stats.inProgressTasks}</CardTitle>
            <CardDescription>Tasks In Progress</CardDescription>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl">{stats.highPriorityTasks}</CardTitle>
            <CardDescription>High Priority Tasks</CardDescription>
          </CardHeader>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span>Completed</span>
                  <span>{stats.completedTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>In Progress</span>
                  <span>{stats.inProgressTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${stats.totalTasks > 0 ? (stats.inProgressTasks / stats.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Not Started</span>
                  <span>{stats.notStartedTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-gray-600 h-2.5 rounded-full" 
                    style={{ width: `${stats.totalTasks > 0 ? (stats.notStartedTasks / stats.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <span>High</span>
                  <span>{stats.highPriorityTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-red-600 h-2.5 rounded-full" 
                    style={{ width: `${stats.totalTasks > 0 ? (stats.highPriorityTasks / stats.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Medium</span>
                  <span>{stats.mediumPriorityTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-yellow-600 h-2.5 rounded-full" 
                    style={{ width: `${stats.totalTasks > 0 ? (stats.mediumPriorityTasks / stats.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between mb-1">
                  <span>Low</span>
                  <span>{stats.lowPriorityTasks}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-green-600 h-2.5 rounded-full" 
                    style={{ width: `${stats.totalTasks > 0 ? (stats.lowPriorityTasks / stats.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 