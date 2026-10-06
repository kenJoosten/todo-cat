// How far along something is: a track in the line color, with her amber filling the done
// part, as the claw marks do on a done todo. It never animates; the claw marks are the only
// decorative motion (tech-docs/ui.md).
export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  /** The accessible name; the numbers themselves are read from the value and max. */
  label: string;
}) {
  const total = Math.max(max, 0);
  const done = Math.min(Math.max(value, 0), total);
  const percent = total > 0 ? (done / total) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-valuetext={`${done} of ${total}`}
      className="h-2 w-full overflow-hidden rounded-full bg-line"
    >
      <div
        className="h-full rounded-full bg-amber"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
