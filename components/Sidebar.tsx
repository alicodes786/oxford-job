'use client';

import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Briefcase, LogOut, Menu, X, AlertCircle, Calendar, Home, Users, Database, FileText, CreditCard, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';

interface SidebarProps {
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
}

export function Sidebar({ isMobileSidebarOpen, setIsMobileSidebarOpen }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!user || !mounted) return null;
  
  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true" 
        />
      )}
    
      {/* Sidebar */}
      <div 
        className={`
          fixed top-0 bottom-0 left-0 z-50 transition-transform duration-300 ease-in-out
          w-64 border-r bg-slate-50 flex flex-col md:static md:z-0 md:translate-x-0
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Dashboard</h1>
            <p className="text-sm text-gray-500">{user.username} ({user.role})</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-6">
            {/* Group 1: Jobs, Analytics, Status Updates */}
            {user.role !== 'sub-admin' && (
              <div>
                <h3 className="mb-2 text-xs uppercase font-semibold text-gray-500 px-2">Jobs & Analytics</h3>
                <li>
                  <Link href="/dashboard" passHref>
                    <Button 
                      variant={pathname === '/dashboard' ? 'default' : 'ghost'} 
                      className="w-full justify-start"
                      onClick={() => setIsMobileSidebarOpen(false)}
                    >
                      <Briefcase className="mr-2 h-4 w-4" />
                      Jobs
                    </Button>
                  </Link>
                </li>
                
                {user.role === 'admin' && (
                  <>
                    <li>
                      <Link href="/dashboard/analytics" passHref>
                        <Button 
                          variant={pathname === '/dashboard/analytics' ? 'default' : 'ghost'} 
                          className="w-full justify-start"
                          onClick={() => setIsMobileSidebarOpen(false)}
                        >
                          <BarChart className="mr-2 h-4 w-4" />
                          Analytics
                        </Button>
                      </Link>
                    </li>
                    <li>
                      <Link href="/dashboard/status-updates" passHref>
                        <Button 
                          variant={pathname === '/dashboard/status-updates' ? 'default' : 'ghost'} 
                          className="w-full justify-start"
                          onClick={() => setIsMobileSidebarOpen(false)}
                        >
                          <AlertCircle className="mr-2 h-4 w-4" />
                          Status Updates
                        </Button>
                      </Link>
                    </li>
                  </>
                )}
              </div>
            )}
            
            {/* Group 2: Calendar, Listings, Cleaners */}
            {(user.role === 'admin' || user.role === 'sub-admin') && (
              <div>
                <h3 className="mb-2 text-xs uppercase font-semibold text-gray-500 px-2">CHAI & BISCUIT</h3>
                {user.role === 'admin' && (
                  <>

                    <li>
                      <Link href="/dashboard/reports" passHref>
                        <Button 
                          variant={pathname === '/dashboard/reports' ? 'default' : 'ghost'} 
                          className="w-full justify-start"
                          onClick={() => setIsMobileSidebarOpen(false)}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Payment Reports
                        </Button>
                      </Link>
                    </li>
                    <li>
                      <Link href="/dashboard/cleaner-reports" passHref>
                        <Button 
                          variant={pathname === '/dashboard/cleaner-reports' ? 'default' : 'ghost'} 
                          className="w-full justify-start"
                          onClick={() => setIsMobileSidebarOpen(false)}
                        >
                          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Cleaner Reports
                        </Button>
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <Link href="/dashboard/calendar" passHref>
                    <Button 
                      variant={pathname === '/dashboard/calendar' ? 'default' : 'ghost'} 
                      className="w-full justify-start"
                      onClick={() => setIsMobileSidebarOpen(false)}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      Calendar
                    </Button>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/listings" passHref>
                    <Button 
                      variant={pathname === '/dashboard/listings' ? 'default' : 'ghost'} 
                      className="w-full justify-start"
                      onClick={() => setIsMobileSidebarOpen(false)}
                    >
                      <Home className="mr-2 h-4 w-4" />
                      Listings
                    </Button>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/cleaners" passHref>
                    <Button 
                      variant={pathname === '/dashboard/cleaners' ? 'default' : 'ghost'} 
                      className="w-full justify-start"
                      onClick={() => setIsMobileSidebarOpen(false)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Cleaners
                    </Button>
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/bank-accounts" passHref>
                    <Button 
                      variant={pathname === '/dashboard/bank-accounts' ? 'default' : 'ghost'} 
                      className="w-full justify-start"
                      onClick={() => setIsMobileSidebarOpen(false)}
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Bank Accounts
                    </Button>
                  </Link>
                </li>
                {user.role === 'admin' && (
                  <li>
                    <Link href="/dashboard/users" passHref>
                      <Button 
                        variant={pathname === '/dashboard/users' ? 'default' : 'ghost'} 
                        className="w-full justify-start"
                        onClick={() => setIsMobileSidebarOpen(false)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Users
                      </Button>
                    </Link>
                  </li>
                )}
                <li>
                  <Link href="/dashboard/sync-logs" passHref>
                    <Button 
                      variant={pathname === '/dashboard/sync-logs' ? 'default' : 'ghost'} 
                      className="w-full justify-start"
                      onClick={() => setIsMobileSidebarOpen(false)}
                    >
                      <Database className="mr-2 h-4 w-4" />
                      Sync Logs
                    </Button>
                  </Link>
                </li>
              </div>
            )}
          </ul>
        </nav>
        
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
} 