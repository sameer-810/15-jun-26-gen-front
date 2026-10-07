import { clearMemory } from "@/shared/lib/sessionMemory";
import { forgetPushOnSignOut } from "@/shared/lib/push";

/**
 * What has to happen before the session is dropped, while there is still a
 * token to do it with.
 *
 *  - The tab forgets where the last person was: their search text and filters
 *    must not be waiting for whoever signs in next.
 *  - This device stops receiving the last person's reminders. Staff share
 *    office PCs, and a reminder naming a customer is not something to deliver
 *    to the next person at the desk.
 *
 * Never rejects and never takes long — a log out must always work.
 */
export async function beforeSignOut() {
  clearMemory();
  await forgetPushOnSignOut();
}
