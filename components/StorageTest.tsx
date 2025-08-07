'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';

export function StorageTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, message]);
    console.log(message);
  };

  const runStorageTest = async () => {
    setIsTesting(true);
    setTestResults([]);
    
    try {
      addResult('🧪 Starting Supabase Storage test...');
      
      // Test 1: List buckets
      addResult('📋 Testing bucket listing...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        addResult(`❌ Bucket listing failed: ${bucketsError.message}`);
      } else {
        addResult(`✅ Found ${buckets?.length || 0} buckets: ${buckets?.map(b => b.id).join(', ')}`);
        
        const jobBucket = buckets?.find(b => b.id === 'job-completions');
        if (jobBucket) {
          addResult(`✅ job-completions bucket found (public: ${jobBucket.public})`);
        } else {
          addResult('❌ job-completions bucket not found');
        }
      }
      
      // Test 2: Check specific bucket
      addResult('🔍 Testing bucket info...');
      const { data: bucketInfo, error: infoError } = await supabase.storage.getBucket('job-completions');
      
      if (infoError) {
        addResult(`❌ Bucket info failed: ${infoError.message}`);
      } else {
        addResult(`✅ Bucket info retrieved: ${JSON.stringify(bucketInfo)}`);
      }
      
      // Test 3: Try a small upload
      addResult('📤 Testing file upload...');
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-completions')
        .upload(`test/test-${Date.now()}.txt`, testFile);
      
      if (uploadError) {
        addResult(`❌ Upload failed: ${uploadError.message}`);
      } else {
        addResult(`✅ Upload successful: ${uploadData.path}`);
        
        // Test 4: Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('job-completions')
          .getPublicUrl(uploadData.path);
        
        addResult(`✅ Public URL: ${publicUrl}`);
        
        // Test 5: Clean up
        addResult('🧹 Cleaning up test file...');
        const { error: deleteError } = await supabase.storage
          .from('job-completions')
          .remove([uploadData.path]);
        
        if (deleteError) {
          addResult(`⚠️ Cleanup warning: ${deleteError.message}`);
        } else {
          addResult('✅ Test file cleaned up');
        }
      }
      
      addResult('🎉 Storage test completed!');
      
    } catch (error) {
      addResult(`💥 Test failed with exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Supabase Storage Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runStorageTest} 
          disabled={isTesting}
          className="w-full"
        >
          {isTesting ? 'Running Test...' : 'Test Storage Setup'}
        </Button>
        
        {testResults.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
            <h3 className="font-medium mb-2">Test Results:</h3>
            <div className="space-y-1 text-sm font-mono">
              {testResults.map((result, index) => (
                <div key={index} className="whitespace-pre-wrap">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 