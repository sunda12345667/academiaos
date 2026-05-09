import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ChevronRight } from 'lucide-react';

export default function SchoolSelect() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setLoading(true);
        const schoolList = await base44.entities.School.list('-student_count', 100);
        setSchools(schoolList);
      } catch (error) {
        console.error('Failed to load schools:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchools();
  }, []);

  const filteredSchools = useMemo(() => {
    if (!searchQuery) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.city?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [schools, searchQuery]);

  const handleContinue = () => {
    if (selectedSchool) {
      navigate('/onboarding/profile', {
        state: { school_id: selectedSchool.id, school_name: selectedSchool.name }
      });
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
                  i === 1 ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
          <h1 className="text-2xl font-jakarta font-bold text-foreground">
            Where do you study?
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Find your school to connect with classmates
          </p>
        </div>

        {/* Search */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search schools…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Schools List */}
          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Loading schools…
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">
                  Can't find your school?
                </p>
                <Button variant="outline" size="sm">
                  Request to add it
                </Button>
              </div>
            ) : (
              filteredSchools.map((school) => (
                <button
                  key={school.id}
                  onClick={() => setSelectedSchool(school)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedSchool?.id === school.id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{school.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {school.city}, {school.country}
                      </p>
                    </div>
                    {selectedSchool?.id === school.id && (
                      <ChevronRight className="w-4 h-4 text-primary mt-1" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Button
            onClick={handleContinue}
            disabled={!selectedSchool}
            className="w-full"
          >
            Continue
          </Button>
          <Button variant="outline" onClick={() => navigate('/login')} className="w-full">
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}