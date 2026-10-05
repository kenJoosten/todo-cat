// The `next` parameter of /login and /signup: where to go once signed in.
// Only a path on this site passes, so the parameter can never send anyone to another origin.
const base = "http://todo-cat.invalid";

export function returnPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) return undefined;
  // The URL parser resolves `//host`, `/\host` and stray tabs the way browsers do.
  const url = new URL(value, base);
  if (url.origin !== base) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
