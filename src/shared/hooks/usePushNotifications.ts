import { useEffect, useState, useSyncExternalStore } from "react";
import { checkPush, disablePush, enablePush, pushStore, sendTestPush } from "@/shared/lib/push";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";

/**
 * Whether this device gets notifications, and the two actions that change it.
 * Every caller reads the same store, so turning them on in one place updates
 * every prompt on screen.
 */
export function usePushNotifications() {
  const state = useSyncExternalStore(pushStore.subscribe, pushStore.get);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void checkPush();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const next = await enablePush();
      if (next === "on") {
        toast.success("Notifications are on for this device");
        // Proof it works, where they can see it: a real notification arrives.
        void sendTestPush().catch(() => undefined);
      } else if (next === "blocked") {
        toast.error("Notifications are blocked. Allow them in this site's browser settings.");
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await disablePush();
      toast.success("Notifications are off for this device");
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return { state, busy, enable, disable };
}
