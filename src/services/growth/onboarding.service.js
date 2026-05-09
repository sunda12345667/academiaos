/**
 * Onboarding Intelligence Service
 *
 * Progressive, role-aware onboarding that adapts to:
 *   student | educator | creator | school_admin | advertiser
 *
 * Philosophy:
 *   - Minimize time-to-value (show core benefit in < 90 seconds)
 *   - Bootstrapping > blank slate (seed social graph on signup)
 *   - Progressive disclosure (never dump all steps upfront)
 *   - Every step is optional but incentivized
 *   - Personalization initialization on step 1
 *
 * Onboarding Steps per Role:
 *
 *   Student:      interests → school_match → follow_suggestions → first_post
 *   Educator:     institution → subjects → course_create → invite_students
 *   Creator:      niche → content_type → creator_profile → first_post → monetization
 *   School Admin: school_setup → invite_educators → announce → verify
 *   Advertiser:   business_type → campaign_goal → first_campaign
 *
 * Activation Events (must occur within 7 days):
 *   - Followed ≥ 3 creators/users   → social_bootstrapped
 *   - Joined ≥ 1 group              → community_bootstrapped
 *   - Published ≥ 1 post            → content_activated
 *   - Completed profile             → profile_complete
 *   - Opened app on ≥ 3 days        → habit_initialized
 *
 * Migration note:
 *   On NestJS: onboarding state stored in Redis (TTL 30 days).
 *   Completion events fire Kafka messages → activation analytics pipeline.
 *   A/B test variants assigned at user creation (via feature-flags rollout).
 */

import { base44 } from '@/api/base44Client';
import { eventQueue } from '@/lib/infra/event-queue';
import notificationService from '@/services/notifications/notification.service';

// ─── Step Definitions ─────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = {
  student: [
    { id: 'select_interests',    label: 'Choose your interests',      required: true,  xp: 50  },
    { id: 'school_match',        label: 'Find your school',           required: false, xp: 30  },
    { id: 'follow_suggestions',  label: 'Follow 3 people',           required: true,  xp: 40  },
    { id: 'join_group',          label: 'Join a study group',         required: false, xp: 30  },
    { id: 'first_post',          label: 'Say hello to the community', required: false, xp: 60  },
    { id: 'notifications',       label: 'Stay in the loop',           required: false, xp: 20  },
  ],
  educator: [
    { id: 'institution_setup',   label: 'Set up your institution',   required: true,  xp: 50  },
    { id: 'subject_setup',       label: 'Add your subjects',         required: true,  xp: 40  },
    { id: 'creator_profile',     label: 'Set up creator profile',    required: false, xp: 30  },
    { id: 'first_course',        label: 'Create your first course',  required: false, xp: 80  },
    { id: 'invite_students',     label: 'Invite your students',      required: false, xp: 50  },
  ],
  creator: [
    { id: 'select_niche',        label: 'Pick your niche',           required: true,  xp: 40  },
    { id: 'creator_profile',     label: 'Set up your creator page',  required: true,  xp: 60  },
    { id: 'first_post',          label: 'Publish your first post',   required: true,  xp: 100 },
    { id: 'follow_suggestions',  label: 'Follow creators like you',  required: false, xp: 30  },
    { id: 'monetization_intro',  label: 'Unlock your earning potential', required: false, xp: 20 },
    { id: 'schedule_live',       label: 'Schedule a live session',   required: false, xp: 50  },
  ],
  school_admin: [
    { id: 'school_profile',      label: 'Set up school profile',     required: true,  xp: 60  },
    { id: 'invite_educators',    label: 'Invite educators',          required: false, xp: 50  },
    { id: 'create_announcement', label: 'Post school announcement',  required: false, xp: 40  },
    { id: 'verify_school',       label: 'Verify your institution',   required: false, xp: 80  },
  ],
  advertiser: [
    { id: 'business_setup',      label: 'Tell us about your business', required: true, xp: 50 },
    { id: 'campaign_goal',       label: 'Set your campaign goal',    required: true,  xp: 40  },
    { id: 'first_campaign',      label: 'Launch your first campaign', required: false, xp: 100 },
    { id: 'wallet_fund',         label: 'Fund your ad wallet',       required: false, xp: 30  },
  ],
};

