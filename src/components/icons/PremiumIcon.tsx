import type { SVGProps } from 'react';

/**
 * Premium icon set — custom outline, 1.6px stroke, Phosphor Duotone inspired.
 * No Lucide / Heroicons / Feather. Single coherent design language.
 * All icons 24x24 viewBox, stroke-linecap/linejoin round.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconScale = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v18" />
    <path d="M7 7h10" />
    <path d="M7 7l-3.5 7a4 4 0 0 0 7 0L7 7Z" opacity="0.9" />
    <path d="M17 7l-3.5 7a4 4 0 0 0 7 0L17 7Z" opacity="0.9" />
    <path d="M4.5 21h15" />
  </svg>
);

export const PremiumBrandMark = ({ size = 28, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1.45}>
    <path d="M12 3.2v16.4" />
    <path d="M6.2 7.2h11.6" />
    <path d="M8.6 19.6h6.8" />
    <path d="M9.8 21h4.4" />
    <path d="M6.2 7.2 3.4 13" opacity="0.9" />
    <path d="m6.2 7.2 2.8 5.8" opacity="0.9" />
    <path d="M2.7 13h7a3.6 3.6 0 0 1-7 0Z" fill="currentColor" fillOpacity="0.16" />
    <path d="M17.8 7.2 15 13" opacity="0.9" />
    <path d="m17.8 7.2 2.8 5.8" opacity="0.9" />
    <path d="M14.3 13h7a3.6 3.6 0 0 1-7 0Z" fill="currentColor" fillOpacity="0.16" />
    <path d="M10.2 4.8 12 3.2l1.8 1.6" />
    <circle cx="12" cy="7.2" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const PremiumChatGlyph = ({ size = 24, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1.55}>
    <path
      d="M6.5 17.5c-2-1.4-3.1-3.4-3.1-5.8 0-4.7 4-8.2 8.7-8.2s8.5 3.4 8.5 7.9-3.8 8-8.5 8c-1.1 0-2.2-.2-3.2-.6L5.1 20l1.4-2.5Z"
      fill="currentColor"
      fillOpacity="0.08"
    />
    <path d="M8.1 10.2h7.8" opacity="0.86" />
    <path d="M8.1 13.2h4.9" opacity="0.62" />
    <path d="M6.5 17.5 5.1 20l3.8-1.2" />
  </svg>
);

export const PremiumDocumentGlyph = ({ size = 24, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1.55}>
    <path
      d="M6.7 3.5h7.4l4.8 4.8v11.1a1.6 1.6 0 0 1-1.6 1.6H6.7a1.6 1.6 0 0 1-1.6-1.6V5.1a1.6 1.6 0 0 1 1.6-1.6Z"
      fill="currentColor"
      fillOpacity="0.08"
    />
    <path d="M14.1 3.5v4.7h4.8" />
    <path d="M8.4 12.2h7.2" opacity="0.86" />
    <path d="M8.4 15.3h7.2" opacity="0.66" />
    <path d="M8.4 18.1h4.5" opacity="0.5" />
  </svg>
);

export const IconSearch = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const IconChevronDown = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconChevronUp = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);

export const IconCheckmark = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="m5.5 12 4 4 9-9" />
  </svg>
);

export const IconCalendar = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 9.5h17" />
    <path d="M8 3.5v3.5M16 3.5v3.5" />
    <circle cx="12" cy="14.5" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const IconFolder = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z" />
    <path d="M3.5 10h17" opacity="0.6" />
  </svg>
);

export const IconShieldAlert = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3Z" />
    <path d="M12 8.5v4" />
    <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

export const IconNote = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M6 3.5h7l5 5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
    <path d="M13 3.5v5h5" />
    <path d="M7.5 13h9M7.5 16.5h6" opacity="0.7" />
  </svg>
);

export const IconBook = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M5 4.5a2 2 0 0 1 2-2h12v17H7a2 2 0 0 0-2 2V4.5Z" />
    <path d="M19 17.5H7a2 2 0 0 0-2 2" opacity="0.7" />
    <path d="M9 8h7M9 11.5h7" opacity="0.7" />
  </svg>
);

export const IconSend = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M20 4 4 11l6.5 2.5L13 20l7-16Z" />
    <path d="M10.5 13.5 20 4" opacity="0.7" />
  </svg>
);

export const IconVideo = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="6.5" width="13" height="11" rx="2.5" />
    <path d="M16.5 10 21 7.5v9L16.5 14" />
    <circle cx="10" cy="12" r="2" opacity="0.6" />
  </svg>
);

export const IconMic = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="9" y="3.5" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
    <path d="M12 17.5v3M9 20.5h6" />
  </svg>
);

export const IconFile = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M6.5 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M13 3.5v5h5" opacity="0.7" />
    <path d="M8.5 13h7M8.5 16h7" opacity="0.6" />
  </svg>
);

export const IconArchive = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1.5" />
    <path d="M5 8.5v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10" />
    <path d="M10 12h4" opacity="0.7" />
  </svg>
);

export const IconExternal = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </svg>
);

export const IconChart = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 4v16h16" />
    <path d="M8 14l3.5-4 3 2.5L20 7" />
    <circle cx="8" cy="14" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="20" cy="7" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUsers = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19c.5-3 3-5 5.5-5s5 2 5.5 5" />
    <path d="M16 6a3 3 0 0 1 0 6" opacity="0.7" />
    <path d="M17 14c2 1 3.5 3 3.5 5" opacity="0.7" />
  </svg>
);

export const IconFolderOpen = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v1.5H3.5v-4Z" />
    <path d="m3.5 10 2 8.5a1.5 1.5 0 0 0 1.5 1.2h11a1.5 1.5 0 0 0 1.5-1.2l1.5-7.5H3.5Z" opacity="0.85" />
  </svg>
);

export const IconLogout = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8" />
    <path d="M17 8.5 20.5 12 17 15.5" />
    <path d="M20.5 12H10" />
  </svg>
);

export const IconPlus = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconGavel = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 4.5 19.5 11l-2.5 2.5L10.5 7 13 4.5Z" />
    <path d="m10.5 7-4 4 3 3 4-4" opacity="0.85" />
    <path d="M5.5 16.5 8 14l2 2-2.5 2.5L5.5 16.5Z" />
    <path d="M3.5 20.5h7" />
  </svg>
);

export const IconBookText = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 0-2 2V5Z" />
    <path d="M19 17.5H6a2 2 0 0 0-2 2" opacity="0.6" />
    <path d="M8 7.5h8M8 11h8M8 14.5h5" opacity="0.75" />
  </svg>
);

/** Decorative corner glyph — scales of justice column, for case cards */
export const GlyphBalance = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M12 2v20" strokeWidth={1.5} />
    <path d="M6 22h12" strokeWidth={1.5} />
    <path d="M9 22L12 18L15 22" fill="currentColor" fillOpacity="0.1" />
    <path d="M12 6c-3-1-6-1-9 0" strokeWidth={1.5} />
    <path d="M12 6c3-1 6-1 9 0" strokeWidth={1.5} />
    <path d="M3 6L5 14" opacity="0.5" />
    <path d="M3 6L1 14" opacity="0.5" />
    <path d="M21 6L23 14" opacity="0.5" />
    <path d="M21 6L19 14" opacity="0.5" />
    <path d="M1 14h4c1 0 2 1 2 2.5S6 19 3 19s-3-1-3-2.5 1-2.5 2-2.5z" fill="currentColor" fillOpacity="0.15" />
    <path d="M19 14h4c1 0 2 1 2 2.5S24 19 21 19s-3-1-3-2.5 1-2.5 2-2.5z" fill="currentColor" fillOpacity="0.15" />
    <circle cx="12" cy="6" r="1" fill="currentColor" />
  </svg>
);

