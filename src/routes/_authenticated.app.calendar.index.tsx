import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/calendar/")({
  head: () => ({ meta: [{ title: "Calendar — CaterFlow" }] }),
  component: CalendarPage,
});

const STATUS_COLOR: Record<string, string> = {
  inquiry: "bg-muted text-muted-foreground",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-destructive/15 text-destructive",
};

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function CalendarPage() {
  const { currentOrgId } = useAuth();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const rangeStart = useMemo(() => startOfMonth(cursor), [cursor]);
  const rangeEnd = useMemo(() => addMonths(rangeStart, 1), [rangeStart]);

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", currentOrgId, ymd(rangeStart)],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id,name,event_date,status,guest_count,customers(name)")
        .eq("organization_id", currentOrgId!)
        .gte("event_date", ymd(rangeStart))
        .lt("event_date", ymd(rangeEnd))
        .order("event_date");
      return data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const e of events as any[]) {
      const key = e.event_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [events]);

  // Build grid: 6 weeks × 7 days, starting on Sunday
  const grid = useMemo(() => {
    const firstDow = rangeStart.getDay();
    const start = new Date(rangeStart);
    start.setDate(start.getDate() - firstDow);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [rangeStart]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = ymd(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground">Events scheduled across your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-40 text-center text-sm font-medium">{monthLabel}</div>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>Today</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((d, i) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayEvents = byDay.get(key) ?? [];
              const isToday = key === today;
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-28 border-b border-r p-1.5 text-left align-top",
                    !inMonth && "bg-muted/20 text-muted-foreground/60",
                    (i + 1) % 7 === 0 && "border-r-0",
                    i >= 35 && "border-b-0",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                      isToday && "bg-primary text-primary-foreground font-semibold",
                    )}>
                      {d.getDate()}
                    </span>
                    {dayEvents.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e: any) => (
                      <Link
                        key={e.id}
                        to="/app/events/$id"
                        params={{ id: e.id }}
                        className={cn(
                          "block truncate rounded px-1.5 py-0.5 text-[11px] leading-tight hover:opacity-80",
                          STATUS_COLOR[e.status] ?? "bg-muted",
                        )}
                        title={`${e.name} · ${e.customers?.name ?? ""}`}
                      >
                        {e.name}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="px-1.5 text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Legend:</span>
        {Object.keys(STATUS_COLOR).map((s) => (
          <Badge key={s} variant="outline" className={cn("border-transparent", STATUS_COLOR[s])}>{s.replace("_", " ")}</Badge>
        ))}
      </div>

      {events.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No events in {monthLabel}.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
