/**
 * Marketplace — Student peer-to-peer marketplace
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Search, Plus, Tag, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES = ['All', 'Textbooks', 'Electronics', 'Study Materials', 'Tutoring', 'Services'];
const CAT_MAP = { Textbooks: 'textbooks', Electronics: 'electronics', 'Study Materials': 'study_materials', Tutoring: 'tutoring', Services: 'services' };

export default function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    base44.entities.MarketplaceListing.filter({ status: 'active' }, '-created_date', 30)
      .then(setListings)
      .finally(() => setLoading(false));
  }, []);

  const filtered = listings.filter(l => {
    const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All' || l.category === CAT_MAP[activeCategory];
    return matchSearch && matchCat;
  });

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-jakarta font-bold text-2xl text-foreground">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Buy and sell with your campus community</p>
        </div>
        <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Sell</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search listings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setActiveCategory(c)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCategory === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(l => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing }) {
  return (
    <Link to={`/marketplace/${listing.id}`} className="group block feed-card overflow-hidden">
      <div className="relative aspect-square bg-muted overflow-hidden">
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Tag className="w-8 h-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className={listing.pricing_type === 'free' ? 'bg-brand-emerald text-white border-0 text-xs' : 'bg-black/70 text-white border-0 backdrop-blur-sm text-xs'}>
            {listing.pricing_type === 'free' ? 'Free' : listing.pricing_type === 'negotiable' ? 'Nego' : `₦${listing.price?.toLocaleString()}`}
          </Badge>
        </div>
      </div>
      <div className="p-2.5 space-y-1">
        <h3 className="font-semibold text-xs text-foreground line-clamp-2 group-hover:text-primary transition-colors">{listing.title}</h3>
        {listing.location && (
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="w-2.5 h-2.5" />{listing.location}
          </p>
        )}
      </div>
    </Link>
  );
}