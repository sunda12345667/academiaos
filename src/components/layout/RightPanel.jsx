/**
 * RightPanel — Community Pulse sidebar (matches design reference)
 */
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, Users, Clock, Circle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const TRENDING_NOTES = [
  { title: 'Advanced Thermodynamics Summary', meta: '240 downloads this week' },
  { title: 'Constitutional Law Case Studies', meta: '115 downloads this week' },
];

const RECENT_ACTIVITY = [
  { text: '@Sarah_B just topped up ₦1,000', time: '2 mins ago', color: 'bg-primary' },
  { text: '@Mike_Law shared a study resource', time: '15 mins ago', color: 'bg-emerald-500' },
];

export default function RightPanel() {
  const [onlineCount] = useState(42);

  return (
    <div className="flex flex-col h-full bg-white border-l border-border overflow-y-auto scrollbar-hide">
      <div className="p-5 space-y-6">
        {/* Header */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Community Pulse</p>
        </div>

        {/* Online Students */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Online Students</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {['bg-blue-400', 'bg-purple-400', 'bg-pink-400'].map((c, i) => (
                <div key={i} className={`w-8 h-8 rounded-full ${c} border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                  {['A', 'B', 'C'][i]}
                </div>
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium">+{onlineCount}</span>
          </div>
        </div>

        {/* Trending Notes */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trending Notes</span>
          </div>
          <div className="space-y-3">
            {TRENDING_NOTES.map((note, i) => (
              <div key={i} className="cursor-pointer hover:opacity-80 transition-opacity">
                <p className="text-sm font-medium text-foreground leading-snug">{note.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{note.meta}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Activity</span>
          </div>
          <div className="space-y-3">
            {RECENT_ACTIVITY.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0 mt-1.5`} />
                <div>
                  <p className="text-xs text-foreground leading-snug">{item.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}