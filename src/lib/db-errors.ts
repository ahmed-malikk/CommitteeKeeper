/**
 * The database's own refusals are written for people ("A turn that was already paid out cannot be swapped"),
 * so they are shown as they are. Anything else (a lost connection, a bug) gets a plain sentence and a log line.
 */
export function explainDbError(error: { code?: string; message: string }, doing: string): string {
  if (error.code === "P0001" && error.message !== "Not allowed") return error.message;
  console.error(`${doing} failed:`, error.code, error.message);
  return `We couldn't ${doing}. Nothing was changed. Check the connection and try again.`;
}
