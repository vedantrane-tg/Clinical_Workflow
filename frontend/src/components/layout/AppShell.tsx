import type { ReactNode } from "react";
import { Navigate, useRouterState } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";
import { useSession } from "@/hooks/useSession";

export function AppShell({ children }: { children: ReactNode }) {
  const { signedIn, loading } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Restoring session…
      </div>
    );
  }

  if (isAuthPage) {
    if (signedIn) return <Navigate to="/" />;
    return <>{children}</>;
  }

  if (!signedIn) return <Navigate to="/login" />;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="sticky top-0 hidden h-screen lg:block">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-2 lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <AppSidebar />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">ClinicalFlow AI</span>
        </div>
        <TopHeader />
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div key={pathname} className="page-enter mx-auto w-full max-w-[1400px] space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
