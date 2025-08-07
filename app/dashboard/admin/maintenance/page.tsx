'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { migrateExistingData, ensureIcalFeedsHaveListings } from '@/lib/models';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function MaintenancePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const runMigration = async () => {
    setIsLoading(true);
    try {
      toast.loading('Migrating data...', { id: 'migration' });
      
      // First ensure all feeds have listings
      await ensureIcalFeedsHaveListings();
      
      // Then run the actual migration
      const result = await migrateExistingData();
      setResults(result);
      
      toast.success('Migration completed successfully', { id: 'migration' });
      console.log('Migration result:', result);
    } catch (error) {
      console.error('Migration failed:', error);
      toast.error('Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'migration' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute adminOnly={true}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Database Maintenance</h1>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Data Migration</CardTitle>
            <CardDescription>
              Migrate existing data to the new database structure. This will:
              <ul className="list-disc ml-5 mt-2">
                <li>Create associations between listings and iCal feeds</li>
                <li>Sync booking events from iCal feeds</li>
                <li>Set up the new many-to-many relationship structure</li>
              </ul>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runMigration}
              disabled={isLoading}
              className="mb-4"
            >
              {isLoading ? 'Migrating...' : 'Migrate Data to New Structure'}
            </Button>
            
            {results && (
              <div className="mt-4 p-4 border rounded bg-gray-50">
                <h3 className="font-medium mb-2">Migration Results:</h3>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  );
} 