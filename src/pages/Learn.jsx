/**
 * Study Hub — matches design reference
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Eye, Download, TrendingUp, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SUBJECT_IMAGES = {
  ENGINEERING: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80',
  MEDICINE: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&q=80',
  BUSINESS: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&q=80',
  LAW: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&q=80',
  TECH: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80',
  SOCIOLOGY: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80',
};

const MOCK_NOTES = [
  { id: '1', tag: 'ENGINEERING', title: 'Thermodynamics: Heat Transfer Cycles', course: 'MEE 301', instructor: 'Dr. Adebayo', author: 'Samuel Okafor', price: 2500, free: false, img: SUBJECT_IMAGES.ENGINEERING },
  { id: '2', tag: 'MEDICINE', title: 'Human Anatomy: Nervous System', course: 'ANA 204', instructor: 'Prof. Nwosu', author: 'Chiamaka E.', price: 0, free: true, img: SUBJECT_IMAGES.MEDICINE },
  { id: '3', tag: 'BUSINESS', title: 'Principles of Microeconomics', course: 'ECO 101', instructor: 'Dept. Faculty', author: 'Daniel Olatunji', price: 1200, free: false, img: SUBJECT_IMAGES.BUSINESS },
  { id: '4', tag: 'LAW', title: 'Constitutional Law Principles', course: 'LAW 201', instructor: 'Prof. Balogun', author: 'Kemi Adeyemi', price: 800, free: false, img: SUBJECT_IMAGES.LAW },
  { id: '5', tag: 'TECH', title: 'Data Structures & Algorithms', course: 'CSC 301', instructor: 'Dr. Chukwu', author: 'Tunde Williams', price: 500, free: false, img: SUBJECT_IMAGES.TECH },
  { id: '6', tag: 'SOCIOLOGY', title: 'Urban Development Patterns', course: 'SOC 205', instructor: 'Dr. Afolabi', author: 'Grace Eze', price: 300, free: false, img: SUBJECT_IMAGES.SOCIOLOGY },
];

const TAG_COLORS = {
  ENGINEERING: 'bg-blue-500/90',
  MEDICINE: 'bg-teal-500/90',
  BUSINESS: 'bg-purple-500/90',
  LAW: 'bg-amber-500/90',
  TECH: 'bg-indigo-500/90',
  SOCIOLOGY: 'bg-rose-500/90',
};

export default function Learn() {
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('all');
  const [subject, setSubject] = useState('all');
  const [level, setLevel] = useState('any');

  const filtered = MOCK_NOTES.filter(n => {
    if (!search) return true;
    return n.title.toLowerCase().includes(search.toLowerCase()) || n.tag.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-jakarta font-bold text-3xl text-foreground">Study Hub</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Access over 5,000 peer-reviewed study notes.</p>
        </div>
        <Badge className="bg-emerald-500 text-white hover:bg-emerald-600 gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold">
          <TrendingUp className="w-3.5 h-3.5" /> 12 New Notes Today
        </Badge>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-32">
          <p className="text-xs text-muted-foreground mb-1">Course</p>
          <Select value={course} onValueChange={setCourse}>
            <SelectTrigger className="h-9 border-0 bg-muted rounded-lg text-sm">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              <SelectItem value="csc301">CSC 301</SelectItem>
              <SelectItem value="eco101">ECO 101</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-32">
          <p className="text-xs text-muted-foreground mb-1">Subject</p>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-9 border-0 bg-muted rounded-lg text-sm">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="engineering">Engineering</SelectItem>
              <SelectItem value="medicine">Medicine</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-28">
          <p className="text-xs text-muted-foreground mb-1">Level</p>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger className="h-9 border-0 bg-muted rounded-lg text-sm">
              <SelectValue placeholder="Any Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Level</SelectItem>
              <SelectItem value="100">100 Level</SelectItem>
              <SelectItem value="200">200 Level</SelectItem>
              <SelectItem value="300">300 Level</SelectItem>
              <SelectItem value="400">400 Level</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-shrink-0 mt-4">
          <Button variant="outline" className="h-9 rounded-lg text-sm gap-2">
            <Search className="w-3.5 h-3.5" /> Reset Filters
          </Button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(note => (
          <div key={note.id} className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer group">
            {/* Image */}
            <div className="relative h-40 overflow-hidden">
              <img src={note.img} alt={note.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute top-3 left-3">
                <span className={`text-[10px] font-bold text-white px-2 py-1 rounded-full ${TAG_COLORS[note.tag] || 'bg-gray-500/80'}`}>
                  {note.tag}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <h3 className="font-jakarta font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1">{note.title}</h3>
              <p className="text-xs text-muted-foreground">{note.course} • {note.instructor}</p>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                    {note.author[0]}
                  </div>
                  <span className="text-xs text-muted-foreground">{note.author.split(' ')[0]}</span>
                </div>
                {note.free ? (
                  <span className="text-sm font-bold text-emerald-600">Free</span>
                ) : (
                  <span className="text-sm font-bold text-primary">₦{note.price.toLocaleString()}</span>
                )}
              </div>

              <Button className="w-full mt-3 gradient-brand text-white rounded-xl font-semibold py-2 text-sm">
                View Note
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}