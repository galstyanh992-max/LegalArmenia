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
  <svg {...base(size)} {...p} strokeWidth={1.2}>
    <path d="M12 4v16" />
    <path d="M5 8h14" />
    <path d="M5 8l-3 6a4 4 0 0 0 6 0L5 8Z" opacity="0.85" />
    <path d="M19 8l-3 6a4 4 0 0 0 6 0L19 8Z" opacity="0.85" />
    <path d="M7 20h10" />
    <path d="M9 4l3-1 3 1" opacity="0.7" />
  </svg>
);

/** Decorative corner glyph — court columns */
export const GlyphColumns = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1.2}>
    <path d="M4 20h16" />
    <path d="M5 17h14" opacity="0.8" />
    <path d="M7 17V9M11 17V9M13 17V9M17 17V9" />
    <path d="M4 8h16l-8-4-8 4Z" />
  </svg>
);

/** Decorative corner glyph — shield with gavel */
export const GlyphShield = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1.2}>
    <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3Z" />
    <path d="M9.5 13.5 14 9l1 1-4.5 4.5-1.5.5.5-1.5Z" opacity="0.85" />
  </svg>
);

/** Decorative corner glyph — stamp */
export const GlyphStamp = ({ size = 64, ...p }: IconProps) => (
  <svg {...base(size)} {...p} strokeWidth={1.2}>
    <path d="M6 20h12" />
    <path d="M8.5 17h7v-3a3 3 0 0 0-3-3h-1a3 3 0 0 0-3 3v3Z" />
    <path d="M12 4v4" />
    <circle cx="12" cy="9" r="1.4" />
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

/** Loader — premium spinning ring */
export const IconLoader = ({ size = 20, ...p }: IconProps) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4a8 8 0 1 0 8 8" opacity="0.9" />
  </svg>
);
