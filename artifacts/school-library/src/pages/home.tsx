import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Users, BarChart3, Shield, Clock, Star, CheckCircle, Library, Eye, EyeOff, AlertCircle } from "lucide-react";

const features = [
  { icon: BookOpen, label: "Book Management", desc: "Track every book — issue, return, and availability at a glance.", color: "bg-blue-500/10 text-blue-600" },
  { icon: Users, label: "Student Records", desc: "Manage student profiles and full borrowing history.", color: "bg-green-500/10 text-green-600" },
  { icon: BarChart3, label: "Reports & Fines", desc: "Auto-calculate ₹2/day overdue fines and export reports.", color: "bg-orange-500/10 text-orange-600" },
  { icon: Shield, label: "Role-Based Access", desc: "Super Admin and Librarian roles with separate dashboards.", color: "bg-purple-500/10 text-purple-600" },
];

const stats = [
  { value: "5000+", label: "Books Managed" },
  { value: "1200+", label: "Active Students" },
  { value: "99.9%", label: "Uptime" },
  { value: "₹2/day", label: "Fine Rate" },
];

const highlights = [
  "Instant book search & availability check",
  "Automated overdue fine calculations",
  "Detailed borrowing history per student",
  "Export reports to PDF & Excel",
];

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</Label>
        <Input
          id="email"
          type="email"
          placeholder="admin@school.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-11"
          autoComplete="email"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 pr-10"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </Button>
    </form>
  );
}

function SetupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { refresh } = useAuth();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, fullName, phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Setup failed");
      }
      await refresh();
      setLocation("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="setup-name">Full Name</Label>
        <Input id="setup-name" placeholder="Administrator Name" value={fullName} onChange={e => setFullName(e.target.value)} required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-email">Email</Label>
        <Input id="setup-email" type="email" placeholder="admin@school.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-phone">Phone (optional)</Label>
        <Input id="setup-phone" placeholder="+91 9876543210" value={phone} onChange={e => setPhone(e.target.value)} className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-password">Password</Label>
        <div className="relative">
          <Input
            id="setup-password"
            type={showPassword ? "text" : "password"}
            placeholder="Min 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="h-10 pr-10"
          />
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <Button type="submit" className="w-full h-10 font-semibold" disabled={loading}>
        {loading ? "Creating account..." : "Create Admin Account"}
      </Button>
    </form>
  );
}

export default function Home() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [showSetup, setShowSetup] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <img src={`${base}/logo.svg`} alt="Logo" className="h-8 w-8" />
        <span className="font-bold text-foreground text-base">School Library</span>
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">Admin Portal</span>
      </header>

      <section className="relative overflow-hidden bg-primary text-primary-foreground py-12 px-6">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px), radial-gradient(circle at 60% 80%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px, 80px 80px, 50px 50px",
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col lg:flex-row gap-10 items-center">
          <div className="flex-1 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 text-sm font-medium">
              <Library className="h-4 w-4" />
              School Library Management System
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">
              Your Library, Organised & Effortless
            </h1>
            <p className="text-primary-foreground/75 text-base leading-relaxed max-w-md">
              A modern, all-in-one platform built for school librarians and administrators.
            </p>
          </div>

          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl text-foreground">
            {showSetup ? (
              <>
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-foreground">First Time Setup</h2>
                  <p className="text-muted-foreground text-sm mt-1">Create your Super Admin account.</p>
                </div>
                <SetupForm />
                <button className="mt-3 text-xs text-muted-foreground hover:text-foreground w-full text-center" onClick={() => setShowSetup(false)}>
                  Already have an account? Sign in
                </button>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-foreground">Welcome back</h2>
                  <p className="text-muted-foreground text-sm mt-1">Sign in to access the dashboard.</p>
                </div>
                <LoginForm />
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground">
                    First time here?{" "}
                    <button className="text-primary hover:underline font-medium" onClick={() => setShowSetup(true)}>
                      Set up admin account
                    </button>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/40">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          {stats.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-6 px-4 text-center">
              <span className="text-2xl font-extrabold text-primary">{value}</span>
              <span className="text-xs text-muted-foreground mt-1">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 px-6 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-foreground">About This System</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto">
            Built specifically for school environments — no technical knowledge required.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          {features.map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="flex gap-4 p-5 rounded-2xl border border-border bg-card hover:shadow-md transition-shadow">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">{label}</h3>
                <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-14 px-6 bg-muted/30 border-y border-border">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
              <Star className="h-3.5 w-3.5" />
              Why Choose This System
            </div>
            <h2 className="text-2xl font-bold text-foreground leading-snug">
              Everything a school library needs, in one place
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Designed with simplicity in mind, this system eliminates manual record-keeping and reduces errors.
            </p>
            <ul className="space-y-2.5 mt-4">
              {highlights.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: BookOpen, title: "Book Catalogue", sub: "Add, edit, and search your full collection instantly." },
              { icon: Clock, title: "Due Date Alerts", sub: "Never miss a return date with smart reminders." },
              { icon: Users, title: "Student Profiles", sub: "Complete borrowing history for every student." },
              { icon: BarChart3, title: "Analytics", sub: "Insights on popular books and borrowing trends." },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-4 space-y-2 hover:shadow-md transition-shadow">
                <Icon className="h-6 w-6 text-primary" />
                <h4 className="font-semibold text-sm text-foreground">{title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-center py-5 text-xs text-muted-foreground border-t border-border bg-muted/30">
        School Library Management System &mdash; Admin Portal &mdash; © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
