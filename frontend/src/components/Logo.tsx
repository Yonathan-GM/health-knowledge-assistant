export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" fill="#0b6e64" />
      <path
        d="M10 7h8l5 5v13a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"
        fill="#fff"
      />
      <path d="M18 7v5h5" stroke="#0b6e64" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M13 18h6M16 15v6" stroke="#0b6e64" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-serif text-base font-semibold leading-tight tracking-tight sm:text-lg">
        Health Knowledge Assistant
      </span>
    </span>
  );
}