/** Decorative corner glyph — court columns */
export const GlyphColumns = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M2 20h20" strokeWidth={1.5} />
    <path d="M4 20l-1 2h18l-1-2" opacity="0.6" fill="currentColor" fillOpacity="0.1" />
    <path d="M3 18h18" strokeWidth={1.5} />
    <path d="M6 18V8" strokeWidth={1.5} />
    <path d="M12 18V8" strokeWidth={1.5} />
    <path d="M18 18V8" strokeWidth={1.5} />
    <path d="M4 8V6l8-4 8 4v2" fill="currentColor" fillOpacity="0.1" strokeWidth={1.5} />
    <path d="M12 2L4 6h16z" opacity="0.8" />
    <circle cx="12" cy="5" r="1" fill="currentColor" />
    <path d="M5 8h2M11 8h2M17 8h2" opacity="0.5" />
    <path d="M5 18h2M11 18h2M17 18h2" opacity="0.5" />
  </svg>
);

/** Decorative corner glyph — shield with gavel */
export const GlyphShield = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M12 22C12 22 20 18 20 11V5l-8-3-8 3v6C4 18 12 22 12 22z" fill="currentColor" fillOpacity="0.15" strokeWidth={1.5} />
    <path d="M12 22C12 22 20 18 20 11V5l-8-3" opacity="0.5" />
    <path d="M12 2v20" opacity="0.3" strokeDasharray="2 2" />
    <path d="M9 9h6v3c0 2-3 4-3 4s-3-2-3-4V9z" fill="currentColor" fillOpacity="0.25" strokeWidth={1.5} />
    <path d="M8 6h8" opacity="0.6" />
    <path d="M12 5v4" opacity="0.6" />
  </svg>
);

