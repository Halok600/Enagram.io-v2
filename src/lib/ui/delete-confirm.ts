/** How long an armed Delete button ignores clicks, so a fast double-click cannot arm and confirm in one go. */
export const CONFIRM_DELAY_MS = 700;

/**
 * Whether a click on an armed "SURE? DELETE" button may confirm the delete.
 * - `armedAtMs`: when the first click armed the button, or null if it is not armed.
 * - `clickDetail`: the click event's `detail` (1 for a single click, 2 for the second click of a double-click,
 *   0 for a keyboard activation).
 * Not armed, too soon after arming, or a repeated click of a multi-click: no.
 */
export function canConfirmDelete(armedAtMs: number | null, nowMs: number, clickDetail: number): boolean {
  if (armedAtMs === null) return false;
  if (nowMs - armedAtMs < CONFIRM_DELAY_MS) return false;
  if (clickDetail > 1) return false;
  return true;
}
