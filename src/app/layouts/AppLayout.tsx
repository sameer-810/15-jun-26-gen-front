import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabBar } from "./MobileTabBar";
import { SidebarProvider } from "./sidebarContext";
import { PageLoader } from "@/shared/components/PageLoader";
import { ReminderAlerts } from "@/modules/lead/components/ReminderAlerts";
import { syncPushSubscription } from "@/shared/lib/push";

export function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  /*
    A new screen starts at its top.

    <main> is the scroller and it outlives every screen inside it, so without
    this a lead opened from thirty cards down the list arrives already scrolled
    thirty cards down. A list that remembers its own position puts it back
    afterwards (see ResourceListPage), which is why this is a layout effect and
    that one is not.
  */
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  // If this device already has notifications on, file it under whoever is
  // signed in now. Asks for nothing and shows nothing.
  useEffect(() => {
    void syncPushSubscription();
  }, []);

  return (
    <SidebarProvider>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          {/*
            `pb-24` below md clears the fixed tab bar and the FAB that sits above
            it. Without it the last card on every list is permanently hidden
            behind the bar — the classic bottom-navigation bug, and the one that
            makes users think a list is truncated.
          */}
          <main
            ref={mainRef}
            className="flex-1 overflow-auto bg-background p-4 pb-24 md:p-6 md:pb-6"
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <MobileTabBar />
        {/* In the shell so a due reminder reaches you on whichever screen you are on. */}
        <ReminderAlerts />
      </div>
    </SidebarProvider>
  );
}
