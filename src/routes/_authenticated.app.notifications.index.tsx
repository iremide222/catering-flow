import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { getNotifications, markNotificationRead } from "@/lib/notifications.functions";
import { formatDate } from "@/lib/format";
import { Bell, Package, Receipt, CalendarDays, CheckSquare, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/notifications/")({
  head: () => ({ meta: [{ title: "Notifications — CaterFlow" }] }),
  component: NotificationsPage,
});

const TYPE_ICON: Record<string, React.ElementType> = {
  low_stock: Package,
  overdue_invoice: Receipt,
  upcoming_event: CalendarDays,
  task_due: CheckSquare,
};

const TYPE_COLOR: Record<string, string> = {
  low_stock: "bg-amber-500/10 text-amber-600",
  overdue_invoice: "bg-red-500/10 text-red-600",
  upcoming_event: "bg-blue-500/10 text-blue-600",
  task_due: "bg-purple-500/10 text-purple-600",
};

function NotificationsPage() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const fetchList = useServerFn(getNotifications);
  const markRead = useServerFn(markNotificationRead);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
    enabled: !!currentOrgId,
  });

  const notifications = data?.notifications ?? [];
  const unread = notifications.filter((n: any) => !n.read);

  const markAllRead = async () => {
    await markRead({ data: { all: true } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const markOne = async (id: string) => {
    await markRead({ data: { id } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread.length} unread {unread.length === 1 ? "alert" : "alerts"}
          </p>
        </div>
        {unread.length > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Bell className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n: any) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            const color = TYPE_COLOR[n.type] ?? "bg-muted text-muted-foreground";
            return (
              <Card key={n.id} className={n.read ? "opacity-70" : ""}>
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`mt-0.5 rounded-full p-2 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {!n.read && <Badge variant="default" className="h-5 text-[10px]">New</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatDate(n.created_at)}</span>
                      {n.link && (
                        <Link to={n.link} className="text-primary hover:underline">
                          View
                        </Link>
                      )}
                      {!n.read && (
                        <button
                          onClick={() => markOne(n.id)}
                          className="text-primary hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
