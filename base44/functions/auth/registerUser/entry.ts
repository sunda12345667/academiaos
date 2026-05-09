import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { email, password, full_name, role = 'student' } = await req.json();

    // Validation
    if (!email || !password || !full_name) {
      return Response.json(
        { error: 'Missing required fields: email, password, full_name' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return Response.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);

    // Create user profile (user is created by Base44 auth system)
    // This function is called after user registration succeeds
    const userProfile = await base44.entities.UserProfile.create({
      user_id: email, // Will be updated with actual user ID after auth completes
      role: ['student', 'lecturer', 'creator'].includes(role) ? role : 'student',
      status: 'pending_verification',
      onboarding_completed: false,
      verified: false,
      interests: [],
      created_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: 'Registration initiated. Check your email for verification.',
      profile_id: userProfile.id
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { error: 'Registration failed: ' + error.message },
      { status: 500 }
    );
  }
});