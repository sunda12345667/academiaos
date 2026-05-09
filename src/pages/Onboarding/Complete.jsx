import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export default function OnboardingComplete() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  useEffect(() => {
    // Redirect if not authenticated or already onboarded
    if (!userProfile?.onboarding_completed) {
      navigate('/onboarding/school');
    }
  }, [userProfile, navigate]);

  const handleExplore = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Animation */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-3xl gradient-brand flex items-center justify-center animate-bounce">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-jakarta font-bold text-foreground mb-3">
          Welcome to StudentOS!
        </h1>
        <p className="text-muted-foreground text-lg mb-2">
          {userProfile?.display_name}, you're all set.
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          Your profile is ready. Connect with creators, join groups, and start earning.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 bg-card rounded-2xl border border-border p-6 mb-8">
          <div className="space-y-1">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-muted-foreground">Posts</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-primary">0</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-bold text-primary">₦0</p>
            <p className="text-xs text-muted-foreground">Earnings</p>
          </div>
        </div>

        {/* CTA */}
        <Button onClick={handleExplore} className="w-full mb-3">
          Start exploring
        </Button>

        {/* Features Preview */}
        <div className="space-y-2 text-left">
          <p className="text-xs font-medium text-muted-foreground px-4">What's next?</p>
          <div className="space-y-2 px-4">
            {[
              { title: 'Follow creators', desc: 'Personalize your feed' },
              { title: 'Join groups', desc: 'Connect with peers' },
              { title: 'Create content', desc: 'Share & earn' }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}