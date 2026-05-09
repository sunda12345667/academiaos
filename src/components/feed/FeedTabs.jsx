/**
 * FeedTabs — Feed type switcher (Home / Following / Trending)
 * Sticky positioning, scroll-aware styling
 */
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'home', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'discover', label: 'Trending' },
];

export default function FeedTabs({ active, onChange }) {
  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/40">
      <div className="flex items-center px-4 overflow-x-auto scrollbar-hide">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'flex-shrink-0 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all duration-150',
              active === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}