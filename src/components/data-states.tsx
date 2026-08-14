import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type BaseProps = {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Something went wrong while loading this data.";
}

/**
 * Renders mutually-exclusive loading / error / empty states inside a <TableBody>.
 * Returns null when there is data to show, so the caller renders its own rows.
 */
export function TableState({
  colSpan,
  rows = 4,
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "Nothing here yet.",
}: BaseProps & { colSpan: number; rows?: number }) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            <TableCell colSpan={colSpan} className="py-3">
              <Skeleton className="h-5 w-full" />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  }

  if (isError) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <div className="text-sm text-muted-foreground">{errorMessage(error)}</div>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
              </Button>
            ) : null}
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (isEmpty) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">{emptyMessage}</div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return null;
}

/**
 * Block-level version for non-table lists/panels. Returns null when data exists.
 */
export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "Nothing here yet.",
  rows = 3,
}: BaseProps & { rows?: number }) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <div className="text-sm text-muted-foreground">{errorMessage(error)}</div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">{emptyMessage}</div>
      </div>
    );
  }

  return null;
}
