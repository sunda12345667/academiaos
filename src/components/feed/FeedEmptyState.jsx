/**
 * FeedEmptyState — Context-aware empty feed display
 */
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function FeedEmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-8 h-8 text-primary" />
      </div>
      <h3 className="font-jakarta font-bold text-lg text-foreground mb-2">
        {message || 'Nothing here yet'}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Follow people, join groups, and explore content to fill your feed.
      </p>
      <Button asChild className="gap-2">
        <Link to="/search">
          <Sparkles className="w-4 h-4" /> Discover Content
        </Link>
      </Button>
    </div>
  );
}