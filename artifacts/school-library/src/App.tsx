import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SuperAdminDashboard from "@/pages/super-admin/dashboard";
import SchoolsPage from "@/pages/super-admin/schools";
import LibrariansPage from "@/pages/super-admin/librarians";
import SuperAdminReports from "@/pages/super-admin/reports";
import SubscriptionsPage from "@/pages/super-admin/subscriptions";
import LibrarianDashboard from "@/pages/librarian/dashboard";
import BooksPage from "@/pages/librarian/books";
import IssuePage from "@/pages/librarian/issue";
import ReturnsPage from "@/pages/librarian/returns";
import StudentsPage from "@/pages/librarian/students";
import LibrarianReports from "@/pages/librarian/reports";
import SubscriptionPage from "@/pages/librarian/subscription";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[100dvh] text-muted-foreground text-sm">Loading...</div>;
  }
  if (!user) return <Redirect to="/" />;
  if (roles && !roles.includes(user.role)) return <Redirect to="/" />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[100dvh] text-muted-foreground text-sm">Loading...</div>;
  }
  if (user) {
    if (user.role === "super_admin") return <Redirect to="/super-admin/dashboard" />;
    if (user.role === "librarian_head") return <Redirect to="/librarian/dashboard" />;
  }
  return <Home />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />

      <Route path="/super-admin/dashboard">
        <PrivateRoute roles={["super_admin"]}><SuperAdminDashboard /></PrivateRoute>
      </Route>
      <Route path="/super-admin/schools">
        <PrivateRoute roles={["super_admin"]}><SchoolsPage /></PrivateRoute>
      </Route>
      <Route path="/super-admin/librarians">
        <PrivateRoute roles={["super_admin"]}><LibrariansPage /></PrivateRoute>
      </Route>
      <Route path="/super-admin/reports">
        <PrivateRoute roles={["super_admin"]}><SuperAdminReports /></PrivateRoute>
      </Route>
      <Route path="/super-admin/subscriptions">
        <PrivateRoute roles={["super_admin"]}><SubscriptionsPage /></PrivateRoute>
      </Route>

      <Route path="/librarian/dashboard">
        <PrivateRoute roles={["librarian_head"]}><LibrarianDashboard /></PrivateRoute>
      </Route>
      <Route path="/librarian/books">
        <PrivateRoute roles={["librarian_head"]}><BooksPage /></PrivateRoute>
      </Route>
      <Route path="/librarian/issue">
        <PrivateRoute roles={["librarian_head"]}><IssuePage /></PrivateRoute>
      </Route>
      <Route path="/librarian/returns">
        <PrivateRoute roles={["librarian_head"]}><ReturnsPage /></PrivateRoute>
      </Route>
      <Route path="/librarian/students">
        <PrivateRoute roles={["librarian_head"]}><StudentsPage /></PrivateRoute>
      </Route>
      <Route path="/librarian/reports">
        <PrivateRoute roles={["librarian_head"]}><LibrarianReports /></PrivateRoute>
      </Route>
      <Route path="/librarian/subscription">
        <PrivateRoute roles={["librarian_head"]}><SubscriptionPage /></PrivateRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light">
          <AuthProvider>
            <TooltipProvider>
              <AppRoutes />
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
