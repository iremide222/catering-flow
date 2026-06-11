import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { notifications: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; all?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.all) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (!data.id) throw new Error("id required");
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = data.organizationId;
    const today = new Date().toISOString().slice(0, 10);

    // Helper: skip if unread notification already exists for this entity+type
    const exists = async (type: string, entityId: string) => {
      const { data: rows } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("entity_id", entityId)
        .eq("read", false)
        .limit(1);
      return (rows ?? []).length > 0;
    };

    const inserts: any[] = [];

    // 1. Low stock
    const { data: items } = await supabase
      .from("items")
      .select("id, name, unit, reorder_level, stock_levels(quantity)")
      .eq("organization_id", orgId)
      .eq("is_active", true);
    for (const it of items ?? []) {
      const onHand = (it.stock_levels ?? []).reduce((s: number, sl: any) => s + Number(sl.quantity ?? 0), 0);
      if (Number(it.reorder_level) > 0 && onHand <= Number(it.reorder_level)) {
        if (!(await exists("low_stock", it.id))) {
          inserts.push({
            organization_id: orgId,
            user_id: userId,
            type: "low_stock",
            title: "Low stock",
            message: `${it.name} is at ${onHand} ${it.unit} (reorder: ${it.reorder_level}).`,
            link: `/app/inventory/${it.id}`,
            entity_type: "item",
            entity_id: it.id,
          });
        }
      }
    }

    // 2. Overdue invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, amount_paid, due_date, customers(name)")
      .eq("organization_id", orgId)
      .lt("due_date", today)
      .neq("status", "void")
      .neq("status", "paid");
    for (const inv of invoices ?? []) {
      const bal = Number(inv.total) - Number(inv.amount_paid);
      if (bal > 0) {
        if (!(await exists("overdue_invoice", inv.id))) {
          inserts.push({
            organization_id: orgId,
            user_id: userId,
            type: "overdue_invoice",
            title: "Overdue invoice",
            message: `${inv.invoice_number} — ${(inv as any).customers?.name ?? "Customer"} owes ${bal.toFixed(2)} (due ${inv.due_date}).`,
            link: `/app/invoices/${inv.id}`,
            entity_type: "invoice",
            entity_id: inv.id,
          });
        }
      }
    }

    // 3. Upcoming events (within 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const { data: events } = await supabase
      .from("events")
      .select("id, title, event_date, status")
      .eq("organization_id", orgId)
      .gte("event_date", today)
      .lte("event_date", nextWeek.toISOString().slice(0, 10))
      .neq("status", "closed")
      .neq("status", "cancelled");
    for (const ev of events ?? []) {
      if (!(await exists("upcoming_event", ev.id))) {
        inserts.push({
          organization_id: orgId,
          user_id: userId,
          type: "upcoming_event",
          title: "Upcoming event",
          message: `${ev.title} is on ${ev.event_date}.`,
          link: `/app/events/${ev.id}`,
          entity_type: "event",
          entity_id: ev.id,
        });
      }
    }

    // 4. Overdue tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, due_date, status")
      .eq("organization_id", orgId)
      .lt("due_date", today)
      .neq("status", "done");
    for (const t of tasks ?? []) {
      if (!(await exists("task_due", t.id))) {
        inserts.push({
          organization_id: orgId,
          user_id: userId,
          type: "task_due",
          title: "Overdue task",
          message: `${t.title} was due ${t.due_date}.`,
          link: `/app/tasks`,
          entity_type: "task",
          entity_id: t.id,
        });
      }
    }

    // Deduplicate inserts by entity_id+type before sending
    const seen = new Set<string>();
    const unique = inserts.filter((n) => {
      const key = `${n.type}:${n.entity_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length > 0) {
      const { error } = await supabase.from("notifications").insert(unique);
      if (error) throw new Error(error.message);
    }

    return { created: unique.length };
  });
