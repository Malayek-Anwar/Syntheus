import Link from 'next/link'

interface BrandLogoProps {
  className?: string
  iconSize?: string
  textSize?: string
  subtitle?: string
  href?: string
}

export function BrandLogo({
  className = '',
  iconSize = 'w-8 h-8',
  textSize = 'text-xl',
  subtitle,
  href,
}: BrandLogoProps) {
  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${iconSize} rounded-xl bg-[#176b61] text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0`}>
        S
      </div>
      <div className="flex flex-col min-w-0">
        <span className={`${textSize} font-semibold text-[#24302d] tracking-tight leading-tight`}>
          Syntheus
        </span>
        {subtitle && (
          <span className="text-[10px] text-[#176b61] font-semibold tracking-wider uppercase leading-none mt-0.5">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} aria-label="Syntheus Home" className="inline-flex items-center hover:opacity-90 transition-opacity">
        {content}
      </Link>
    )
  }

  return content
}
