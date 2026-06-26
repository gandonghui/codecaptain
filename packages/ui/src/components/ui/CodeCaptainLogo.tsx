import React from 'react';

interface CodeCaptainLogoProps {
  className?: string;
  width?: number;
  height?: number;
  /** Kept for API compatibility with previous callers; currently a no-op. */
  isAnimated?: boolean;
}

// Brand mark (the stylised "M" + accent underline). Black strokes use
// `currentColor` so the mark adapts to light/dark themes; the underline keeps the
// brand purple. Source of truth for the artwork is
// packages/electron/resources/icons/icon-source.svg — keep the two in sync if the
// logo changes (that SVG also drives the app/installer/tray icons via gen-icons).
const ACCENT = 'rgb(115,68,227)';

export const CodeCaptainLogo: React.FC<CodeCaptainLogoProps> = ({
  className,
  width = 120,
  height = 120,
}) => {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="110 267 190 190"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Medcaptain"
    >
      <path
        transform="translate(202.0063 286.0004)"
        d="M 77.8970 0 C 77.8970 0, 0 111.2490, 0 111.2490 C 0 111.2490, 21.2410 111.2490, 21.2410 111.2490 C 21.2410 111.2490, 77.8970 30.3360, 77.8970 30.3360 C 77.8970 30.3360, 77.8970 111.2490, 77.8970 111.2490 C 77.8970 111.2490, 95.2970 111.2490, 95.2970 111.2490 C 95.2970 111.2490, 95.2970 5.4850, 95.2970 5.4850 C 95.2970 5.4850, 95.2970 0, 95.2970 0 C 95.2970 0, 77.8970 0, 77.8970 0 Z"
        fill="currentColor"
      />
      <path
        transform="translate(141.7510 286.0004)"
        d="M 77.8970 0 C 77.8970 0, 0 111.2490, 0 111.2490 C 0 111.2490, 21.2410 111.2490, 21.2410 111.2490 C 21.2410 111.2490, 77.8970 30.3360, 77.8970 30.3360 C 77.8970 30.3360, 77.8970 61.3740, 77.8970 61.3740 C 77.8970 61.3740, 95.2970 61.3740, 95.2970 61.3740 C 95.2970 61.3740, 95.2970 5.4850, 95.2970 5.4850 C 95.2970 5.4850, 95.2970 0, 95.2970 0 C 95.2970 0, 77.8970 0, 77.8970 0 Z"
        fill="currentColor"
      />
      <path
        transform="translate(120.0000 405.7494)"
        d="M 0 0 C 0 0, 0 5.5170, 0 5.5170 C 0 5.5170, 73.3060 25.1580, 73.3060 25.1580 C 73.3060 25.1580, 73.3060 0, 73.3060 0 C 73.3060 0, 0 0, 0 0 Z"
        fill={ACCENT}
      />
      <path
        transform="translate(202.0057 405.7494)"
        d="M 95.2980 0 C 95.2980 0, 0 0, 0 0 C 0 0, 0 6.6820, 0 6.6820 C 0 6.6820, 95.2980 32.2170, 95.2980 32.2170 C 95.2980 32.2170, 95.2980 0, 95.2980 0 Z"
        fill={ACCENT}
      />
    </svg>
  );
};

export default CodeCaptainLogo;
