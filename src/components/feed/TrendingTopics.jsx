/**
 * TrendingTopics — Right panel widget
 */
import { TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const MOCK_TRENDS = [
  { tag: 'WAEC2026', posts: '14.2k' },
  { tag: 'FinalYearLife', posts: '9.8k' },
  { tag: 'EngineeringNaija', posts: '7.1k' },
  { tag: 'ScholarshipAlert', posts: '5.3k' },
  { tag: 'CodeWithUs', posts: '4.7k' },
];

export default function TrendingTopics() {
  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="font-jakarta font-semibold text-sm text-foreground">Trending</h3>
      </div>
      <div className="space-y-2">
        {MOCK_TRENDS.map((t, i) => (
          <Link
            key={t.tag}
            to={`/search?tag=${t.tag}`}
            className="flex items-center justify-between group py-1"
          >
            <div>
              <p className="text-xs text-muted-foreground">#{i + 1} trending</p>
              <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                #{t.tag}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{t.posts}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}