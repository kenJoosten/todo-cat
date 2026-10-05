// A one-time code the user compares with another screen, large and in the monospace face.
export function UserCode({ code }: { code: string }) {
  return (
    <p className="mt-10 w-fit rounded-md border-2 border-ink bg-white px-5 py-3 font-mono text-3xl font-semibold tracking-[0.2em]">
      {code}
    </p>
  );
}
