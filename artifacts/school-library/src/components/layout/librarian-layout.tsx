import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, BookOpen, BookPlus, BookCheck, Users, BarChart3, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMyProfile, useGetSchool, getGetSchoolQueryKey } from "@workspace/api-client-react";
import { FrozenAccountScreen } from "@/pages/librarian/subscription";

const navItems = [
  { href: "/librarian/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/librarian/books", label: "Books", icon: BookOpen },
  { href: "/librarian/issue", label: "Issue Book", icon: BookPlus },
  { href: "/librarian/returns", label: "Returns", icon: BookCheck },
  { href: "/librarian/students", label: "Students", icon: Users },
  { href: "/librarian/reports", label: "Reports", icon: BarChart3 },
  { href: "/librarian/subscription", label: "Subscription", icon: CreditCard },
];

export default function LibrarianLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: profile } = useGetMyProfile();
  const schoolId = profile?.schoolId ?? "";
  const { data: school } = useGetSchool(schoolId, {
    query: { enabled: !!schoolId, queryKey: getGetSchoolQueryKey(schoolId) },
  });

  const isFrozen = school?.status === "frozen";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-card">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <img src={`${basePath}/logo.svg`} alt="Logo" className="h-8 w-8" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight text-foreground truncate">Library System</p>
            <p className="text-xs text-muted-foreground truncate">{school?.name ?? "Librarian"}</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  location === href || location.startsWith(href)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </a>
            </Link>
          ))}
        </nav>
        <div className="px-2 py-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={() => logout()}
            data-testid="button-signout"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {isFrozen ? <FrozenAccountScreen /> : children}
      </main>
    </div>
  );
}
