// The signature detail (tech-docs/ui.md): three tapered amber scratches across a done todo's
// title instead of a line-through. Place it inside a `relative` element around the title.
// `swipe` draws them once, left to right, for a todo checked off while you watch.
export function ClawMarks({ swipe = false }: { swipe?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-y-0 -left-1 h-full w-[calc(100%+0.5rem)] fill-amber ${swipe ? "claw-swipe" : ""}`}
    >
      {/* Each scratch is a sliver, thin at both ends, rising a little to the right. */}
      <path d="M0 8 C35 5.8 70 4.2 100 3 C70 6.4 35 9 0 8 Z" />
      <path d="M3 13.6 C37 11.4 71 9.8 100 8.8 C71 12 37 14.6 3 13.6 Z" />
      <path d="M7 19.2 C40 17 73 15.4 97 14.6 C73 17.6 40 20.2 7 19.2 Z" />
    </svg>
  );
}
