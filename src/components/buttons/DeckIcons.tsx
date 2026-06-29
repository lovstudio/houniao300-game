// Compact line icons for the masthead control deck. 16px, currentColor stroke.
const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const SnowflakeIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
  </svg>
);

export const PlayIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const MusicIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="16" cy="16" r="3" />
  </svg>
);

export const MuteIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M11 5 6 9H3v6h3l5 4z" />
    <path d="m17 9 4 6M21 9l-4 6" />
  </svg>
);

export const JoinIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M18 8v6M15 11h6" />
  </svg>
);

export const LeaveIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0M15 11h6" />
  </svg>
);

export const PersonIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="7" r="3.4" />
    <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
  </svg>
);

export const CameraIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M3 8h3l1.5-2h9L18 8h3v11H3z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);

export const PhotoIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M4 5h16v14H4z" />
    <circle cx="9" cy="10" r="2" />
    <path d="m4 16 4.5-4.5L13 16l2.5-2.5L20 18" />
  </svg>
);

export const FollowIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
);

export const FreeMoveIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </svg>
);

export const ExpandIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5" />
  </svg>
);

export const ShrinkIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M3 8h5V3M16 3v5h5M21 16h-5v5M8 21v-5H3" />
  </svg>
);

export const GearIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" />
  </svg>
);

export const CollisionIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M4 4h16v16H4zM4 12h16M12 4v16" />
    <path d="m7 17 10-10" />
  </svg>
);

export const LocateIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export const ChevronIcon = () => (
  <svg {...base} aria-hidden>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...base} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.6 2.2-2.6 4" />
    <circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const VersionIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M7 4h7l5 5v11H7z" />
    <path d="M14 4v5h5M10 14h6M10 17h4" />
  </svg>
);
