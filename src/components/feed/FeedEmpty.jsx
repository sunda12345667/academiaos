/**
 * FeedEmpty — Zero-state for feeds
 */
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function FeedEmpty({ message = "Your feed is empty", cta = "Explore content", ctaTo = "/search" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-primary" />
      </div>
      <h3 className="font-jakarta font-semibold text-base text-foreground mb-1">{message}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        Follow people and join groups to fill your feed with content you love.
      </p>
      <Link to={ctaTo}>
        <Button size="sm" className="font-semibold">
          {cta}
        </Button>
      </Link>
    </div>
  );
}