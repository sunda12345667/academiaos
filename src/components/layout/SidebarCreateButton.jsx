/**
 * SidebarCreateButton — Primary CTA for content creation
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SidebarCreateButton() {
  const navigate = useNavigate();

  return (
    <Button
      onClick={() => navigate('/create')}
      className="w-full gap-2 font-semibold text-sm h-9 gradient-brand border-0 hover:opacity-90 transition-opacity shadow-md shadow-primary/25"
    >
      <PlusCircle className="w-4 h-4" />
      Create
    </Button>
  );
}