// Activation milestone: steps that trigger "activated" status
const ACTIVATION_TRIGGERS = {
  student:     ['follow_suggestions', 'first_post'],
  educator:    ['first_course'],
  creator:     ['first_post'],
  school_admin: ['school_profile'],
  advertiser:  ['first_campaign'],
};

// ─── State Management (UserProfile.onboarding_state field) ───────────────────

/**
 * Get the current onboarding state for a user.
 * Returns { role, steps: [], completedSteps: [], isComplete, activationScore }
 */
export async function getOnboardingState(userProfileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  if (!profile) return null;

  const role = _resolveOnboardingRole(profile.role);
  const steps = ONBOARDING_STEPS[role] || ONBOARDING_STEPS.student;
  const completedSteps = profile.onboarding_completed_steps || [];
  const isComplete = profile.onboarding_complete || false;

  const totalXp = steps.reduce((s, step) => s + step.xp, 0);
  const earnedXp = steps
    .filter(s => completedSteps.includes(s.id))
    .reduce((sum, s) => sum + s.xp, 0);

  const activationTriggers = ACTIVATION_TRIGGERS[role] || [];
  const isActivated = activationTriggers.every(t => completedSteps.includes(t));

  return {
    role,
    steps: steps.map(s => ({ ...s, completed: completedSteps.includes(s.id) })),
    completedSteps,
    isComplete,
    isActivated,
    progressPercent: steps.length ? Math.round((completedSteps.length / steps.length) * 100) : 0,
    xpEarned: earnedXp,
    xpTotal: totalXp,
    currentStep: steps.find(s => !completedSteps.includes(s.id)) || null,
  };
}

/**
 * Mark an onboarding step as complete.
 * Awards XP, checks for activation, fires analytics event.
 */
export async function completeStep(userProfileId, stepId) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  if (!profile) return null;

  const role = _resolveOnboardingRole(profile.role);
  const steps = ONBOARDING_STEPS[role] || ONBOARDING_STEPS.student;
  const step = steps.find(s => s.id === stepId);
  if (!step) return null;

  const completedSteps = [...(profile.onboarding_completed_steps || [])];
  if (completedSteps.includes(stepId)) return { alreadyComplete: true };

  completedSteps.push(stepId);

  const allRequired = steps.filter(s => s.required).every(s => completedSteps.includes(s.id));
  const allComplete = steps.every(s => completedSteps.includes(s.id));

  await base44.entities.UserProfile.update(userProfileId, {
    onboarding_completed_steps: completedSteps,
    onboarding_complete: allComplete,
    ...(allRequired && !profile.onboarding_activated ? { onboarding_activated: true } : {}),
  });

  // Track activation funnel
  eventQueue.track('onboarding', 'step_complete', {
    stepId, role, stepXp: step.xp,
    progressPercent: Math.round((completedSteps.length / steps.length) * 100),
  });

  if (allRequired && !profile.onboarding_activated) {
    eventQueue.track('onboarding', 'activated', { role, stepsCompleted: completedSteps.length });
  }

  if (allComplete) {
    eventQueue.track('onboarding', 'complete', { role });
    await notificationService.createNotification({
      recipient_id: userProfileId,
      type: 'system_alert',
      title: '🎉 Onboarding Complete!',
      body: 'You\'re all set up on StudentOS. Start exploring!',
    }).catch(() => {});
  }

  return { stepId, xpAwarded: step.xp, completedSteps, isActivated: allRequired };
}

// ─── Social Graph Bootstrapping ───────────────────────────────────────────────

