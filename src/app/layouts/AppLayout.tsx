import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileTabBar } from "./MobileTabBar";
import { SidebarProvider } from "./sidebarContext";
import { PageLoader } from "@/shared/components/PageLoader";
import { ReminderAlerts } from "@/modules/lead/components/ReminderAlerts";

export function AppLayout() {
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
          <main className="flex-1 overflow-auto bg-background p-4 pb-24 md:p-6 md:pb-6">
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
