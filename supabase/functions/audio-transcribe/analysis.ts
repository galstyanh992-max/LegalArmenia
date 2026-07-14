// Pure, provider-independent transcription analysis helpers.
//
// Extracted from index.ts so the language/hallucination/confidence logic can be
// unit-tested without a Deno runtime or any real provider call. This module must
// stay free of Deno globals and network imports so it is importable from both the
// edge function and the vitest suite.

export const CONFIDENCE_THRESHOLD = 0.50;
export const REPETITION_HALLUCINATION_MIN_RUN = 8;

export interface TranscriptionAnalysis {
  language_detected: "armenian" | "russian" | "mixed" | "unknown";
  word_count: number;
  confidence_score: number;
  confidence_reason: string;
  needs_review: boolean;
  has_repetition_hallucination: boolean;
  warnings: string[];
}

/** Longest run of an identical consecutive token — a cheap hallucination signal. */
export function longestConsecutiveRepeat(words: string[]): number {
  let max = 0;
  let run = 1;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      run++;
      if (run > max) max = run;
    } else {
      run = 1;
    }
  }
  return max;
}

export function detectLanguage(text: string): TranscriptionAnalysis["language_detected"] {
  const totalChars = text.length;
  if (totalChars === 0) return "unknown";
  const armenianChars = (text.match(/[Ա-֏]/g) || []).length;
  const russianChars = (text.match(/[Ѐ-ӿ]/g) || []).length;

  if (armenianChars / totalChars > 0.3) {
    return russianChars / totalChars > 0.2 ? "mixed" : "armenian";
  }
  if (russianChars / totalChars > 0.3) {
    return "russian";
  }
  return "unknown";
}

/**
 * Deterministic analysis of a non-empty transcription string. Throws on empty
 * input so callers surface an explicit failure rather than persisting a blank
 * result.
 */
export function analyzeTranscription(transcription: string): TranscriptionAnalysis {
  const trimmed = transcription.trim();
  if (!trimmed) {
    throw new Error("Empty transcription result");
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const maxRepeat = longestConsecutiveRepeat(words);
  const hasRepetitionHallucination = maxRepeat >= REPETITION_HALLUCINATION_MIN_RUN;

  const warnings: string[] = [];
  let confidence_score = 0.85;
  if (hasRepetitionHallucination) {
    confidence_score = 0.3;
    warnings.push("Detected repetitive text — possible hallucination due to poor audio quality");
  }

  const needs_review = confidence_score < CONFIDENCE_THRESHOLD || hasRepetitionHallucination;
  const confidence_reason = confidence_score >= 0.8
    ? "High confidence transcription"
    : "Medium confidence — review recommended";

  return {
    language_detected: detectLanguage(trimmed),
    word_count: words.length,
    confidence_score,
    confidence_reason,
    needs_review,
    has_repetition_hallucination: hasRepetitionHallucination,
    warnings,
  };
}
