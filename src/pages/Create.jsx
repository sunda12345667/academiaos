/**
 * Create — Post composer page
 * Handles all content types with type switching
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import postService from '@/services/social/post.service';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, FileText, HelpCircle, BarChart2, ArrowLeft, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

const POST_TYPES = [
  { key: 'text', icon: FileText, label: 'Post' },
  { key: 'question', icon: HelpCircle, label: 'Question' },
  { key: 'image', icon: Image, label: 'Photo' },
  { key: 'video', icon: Video, label: 'Video' },
  { key: 'poll', icon: BarChart2, label: 'Poll' },
];

export default function Create() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useCurrentUser();

  const [type, setType] = useState(searchParams.get('type') || 'text');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pollOptions, setPollOptions] = useState(['', '']);

  async function handleSubmit() {
    if (!profile || !content.trim()) return;
    setSubmitting(true);
    try {
      await postService.createPost(profile, {
        type,
        content,
        visibility: 'public',
        ...(type === 'poll' && { poll_options: pollOptions.filter(Boolean).map(text => ({ text, votes: 0 })) }),
      });
      navigate('/');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = content.trim().length > 0 && !submitting;

  return (
    <div className="max-w-2xl mx-auto w-full min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/40">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="font-jakarta font-bold text-base">Create Post</h2>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          size="sm"
          className="font-semibold gradient-brand border-0 hover:opacity-90"
        >
          {submitting ? 'Posting…' : 'Post'}
        </Button>
      </div>

      {/* Type selector */}
      <div className="flex gap-2 px-4 py-3 border-b border-border/40 overflow-x-auto scrollbar-hide">
        {POST_TYPES.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setType(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 transition-all',
              type === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="flex-1 p-4">
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {profile?.display_name?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              placeholder={
                type === 'question' ? "What's your question?"
                : type === 'poll' ? "What do you want to ask?"
                : "What's on your mind?"
              }
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[120px] border-0 bg-transparent p-0 text-base resize-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
              autoFocus
            />

            {type === 'poll' && (
              <div className="space-y-2">
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    value={opt}
                    onChange={e => {
                      const updated = [...pollOptions];
                      updated[i] = e.target.value;
                      setPollOptions(updated);
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full px-3 py-2 text-sm bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ))}
                {pollOptions.length < 4 && (
                  <button
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    + Add option
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/40 px-4 py-3 flex items-center gap-2 text-muted-foreground">
        <Globe className="w-4 h-4" />
        <span className="text-xs font-medium">Everyone can see this post</span>
      </div>
    </div>
  );
}