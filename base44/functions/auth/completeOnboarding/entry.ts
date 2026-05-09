import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const {
      school_id,
      department,
      level,
      display_name,
      bio,
      interests = [],
      avatar_url
    } = await req.json();

    // Validation
    if (!school_id || !display_name) {
      return Response.json(
        { error: 'Missing required fields: school_id, display_name' },
        { status: 400 }
      );
    }

    if (display_name.length < 2 || display_name.length > 30) {
      return Response.json(
        { error: 'Display name must be 2-30 characters' },
        { status: 400 }
      );
    }

    // Get existing profile or create
    const existingProfile = await base44.entities.UserProfile.filter(
      { user_id: user.id },
      'created_at',
      1
    );

    let userProfile;

    if (existingProfile.length > 0) {
      // Update existing profile
      userProfile = await base44.entities.UserProfile.update(
        existingProfile[0].id,
        {
          school_id,
          department,
          level,
          display_name,
          bio,
          interests,
          avatar_url,
          verified: true,
          status: 'active',
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        }
      );
    } else {
      // Create new profile
      userProfile = await base44.entities.UserProfile.create({
        user_id: user.id,
        school_id,
        department,
        level,
        display_name,
        bio,
        interests,
        avatar_url,
        role: 'student',
        verified: true,
        status: 'active',
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString()
      });
    }

    // Bootstrap notification preferences (optional, for Phase 2)
    // Initialize growth signals (follows, interests matched, etc.)

    return Response.json({
      success: true,
      message: 'Onboarding completed successfully',
      profile: {
        id: userProfile.id,
        user_id: userProfile.user_id,
        display_name: userProfile.display_name,
        school_id: userProfile.school_id,
        role: userProfile.role,
        status: userProfile.status,
        onboarding_completed: userProfile.onboarding_completed
      }
    }, { status: 200 });
  } catch (error) {
    console.error('Onboarding error:', error);
    return Response.json(
      { error: 'Onboarding failed: ' + error.message },
      { status: 500 }
    );
  }
});