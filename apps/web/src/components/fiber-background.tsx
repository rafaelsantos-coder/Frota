type FiberBackgroundProps = {
  variant?: "full" | "strip";
};

/** Linhas de fibra óptica — identidade Sulnet laranja/branco */
export function FiberBackground({ variant = "full" }: FiberBackgroundProps) {
  return (
    <div className={`fiber-bg fiber-bg--${variant}`} aria-hidden="true">
      <svg className="fiber-svg" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="fiberOrange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff7a18" />
            <stop offset="55%" stopColor="#ff5500" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
          </linearGradient>
          <filter id="fiberGlow">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="1200" height="200" fill="url(#fiberOrange)" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <path
            key={i}
            d={`M -20 ${30 + i * 22} C 180 ${10 + i * 18}, 420 ${70 + i * 12}, 680 ${25 + i * 20} S 980 ${80 + i * 8}, 1220 ${35 + i * 16}`}
            fill="none"
            stroke="url(#lineGlow)"
            strokeWidth={1 + (i % 2)}
            opacity={0.45 + (i % 3) * 0.15}
            filter="url(#fiberGlow)"
          />
        ))}
        {[90, 340, 580, 820, 1050].map((x, i) => (
          <circle key={x} cx={x} cy={60 + (i % 3) * 35} r="2.5" fill="#fff" opacity="0.9" filter="url(#fiberGlow)" />
        ))}
        <g transform="translate(1020, 48)" opacity="0.85">
          <path
            d="M0 24 C0 11 11 0 24 0 C37 0 48 11 48 24 C48 37 37 48 24 48 C11 48 0 37 0 24 Z M24 12 C17 12 12 17 12 24 C12 31 17 36 24 36 C31 36 36 31 36 24 C36 17 31 12 24 12 Z"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
          />
          <path d="M24 36 L24 56 M12 44 L24 36 L36 44" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
