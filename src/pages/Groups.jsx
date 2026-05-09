/**
 * Chat/Groups — matches design reference (Discord-style messaging)
 */
import { useState } from 'react';
import { Search, Plus, Hash, Users, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const GROUP_CHATS = [
  { id: '1', name: 'Computer Science 101', abbr: 'CS', color: 'bg-primary', lastMsg: 'Sarah: Anyone finished the lab?', time: '10:42 AM', unread: 3, live: true },
  { id: '2', name: 'History of Art', abbr: 'HS', color: 'bg-amber-500', lastMsg: 'Alex: The slides are uploaded!', time: '9:15 AM', unread: 0, live: false },
];

const DIRECT_MESSAGES = [
  { id: 'd1', name: 'Jordan Smith', abbr: 'J', color: 'bg-emerald-500', lastMsg: 'See you at the library...', time: '8:30 AM', avatar: null, online: true },
  { id: 'd2', name: 'David Chen', abbr: 'D', color: 'bg-blue-500', lastMsg: "Thanks for the notes!", time: 'Yesterday', avatar: null, online: false },
];

const ONLINE_MEMBERS = [
  { name: 'Felix (You)', abbr: 'F', color: 'bg-primary' },
  { name: 'Sarah Jenkins', abbr: 'S', color: 'bg-pink-500' },
  { name: 'Alex Rivera', abbr: 'A', color: 'bg-purple-500' },
  { name: 'Cooper M.', abbr: 'C', color: 'bg-amber-500' },
];

const OFFLINE_MEMBERS = [
  { name: 'Nina Vo', abbr: 'N', color: 'bg-gray-400' },
  { name: 'Marcus Wright', abbr: 'M', color: 'bg-gray-400' },
];

const MESSAGES = [
  { id: 1, sender: 'Sarah Jenkins', time: '10:42 AM', text: "Has anyone finished the lab session from Tuesday? I'm having trouble with the binary search implementation in Python.", mine: false, abbr: 'S', color: 'bg-pink-500' },
  { id: 2, sender: 'You', time: '10:44 AM', text: "Hey Sarah! I just finished it. The trick is to ensure you're updating the low index with mid + 1. I can share my logic if you want?", mine: true },
  { id: 3, sender: 'Alex Rivera', time: '10:46 AM', text: "Yes please! I'm struggling with the edge cases where the target isn't in the list at all. 😅", mine: false, abbr: 'A', color: 'bg-purple-500' },
];

export default function Groups() {
  const [activeChat, setActiveChat] = useState(GROUP_CHATS[0]);
  const [message, setMessage] = useState('');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Chat List */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-jakarta font-semibold text-base text-foreground mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search workspaces..." className="pl-8 h-8 text-xs rounded-xl" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-1">
          {/* Group Chats */}
          {GROUP_CHATS.map(chat => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${activeChat?.id === chat.id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
            >
              <div className={`w-9 h-9 rounded-xl ${chat.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {chat.abbr}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className={`text-sm font-semibold truncate ${activeChat?.id === chat.id ? 'text-primary' : 'text-foreground'}`}>{chat.name}</p>
                  {chat.live && <Badge className="text-[8px] bg-red-500 text-white px-1.5 py-0 h-4 rounded font-bold">LIVE</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMsg}</p>
              </div>
              {chat.unread > 0 && (
                <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold text-white">{chat.unread}</span>
                </div>
              )}
            </button>
          ))}

          <div className="pt-3 pb-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1">Direct Messages</p>
          </div>

          {DIRECT_MESSAGES.map(dm => (
            <button key={dm.id} className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left">
              <div className="relative flex-shrink-0">
                <div className={`w-9 h-9 rounded-full ${dm.color} flex items-center justify-center text-white text-sm font-bold`}>{dm.abbr}</div>
                {dm.online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{dm.name}</p>
                <p className="text-xs text-muted-foreground truncate">{dm.lastMsg}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Pro Features */}
        <div className="p-3 border-t border-border">
          <div className="bg-foreground rounded-xl p-3.5">
            <p className="text-[9px] font-bold text-primary uppercase tracking-widest mb-1">Pro Features</p>
            <p className="text-xs text-white/80 mb-2.5 leading-relaxed">Get unlimited storage for study notes.</p>
            <Button size="sm" className="w-full gradient-brand text-white rounded-lg text-xs font-semibold">Upgrade Now</Button>
          </div>
        </div>
      </div>

      {/* Center: Chat View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl ${activeChat?.color || 'bg-primary'} flex items-center justify-center text-white text-xs font-bold`}>
              {activeChat?.abbr}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">{activeChat?.name}</h3>
              <p className="text-xs text-emerald-500 font-medium">● 42 students active</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Search className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Hash className="w-4 h-4" /></button>
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"><Users className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          <div className="flex justify-center">
            <span className="text-[10px] text-muted-foreground bg-muted px-3 py-1 rounded-full font-medium uppercase tracking-wide">Today</span>
          </div>

          {MESSAGES.map(msg => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.mine ? 'flex-row-reverse' : ''}`}>
              {!msg.mine && (
                <div className={`w-8 h-8 rounded-full ${msg.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5`}>
                  {msg.abbr}
                </div>
              )}
              <div className={`max-w-[65%] ${msg.mine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                {!msg.mine && <p className="text-xs font-semibold text-foreground">{msg.sender} <span className="text-muted-foreground font-normal ml-1">{msg.time}</span></p>}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.mine ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-border text-foreground rounded-tl-sm'}`}>
                  {msg.text}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex gap-1">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />)}
            </div>
            Sarah is typing...
          </div>
        </div>

        {/* Message Input */}
        <div className="flex-shrink-0 border-t border-border bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Plus className="w-4 h-4" />
            </button>
            <Input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Message ${activeChat?.name}...`}
              className="flex-1 rounded-xl border-border"
            />
            <button className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              😊
            </button>
          </div>
          <div className="flex gap-3 px-10">
            {['FILE', 'IMAGE', 'SNIPPET'].map(t => (
              <button key={t} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <span>⌘</span> {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Members */}
      <div className="w-52 flex-shrink-0 bg-white border-l border-border overflow-y-auto scrollbar-hide p-4">
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Online — {ONLINE_MEMBERS.length}</p>
            <div className="space-y-2">
              {ONLINE_MEMBERS.map(m => (
                <div key={m.name} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full ${m.color} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>{m.abbr}</div>
                  <span className="text-xs text-foreground font-medium truncate">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Offline — 30</p>
            <div className="space-y-2">
              {OFFLINE_MEMBERS.map(m => (
                <div key={m.name} className="flex items-center gap-2 opacity-50">
                  <div className={`w-7 h-7 rounded-full ${m.color} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>{m.abbr}</div>
                  <span className="text-xs text-foreground font-medium truncate">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Activity */}
        <div className="mt-6 bg-muted rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-primary" />
            <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Live Activity</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">Most students are discussing <span className="text-primary font-medium">#final-prep</span> right now.</p>
          <Button size="sm" variant="outline" className="w-full mt-2 text-xs rounded-lg">Join Discussion</Button>
        </div>
      </div>
    </div>
  );
}