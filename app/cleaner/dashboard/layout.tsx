'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useCleanerAuth } from '@/lib/cleaner-auth';

export default function CleanerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { cleaner } = useCleanerAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications
  useEffect(() => {
    const loadNotifications = async () => {
      if (!cleaner?.uuid) return;

      try {
        const response = await fetch(`/api/notifications?cleaner_uuid=${cleaner.uuid}`);
        const data = await response.json();
        
        if (data.success) {
          setNotifications(data.notifications);
          setUnreadCount(data.notifications.filter((n: any) => !n.read).length);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
    // Poll for new notifications every minute
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [cleaner?.uuid]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={toggleSidebar}
          className="bg-white p-2 rounded-md shadow-md border border-gray-200 hover:bg-gray-50"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:w-56
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col py-8 px-4
      `}>
        {/* Mobile close button */}
        <div className="lg:hidden flex justify-end mb-4">
          <button
            onClick={closeSidebar}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add notification count to the sidebar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Cleaner Portal</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Add notifications section */}
        {notifications.length > 0 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Notifications</h3>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((notification) => (
                <div
                  key={notification.id}
                  className={`text-xs p-2 rounded ${notification.read ? 'bg-gray-100' : 'bg-blue-50'}`}
                >
                  {notification.message}
                </div>
              ))}
            </div>
          </div>
        )}
        <nav className="flex flex-col gap-2">
          <Link href="/cleaner/dashboard" legacyBehavior>
            <a 
              className={`px-3 py-2 rounded-md font-medium text-sm transition-colors ${pathname === '/cleaner/dashboard' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              onClick={closeSidebar}
            >
              Dashboard
            </a>
          </Link>
          <Link href="/cleaner/payment-report" legacyBehavior>
            <a 
              className={`px-3 py-2 rounded-md font-medium text-sm transition-colors ${pathname === '/cleaner/payment-report' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
              onClick={closeSidebar}
            >
              Payment Report
            </a>
          </Link>
          {cleaner?.role === 'editor' && (
            <Link href="/cleaner/calendar" legacyBehavior>
              <a 
                className={`px-3 py-2 rounded-md font-medium text-sm transition-colors ${pathname === '/cleaner/calendar' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                onClick={closeSidebar}
              >
                Calendar
              </a>
            </Link>
          )}
        </nav>
        <div className="flex-1" />
        <div className="text-xs text-gray-400 mt-8">
          Logged in as: <span className="font-semibold text-gray-600">{cleaner?.name}</span>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen lg:ml-0">
        {/* Add top padding on mobile to account for the hamburger button */}
        <div className="lg:hidden h-16"></div>
        {children}
      </main>
    </div>
  );
} 