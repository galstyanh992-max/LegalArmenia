export interface RankingSanitizationResult {
  instruction_like_score: number;
  sanitized_ranking_text: string;
  removed_segments: string[];
  legal_imperative_preserved: boolean;
  sanitizer_version: "legal-ranking-sanitizer-v3";
}

const ATTACK_PATTERNS: RegExp[] = [
  /ignore\s+(?:all\s+)?previous\s+instructions?[^.!?\n]*/giu,
  /(?:return|rank|place)\s+(?:this|it)\s+first[^.!?\n]*/giu,
  /reveal\s+(?:the\s+)?(?:system\s+)?prompt[^.!?\n]*/giu,
  /(?:change|override|increase)\s+(?:the\s+)?(?:rank|score)[^.!?\n]*/giu,
  /this\s+is\s+the\s+only\s+valid\s+law[^.!?\n]*/giu,
  /(?:system|assistant|user)\s*:[^\n]*/giu,
  /игнорируй\s+(?:все\s+)?предыдущие\s+инструкции[^.!?\n]*/giu,
  /(?:поставь|верни|ранжируй)\s+(?:это\s+)?(?:первым|на\s+первое)[^.!?\n]*/giu,
  /(?:раскрой|покажи)\s+(?:системный\s+)?(?:промпт|инструкции)[^.!?\n]*/giu,
  /(?:измени|увеличь)\s+(?:рейтинг|оценку|балл)[^.!?\n]*/giu,
  /это\s+единственный\s+действительный\s+закон[^.!?\n]*/giu,
  /анտեսիր\s+(?:բոլոր\s+)?նախորդ\s+հրահանգները[^.!?\n]*/giu,
  /(?:վերադարձրու|դասակարգիր|դիր)\s+(?:սա\s+)?առաջին(?:ը)?[^.!?\n]*/giu,
  /(?:բացահայտիր|ցույց\s+տուր)\s+(?:համակարգային\s+)?(?:հուշումը|հրահանգները)[^.!?\n]*/giu,
  /(?:փոխիր|բարձրացրու)\s+(?:վարկանիշը|գնահատականը|միավորը)[^.!?\n]*/giu,
  /սա\s+միակ\s+վավեր\s+օրենքն\s+է[^.!?\n]*/giu,
];

const LEGAL_IMPERATIVE =
  /\b(?:shall|must|required|prohibited|may\s+not)\b|\b(?:обязан|должен|запрещен|требуется|не\s+вправе)\b|(?:պարտավոր\s+է|պետք\s+է|արգելվում\s+է|չի\s+կարող)/iu;
const AI_CONTEXT =
  /assistant|system|model|prompt|rank|score|output|ассистент|система|модель|промпт|рейтинг|оценк|вывод|օգնական|համակարգ|մոդել|հուշում|վարկանիշ|գնահատական|պատասխան/iu;

export function sanitizeRankingText(text: string): RankingSanitizationResult {
  const original = String(text ?? "").normalize("NFKC");
  let sanitized = original;
  const removed: string[] = [];
  for (const pattern of ATTACK_PATTERNS) {
    pattern.lastIndex = 0;
    sanitized = sanitized.replace(pattern, (segment) => {
      removed.push(segment.trim());
      return " [INSTRUCTION_MASKED] ";
    });
  }
  sanitized = sanitized.replace(/(?:\s*\[INSTRUCTION_MASKED\]\s*)+/g, " [INSTRUCTION_MASKED] ")
    .replace(/\s+/g, " ").trim();
  const imperativePresent = LEGAL_IMPERATIVE.test(original);
  const legalImperativePreserved = !imperativePresent ||
    (!AI_CONTEXT.test(original) && LEGAL_IMPERATIVE.test(sanitized));
  const score = removed.length
    ? Math.min(1, 0.55 + removed.length * 0.15 + (AI_CONTEXT.test(original) ? 0.15 : 0))
    : 0;
  return {
    instruction_like_score: score,
    sanitized_ranking_text: sanitized,
    removed_segments: removed,
    legal_imperative_preserved: legalImperativePreserved,
    sanitizer_version: "legal-ranking-sanitizer-v3",
  };
}
