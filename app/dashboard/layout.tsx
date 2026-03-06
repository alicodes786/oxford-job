'use client';

import { Sidebar } from '@/components/Sidebar';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Close sidebar when window is resized to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar 
        isMobileSidebarOpen={isMobileSidebarOpen} 
        setIsMobileSidebarOpen={setIsMobileSidebarOpen} 
      />
      
      <div className="flex-1 overflow-auto">
        {/* Mobile header with hamburger menu */}
        <div className="md:hidden sticky top-0 z-30 bg-white shadow-sm p-3 flex justify-end">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsMobileSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        
        <main>
          {children}
        </main>
      </div>
    </div>
  );
} 