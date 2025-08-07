'use client';
import UniversalCalendarPage from '@/components/UniversalCalendarPage';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function CalendarPage() {
  const { user, loading } = useAuth();
  const [debugMode, setDebugMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  if (loading) return null;
  
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };
  
  return (
    <div>
      {(user?.role === 'admin' || user?.role === 'sub-admin') && (
        <div className="p-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDebugMode(!debugMode)}
              className="mb-4"
            >
              {debugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mb-4"
            >
              Refresh Calendar
            </Button>
          </div>
        </div>
      )}
      
      <UniversalCalendarPage 
        key={refreshKey}
        hasAccess={user?.role === 'admin' || user?.role === 'sub-admin'} 
        noAccessMessage="You do not have permission to view the calendar. Only admins and sub-admins can access this page."
        debugMode={debugMode}
      />
    </div>
  );
}