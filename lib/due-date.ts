const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

/**
 * A due date as people read it, "9 Oct" from "2026-10-09", for the sidebar and the chat.
 * Never through a JavaScript Date, which would show the previous day west of Greenwich.
 */
export function dueDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-").map(Number);
  return `${day} ${months[month - 1]}`;
}
