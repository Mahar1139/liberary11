import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, School, Users, BarChart3, CreditCard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/schools", label: "Schools", icon: School },
  { href: "/super-admin/librarians", label: "Librarians", icon: Users },
  { href: "/super-admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 flex-shrink-0 border-r border-border flex flex-col bg-card">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <img src={`${basePath}/logo.svg`} alt="Logo" className="h-8 w-8" />
          <div>
            <p className="font-bold text-sm leading-tight text-foreground">Library System</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <a
                data-testid={`nav-${label.toLowerCase()}`}
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
        {children}
      </main>
    </div>
  );
}
