/**
 * Learn — Course discovery and learning hub
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Search, Star, Users, BookOpen, Play, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];

export default function Learn() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeLevel, setActiveLevel] = useState('All');

  useEffect(() => {
    base44.entities.Course.filter({ status: 'published' }, '-enrollment_count', 20)
      .then(setCourses)
      .finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter(c => {
    const matchSearch = !search || c.title.toLowerCase().includes(search.toLowerCase());
    const matchLevel = activeLevel === 'All' || c.level === activeLevel.toLowerCase();
    return matchSearch && matchLevel;
  });

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-jakarta font-bold text-2xl text-foreground">Learn</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Grow your skills with peer-taught courses</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search courses..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Level filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => setActiveLevel(l)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeLevel === l
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Course grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No courses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(course => <CourseCard key={course.id} course={course} />)}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }) {
  return (
    <Link to={`/learn/${course.id}`} className="group block feed-card overflow-hidden">
      <div className="relative aspect-video bg-muted overflow-hidden">
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
            <Play className="w-8 h-8 text-primary/60" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className={course.pricing_type === 'free' ? 'bg-brand-emerald text-white border-0' : 'bg-black/60 text-white border-0 backdrop-blur-sm'}>
            {course.pricing_type === 'free' ? 'Free' : `₦${(course.price || 0).toLocaleString()}`}
          </Badge>
        </div>
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">{course.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {course.rating_average > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="w-3 h-3 fill-brand-amber text-brand-amber" />
              {course.rating_average.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <Users className="w-3 h-3" />
            {course.enrollment_count?.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
}