/** Decorative corner glyph — stamp */
export const GlyphStamp = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M6 21h12" strokeWidth={1.5} />
    <path d="M4 21h20" opacity="0.3" strokeDasharray="2 2" />
    <path d="M7 21v-4c0-2 2-3 5-3s5 1 5 3v4" fill="currentColor" fillOpacity="0.15" strokeWidth={1.5} />
    <path d="M12 14v-6" strokeWidth={1.5} />
    <circle cx="12" cy="6" r="2" fill="currentColor" fillOpacity="0.2" />
    <path d="M10 6a2 2 0 1 1 4 0 2 2 0 1 1-4 0" strokeWidth={1.5} />
    <path d="M9 14h6" opacity="0.6" />
    <path d="M8 17h8" opacity="0.4" />
  </svg>
);

export const GlyphFile = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="currentColor" fillOpacity="0.1" strokeWidth={1.5} />
    <path d="M14 2v6h6" strokeWidth={1.5} opacity="0.8" />
    <path d="M8 10h8M8 14h8M8 18h5" opacity="0.6" strokeDasharray="1 3" />
    <path d="M10 5h2" opacity="0.5" />
  </svg>
);

export const GlyphFolder = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" fill="currentColor" fillOpacity="0.1" strokeWidth={1.5} />
    <path d="M3 11h18" opacity="0.5" strokeWidth={1.5} />
    <path d="M8 15h8" opacity="0.6" strokeDasharray="1 3" />
    <path d="M10 6h4" opacity="0.4" />
  </svg>
);

export const GlyphGavel = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1}>
    <path d="M14 10l-8 8-2-2 8-8" strokeWidth={1.5} />
    <path d="M13 7l4 4" strokeWidth={1.5} />
    <path d="M11 5l3-3 7 7-3 3-7-7z" fill="currentColor" fillOpacity="0.15" strokeWidth={1.5} />
    <path d="M16 10l2 2" opacity="0.6" />
    <path d="M9 3l2 2" opacity="0.6" />
    <path d="M3 19h8" opacity="0.5" />
    <path d="M5 21h4" opacity="0.3" />
  </svg>
);

