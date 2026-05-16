/**
 * Home — Dashboard (matches design reference: Daily Overview)
 */
import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useWallet } from '@/hooks/useWallet';
import { base44 } from '@/api/base44Client';
import { Upload, HelpCircle, Smartphone, ArrowUpRight, History, CheckSquare, Square, TrendingUp, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const MOCK_TASKS = [
  { id: 1, label: 'Submit CSC 301 Assignment', meta: 'Due at 11:59 PM', done: false },
  { id: 2, label: 'Review Marketing 101 Notes', meta: '20 min reading', done: false },
  { id: 3, label: 'Recharge Data Plan', meta: 'Completed 2h ago', done: true },
];

const TRENDING_NOTES = [
  { tag: 'NEW', tag2: 'VERIFIED', title: 'Data Structures Summary', desc: 'Complete guide to Linked Lists & Trees...', price: '₦ 500', views: '1.2k', color: 'bg-blue-50', img: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&q=80' },
  { tag: 'HOT', title: 'Architecture Exam Prep', desc: 'Mid-term revision with past questions...', price: '₦ 750', views: '3.8k', color: 'bg-gray-900', img: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=300&q=80', dark: true },
  { tag: 'CLASSIC', title: 'Algorithms Cheat Sheet', desc: 'Quick reference for Big O notation...', price: '₦ 200', views: '5.1k', color: 'bg-amber-50', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&q=80' },
];

export default function Home() {
  const { profile } = useCurrentUser();
  const { balance, loading: walletLoading, formatAmount } = useWallet();
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const streak = 14;
  const streakGoal = 17;
  const streakProgress = (streak / streakGoal) * 100;

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const firstName = profile?.display_name?.split(' ')[0] || 'Alex';

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest">WELCOME BACK, {firstName.toUpperCase()}</p>
          <h1 className="font-jakarta font-bold text-2xl sm:text-3xl text-foreground mt-0.5">Daily Overview</h1>
        </div>
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] sm:text-xs font-semibold cursor-pointer shrink-0">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="hidden sm:inline">12 New Notes Today</span>
          <span className="sm:hidden">12 New</span>
        </Badge>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Upload, label: 'Upload Note' },
          { icon: HelpCircle, label: 'Ask Question' },
          { icon: Smartphone, label: 'Recharge' },
        ].map(({ icon: Icon, label }) => (
          <button key={label} className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2.5 p-3 sm:p-4 bg-white border border-border rounded-2xl hover:bg-muted/50 transition-all active:scale-95">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-[11px] sm:text-sm font-medium text-foreground text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Wallet + Streak Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Wallet */}
        <div className="bg-primary rounded-2xl p-4 sm:p-5 text-white">
          <p className="text-xs font-medium text-white/70 uppercase tracking-wide mb-1">Wallet Balance</p>
          {walletLoading ? (
            <Skeleton className="h-9 w-36 bg-white/20 mb-4" />
          ) : (
            <p className="font-jakarta font-bold text-2xl sm:text-2xl tracking-tight mb-4">
              {formatAmount(balance.available)}
            </p>
          )}
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              <ArrowUpRight className="w-3.5 h-3.5" /> Withdraw
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              <History className="w-3.5 h-3.5" /> History
            </button>
          </div>
        </div>

        {/* Study Streak */}
        <div className="bg-white border border-border rounded-2xl p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground mb-1">Study Streak</p>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="font-jakarta font-bold text-4xl text-foreground">{streak}</span>
            <span className="text-sm text-muted-foreground font-medium">DAYS STRONG</span>
          </div>
          <div className="flex gap-1 mb-2 mt-3">
            {Array(7).fill(0).map((_, i) => (
              <div key={i} className={`h-2 flex-1 rounded-full ${i < 5 ? 'bg-emerald-500' : 'bg-border'}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Keep it up! 3 more days to your next bonus</p>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="bg-white border border-border rounded-2xl p-4 sm:p-5">
        <h2 className="font-jakarta font-semibold text-base text-foreground mb-4">Today's Tasks</h2>
        <div className="space-y-4">
          {tasks.map(task => (
            <div key={task.id} className="flex items-start gap-3 cursor-pointer" onClick={() => toggleTask(task.id)}>
              {task.done
                ? <CheckSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                : <Square className="w-5 h-5 text-border flex-shrink-0 mt-0.5" />
              }
              <div className="min-w-0">
                <p className={`text-sm font-medium ${task.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{task.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trending Notes */}
      <div>
        <h2 className="font-jakarta font-semibold text-base text-foreground mb-3">Trending in CSC 301</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {TRENDING_NOTES.map((note, i) => (
            <div key={i} className="bg-white border border-border rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow group flex sm:block">
              <div className="relative w-28 sm:w-auto h-auto sm:h-32 flex-shrink-0 overflow-hidden">
                <img src={note.img} alt={note.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute top-2 left-2 flex gap-1">
                  {note.tag && <span className="text-[9px] font-bold bg-black/70 text-white px-1.5 py-0.5 rounded uppercase tracking-wide">{note.tag}</span>}
                  {note.tag2 && <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded uppercase tracking-wide">{note.tag2}</span>}
                </div>
              </div>
              <div className="p-3 flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground line-clamp-1">{note.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1">{note.desc}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-primary">{note.price}</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Eye className="w-3 h-3" />{note.views}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}