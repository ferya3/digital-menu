/**
 * Error result from a Server Action.
 * In production Next.js hides the message of thrown errors and the client only gets a generic text;
 * so actions *return* the error and the client re-throws it (with the proper message) via unwrap.
 */
export type ActionFail = { __error: string };

export function unwrap<T>(r: T | ActionFail): T {
  if (r && typeof r === "object" && "__error" in (r as object)) throw new Error((r as ActionFail).__error);
  return r as T;
}
