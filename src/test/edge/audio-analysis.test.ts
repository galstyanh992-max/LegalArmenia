import { describe, it, expect } from 'vitest';
import {
  analyzeTranscription,
  detectLanguage,
  longestConsecutiveRepeat,
  CONFIDENCE_THRESHOLD,
  REPETITION_HALLUCINATION_MIN_RUN,
} from '../../../supabase/functions/audio-transcribe/analysis';

// These exercise the deterministic, provider-independent analysis extracted
// from the audio-transcribe edge function. No provider call is involved.

describe('detectLanguage', () => {
  it('classifies predominantly Armenian text', () => {
    expect(detectLanguage('Բարեւ ձեզ, նիստը սկսվում է դատարանում')).toBe('armenian');
  });

  it('classifies predominantly Russian text', () => {
    expect(detectLanguage('Здравствуйте, заседание суда начинается сейчас')).toBe('russian');
  });

  it('classifies mixed Armenian/Russian text (Armenian-dominant with substantial Cyrillic)', () => {
    // >30% Armenian and >20% Cyrillic characters.
    expect(detectLanguage('Բարեւ ձեզ դատարանում նիստը սկսվում է здравствуйте суд')).toBe('mixed');
  });

  it('returns unknown for empty or non-target scripts', () => {
    expect(detectLanguage('')).toBe('unknown');
    expect(detectLanguage('hello world this is english')).toBe('unknown');
  });
});

describe('longestConsecutiveRepeat', () => {
  it('counts the longest identical run', () => {
    expect(longestConsecutiveRepeat(['a', 'a', 'a', 'b', 'c'])).toBe(3);
    expect(longestConsecutiveRepeat(['a', 'b', 'c'])).toBe(0);
    expect(longestConsecutiveRepeat([])).toBe(0);
  });
});

describe('analyzeTranscription', () => {
  it('throws on empty/whitespace input rather than producing a blank result', () => {
    expect(() => analyzeTranscription('')).toThrow(/Empty transcription/);
    expect(() => analyzeTranscription('   \n  ')).toThrow(/Empty transcription/);
  });

  it('yields high confidence and no review for clean text', () => {
    const a = analyzeTranscription('Բարեւ ձեզ, նիստը սկսվում է դատարանում այսօր առավոտյան ժամը տասին');
    expect(a.confidence_score).toBeGreaterThanOrEqual(0.8);
    expect(a.needs_review).toBe(false);
    expect(a.has_repetition_hallucination).toBe(false);
    expect(a.warnings).toHaveLength(0);
    expect(a.word_count).toBeGreaterThan(0);
  });

  it('flags a repetition hallucination and forces human review', () => {
    const repeated = Array(REPETITION_HALLUCINATION_MIN_RUN + 2).fill('նույն').join(' ');
    const a = analyzeTranscription(repeated);
    expect(a.has_repetition_hallucination).toBe(true);
    expect(a.confidence_score).toBeLessThan(CONFIDENCE_THRESHOLD);
    expect(a.needs_review).toBe(true);
    expect(a.warnings.length).toBeGreaterThan(0);
  });

  it('does not flag a run just below the threshold', () => {
    const repeated = Array(REPETITION_HALLUCINATION_MIN_RUN - 1).fill('բառ').join(' ');
    const a = analyzeTranscription(repeated);
    expect(a.has_repetition_hallucination).toBe(false);
    expect(a.needs_review).toBe(false);
  });
});
