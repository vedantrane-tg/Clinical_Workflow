import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { TopHeader } from "./TopHeader";
import { useSession } from "@/hooks/useSession";

function SignedOut() {
  const { signIn, user } = useSession();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold text-foreground">ClinicalFlow AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Session ended. Authentication is handled by Amazon Cognito in production; this demo uses a mock
          session.
        </p>
        <Button className="mt-5 w-full" onClick={signIn}>
          Sign back in as {user.name}
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { signedIn } = useSession();
  if (!signedIn) return <SignedOut />;

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
          <div className="mx-auto w-full max-w-[1400px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}