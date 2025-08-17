'use client';

import Link from 'next/link';
import { Film, User2, CreditCard, Plus, LogOut, Mail, Coins, Settings, Activity, Calendar, Star, TrendingUp, Clock, Video as VideoIcon } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { pbHelpers, Video } from '@/lib/pocketbase';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const [userVideos, setUserVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (user) {
          const videos = await pbHelpers.getUserVideos(user.id);
          setUserVideos(videos);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleSignOut = () => {
    signOut();
    window.location.href = '/';
  };

  return (
    <PageTemplate>
      <section className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 p-6 rounded-xl bg-white/5 border border-white/15">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Welcome back, {user?.name ?? 'Guest'}</h1>
              <p className="text-white/70 text-sm">Manage your account and create videos</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/15">
                <Coins className="h-4 w-4 text-white/70 mx-auto mb-1" />
                <p className="text-lg font-medium">{user?.credits ?? 0}</p>
                <p className="text-xs text-white/50">Credits</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5 border border-white/15">
                <VideoIcon className="h-4 w-4 text-white/70 mx-auto mb-1" />
                <p className="text-lg font-medium">{userVideos.length}</p>
                <p className="text-xs text-white/50">Videos</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-8 space-y-8">
            {/* Account Overview */}
            <div className="rounded-xl bg-white/5 border border-white/15 p-5">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <User2 className="h-4 w-4 text-white/70"/>
                Account Overview
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-3 w-3 text-white/60" />
                    <p className="text-xs text-white/60">Email Address</p>
                  </div>
                  <p className="font-medium text-sm">{user?.email ?? 'Not signed in'}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3 w-3 text-white/60" />
                    <p className="text-xs text-white/60">Member Since</p>
                  </div>
                  <p className="font-medium text-sm">January 2024</p>
                </div>
              </div>
            </div>

            {/* Usage Statistics */}
            <div className="rounded-xl bg-white/5 border border-white/15 p-5">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-white/70"/>
                Usage Statistics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                  <VideoIcon className="h-4 w-4 text-white/70 mx-auto mb-2" />
                  <p className="text-xl font-medium mb-1">{userVideos.length}</p>
                  <p className="text-xs text-white/60">Videos Created</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                  <Clock className="h-4 w-4 text-white/70 mx-auto mb-2" />
                  <p className="text-xl font-medium mb-1">24</p>
                  <p className="text-xs text-white/60">Hours Saved</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-white/5 border border-white/10">
                  <Coins className="h-4 w-4 text-white/70 mx-auto mb-2" />
                  <p className="text-xl font-medium mb-1">{user?.credits ?? 0}</p>
                  <p className="text-xs text-white/60">Credits Available</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-xl bg-white/5 border border-white/15 p-5">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-white/70"/>
                Recent Activity
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <VideoIcon className="h-3 w-3 text-white/60" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Created "Sunset Adventure" video</p>
                    <p className="text-xs text-white/60">2 hours ago</p>
                  </div>
                  <Star className="h-3 w-3 text-white/50" />
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Coins className="h-3 w-3 text-white/60" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Added 50 credits to account</p>
                    <p className="text-xs text-white/60">1 day ago</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Film className="h-3 w-3 text-white/60" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Viewed gallery collection</p>
                    <p className="text-xs text-white/60">3 days ago</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Actions */}
            <div className="rounded-xl bg-white/5 border border-white/15 p-5">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-white/70"/>
                Quick Actions
              </h3>
              <div className="space-y-2">
                <Link href="/video" className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2">
                  <Plus className="h-4 w-4 text-white/70" />
                  <div>
                    <p className="font-medium text-sm">Create Video</p>
                    <p className="text-xs text-white/60">Start a new project</p>
                  </div>
                </Link>
                <Link href="/gallery" className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2">
                  <Film className="h-4 w-4 text-white/70" />
                  <div>
                    <p className="font-medium text-sm">View Gallery</p>
                    <p className="text-xs text-white/60">Browse your videos</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Credits Management */}
            <div className="rounded-xl bg-white/5 border border-white/15 p-5">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-white/70"/>
                Manage Credits
              </h3>
              <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-white/70" />
                  <div>
                    <p className="text-xs text-white/60">Current Balance</p>
                    <p className="text-lg font-medium">{user?.credits ?? 0}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <form action="/api/credits/add" method="post">
                  <input type="hidden" name="amount" value="50" />
                  <button className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-3 w-3 text-white/70" />
                      <span className="font-medium text-sm">50 Credits</span>
                    </div>
                    <span className="text-xs text-white/60">$5.00</span>
                  </button>
                </form>
                <form action="/api/credits/add" method="post">
                  <input type="hidden" name="amount" value="200" />
                  <button className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-3 w-3 text-white/70" />
                      <span className="font-medium text-sm">200 Credits</span>
                    </div>
                    <span className="text-xs text-white/60">$18.00</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Account Settings */}
            <div className="rounded-xl bg-white/5 border border-white/15 p-5">
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Settings className="h-4 w-4 text-white/70"/>
                Account Settings
              </h3>
              <div className="space-y-2">
                <button className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 text-left">
                  <Settings className="h-3 w-3 text-white/60" />
                  <span className="font-medium text-sm">Account Preferences</span>
                </button>
                <button 
                  onClick={handleSignOut}
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition-colors flex items-center gap-2"
                >
                  <LogOut className="h-3 w-3 text-white/60" />
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageTemplate>
  );
}


