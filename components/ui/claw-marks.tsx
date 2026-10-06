// The signature detail (tech-docs/ui.md): three tapered amber scratches across a done todo's
// title instead of a line-through. Place it inside a `relative` element around the title;
// it covers the title's first line, so a wrapped title keeps its scratches in proportion.
// `swipe` draws them once, left to right, for a todo checked off while you watch.
export function ClawMarks({ swipe = false }: { swipe?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute top-0 -left-1 h-[1lh] w-[calc(100%+0.5rem)] fill-amber ${swipe ? "claw-swipe" : ""}`}
    >
      {/* Each scratch is a sliver, sharp at both ends and thickest in the middle, rising to
          the right; each starts a little later and runs a little shorter, as a paw drags. */}
      <path d="M0 13 C33 7.8 67 4.4 100 3 C67 8.2 33 11.6 0 13 Z" />
      <path d="M5 18.5 C33 13.6 62 10.5 90 9 C62 13.9 33 17 5 18.5 Z" />
      <path d="M12 22.5 C40 18 69 15 97 13.5 C69 18 40 21 12 22.5 Z" />
    </svg>
  );
}
