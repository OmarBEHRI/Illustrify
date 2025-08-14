'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Film, User2, CreditCard, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface NavigationProps {
  className?: string;
}

export default function Navigation({ className = '' }: NavigationProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isActive = (path: string) => pathname === path;

  return (
    <header className={`flex items-center justify-between ${className}`}>
      <Link href="/" className="text-xl font-semibold tracking-wide">Illustrify</Link>
      
      <div className="flex items-center gap-8">
        {/* Credits - Left of nav links */}
        <div className="font-semibold inline-flex items-center gap-2 text-white/70">
          <CreditCard className="h-4 w-4"/> {user?.credits ?? 0} credits
        </div>
        
        {/* Navigation Links - Right side */}
        <div className="flex items-center gap-6 text-sm">
          <Link 
            href="/generate" 
            className={`font-semibold nav-link inline-flex items-center gap-2 hover:text-white transition-colors ${
              isActive('/generate') ? 'text-white active' : 'text-white/70'
            }`}
          >
            <Plus className="h-4 w-4"/> Create
          </Link>
          
          <Link 
            href="/gallery" 
            className={`font-semibold nav-link inline-flex items-center gap-2 hover:text-white transition-colors ${
              isActive('/gallery') ? 'text-white active' : 'text-white/70'
            }`}
          >
            <Film className="h-4 w-4"/> Gallery
          </Link>
          
          <Link 
            href="/profile" 
            className={`font-semibold nav-link inline-flex items-center gap-2 hover:text-white transition-colors ${
              isActive('/profile') ? 'text-white active' : 'text-white/70'
            }`}
          >
            <User2 className="h-4 w-4"/> {user?.name ?? 'Guest'}
          </Link>
        </div>
      </div>
    </header>
  );
}