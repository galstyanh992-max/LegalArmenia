export interface LegalProvision {
  article: string;
  part: string;
  point: string;
  subpoint: string;
  chapter: string;
  section: string;
  range_end: string;
  provision_key: string;
  confidence: number;
}

const DASH = "[-‐‑‒–—]";
const NUMBER = "(\\d+(?:[.]\\d+)?)";
const ARTICLE_WORD = "(?:հոդված(?:ը|ի|ում|ներ)?|стать(?:я|и|ю|е)|articles?)";
const PART_WORD = "(?:մաս(?:ը|ի|ում)?|част(?:ь|и|ью)|parts?)";
const POINT_WORD = "(?:կետ(?:ը|ի|ում)?|пункт(?:а|е|ом)?|points?)";
const SUBPOINT_WORD = "(?:ենթակետ(?:ը|ի|ում)?|подпункт(?:а|е|ом)?|subpoints?)";
const CHAPTER_WORD = "(?:գլուխ(?:ը|ի|ում)?|глав(?:а|ы|е)|chapters?)";
const SECTION_WORD = "(?:բաժին(?:ը|ի|ում)?|раздел(?:а|е)?|sections?)";

const explicit = (word: string) =>
  new RegExp(`${word}\\s*[№#:]?\\s*${NUMBER}`, "iu");
const prefixed = (word: string) =>
  new RegExp(`${NUMBER}\\s*${DASH}\\s*(?:րդ|ին|й|я)\\s*${word}`, "iu");

const ARTICLE = explicit(ARTICLE_WORD);
const PREFIXED_ARTICLE = prefixed(ARTICLE_WORD);
const PART = explicit(PART_WORD);
const PREFIXED_PART = prefixed(PART_WORD);
const POINT = explicit(POINT_WORD);
const PREFIXED_POINT = prefixed(POINT_WORD);
const SUBPOINT = new RegExp(
  `${SUBPOINT_WORD}\\s*[№#:]?\\s*[«"']?([\\p{L}\\d]+)[»"']?`,
  "iu",
);
const PREFIXED_SUBPOINT = new RegExp(
  `[«"']([ա-ֆa-zа-я\\d]+)[»"']\\s*${SUBPOINT_WORD}`,
  "iu",
);
const CHAPTER = explicit(CHAPTER_WORD);
const PREFIXED_CHAPTER = prefixed(CHAPTER_WORD);
const SECTION = explicit(SECTION_WORD);
const PREFIXED_SECTION = prefixed(SECTION_WORD);
const ARTICLE_PART_PARENS = new RegExp(
  `${ARTICLE_WORD}\\s*${NUMBER}\\s*[(]${NUMBER}[)]`,
  "iu",
);
const ARTICLE_RANGE = new RegExp(
  `(?:${ARTICLE_WORD}\\s*)?${NUMBER}\\s*${DASH}\\s*${NUMBER}\\s*(?:${ARTICLE_WORD})?`,
  "iu",
);

const MANIPULATION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions?/iu,
  /(?:return|rank|place)\s+(?:this|it)\s+first/iu,
  /reveal\s+(?:the\s+)?(?:system\s+)?prompt/iu,
  /(?:change|override|increase)\s+(?:the\s+)?(?:rank|score)/iu,
  /(?:system|assistant|user)\s*[:=]/iu,
  /игнорируй\s+(?:все\s+)?предыдущие\s+инструкции/iu,
  /(?:поставь|верни|ранжируй)\s+(?:это\s+)?(?:первым|на\s+первое)/iu,
  /(?:раскрой|покажи)\s+(?:системный\s+)?(?:промпт|инструкции)/iu,
  /(?:измени|увеличь)\s+(?:рейтинг|оценку|балл)/iu,
  /անտեսիր\s+(?:բոլոր\s+)?նախորդ\s+հրահանգները/iu,
  /(?:վերադարձրու|դասակարգիր|դիր)\s+(?:սա\s+)?առաջին(?:ը)?/iu,
  /(?:բացահայտիր|ցույց\s+տուր)\s+(?:համակարգային\s+)?(?:հուշումը|հրահանգները)/iu,
  /(?:փոխիր|բարձրացրու)\s+(?:վարկանիշը|գնահատականը|միավորը)/iu,
];

function canonical(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/[‐‑‒–—]/g, "-").trim()
    .toLocaleLowerCase();
}

function capture(text: string, primary: RegExp, alternate?: RegExp): string {
  return canonical(alternate?.exec(text)?.[1] ?? primary.exec(text)?.[1]);
}

function emptyProvision(): LegalProvision {
  return {
    article: "",
    part: "",
    point: "",
    subpoint: "",
    chapter: "",
    section: "",
    range_end: "",
    provision_key: "",
    confidence: 0,
  };
}

export function isPromptManipulation(text: string): boolean {
  const normalized = String(text ?? "").normalize("NFKC");
  return MANIPULATION_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function parseLegalProvision(
  text: string,
  options: { trustedStructure?: boolean } = {},
): LegalProvision {
  const normalized = String(text ?? "").normalize("NFKC");
  if (!options.trustedStructure && isPromptManipulation(normalized)) {
    return emptyProvision();
  }

  const parenthetical = ARTICLE_PART_PARENS.exec(normalized);
  const range = ARTICLE_RANGE.exec(normalized);
  const article = canonical(
    parenthetical?.[1] ?? capture(normalized, ARTICLE, PREFIXED_ARTICLE) ??
      range?.[1],
  );
  const part = canonical(
    parenthetical?.[2] ?? capture(normalized, PART, PREFIXED_PART),
  );
  const point = capture(normalized, POINT, PREFIXED_POINT);
  const subpoint = capture(normalized, SUBPOINT, PREFIXED_SUBPOINT);
  const chapter = capture(normalized, CHAPTER, PREFIXED_CHAPTER);
  const section = capture(normalized, SECTION, PREFIXED_SECTION);
  const rangeEnd = canonical(range?.[2]);
  const provisionKey = [
    article && `article:${article}`,
    rangeEnd && `range-end:${rangeEnd}`,
    part && `part:${part}`,
    point && `point:${point}`,
    subpoint && `subpoint:${subpoint}`,
    chapter && `chapter:${chapter}`,
    section && `section:${section}`,
  ].filter(Boolean).join("|");
  const components = [article, part, point, subpoint, chapter, section].filter(
    Boolean,
  ).length;
  return {
    article,
    part,
    point,
    subpoint,
    chapter,
    section,
    range_end: rangeEnd,
    provision_key: provisionKey,
    confidence: components ? (options.trustedStructure ? 1 : 0.99) : 0,
  };
}

export function provisionSpecificity(value: LegalProvision): number {
  if (value.subpoint) return 1;
  if (value.point) return 0.85;
  if (value.part) return 0.65;
  if (value.article || value.range_end) return 0.45;
  if (value.chapter || value.section) return 0.3;
  return 0;
}
