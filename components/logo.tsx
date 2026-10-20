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
  const logoSize = size === 'lg' ? 76 : size === 'md' ? 52 : 36

  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      <img
        src="/algobot-logo.png"
        alt="Algobot"
        width={logoSize}
        height={logoSize}
        className="rounded-xl object-cover shadow-[0_0_24px_rgba(0,153,255,0.22)]"
      />
      {variant === 'full' && (
        <span className={`font-extrabold tracking-tight ${s.text} leading-none select-none`}>
          <span className="text-white">Algo</span>
          <span className="text-[#13bfff]">Bot</span>
        </span>
      )}
    </span>
  )
}
