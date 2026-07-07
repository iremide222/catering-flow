import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { writeAuditEntry } from "./audit.functions";
import { useAuth } from "./auth-context";

/**
 * Client-side helper for fire-and-forget audit log writes.
 * Silently swallows errors so audit failures never block user flows.
 */
export function useAuditLog() {
  const { currentOrgId } = useAuth();
  const write = useServerFn(writeAuditEntry);
  return useCallback(
    (action: string, entity?: string, entityId?: string, payload?: Record<string, unknown>) => {
      if (!currentOrgId) return;
      void write({
        data: { organizationId: currentOrgId, action, entity, entityId, payload },
      }).catch(() => {});
    },
    [currentOrgId, write],
  );
}
