/**
 * Marketplace — matches design reference
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Star, ShoppingBag, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const MOCK_LISTINGS = [
  {
    id: '1', tag: 'TEXTBOOKS', title: 'Organic Chemistry Study Pack', desc: 'Complete set of annotated notes...', price: 45, rating: 4.8, currency: '$',
    img: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80'
  },
  {
    id: '2', tag: 'SERVICES', title: '1-on-1 Python Mentorship', desc: 'Senior CS student offering personalized...', price: 25, priceUnit: '/hr', rating: 5.0, currency: '$',
    img: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80'
  },
  {
    id: '3', tag: 'ELECTRONICS', title: 'Logitech MX Setup', desc: 'Gently used MX Master 3 and Keys...', price: 120, rating: 4.5, currency: '$',
    img: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80'
  },
  {
    id: '4', tag: 'STUDY NOTES', title: 'Digital Art History Atlas', desc: 'Hand-drawn visual maps for Art History...', price: 12, rating: 4.9, currency: '$',
    img: 'https://images.unsplash.com/photo-1517971129774-8a2b38fa128e?w=400&q=80'
  },
  {
    id: '5', tag: 'HOUSEHOLD', title: 'Ninja Air Fryer (Silver)', desc: 'Perfect for dorm living. Only used for one...', price: 55, rating: 4.2, currency: '$',
    img: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400&q=80'
  },
];

const TAG_COLORS = {
  'TEXTBOOKS': 'bg-blue-500/80',
  'SERVICES': 'bg-emerald-500/80',
  'ELECTRONICS': 'bg-purple-500/80',
  'STUDY NOTES': 'bg-amber-500/80',
  'HOUSEHOLD': 'bg-rose-500/80',
};

export default function Marketplace() {
  const [category, setCategory] = useState('all');
  const [price, setPrice] = useState('any');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-jakarta font-bold text-3xl text-foreground">Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs leading-relaxed">Everything you need for your academic journey, sold by students for students.</p>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40 rounded-xl bg-white border-border text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="textbooks">Textbooks</SelectItem>
              <SelectItem value="services">Services</SelectItem>
              <SelectItem value="electronics">Electronics</SelectItem>
              <SelectItem value="study_notes">Study Notes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger className="w-32 rounded-xl bg-white border-border text-sm">
              <SelectValue placeholder="Any Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any Price</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="under50">Under $50</SelectItem>
              <SelectItem value="over50">$50+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MOCK_LISTINGS.map(item => (
          <div key={item.id} className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer group">
            {/* Image */}
            <div className="relative h-44 overflow-hidden bg-muted">
              <img src={item.img} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              <div className="absolute top-3 left-3">
                <span className={`text-[10px] font-bold text-white px-2 py-1 rounded-full ${TAG_COLORS[item.tag] || 'bg-gray-500/80'}`}>
                  {item.tag}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-jakarta font-semibold text-sm text-foreground leading-snug line-clamp-2">{item.title}</h3>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-foreground">{item.rating}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{item.desc}</p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Price</p>
                  <p className="text-lg font-bold text-foreground">{item.currency}{item.price.toFixed(2)}{item.priceUnit || ''}</p>
                </div>
                <Button className="gradient-brand text-white rounded-xl px-5 font-semibold">Buy</Button>
              </div>
            </div>
          </div>
        ))}

        {/* Sell CTA Card */}
        <div className="gradient-brand rounded-2xl p-6 flex flex-col items-center justify-center text-center text-white min-h-[280px] cursor-pointer hover:opacity-95 transition-opacity">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-jakarta font-bold text-xl mb-2">Have stuff to sell?</h3>
          <p className="text-sm text-white/80 mb-5 leading-relaxed">Join over 2,000 students making extra cash by clearing out their old gear.</p>
          <Button className="bg-white text-primary font-semibold rounded-xl px-6 hover:bg-white/90">
            Start Listing Today
          </Button>
        </div>
      </div>

      {/* Milestone Banner */}
      <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-sm text-foreground">Marketplace Milestone</p>
            <span className="text-sm font-bold text-emerald-600">2/3</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">Sell 2 more items to unlock the "Trusted Seller" badge and get 0% fees for a month!</p>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '66%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}