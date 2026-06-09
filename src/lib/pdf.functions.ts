import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type Line = { description: string; quantity: number; unit_price: number; total: number };

type DocInput = {
  kind: "Invoice" | "Quotation";
  orgName: string;
  orgCurrency: string;
  docNumber: string;
  status: string;
  issueDate?: string | null;
  dueOrValidLabel: string;
  dueOrValidDate?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  eventTitle?: string | null;
  items: Line[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid?: number;
  balance?: number;
  notes?: string | null;
};

function fmtMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(+d)) return s;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) cur = test;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

async function buildPdf(input: DocInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const margin = 48;
  const muted = rgb(0.45, 0.45, 0.5);
  const ink = rgb(0.1, 0.1, 0.12);
  const accent = rgb(0.16, 0.36, 0.78);

  let y = height - margin;

  // Header
  page.drawText(input.orgName, { x: margin, y: y - 6, size: 18, font: bold, color: ink });
  page.drawText(input.kind.toUpperCase(), { x: width - margin - bold.widthOfTextAtSize(input.kind.toUpperCase(), 22), y: y - 4, size: 22, font: bold, color: accent });
  y -= 36;
  page.drawText(`# ${input.docNumber}`, { x: width - margin - font.widthOfTextAtSize(`# ${input.docNumber}`, 11), y, size: 11, font, color: muted });
  y -= 16;
  page.drawText(`Status: ${input.status}`, { x: width - margin - font.widthOfTextAtSize(`Status: ${input.status}`, 10), y, size: 10, font, color: muted });

  y -= 30;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.88) });
  y -= 24;

  // Meta two-column
  const leftX = margin;
  const rightX = width / 2 + 10;
  const drawKV = (x: number, yy: number, label: string, value: string) => {
    page.drawText(label, { x, y: yy, size: 9, font, color: muted });
    const lines = wrap(value, font, 11, width / 2 - margin - 10);
    let ly = yy - 14;
    for (const ln of lines) {
      page.drawText(ln, { x, y: ly, size: 11, font: bold, color: ink });
      ly -= 14;
    }
    return ly;
  };

  const lYa = drawKV(leftX, y, "Bill to", input.customerName || "—");
  if (input.customerEmail) page.drawText(input.customerEmail, { x: leftX, y: lYa, size: 10, font, color: muted });

  const rYa = drawKV(rightX, y, input.kind === "Invoice" ? "Issue date" : "Created", fmtDate(input.issueDate));
  const rYb = drawKV(rightX, rYa - 12, input.dueOrValidLabel, fmtDate(input.dueOrValidDate));
  if (input.eventTitle) drawKV(rightX, rYb - 12, "Event", input.eventTitle);

  y = Math.min(lYa, rYa) - 50;

  // Items table
  const cols = { desc: leftX, qty: width - margin - 230, unit: width - margin - 140, total: width - margin };
  page.drawRectangle({ x: margin - 4, y: y - 4, width: width - margin * 2 + 8, height: 20, color: rgb(0.96, 0.97, 0.99) });
  page.drawText("Description", { x: cols.desc, y, size: 10, font: bold, color: ink });
  const drawRight = (txt: string, xRight: number, yy: number, f: PDFFont, sz = 10, color = ink) => {
    page.drawText(txt, { x: xRight - f.widthOfTextAtSize(txt, sz), y: yy, size: sz, font: f, color });
  };
  drawRight("Qty", cols.qty + 30, y, bold);
  drawRight("Unit price", cols.unit + 60, y, bold);
  drawRight("Total", cols.total, y, bold);
  y -= 20;

  const ensureSpace = (need: number) => {
    if (y - need < margin + 100) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - margin;
    }
  };

  for (const it of input.items) {
    const descLines = wrap(it.description || "—", font, 10, cols.qty - cols.desc - 8);
    ensureSpace(14 * descLines.length + 6);
    let ly = y;
    for (const ln of descLines) {
      page.drawText(ln, { x: cols.desc, y: ly, size: 10, font, color: ink });
      ly -= 12;
    }
    drawRight(String(it.quantity), cols.qty + 30, y, font);
    drawRight(fmtMoney(it.unit_price, input.orgCurrency), cols.unit + 60, y, font);
    drawRight(fmtMoney(it.total, input.orgCurrency), cols.total, y, font);
    y = ly - 4;
    page.drawLine({ start: { x: margin, y: y + 2 }, end: { x: width - margin, y: y + 2 }, thickness: 0.3, color: rgb(0.92, 0.92, 0.95) });
  }

  if (input.items.length === 0) {
    page.drawText("No line items.", { x: cols.desc, y, size: 10, font, color: muted });
    y -= 16;
  }

  // Totals
  ensureSpace(110);
  y -= 14;
  const totalsX = width - margin - 220;
  const drawTotalRow = (label: string, value: string, b = false) => {
    page.drawText(label, { x: totalsX, y, size: b ? 12 : 10, font: b ? bold : font, color: b ? ink : muted });
    drawRight(value, cols.total, y, b ? bold : font, b ? 12 : 10);
    y -= b ? 18 : 14;
  };
  drawTotalRow("Subtotal", fmtMoney(input.subtotal, input.orgCurrency));
  drawTotalRow("Tax", fmtMoney(input.tax, input.orgCurrency));
  drawTotalRow("Total", fmtMoney(input.total, input.orgCurrency), true);
  if (typeof input.amountPaid === "number") drawTotalRow("Paid", fmtMoney(input.amountPaid, input.orgCurrency));
  if (typeof input.balance === "number") drawTotalRow("Balance due", fmtMoney(input.balance, input.orgCurrency), true);

  // Notes
  if (input.notes) {
    ensureSpace(60);
    y -= 14;
    page.drawText("Notes", { x: margin, y, size: 10, font: bold, color: ink });
    y -= 14;
    for (const ln of wrap(input.notes, font, 10, width - margin * 2)) {
      ensureSpace(14);
      page.drawText(ln, { x: margin, y, size: 10, font, color: muted });
      y -= 12;
    }
  }

  // Footer
  page.drawText(`Generated ${new Date().toLocaleDateString("en-US")}`, {
    x: margin, y: margin - 12, size: 8, font, color: muted,
  });

  return await pdf.save();
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  // btoa exists in workerd and browsers
  return btoa(bin);
}

