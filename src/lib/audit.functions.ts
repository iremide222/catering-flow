import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { organizationId: string; limit?: number; entity?: string; action?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("audit_log")
      .select("id, action, entity, entity_id, payload, created_at, user_id, profiles:user_id(full_name)")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.entity) q = q.eq("entity", data.entity);
    if (data.action) q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { entries: rows ?? [] };
  });

export const writeAuditEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    organizationId: string;
    action: string;
    entity?: string;
    entityId?: string;
    payload?: Record<string, unknown>;
  }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("audit_log").insert({
      organization_id: data.organizationId,
      user_id: userId,
      action: data.action,
      entity: data.entity ?? null,
      entity_id: data.entityId ?? null,
      payload: data.payload ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
