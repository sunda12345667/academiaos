import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, ChevronRight } from 'lucide-react';

export default function ProfileSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeOnboarding } = useAuth();

  const school_id = location.state?.school_id;
  const school_name = location.state?.school_name;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAvatarSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setAvatar(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async () => {
    if (!avatar) return null;

    try {
      const response = await base44.integrations.Core.UploadFile({
        file: avatar
      });
      return response.file_url;
    } catch (error) {
      console.error('Avatar upload failed:', error);
      throw error;
    }
  };

  const handleContinue = async () => {
    setError('');

    if (!displayName.trim()) {
      setError('Please enter a display name');
      return;
    }

    if (displayName.length < 2 || displayName.length > 30) {
      setError('Display name must be 2-30 characters');
      return;
    }

    setLoading(true);

    try {
      let avatarUrl = null;
      if (avatar) {
        avatarUrl = await uploadAvatar();
      }

      await completeOnboarding({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
        school_id,
        interests: []
      });

      navigate('/onboarding/interests');
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  if (!school_id) {
    return navigate('/onboarding/school');
  }

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
                  i <= 2 ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">
            Create your profile
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            {school_name}
          </p>
        </div>

        {/* Form */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Avatar */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-3">
              Profile photo
            </label>
            <div className="flex gap-4 items-start">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted border-2 border-border flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-bold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                  disabled={loading}
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  asChild
                  disabled={loading}
                >
                  <span>
                    <Upload className="w-4 h-4" />
                    Upload photo
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Display name
            </label>
            <div className="flex gap-2 items-baseline">
              <Input
                type="text"
                placeholder="How should we call you?"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={30}
                disabled={loading}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {displayName.length}/30
              </span>
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Bio (optional)
            </label>
            <div className="flex gap-2 items-baseline">
              <textarea
                placeholder="Tell us about yourself…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={150}
                disabled={loading}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none h-20"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {bio.length}/150
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            onClick={handleContinue}
            disabled={!displayName.trim() || loading}
            className="w-full gap-2"
          >
            {loading ? 'Saving…' : 'Continue'}
            {!loading && <ChevronRight className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/onboarding/school')}
            className="w-full"
            disabled={loading}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}