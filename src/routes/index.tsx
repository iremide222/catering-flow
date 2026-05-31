import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Package, BarChart3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CaterFlow ERP — Catering business management" },
      { name: "description", content: "Run events, quotes, customers, inventory, staff and finance from one place." },
      { property: "og:title", content: "CaterFlow ERP" },
      { property: "og:description", content: "The operations system for catering teams." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold tracking-tight">CaterFlow</div>
          <nav className="flex gap-2">
            <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/signup"><Button>Get started</Button></Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Run your catering business from one operations system.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          CaterFlow ERP brings events, quotations, customers, inventory, staff and finance
          together so your team can quote faster and deliver every event on time.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup"><Button size="lg">Create your workspace</Button></Link>
          <Link to="/login"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: CalendarDays, title: "Events & quotations", body: "From inquiry to delivery, with versioned quotes and a shared calendar." },
          { icon: Users, title: "CRM", body: "Customer history, preferences, follow-ups and spend at a glance." },
          { icon: Package, title: "Inventory & procurement", body: "Stock movements, low-stock alerts and supplier orders linked to events." },
          { icon: BarChart3, title: "Finance & reporting", body: "Revenue, expenses and per-event profit calculated automatically." },
          { icon: ShieldCheck, title: "Roles & audit", body: "Admin, Manager, Accountant, Store and Staff roles with full activity log." },
          { icon: CalendarDays, title: "Multi-tenant", body: "Run multiple catering brands in one install with isolated data." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border bg-card p-6">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} CaterFlow ERP
        </div>
      </footer>
    </div>
  );
}
