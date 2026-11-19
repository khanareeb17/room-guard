export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <path d="M32 4 8 13v17c0 15.5 10.2 26.6 24 30 13.8-3.4 24-14.5 24-30V13L32 4Z" fill="#14b8a6" />
      <path d="M32 9.5 13 16.6v13.6c0 12.6 8 21.6 19 24.6 11-3 19-12 19-24.6V16.6L32 9.5Z" fill="#0a1020" />
      <circle cx="32" cy="31" r="12" fill="none" stroke="#2dd4bf" strokeWidth="4" />
      <circle cx="32" cy="31" r="5" fill="#2dd4bf" />
      <circle cx="35.5" cy="27.5" r="2" fill="#fff" />
    </svg>
  );
}
