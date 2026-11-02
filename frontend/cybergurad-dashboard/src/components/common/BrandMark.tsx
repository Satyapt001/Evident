export default function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M16 3.5l10.5 4.2v8.1c0 6.2-4.4 10.4-10.5 12.7C9.9 26.2 5.5 22 5.5 15.8V7.7z" />
      <path d="M11 16l3.6 3.6L21.5 12" />
    </svg>
  )
}
