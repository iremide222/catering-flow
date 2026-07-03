// Lightweight CSV export helper — no dependencies.

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv<T extends Record<string, unknown>>(
  filename: string,
  columns: { key: keyof T | string; label: string; get?: (row: T) => unknown }[],
  rows: T[],
) {
  const header = columns.map((c) => escape(c.label)).join(",");
  const body = rows
    .map((r) =>
      columns
        .map((c) => escape(c.get ? c.get(r) : (r as any)[c.key]))
        .join(","),
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${filename}-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