/** Minimal vertical action icon (replaces three dots) */
export const IconActionVertical = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14" />
    <circle cx="12" cy="9" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="15" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCasesPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M2 6h20v2H2z" />
    <path d="M6 3h12v3H6z" opacity="0.6" />
    <path d="M8 1h8v2H8z" opacity="0.3" />
    <path d="M12 12v6M9 14h6" />
    <path d="M9 14l-1.5 2h3L9 14z" opacity="0.6" />
    <path d="M15 14l-1.5 2h3L15 14z" opacity="0.6" />
    <path d="M10 18h4" />
  </svg>
);

export const IconCalculatorPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="2" width="16" height="20" rx="3" />
    <rect x="7" y="5" width="10" height="4" rx="1" opacity="0.8" />
    <circle cx="8" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="13" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="8" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="17" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="16" cy="17" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconTargetPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M16.5 16.5A8 8 0 1 0 12 19" opacity="0.6" />
    <circle cx="12" cy="11" r="4" />
    <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
    <path d="M12 7l3.5-3.5 1.5 1.5-3.5 3.5" />
    <circle cx="17" cy="17" r="4" />
    <path d="M15 17l1.5 1.5 2.5-2.5" />
  </svg>
);

export const IconCalendarPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M15 19H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
    <path d="M3 9h16" opacity="0.6" />
    <path d="M7 2v4M15 2v4" />
    <circle cx="17" cy="17" r="5" />
    <path d="M17 14.5v2.5l1.5 1.5" />
  </svg>
);

export const IconDocumentsPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M7 6v14a2 2 0 0 0 2 2h10" opacity="0.6" />
    <path d="M10 2h6l4 4v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
    <path d="M16 2v4h4" opacity="0.6" />
    <circle cx="14" cy="13" r="3" />
    <path d="M13 12h2M13 14h1" opacity="0.6" />
  </svg>
);

export const IconMicPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="8" y="2" width="8" height="12" rx="4" />
    <rect x="10" y="4" width="4" height="4" rx="2" opacity="0.6" />
    <path d="M5 11v1a7 7 0 0 0 14 0v-1" opacity="0.6" />
    <path d="M12 19v3M9 22h6" />
    <circle cx="12" cy="7" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconArchivePremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <rect x="4" y="4" width="16" height="5" rx="1" />
    <path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" opacity="0.8" />
    <path d="M9 13h6" />
    <path d="M9 17h4" opacity="0.6" />
  </svg>
);

export const IconNotePremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M6 3h8l5 5v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v5h5" opacity="0.6" />
    <path d="M8 10h8M8 14h8M8 18h5" opacity="0.7" />
    <circle cx="10" cy="6" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconDictionaryPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 0-2 2V5Z" />
    <path d="M18 17.5H6a2 2 0 0 0-2 2" opacity="0.6" />
    <path d="M8 7h6M8 11h7M8 15h4" opacity="0.8" />
    <circle cx="16" cy="7" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconTelegramPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M21 3L3 10l6 3 1.5 7L14 15l5 4L21 3z" />
    <path d="M9 13l3.5-3.5" opacity="0.6" />
    <path d="M10.5 15.5L14 15l-1-2.5" opacity="0.6" />
  </svg>
);

export const IconExternalPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M13 4h7v7" />
    <path d="M20 4L11 13" />
    <path d="M17 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5" opacity="0.8" />
    <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUsersPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M3 20c.5-4 3-6 6-6s5.5 2 6 6" />
    <circle cx="16" cy="10" r="3" opacity="0.6" />
    <path d="M15 14c2 1 4 3 4 6" opacity="0.6" />
  </svg>
);

export const IconSearchPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
    <circle cx="11" cy="11" r="2" opacity="0.6" />
  </svg>
);

export const IconChartPremium = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M4 4v16h16" />
    <path d="M8 14l3.5-4 3 2.5L20 7" opacity="0.8" />
    <circle cx="8" cy="14" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="20" cy="7" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

export const IconLoader = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4a8 8 0 1 0 8 8" opacity="0.9" />
  </svg>
);
