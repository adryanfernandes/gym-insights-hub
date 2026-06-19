import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useApp } from "@/contexts/AppContext";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loadingAuth } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loadingAuth && !user) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loadingAuth, navigate, user]);

  if (loadingAuth || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <Outlet />;
}
