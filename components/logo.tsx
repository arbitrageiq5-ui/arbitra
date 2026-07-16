interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'full' | 'icon'
}

const sizes = {
  sm: { icon: 28, text: 'text-base', gap: 'gap-2' },
  md: { icon: 36, text: 'text-xl',  gap: 'gap-2.5' },
  lg: { icon: 48, text: 'text-3xl', gap: 'gap-3' },
}

export function ArbitrageIQLogo({ size = 'md', variant = 'full' }: LogoProps) {
  const s = sizes[size]

  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      {/* Icon mark */}
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer rounded square */}
        <rect width="36" height="36" rx="9" fill="#0E1324" />
        <rect width="36" height="36" rx="9" fill="url(#logo-bg)" opacity="0.6" />

        {/* Rising bars — arbitrage chart motif */}
        <rect x="6"  y="22" width="4" height="8"  rx="1.5" fill="#6C63FF" opacity="0.7" />
        <rect x="12" y="17" width="4" height="13" rx="1.5" fill="#00D4FF" opacity="0.85" />
        <rect x="18" y="12" width="4" height="18" rx="1.5" fill="#00D4FF" />
        <rect x="24" y="7"  width="4" height="23" rx="1.5" fill="#00FF99" />

        {/* Upward trend arrow */}
        <path
          d="M7 20 L17 10 L24 15 L30 6"
          stroke="#00D4FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />
        {/* Arrow head */}
        <path
          d="M27 6 L30 6 L30 9"
          stroke="#00D4FF"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.5"
        />

        <defs>
          <linearGradient id="logo-bg" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%"  stopColor="#6C63FF" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
        </defs>
      </svg>

      {/* Wordmark */}
      {variant === 'full' && (
        <span className={`font-extrabold tracking-tight ${s.text} leading-none select-none`}>
          <span className="text-white">Arbitrage</span>
          <span
            className="text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(90deg, #00D4FF, #6C63FF)' }}
          >
            IQ
          </span>
        </span>
      )}
    </span>
  )
}
