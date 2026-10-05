import type { ErrorCode } from "@todo-cat/contract";

// Every failure ends in a CliError with a stable code, which is the API's own code when the
// server sent one, and the exit code agents branch on.

// `satisfies` fails to compile when the contract adds an error code without an exit code here.
const exitCodeByError = {
  "internal-error": 1,
  "server-error": 1,
  "unexpected-response": 1,
  usage: 2,
  "validation-failed": 2,
  "confirmation-required": 2,
  "not-logged-in": 3,
  unauthorized: 3,
  "todo-not-found": 4,
  "server-unreachable": 5,
  "login-denied": 6,
  "login-expired": 6,
} as const satisfies Record<ErrorCode, number> & Record<string, number>;

export type CliErrorCode = keyof typeof exitCodeByError;

const exitMeanings = [
  "success",
  "unexpected error",
  "usage error or invalid input",
  "not logged in, or the session ended",
  "todo not found",
  "server unreachable",
  "login denied or expired",
];

export class CliError extends Error {
  readonly exitCode: number;

  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCodeByError[code];
  }
}

/** The exit code table for --help, one line per exit code with the error codes behind it. */
export function exitCodesHelp(): string {
  const lines = exitMeanings.map((meaning, exit) => {
    const codes = Object.entries(exitCodeByError)
      .filter(([, code]) => code === exit)
      .map(([name]) => name);
    return `  ${exit}  ${meaning}${codes.length > 0 ? ` (${codes.join(", ")})` : ""}`;
  });
  return `Exit codes:\n${lines.join("\n")}`;
}
