/**
 * Profile — matches design reference (earnings, reputation, notes)
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { GraduationCap, MapPin, Eye, Download, Grid3x3, List, TrendingUp, Play, Share2, Settings } from 'lucide-react';

const PURCHASED_NOTES = [
  { title: 'Mod...', author: 'By Sarah Williams', icon: '📄' },
  { title: 'Intro ...', author: 'By Jordan Lee', icon: '❓' },
  { title: 'Linea...', author: 'By Dr. Gupta', icon: '📊' },
];

const UPLOADED_NOTES = [
  { tag: 'CS-302', title: 'Advanced Algorithms: Graph Theory', views: '2.4k', downloads: '842', img: 'https://images.unsplash.com/photo-1455849318743-b2233052fcff?w=300&q=80' },
  { tag: 'DS-101', title: 'Data Structures Full Semester Kit', views: '5.1k', downloads: '1.2k', img: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=300&q=80' },
];

export default function Profile() {
  const { username } = useParams();
  const { profile: currentProfile } = useCurrentUser();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isOwn = !username || username === currentProfile?.username;
  const targetProfile = isOwn ? currentProfile : profile;

  useEffect(() => {
    if (isOwn) { setLoading(false); return; }
    base44.entities.UserProfile.filter({ username })
      .then(results => setProfile(results[0] || null))
      .finally(() => setLoading(false));
  }, [username, isOwn]);

  if (loading) return <ProfileSkeleton />;

  const displayName = targetProfile?.display_name || 'Alex Chen';
  const reputation = 9.8;

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      {/* Profile Header */}
      <div className="bg-white border border-border rounded-2xl p-6 mb-5 flex items-start gap-6">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar className="w-28 h-28 border-4 border-white shadow-md">
            <AvatarImage src={targetProfile?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-3xl font-jakarta">
              {displayName[0]}
            </AvatarFallback>
          </Avatar>
          {isOwn && (
            <button className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow">
              <Settings className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="font-jakarta font-bold text-3xl text-foreground">{displayName}</h1>
                <Badge className="bg-emerald-500 text-white rounded-full gap-1.5 px-3 py-1">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  Level 42
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mb-3">
                {targetProfile?.bio || 'Senior Computer Science Major @ Stanford University. Expert in Algorithms and Distributed Systems. Top 1% Note Contributor.'}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" /> Class of 2024
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {targetProfile?.country || 'Palo Alto, CA'}
                </span>
              </div>
            </div>
            {isOwn && (
              <div className="flex gap-2 flex-shrink-0">
                <Button variant="outline" className="rounded-xl gap-2">
                  <Share2 className="w-4 h-4" /> Share Profile
                </Button>
                <Button className="gradient-brand text-white rounded-xl gap-2">
                  <Settings className="w-4 h-4" /> Edit Settings
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Earnings + Uploaded Notes */}
        <div className="lg:col-span-2 space-y-5">
          {/* Earnings Summary */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-jakarta font-semibold text-base text-foreground">Earnings Summary</h2>
                <p className="text-xs text-primary mt-0.5">Your academic monetization progress</p>
              </div>
              <Button variant="ghost" size="sm" className="text-primary text-xs font-medium">View History</Button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Total Revenue</p>
                <p className="font-jakarta font-bold text-xl text-primary">$1,248.50</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                  <span className="text-[10px] text-emerald-600 font-medium">+12% this month</span>
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Note Sales</p>
                <p className="font-jakarta font-bold text-xl text-foreground">342</p>
                <p className="text-[10px] text-muted-foreground mt-1">Top seller: DS101</p>
              </div>
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Payout Status</p>
                <p className="font-jakarta font-bold text-xl text-foreground">$142.00</p>
                <div className="h-1 bg-border rounded-full mt-2 mb-1">
                  <div className="h-full bg-primary rounded-full" style={{ width: '60%' }} />
                </div>
                <p className="text-[10px] text-muted-foreground">Next payout in 4 days</p>
              </div>
            </div>
          </div>

          {/* Uploaded Notes */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-jakarta font-semibold text-base text-foreground">Uploaded Notes</h2>
              <div className="flex gap-1">
                <button className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {UPLOADED_NOTES.map((note, i) => (
                <div key={i} className="group cursor-pointer rounded-xl overflow-hidden border border-border hover:shadow-md transition-all">
                  <div className="relative h-28 overflow-hidden">
                    <img src={note.img} alt={note.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute top-2 left-2">
                      <span className="text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded">{note.tag}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-foreground line-clamp-2 mb-2">{note.title}</h3>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{note.views}</span>
                      <span className="flex items-center gap-1"><Download className="w-3 h-3" />{note.downloads}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Reputation + Purchased */}
        <div className="space-y-5">
          {/* Reputation Score */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <h2 className="font-jakarta font-semibold text-base text-foreground mb-0.5">Reputation Score</h2>
            <p className="text-xs text-muted-foreground mb-4">Trusted contributor status</p>
            <div className="flex justify-center mb-4">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 40 * (reputation / 10)} ${2 * Math.PI * 40}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-jakarta font-bold text-2xl text-foreground">{reputation}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wide">TOP RATED</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Accuracy', value: '99%', positive: true },
                { label: 'Response Rate', value: '2h avg', positive: null },
                { label: 'Upvotes', value: '4.8k', positive: null },
              ].map(stat => (
                <div key={stat.label} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                  <span className={`text-xs font-semibold ${stat.positive ? 'text-emerald-600' : 'text-foreground'}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Purchased Notes */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-jakarta font-semibold text-sm text-foreground">Purchased</h2>
              <Badge variant="secondary" className="text-xs">18 Total</Badge>
            </div>
            <div className="space-y-3">
              {PURCHASED_NOTES.map((note, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-base flex-shrink-0">{note.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{note.title}</p>
                    <p className="text-[10px] text-muted-foreground">{note.author}</p>
                  </div>
                  <button className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center">
                    <Download className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4 rounded-xl text-xs font-medium">
              Browse More Resources
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="p-6 max-w-5xl mx-auto w-full space-y-5">
      <div className="bg-white border border-border rounded-2xl p-6 flex gap-6">
        <Skeleton className="w-28 h-28 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full max-w-sm" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    </div>
  );
}