export const generateInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: inv, error } = await supabase
      .from("invoices")
      .select("*, customers(name,email), events(title), organizations(name,currency)")
      .eq("id", data.id)
      .single();
    if (error || !inv) throw new Error(error?.message || "Invoice not found");
    const { data: items } = await supabase.from("invoice_items").select("*").eq("invoice_id", data.id).order("created_at");

    const bytes = await buildPdf({
      kind: "Invoice",
      orgName: (inv as any).organizations?.name ?? "Organization",
      orgCurrency: (inv as any).organizations?.currency ?? "USD",
      docNumber: inv.invoice_number,
      status: inv.status,
      issueDate: inv.issue_date,
      dueOrValidLabel: "Due date",
      dueOrValidDate: inv.due_date,
      customerName: (inv as any).customers?.name,
      customerEmail: (inv as any).customers?.email,
      eventTitle: (inv as any).events?.title,
      items: (items ?? []).map((i: any) => ({
        description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price), total: Number(i.total),
      })),
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax_amount),
      total: Number(inv.total),
      amountPaid: Number(inv.amount_paid),
      balance: Number(inv.total) - Number(inv.amount_paid),
      notes: inv.notes,
    });

    return { filename: `${inv.invoice_number}.pdf`, base64: toBase64(bytes) };
  });

export const generateQuotationPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: q, error } = await supabase
      .from("quotations")
      .select("*, events(id, title, organization_id, customers(name,email), organizations(name,currency))")
      .eq("id", data.id)
      .single();
    if (error || !q) throw new Error(error?.message || "Quotation not found");
    const ev: any = (q as any).events;
    const { data: items } = await supabase.from("event_items").select("*").eq("event_id", ev.id).order("created_at");

    const lines = (items ?? []).map((i: any) => ({
      description: [i.name, i.description].filter(Boolean).join(" — "),
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      total: Number(i.quantity) * Number(i.unit_price),
    }));

    const bytes = await buildPdf({
      kind: "Quotation",
      orgName: ev?.organizations?.name ?? "Organization",
      orgCurrency: ev?.organizations?.currency ?? "USD",
      docNumber: `Q-${String(q.id).slice(0, 8).toUpperCase()}-v${q.version}`,
      status: q.status,
      issueDate: q.created_at,
      dueOrValidLabel: "Valid until",
      dueOrValidDate: q.valid_until,
      customerName: ev?.customers?.name,
      customerEmail: ev?.customers?.email,
      eventTitle: ev?.title,
      items: lines,
      subtotal: Number(q.subtotal),
      tax: Number(q.subtotal) * (Number(q.tax_rate) / 100),
      total: Number(q.total),
      notes: q.notes,
    });

    return { filename: `quotation-${String(q.id).slice(0, 8)}-v${q.version}.pdf`, base64: toBase64(bytes) };
  });
