/**
 * useStudyAssistant — Educational AI hook
 *
 * Wraps all education.ai.service calls with:
 *   - loading/error state management
 *   - result caching per topic (session-scoped)
 *   - behavioral event firing
 *   - AI usage metering integration
 *
 * Usage:
 *   const { explain, quiz, flashcards, summarize, studyPlan, search } = useStudyAssistant();
 *
 * All methods return { data, loading, error } via state.
 * Designed for inline AI features in the Learn page and post detail views.
 */
import { useState, useCallback, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import educationAI from '@/services/ai/education.ai.service';
import BehavioralEvents from '@/services/analytics/behavioral.events';

// Session cache to avoid duplicate AI calls
const _sessionCache = new Map();

function _cacheKey(fn, ...args) {
  return `${fn}:${JSON.stringify(args)}`;
}

export function useStudyAssistant() {
  const { profile } = useCurrentUser();
  const userId = profile?.id;
  const [state, setState] = useState({ loading: false, error: null });
  const activeRef = useRef(true);

  const _call = useCallback(async (fn, cacheKey, eventFn, ...args) => {
    // Return cached result if available
    if (_sessionCache.has(cacheKey)) {
      return _sessionCache.get(cacheKey);
    }

    setState({ loading: true, error: null });
    if (eventFn) eventFn();

    const result = await fn(...args, { userId });
    if (activeRef.current) {
      _sessionCache.set(cacheKey, result);
      setState({ loading: false, error: null });
    }
    return result;
  }, [userId]);

  // ─── Public API ────────────────────────────────────────────────────────────

  const explainTopic = useCallback(async (topic, level = 'university') => {
    const key = _cacheKey('explain', topic, level);
    return _call(
      (opts) => educationAI.explainTopic(topic, { level, ...opts }),
      key,
      () => BehavioralEvents.learn.explainTopic(topic),
    );
  }, [_call]);

  const generateQuiz = useCallback(async (topic, { count = 5, difficulty = 'intermediate' } = {}) => {
    const key = _cacheKey('quiz', topic, count, difficulty);
    return _call(
      (opts) => educationAI.generateQuiz(topic, { count, difficulty, ...opts }),
      key,
      () => BehavioralEvents.learn.quizStart(topic),
    );
  }, [_call]);

  const generateFlashcards = useCallback(async (content, count = 10) => {
    const key = _cacheKey('flashcards', content.slice(0, 50), count);
    return _call(
      (opts) => educationAI.generateFlashcards(content, { count, ...opts }),
      key,
      () => BehavioralEvents.ai.flashcardGen(),
    );
  }, [_call]);

  const summarizeNotes = useCallback(async (content, style = 'bullets') => {
    const key = _cacheKey('summary', content.slice(0, 50), style);
    return _call(
      (opts) => educationAI.summarizeNotes(content, { style, ...opts }),
      key,
      () => BehavioralEvents.learn.notesSummary(content.split(' ').length),
    );
  }, [_call]);

  const generateStudyPlan = useCallback(async (subject, duration = '4 weeks', goals = 'exam preparation') => {
    const key = _cacheKey('studyplan', subject, duration);
    return _call(
      (opts) => educationAI.generateStudyPlan(subject, { duration, goals, ...opts }),
      key,
      () => BehavioralEvents.learn.studyPlanGen(subject),
    );
  }, [_call]);

  const educationalSearch = useCallback(async (query, context) => {
    const key = _cacheKey('edusearch', query);
    return _call(
      (opts) => educationAI.educationalSearch(query, { context, ...opts }),
      key,
      () => BehavioralEvents.ai.searchEnhance(query),
    );
  }, [_call]);

  const getAssignmentGuidance = useCallback(async (topic, assignmentType) => {
    const key = _cacheKey('assignment', topic, assignmentType);
    return _call(
      (opts) => educationAI.getAssignmentGuidance(topic, assignmentType, opts),
      key,
      null,
    );
  }, [_call]);

  const clearCache = useCallback(() => _sessionCache.clear(), []);

  return {
    ...state,
    explainTopic,
    generateQuiz,
    generateFlashcards,
    summarizeNotes,
    generateStudyPlan,
    educationalSearch,
    getAssignmentGuidance,
    clearCache,
  };
}

export default useStudyAssistant;