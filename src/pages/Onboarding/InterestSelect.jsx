import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { ChevronRight, Check } from 'lucide-react';

const DEFAULT_INTERESTS = [
  'Technology', 'Business', 'Science', 'Arts', 'Sports',
  'Music', 'Photography', 'Writing', 'Design', 'Marketing',
  'Engineering', 'Mathematics', 'Languages', 'History', 'Philosophy',
  'Coding', 'Data Science', 'Gaming', 'Fashion', 'Fitness',
  'Cooking', 'Travel', 'Environmental', 'Social', 'Mental Health'
];

export default function InterestSelect() {
  const navigate = useNavigate();
  const { userProfile, updateProfile } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleToggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else if (selectedInterests.length < 8) {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      await updateProfile({
        interests: selectedInterests
      });
      navigate('/onboarding/complete');
    } catch (error) {
      console.error('Failed to save interests:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= 3 ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">
            What interests you?
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Choose at least 3 to personalize your feed
          </p>
        </div>

        {/* Interests Grid */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_INTERESTS.map((interest) => (
              <button
                key={interest}
                onClick={() => handleToggleInterest(interest)}
                disabled={
                  loading ||
                  (!selectedInterests.includes(interest) &&
                    selectedInterests.length >= 8)
                }
                className={`relative px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  selectedInterests.includes(interest)
                    ? 'bg-primary text-primary-foreground border-2 border-primary'
                    : 'bg-muted text-foreground border-2 border-transparent hover:bg-accent'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span className="flex items-center justify-center gap-2">
                  {interest}
                  {selectedInterests.includes(interest) && (
                    <Check className="w-4 h-4" />
                  )}
                </span>
              </button>
            ))}
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2">
            Selected: {selectedInterests.length} / 8
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            onClick={handleContinue}
            disabled={selectedInterests.length < 3 || loading}
            className="w-full gap-2"
          >
            {loading ? 'Saving…' : 'Continue'}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/onboarding/profile')}
            className="w-full"
            disabled={loading}
          >
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/onboarding/complete')}
            className="w-full text-muted-foreground"
            disabled={loading}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}