/**
 * Get curated follow suggestions for onboarding (fast, pre-filtered).
 * Priority: school match → subject match → high trust creators
 */
export async function getOnboardingSuggestions(userProfileId, { limit = 8 } = {}) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  if (!profile) return [];

  // Fetch followed IDs to exclude
  const alreadyFollowing = await base44.entities.Follow.filter(
    { follower_id: userProfileId, status: 'active' }, '-created_date', 200
  ).catch(() => []);
  const followingSet = new Set(alreadyFollowing.map(f => f.following_id));

  // Pool: verified educators + creators with trust ≥ 40
  const [educators, creators] = await Promise.all([
    base44.entities.UserProfile.filter(
      { verification_status: 'educator_verified' }, '-follower_count', 30
    ).catch(() => []),
    base44.entities.CreatorProfile.filter({}, '-total_followers', 30).catch(() => []),
  ]);

  const subjectInterests = profile.preferences?.subject_interests || [];

  // Score and deduplicate
  const scored = [];
  const seen = new Set([userProfileId, ...followingSet]);

  for (const u of educators) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    const schoolBoost = u.school_id === profile.school_id ? 20 : 0;
    scored.push({ profileId: u.id, score: 50 + schoolBoost, type: 'educator', data: u });
  }

  for (const c of creators) {
    if (seen.has(c.user_id)) continue;
    seen.add(c.user_id);
    const subjectBoost = (c.subject_focus || []).filter(s => subjectInterests.includes(s)).length * 10;
    scored.push({ profileId: c.user_id, score: (c.trust_score || 30) + subjectBoost, type: 'creator', data: c });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Get suggested groups for onboarding.
 * Priority: school-specific → subject match → popular
 */
export async function getOnboardingGroupSuggestions(userProfileId, { limit = 5 } = {}) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  const schoolId = profile?.school_id;
  const subjectInterests = profile?.preferences?.subject_interests || [];

  const [schoolGroups, publicGroups] = await Promise.all([
    schoolId
      ? base44.entities.Group.filter({ school_id: schoolId, status: 'active', privacy: 'public' }, '-member_count', 10).catch(() => [])
      : Promise.resolve([]),
    base44.entities.Group.filter({ status: 'active', privacy: 'public' }, '-member_count', 20).catch(() => []),
  ]);

  const seen = new Set();
  const all = [...schoolGroups, ...publicGroups].filter(g => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return true;
  });

  return all
    .map(g => {
      const subjectBoost = (g.subject_tags || []).filter(s => subjectInterests.includes(s)).length * 15;
      const schoolBoost = g.school_id === schoolId ? 25 : 0;
      return { ...g, _score: (g.member_count || 0) * 0.1 + subjectBoost + schoolBoost };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

// ─── Personalization Initialization ──────────────────────────────────────────

/**
 * Save interest selections from onboarding step 1.
 * These seed the personalization engine immediately.
 */
export async function saveInterestSelection(userProfileId, interests, schoolId = null) {
  const updates = {
    preferences: { subject_interests: interests },
    ...(schoolId ? { school_id: schoolId } : {}),
  };
  await base44.entities.UserProfile.update(userProfileId, updates);

  eventQueue.track('onboarding', 'interests_selected', {
    interestCount: interests.length,
    interests: interests.slice(0, 5), // cap for analytics
  });

  return completeStep(userProfileId, 'select_interests');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _resolveOnboardingRole(role) {
  const map = {
    student: 'student',
    educator: 'educator',
    creator: 'creator',
    school_admin: 'school_admin',
    advertiser: 'advertiser',
    moderator: 'student',
    admin: 'student',
  };
  return map[role] || 'student';
}

export default {
  ONBOARDING_STEPS,
  getOnboardingState,
  completeStep,
  getOnboardingSuggestions,
  getOnboardingGroupSuggestions,
  saveInterestSelection,
};