export interface LegalProvision {
  article: string;
  part: string;
  point: string;
  subpoint: string;
  provision_key: string;
}

const ARTICLE =
  /(?:հոդված(?:ի|ը|ում)?|стать(?:я|и|ю|е)|article)\s*[№#:]?\s*(\d+(?:[.\-–]\d+)?)(?:\s*[-‑–]?(?:րդ|й|я))?/iu;
const PREFIXED_ARTICLE =
  /\b(\d+(?:[.\-–]\d+)?)\s*[-‑–]?(?:րդ|й)\s+(?:հոդված|стать)/iu;
const PART =
  /(?:մաս(?:ի|ը|ում)?|част(?:ь|и|ью)|part)\s*[№#:]?\s*(\d+(?:\.\d+)?)(?:\s*[-‑–]?(?:ին|րդ|й|я))?/iu;
const PREFIXED_PART = /\b(\d+(?:\.\d+)?)\s*[-‑–]?(?:րդ|й)\s+(?:մաս|част)/iu;
const POINT =
  /(?:կետ(?:ի|ը|ում)?|пункт(?:а|е|ом)?|point)\s*[№#:]?\s*(\d+(?:\.\d+)?)(?:\s*[-‑–]?(?:րդ|й))?/iu;
const PREFIXED_POINT = /\b(\d+(?:\.\d+)?)\s*[-‑–]?(?:րդ|й)\s+(?:կետ|пункт)/iu;
const SUBPOINT =
  /(?:ենթակետ(?:ի|ը|ում)?|подпункт(?:а|е|ом)?|subpoint)\s*[«"']?([\p{L}\d]+)[»"']?/iu;
const PREFIXED_SUBPOINT =
  /[«"']([ա-ֆa-zа-я\d]+)[»"']\s+(?:ենթակետ|подпункт|subpoint)/iu;

const MANIPULATION =
  /(?:ignore\s+(?:all\s+)?previous\s+instructions|rank\s+this\s+first|reveal\s+(?:the\s+)?(?:system\s+)?prompt|system\s*[:=]|assistant\s*[:=]|user\s*[:=]|игнорируй\s+предыдущ|поставь\s+(?:это\s+)?на\s+перв|раскрой\s+(?:системн|промпт)|անտես(?:իր|եք).*հրահանգ|դասակարգ(?:իր|եք).*առաջին|բացահայտ(?:իր|եք).*հուշում)/iu;

function canonical(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").replace(/[‑–]/g, "-").trim()
    .toLocaleLowerCase();
}

function capture(text: string, primary: RegExp, prefixed?: RegExp): string {
  return canonical(prefixed?.exec(text)?.[1] ?? primary.exec(text)?.[1]);
}

export function isPromptManipulation(text: string): boolean {
  return MANIPULATION.test(text.normalize("NFKC"));
}

export function parseLegalProvision(
  text: string,
  options: { trustedStructure?: boolean } = {},
): LegalProvision {
  const normalized = String(text ?? "").normalize("NFKC");
  if (!options.trustedStructure && isPromptManipulation(normalized)) {
    return {
      article: "",
      part: "",
      point: "",
      subpoint: "",
      provision_key: "",
    };
  }
  const article = capture(normalized, ARTICLE, PREFIXED_ARTICLE);
  const part = capture(normalized, PART, PREFIXED_PART);
  const point = capture(normalized, POINT, PREFIXED_POINT);
  const subpoint = capture(normalized, SUBPOINT, PREFIXED_SUBPOINT);
  const key = [
    article && `a:${article}`,
    part && `p:${part}`,
    point && `pt:${point}`,
    subpoint && `sp:${subpoint}`,
  ].filter(Boolean).join("/");
  return { article, part, point, subpoint, provision_key: key };
}

export function provisionSpecificity(value: LegalProvision): number {
  if (value.subpoint) return 1;
  if (value.point) return 0.85;
  if (value.part) return 0.65;
  if (value.article) return 0.45;
  return 0;
}
