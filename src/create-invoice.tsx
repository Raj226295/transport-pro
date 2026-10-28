import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { ArrowLeft, Building2, CalendarDays, CheckCircle2, CircleDollarSign, Download, Eraser, Eye, FilePenLine, FilePlus2, FileText, Globe2, ImageUp, Mail, MapPin, PackagePlus, PenLine, Phone, Plus, Printer, Save, Send, Share2, Trash2, Undo2, Upload, UserRound, X } from "lucide-react";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "./create-invoice.css";

export type InvoiceItem = { id: number; description: string; quantity: number; rate: number };
export type BillData = {
  number: string; date: string; dueDate: string; paymentStatus: "Unpaid" | "Partially Paid" | "Paid";
  company: string; companyTagline: string; logo: string; companyAddress: string; companyCity: string; companyState: string; companyPin: string; companyPhone: string; companyEmail: string; companyWebsite: string;
  customer: string; customerCompany: string; customerAddress: string; customerCity: string; customerState: string; customerPin: string; customerPhone: string; customerEmail: string;
  project: string; poNumber: string; paymentInstructions: string; paymentTerms: string; notes: string; thankYou: string; signature: string; items: InvoiceItem[];
};
export type SavedBill = { id: string; date: string; party: string; from: string; to: string; vehicle: string; goods: string; quantity: number; unit: string; amount: number; status: "Delivered" | "In transit" | "Pending"; payload: BillData };

const savedKey = "transportpro-saved-bills-v1", draftKey = "transportpro-invoice-drafts-v1";
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
const humanDate = (value: string) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : "—";
const rowAmount = (item: InvoiceItem) => Math.round(Math.max(0, item.quantity) * Math.max(0, item.rate) * 100) / 100;
export const readSavedBills = (): SavedBill[] => { try { return JSON.parse(localStorage.getItem(savedKey) || "[]") as SavedBill[]; } catch { return []; } };
const writeSaved = (rows: SavedBill[]) => localStorage.setItem(savedKey, JSON.stringify(rows));
const readDrafts = (): SavedBill[] => { try { return JSON.parse(localStorage.getItem(draftKey) || "[]") as SavedBill[]; } catch { return []; } };
const writeDrafts = (rows: SavedBill[]) => localStorage.setItem(draftKey, JSON.stringify(rows));
const nextNumber = () => `INV-${String(Math.max(0, ...[...readSavedBills(), ...readDrafts()].map((row) => Number(row.id.match(/(\d+)$/)?.[1] || 0))) + 1).padStart(4, "0")}`;
export const createEmptyInvoice = (): BillData => ({
  number: nextNumber(), date: iso(new Date()), dueDate: "", paymentStatus: "Unpaid", company: "", companyTagline: "", logo: "", companyAddress: "", companyCity: "", companyState: "", companyPin: "", companyPhone: "", companyEmail: "", companyWebsite: "",
  customer: "", customerCompany: "", customerAddress: "", customerCity: "", customerState: "", customerPin: "", customerPhone: "", customerEmail: "", project: "", poNumber: "",
  paymentInstructions: "", paymentTerms: "", notes: "", thankYou: "", signature: "", items: [{ id: 1, description: "", quantity: 1, rate: 0 }],
});
const blank = createEmptyInvoice;
const normalize = (input?: Partial<BillData>): BillData => ({ ...blank(), ...input, items: input?.items?.length ? input.items : blank().items });

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) { return <h2><span className="invoice-section-icon" aria-hidden="true">{icon}</span>{children}</h2>; }
function Field({ label, value, change, type = "text", required, error, icon }: { label: string; value: string | number; change: (value: string) => void; type?: string; required?: boolean; error?: string; icon?: ReactNode }) {
  const id = useId(), errorId = `${id}-error`;
  return <label className={`invoice-field${error ? " has-error" : ""}`}><span>{label}{required && <b> *</b>}</span><span className="invoice-control">{icon && <i aria-hidden="true">{icon}</i>}<input id={id} type={type} value={value} onChange={(event) => change(event.target.value)} required={required} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <small id={errorId}>{error}</small>}</span></label>;
}
function Area({ label, value, change }: { label: string; value: string; change: (value: string) => void }) { return <label className="invoice-field"><span>{label}</span><span className="invoice-control"><textarea value={value} onChange={(event) => change(event.target.value)} /></span></label>; }

type SignaturePoint = { x: number; y: number };
type SignatureStroke = SignaturePoint[];

function DigitalSignature({ value, onChange, onMessage }: { value: string; onChange: (value: string) => void; onMessage: (message: string) => void }) {
  const [tab, setTab] = useState<"draw" | "upload">("draw");
  const [strokeCount, setStrokeCount] = useState(0);
  const [strokeVersion, setStrokeVersion] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const strokes = useRef<SignatureStroke[]>([]);

  const renderStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    context.clearRect(0, 0, width, height);
    context.strokeStyle = "#102f4a";
    context.fillStyle = "#102f4a";
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    strokes.current.forEach((stroke) => {
      if (!stroke.length) return;
      if (stroke.length === 1) {
        context.beginPath();
        context.arc(stroke[0].x * width, stroke[0].y * height, 1.2, 0, Math.PI * 2);
        context.fill();
        return;
      }
      context.beginPath();
      stroke.forEach((point, index) => {
        const x = point.x * width, y = point.y * height;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tab !== "draw") return;
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight), ratio = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderStrokes();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [tab, strokeVersion]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>): SignaturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    strokes.current.push([point(event)]);
    drawing.current = true;
    setStrokeCount(strokes.current.length);
    renderStrokes();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    strokes.current.at(-1)?.push(point(event));
    renderStrokes();
  };
  const end = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    event.preventDefault();
    drawing.current = false;
    setStrokeVersion((version) => version + 1);
  };
  const clear = () => {
    drawing.current = false;
    strokes.current = [];
    setStrokeCount(0);
    setStrokeVersion((version) => version + 1);
    onChange("");
    onMessage("Signature cleared.");
  };
  const undo = () => {
    if (!strokes.current.length) return;
    strokes.current.pop();
    setStrokeCount(strokes.current.length);
    setStrokeVersion((version) => version + 1);
    onMessage("Last signature stroke removed.");
  };
  const saveDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes.current.length) { onMessage("Draw your signature before saving it."); return; }
    onChange(canvas.toDataURL("image/png"));
    onMessage("Drawn signature saved to this invoice.");
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { onMessage("Choose a PNG, JPG or JPEG signature image."); event.target.value = ""; return; }
    if (file.size > 2_000_000) { onMessage("Signature image must be smaller than 2 MB."); event.target.value = ""; return; }
    try {
      const bitmap = await createImageBitmap(file);
      if (!bitmap.width || !bitmap.height) throw new Error("Empty image");
      const scale = Math.min(1, 450 / bitmap.width, 160 / bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const signature = file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", .92);
      if (signature.length > 600_000) throw new Error("Persisted image is too large");
      onChange(signature);
      onMessage("Uploaded signature saved to this invoice.");
    } catch {
      onMessage("This image could not be decoded as a valid signature. Choose another PNG or JPG file.");
    } finally {
      event.target.value = "";
    }
  };

  return <div className="digital-signature"><div className="signature-title"><div><PenLine aria-hidden="true" /><span>Authorized Signature <small>(Optional)</small></span></div>{value && <span className="signature-ready"><CheckCircle2 aria-hidden="true" />Saved</span>}</div>
    <div className="signature-tabs" role="tablist" aria-label="Signature input method"><button type="button" role="tab" aria-selected={tab === "draw"} onClick={() => setTab("draw")}><PenLine />Draw Signature</button><button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}><ImageUp />Upload Signature</button></div>
    {tab === "draw" ? <div className="signature-draw-panel" role="tabpanel"><canvas ref={canvasRef} className="signature-canvas" aria-label="Draw authorized signature" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} onContextMenu={(event) => event.preventDefault()} /><p>Draw inside the box using a mouse, touchpad, stylus or finger.</p><div className="signature-actions"><button type="button" className="signature-button quiet" onClick={clear}><Eraser />Clear</button><button type="button" className="signature-button quiet" onClick={undo} disabled={strokeCount === 0}><Undo2 />Undo</button><button type="button" className="signature-button primary" onClick={saveDrawing}><Save />Save Signature</button></div></div> : <div className="signature-upload-panel" role="tabpanel"><input ref={uploadRef} type="file" accept="image/png,image/jpeg,.jpg,.jpeg" onChange={upload} hidden />{value ? <div className="signature-upload-preview"><img src={value} alt="Authorized signature preview" /><div><button type="button" className="signature-button quiet" onClick={() => uploadRef.current?.click()}><Upload />Replace</button><button type="button" className="signature-button danger" onClick={() => { onChange(""); onMessage("Signature removed."); if (uploadRef.current) uploadRef.current.value = ""; }}><Trash2 />Remove</button></div></div> : <button className="signature-dropzone" type="button" onClick={() => uploadRef.current?.click()}><ImageUp /><strong>Choose signature image</strong><span>PNG, JPG or JPEG · maximum 2 MB</span></button>}</div>}
    {value && <div className="signature-saved-preview"><span>Saved signature preview</span><img src={value} alt="Saved authorized signature" /></div>}
  </div>;
}

export function InvoiceDocument({ data }: { data: BillData }) {
  const total = data.items.reduce((sum, row) => sum + rowAmount(row), 0);
  return <article className="invoice-document" id="invoice-document">
    <header className="invoice-paper-header"><div className="invoice-company"><img src={data.logo || "/raj-v-singh-logo.png"} alt="" /><div><h1>{data.company || "Company name"}</h1>{data.companyTagline && <strong>{data.companyTagline}</strong>}{[data.companyAddress, data.companyCity, data.companyState, data.companyPin].some(Boolean) && <p><MapPin />{[data.companyAddress, data.companyCity, data.companyState, data.companyPin].filter(Boolean).join(", ")}</p>}{data.companyPhone && <p><Phone />{data.companyPhone}</p>}{data.companyEmail && <p><Mail />{data.companyEmail}</p>}{data.companyWebsite && <p><Globe2 />{data.companyWebsite}</p>}</div></div><div className="invoice-meta"><h2>INVOICE</h2><dl><div><dt>Invoice No.</dt><dd>{data.number}</dd></div><div><dt>Date</dt><dd>{humanDate(data.date)}</dd></div><div><dt>Due Date</dt><dd>{humanDate(data.dueDate)}</dd></div><div><dt>Status</dt><dd><span data-status={data.paymentStatus}>{data.paymentStatus}</span></dd></div></dl></div></header>
    <section className="invoice-address-grid"><div><h3>Bill To</h3><strong>{data.customer}</strong>{data.customerCompany && data.customerCompany !== data.customer && <p>{data.customerCompany}</p>}{[data.customerAddress, data.customerCity, data.customerState, data.customerPin].some(Boolean) && <p>{[data.customerAddress, data.customerCity, data.customerState, data.customerPin].filter(Boolean).join(", ")}</p>}{data.customerPhone && <p><Phone />{data.customerPhone}</p>}{data.customerEmail && <p><Mail />{data.customerEmail}</p>}</div><div><h3>Project / Service</h3>{data.project && <p>{data.project}</p>}{data.poNumber && <p><b>P.O. No:</b> {data.poNumber}</p>}</div></section>
    <table className="invoice-line-table"><thead><tr><th>#</th><th>Description</th><th>Hours / Qty</th><th>Rate (₹)</th><th>Amount (₹)</th></tr></thead><tbody>{data.items.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.description || "—"}</td><td>{row.quantity}</td><td>₹{row.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td>₹{rowAmount(row).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>)}</tbody><tfoot><tr><td colSpan={3} /><th>Total Amount</th><td>{money(total)}</td></tr></tfoot></table>
    <section className="invoice-footer-grid">{(data.paymentInstructions || data.paymentTerms || data.notes) && <div><h3>Notes &amp; Payment</h3>{data.paymentInstructions && <p><b>Payment Instructions</b><br />{data.paymentInstructions}</p>}{data.paymentTerms && <p><b>Payment Terms</b><br />{data.paymentTerms}</p>}{data.notes && <p><b>Additional Notes</b><br />{data.notes}</p>}</div>}<div><h3>Thank You</h3><p>{data.thankYou || "Thank you for your business."}</p><div className="invoice-signature">{data.signature && <img src={data.signature} alt="Authorized signature" />}<span aria-hidden="true" /><b>Authorized Signature</b></div></div></section>
    <footer className="invoice-paper-footer">{data.companyPhone && <span><Phone />{data.companyPhone}</span>}{data.companyEmail && <span><Mail />{data.companyEmail}</span>}{data.companyWebsite && <span><Globe2 />{data.companyWebsite}</span>}{[data.companyAddress, data.companyCity].some(Boolean) && <span><MapPin />{[data.companyAddress, data.companyCity].filter(Boolean).join(", ")}</span>}</footer>
  </article>;
}

const fetchBytes = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
const wrap = (text: string, font: PDFFont, size: number, width: number) => { const words = (text || "—").split(/\s+/), lines: string[] = []; let line = ""; words.forEach((word) => { if (font.widthOfTextAtSize(word, size) > width) { if (line) { lines.push(line); line = ""; } let chunk = ""; for (const char of word) { const next = chunk + char; if (font.widthOfTextAtSize(next, size) > width && chunk) { lines.push(chunk); chunk = char; } else chunk = next; } line = chunk; return; } const next = line ? `${line} ${word}` : word; if (font.widthOfTextAtSize(next, size) > width && line) { lines.push(line); line = word; } else line = next; }); if (line) lines.push(line); return lines; };
export async function createChallanPdfFile(raw: BillData) {
  const data = normalize(raw), pdf = await PDFDocument.create();
  const [regular, semibold, bold] = await Promise.all([pdf.embedFont(StandardFonts.Helvetica), pdf.embedFont(StandardFonts.HelveticaBold), pdf.embedFont(StandardFonts.HelveticaBold)]);
  const navy = rgb(16 / 255, 43 / 255, 92 / 255), ink = rgb(16 / 255, 35 / 255, 74 / 255), blue = rgb(8 / 255, 101 / 255, 168 / 255), cyan = rgb(0, 168 / 255, 214 / 255), pale = rgb(240 / 255, 249 / 255, 252 / 255), line = rgb(205 / 255, 230 / 255, 242 / 255), white = rgb(1, 1, 1), muted = rgb(83 / 255, 107 / 255, 133 / 255), pageSize: [number, number] = [595.28, 841.89], margin = 38, width = pageSize[0] - margin * 2, bottom = 60;
  let page!: PDFPage, y = 0, pageNumber = 0;
  const drawRupee = (x: number, yy: number, size: number, color: ReturnType<typeof rgb>) => {
    const s = size / 9, line = (x1: number, y1: number, x2: number, y2: number, thickness = .8) => page.drawLine({ start: { x: x + x1 * s, y: yy + y1 * s }, end: { x: x + x2 * s, y: yy + y2 * s }, thickness, color });
    line(.5, 8, 7, 8); line(.5, 6.2, 7, 6.2); line(2, 8, 2, 1); line(2, 6.2, 4.8, 6.2); line(4.8, 6.2, 6, 5.4); line(6, 5.4, 6, 4.4); line(6, 4.4, 5.2, 3.5); line(5.2, 3.5, 2, 3.5); line(2.5, 3.5, 7, 0, 1);
  };
  const text = (value: string | number, x: number, yy: number, size = 8, strong = false, color = ink, align: "left" | "right" = "left") => {
    const content = String(value ?? ""), font = strong ? (size >= 14 ? bold : semibold) : regular;
    const pieces = content.split("₹"), symbolW = size * .95, totalW = pieces.reduce((sum, piece) => sum + font.widthOfTextAtSize(piece, size), 0) + Math.max(0, pieces.length - 1) * symbolW;
    let cursor = align === "right" ? x - totalW : x;
    pieces.forEach((piece, index) => { if (piece) { page.drawText(piece, { x: cursor, y: yy, size, font, color, maxWidth: width }); cursor += font.widthOfTextAtSize(piece, size); } if (index < pieces.length - 1) { drawRupee(cursor + 1, yy + size * .02, size * .75, color); cursor += symbolW; } });
  };
  const wrapped = (value: string, x: number, yy: number, max: number, size = 8, strong = false, color = ink, maxLines = 8) => {
    const all = wrap(value, strong ? semibold : regular, size, max), lines = all.slice(0, maxLines);
    if (all.length > maxLines && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?\s]+$/, "")}…`;
    lines.forEach((entry, index) => text(entry, x, yy - index * (size + 3), size, strong, color));
    return lines.length;
  };
  const roundedCard = (x: number, top: number, w: number, h: number, fill = white) => {
    page.drawRectangle({ x, y: top - h, width: w, height: h, color: fill, borderColor: line, borderWidth: .8 });
  };
  const drawIcon = (kind: "pin" | "phone" | "mail" | "web", x: number, yy: number) => {
    const c = cyan, lw = .8;
    if (kind === "pin") {
      page.drawCircle({ x: x + 4, y: yy + 4, size: 2.5, borderColor: c, borderWidth: lw });
      page.drawLine({ start: { x: x + 2.2, y: yy + 2.4 }, end: { x: x + 4, y: yy - 1 }, thickness: lw, color: c });
      page.drawLine({ start: { x: x + 5.8, y: yy + 2.4 }, end: { x: x + 4, y: yy - 1 }, thickness: lw, color: c });
    } else if (kind === "mail") {
      page.drawRectangle({ x, y: yy, width: 9, height: 6, borderColor: c, borderWidth: lw });
      page.drawLine({ start: { x, y: yy + 6 }, end: { x: x + 4.5, y: yy + 2.5 }, thickness: lw, color: c });
      page.drawLine({ start: { x: x + 9, y: yy + 6 }, end: { x: x + 4.5, y: yy + 2.5 }, thickness: lw, color: c });
    } else if (kind === "web") {
      page.drawCircle({ x: x + 4.5, y: yy + 4, size: 4, borderColor: c, borderWidth: lw });
      page.drawLine({ start: { x: x + .5, y: yy + 4 }, end: { x: x + 8.5, y: yy + 4 }, thickness: lw, color: c });
      page.drawLine({ start: { x: x + 4.5, y: yy }, end: { x: x + 4.5, y: yy + 8 }, thickness: lw, color: c });
    } else {
      page.drawLine({ start: { x: x + 1, y: yy + 1 }, end: { x: x + 3, y: yy + 6 }, thickness: 1.5, color: c });
      page.drawLine({ start: { x: x + 3, y: yy + 6 }, end: { x: x + 6, y: yy + 8 }, thickness: 1.5, color: c });
      page.drawLine({ start: { x: x + 6, y: yy + 8 }, end: { x: x + 8, y: yy + 6 }, thickness: 1.5, color: c });
      page.drawLine({ start: { x: x + 1, y: yy + 1 }, end: { x: x + 3, y: yy }, thickness: 1.5, color: c });
    }
  };
  const footer = () => {
    page.drawRectangle({ x: margin, y: 24, width, height: 22, color: pale });
    const contacts = [data.companyPhone, data.companyEmail, data.companyWebsite, [data.companyAddress, data.companyCity].filter(Boolean).join(", ")].filter(Boolean).join("   ·   ");
    wrap(contacts, regular, 6.2, width - 38).slice(0, 2).forEach((entry, index) => text(entry, margin + 9, 36 - index * 7, 6.2, false, muted));
    text(`${pageNumber}`, pageSize[0] - margin - 9, 32, 7, true, blue, "right");
  };
  const addPage = (continuation = false) => {
    page = pdf.addPage(pageSize); pageNumber += 1; y = 800;
    if (continuation) { text(data.company || "INVOICE", margin, y, 11, true, navy); text(`Invoice ${data.number}`, pageSize[0] - margin, y, 8, true, muted, "right"); y -= 24; }
  };
  addPage();

  // Header: company identity and invoice metadata.
  const headerTop = 800, metaX = 392, metaW = width - (metaX - margin);
  try {
    const logoBytes = data.logo ? await fetchBytes(data.logo) : await fetchBytes("/raj-v-singh-logo.png");
    const logo = data.logo?.startsWith("data:image/jpeg") ? await pdf.embedJpg(logoBytes) : await pdf.embedPng(logoBytes), scaled = logo.scaleToFit(82, 68);
    page.drawImage(logo, { x: margin, y: headerTop - scaled.height, width: scaled.width, height: scaled.height });
  } catch { /* A missing optional logo must not interrupt invoice creation. */ }
  const companyX = margin + 94, companyW = metaX - companyX - 14;
  const companyName = data.company || "Company name", companyNameSize = Math.max(11, Math.min(17, companyW / bold.widthOfTextAtSize(companyName, 1)));
  const companyNameLines = wrapped(companyName, companyX, headerTop - 7, companyW, companyNameSize, true, navy, 2);
  const taglineY = headerTop - companyNameLines * (companyNameSize + 3) - 4;
  if (data.companyTagline) wrapped(data.companyTagline, companyX, taglineY, companyW, 8, true, blue, 2);
  let companyY = taglineY - (data.companyTagline ? 15 : 5);
  const companyLines = ([
    ["pin", [data.companyAddress, data.companyCity, data.companyState, data.companyPin].filter(Boolean).join(", ")],
    ["phone", data.companyPhone], ["mail", data.companyEmail], ["web", data.companyWebsite],
  ] as ["pin" | "phone" | "mail" | "web", string][]).filter(([, value]) => Boolean(value));
  companyLines.forEach(([icon, value]) => { drawIcon(icon, companyX, companyY - 1); companyY -= wrapped(value, companyX + 13, companyY, companyW - 13, 7.5, false, muted, 2) * 10 + 2; });

  roundedCard(metaX, headerTop, metaW, 126, pale);
  text("INVOICE", metaX + 14, headerTop - 28, 24, true, navy);
  page.drawLine({ start: { x: metaX + 14, y: headerTop - 37 }, end: { x: metaX + metaW - 14, y: headerTop - 37 }, thickness: .8, color: line });
  const metaRows: [string, string][] = [["Invoice No.", data.number], ["Invoice date", humanDate(data.date)], ["Due date", humanDate(data.dueDate)]];
  metaRows.forEach(([label, value], index) => { const yy = headerTop - 53 - index * 14; text(label, metaX + 14, yy, 7, false, muted); text(value || "—", metaX + metaW - 14, yy, 7.5, true, ink, "right"); });
  const statusColor = data.paymentStatus === "Paid" ? rgb(.87, .96, .90) : data.paymentStatus === "Partially Paid" ? rgb(.87, .94, .99) : rgb(1, .96, .83);
  const statusWidth = Math.min(metaW - 28, semibold.widthOfTextAtSize(data.paymentStatus, 7) + 16);
  page.drawRectangle({ x: metaX + 14, y: headerTop - 119, width: statusWidth, height: 15, color: statusColor });
  text(data.paymentStatus, metaX + 22, headerTop - 114, 7, true, navy);

  // Equal-height address and service cards.
  y = Math.min(headerTop - 142, companyY - 8);
  const cardGap = 12, cardW = (width - cardGap) / 2, cardH = 116, cardTop = y;
  [margin, margin + cardW + cardGap].forEach((x) => { roundedCard(x, cardTop, cardW, cardH); page.drawRectangle({ x, y: cardTop - 25, width: cardW, height: 25, color: pale }); });
  text("BILL TO", margin + 12, cardTop - 17, 10, true, blue);
  text("PROJECT / SERVICE", margin + cardW + cardGap + 12, cardTop - 17, 10, true, blue);
  let customerY = cardTop - 42;
  customerY -= wrapped(data.customer || "Customer", margin + 12, customerY, cardW - 24, 9, true, ink, 2) * 12;
  if (data.customerCompany && data.customerCompany !== data.customer) { customerY -= wrapped(data.customerCompany, margin + 12, customerY, cardW - 24, 7.5, false, muted, 2) * 10; }
  const address = [data.customerAddress, data.customerCity, data.customerState, data.customerPin].filter(Boolean).join(", ");
  if (address) customerY -= wrapped(address, margin + 12, customerY - 1, cardW - 24, 7.5, false, muted, 3) * 10;
  if (data.customerPhone) { text("Phone", margin + 12, customerY - 2, 7, true, muted); text(data.customerPhone, margin + 44, customerY - 2, 7.5, false, ink); customerY -= 11; }
  if (data.customerEmail) { text("Email", margin + 12, customerY - 2, 7, true, muted); wrapped(data.customerEmail, margin + 44, customerY - 2, cardW - 56, 7.5, false, ink, 2); }
  const serviceX = margin + cardW + cardGap + 12, serviceW = cardW - 24;
  let serviceY = cardTop - 43;
  serviceY -= wrapped(data.project || "—", serviceX, serviceY, serviceW, 8, false, ink, 5) * 11;
  if (data.poNumber) { text("P.O. number", serviceX, serviceY - 3, 7, true, muted); wrapped(data.poNumber, serviceX, serviceY - 15, serviceW, 7.5, false, ink, 2); }

  // Table uses fixed column boundaries and repeats its heading on continued pages.
  y = cardTop - cardH - 24;
  const columns = [35, 238, 78, 86, width - 35 - 238 - 78 - 86];
  const drawTableHeader = () => {
    page.drawRectangle({ x: margin, y: y - 25, width, height: 25, color: blue });
    const starts = [margin, margin + columns[0], margin + columns[0] + columns[1], margin + columns[0] + columns[1] + columns[2], margin + columns[0] + columns[1] + columns[2] + columns[3]];
    ["S.No.", "DESCRIPTION", "HOURS / QTY", "RATE (₹)", "AMOUNT (₹)"].forEach((label, i) => {
      const right = i > 2; text(label, right ? starts[i] + columns[i] - 8 : starts[i] + 8, y - 16, 7, true, white, right ? "right" : "left");
    });
    y -= 25;
  };
  drawTableHeader();
  const rowBottomLimit = bottom + 128;
  data.items.forEach((row, index) => {
    const descLines = wrap(row.description || "—", regular, 8, columns[1] - 18), visibleDescLines = Math.min(8, descLines.length), rowH = Math.max(29, visibleDescLines * 11 + 14);
    if (y - rowH < rowBottomLimit) { footer(); addPage(true); drawTableHeader(); }
    const rowTop = y, rowY = y - rowH;
    page.drawRectangle({ x: margin, y: rowY, width, height: rowH, color: index % 2 ? white : pale, borderColor: line, borderWidth: .55 });
    const starts = [margin, margin + columns[0], margin + columns[0] + columns[1], margin + columns[0] + columns[1] + columns[2], margin + columns[0] + columns[1] + columns[2] + columns[3]];
    starts.slice(1).forEach((x) => page.drawLine({ start: { x, y: rowTop }, end: { x, y: rowY }, thickness: .4, color: line }));
    text(index + 1, starts[0] + columns[0] / 2, rowTop - 18, 8, false, ink, "right");
    wrapped(row.description || "—", starts[1] + 9, rowTop - 17, columns[1] - 18, 8, false, ink, visibleDescLines);
    text(row.quantity.toLocaleString("en-IN", { maximumFractionDigits: 2 }), starts[2] + columns[2] / 2, rowTop - 18, 8, false, ink, "right");
    text(`₹${row.rate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, starts[3] + columns[3] - 8, rowTop - 18, 8, false, ink, "right");
    text(`₹${rowAmount(row).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, starts[4] + columns[4] - 8, rowTop - 18, 8, true, ink, "right");
    y = rowY;
  });

  const total = data.items.reduce((sum, row) => sum + rowAmount(row), 0);
  if (y - 54 < rowBottomLimit) { footer(); addPage(true); y -= 4; }
  const totalW = 230, totalX = pageSize[0] - margin - totalW;
  roundedCard(totalX, y - 8, totalW, 44, pale);
  text("TOTAL AMOUNT", totalX + 14, y - 25, 9, true, blue);
  text(money(total), totalX + totalW - 14, y - 29, 16, true, navy, "right");
  y -= 62;

  // Notes and thank-you/signature cards are kept together when possible.
  const noteItems = [["Payment Instructions", data.paymentInstructions], ["Payment Terms", data.paymentTerms], ["Additional Notes", data.notes]].filter(([, value]) => Boolean(value)) as [string, string][];
  const noteLines = noteItems.reduce((sum, [, value]) => sum + 1 + Math.min(10, wrap(value, regular, 7.5, 220).length), 0);
  const notesH = Math.max(72, 32 + noteLines * 10), thankH = 120, detailH = Math.max(notesH, thankH);
  if (y - detailH < bottom + 12) { footer(); addPage(true); }
  const noteW = 310, detailGap = 12, thanksX = margin + noteW + detailGap, thanksW = width - noteW - detailGap, detailTop = y;
  roundedCard(margin, detailTop, noteW, detailH, pale); roundedCard(thanksX, detailTop, thanksW, detailH, pale);
  text("NOTES & PAYMENT", margin + 12, detailTop - 18, 9, true, blue);
  let noteY = detailTop - 36;
  noteItems.forEach(([label, value]) => { text(label, margin + 12, noteY, 7.5, true, navy); noteY -= 11; const n = wrapped(value, margin + 12, noteY, noteW - 24, 7.5, false, muted, 10); noteY -= n * 10 + 6; });
  text("THANK YOU", thanksX + 12, detailTop - 18, 9, true, blue);
  wrapped(data.thankYou || "Thank you for your business.", thanksX + 12, detailTop - 36, thanksW - 24, 8, false, ink, 4);
  const signW = Math.min(150, thanksW - 24), signX = thanksX + (thanksW - signW) / 2, signLine = detailTop - detailH + 29;
  if (data.signature) {
    try {
      const signatureBytes = await fetchBytes(data.signature), signature = data.signature.startsWith("data:image/jpeg") ? await pdf.embedJpg(signatureBytes) : await pdf.embedPng(signatureBytes), scaled = signature.scaleToFit(signW, 38);
      page.drawImage(signature, { x: signX + (signW - scaled.width) / 2, y: signLine + 3, width: scaled.width, height: scaled.height });
    } catch { /* Invalid optional signature leaves a clean signing line. */ }
  }
  page.drawLine({ start: { x: signX, y: signLine }, end: { x: signX + signW, y: signLine }, thickness: .65, color: muted });
  text("Authorized Signature", signX + signW / 2, signLine - 12, 7, false, muted, "right");
  footer();
  return new File([await pdf.save() as unknown as BlobPart], `Invoice_${data.number}.pdf`, { type: "application/pdf" });
}
function downloadFile(file: File) { const url = URL.createObjectURL(file), anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export async function downloadChallan(data: BillData) { const file = await createChallanPdfFile(data); downloadFile(file); return file; }
export async function shareChallan(data: BillData) { const file = await createChallanPdfFile(data); if (navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: `Invoice ${data.number}`, files: [file] }); return "shared"; } downloadFile(file); return "downloaded"; }
export function printChallan(data: BillData) { const popup = window.open("", "_blank"); if (!popup) throw new Error("Allow pop-ups to print the invoice."); const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map((node) => node.outerHTML).join(""); popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${data.number}</title>${styles}<style>@page{size:A4 portrait;margin:0}body{margin:0;background:#fff}.invoice-document{box-shadow:none!important}</style></head><body>${renderToStaticMarkup(<InvoiceDocument data={normalize(data)} />)}</body></html>`); popup.document.close(); popup.addEventListener("load", () => { popup.focus(); popup.print(); }, { once: true }); }

export default function CreateInvoice({ onBack, editing }: { onBack: () => void; editing?: SavedBill }) {
  const restored = !editing ? readDrafts()[0] : undefined;
  const [data, setData] = useState(() => normalize(editing?.payload || restored?.payload || blank()));
  const baseline = useRef(data), formVersionRef = useRef(0), [activeEditId, setActiveEditId] = useState(editing?.id), [errors, setErrors] = useState<Record<string, string>>({}), [message, setMessage] = useState(restored && !editing ? `Draft ${restored.id} restored.` : "Changes are saved only when you choose Save Draft or Save Bill."), [preview, setPreview] = useState(false), [confirmNewBill, setConfirmNewBill] = useState(false), [formVersion, setFormVersion] = useState(0), [busy, setBusy] = useState<"" | "download" | "share" | "save">(""), logoInput = useRef<HTMLInputElement>(null), modalRef = useRef<HTMLDivElement>(null), closeRef = useRef<HTMLButtonElement>(null), total = useMemo(() => data.items.reduce((sum, row) => sum + rowAmount(row), 0), [data.items]);
  const hasUnsavedChanges = JSON.stringify(data) !== JSON.stringify(baseline.current);
  useEffect(() => { if (!preview) return; const previous = document.activeElement as HTMLElement | null; closeRef.current?.focus(); const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setPreview(false); return; } if (event.key !== "Tab" || !modalRef.current) return; const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled")); if (!focusable.length) return; const first = focusable[0], last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; window.addEventListener("keydown", onKey, true); return () => { window.removeEventListener("keydown", onKey, true); previous?.focus(); }; }, [preview]);
  const patch = <K extends keyof BillData>(key: K, value: BillData[K]) => { setData((current) => ({ ...current, [key]: value })); setErrors((current) => { if (!current[key]) return current; const next = { ...current }; delete next[key]; return next; }); };
  const itemPatch = (id: number, key: keyof InvoiceItem, value: string | number) => patch("items", data.items.map((row) => row.id === id ? { ...row, [key]: value } : row));
  const validate = () => { const next: Record<string, string> = {}; if (!data.company.trim()) next.company = "Enter your company name."; if (!data.customer.trim()) next.customer = "Enter the customer name."; if (!data.number.trim()) next.number = "Enter an invoice number."; if (!data.date) next.date = "Choose an invoice date."; if (!data.dueDate) next.dueDate = "Choose a due date."; if (!data.items.some((row) => row.description.trim() && row.quantity > 0)) next.items = "Add at least one valid invoice item."; setErrors(next); if (Object.keys(next).length) { setMessage("Please correct the highlighted fields."); requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); } return !Object.keys(next).length; };
  const record = (payload: BillData): SavedBill => ({ id: payload.number, date: humanDate(payload.date), party: payload.customerCompany || payload.customer, from: payload.companyCity, to: payload.customerCity, vehicle: "—", goods: payload.items.map((row) => row.description).filter(Boolean).join(", "), quantity: payload.items.reduce((sum, row) => sum + row.quantity, 0), unit: "items", amount: payload.items.reduce((sum, row) => sum + rowAmount(row), 0), status: payload.paymentStatus === "Paid" ? "Delivered" : "Pending", payload });
  const save = async (draft = false) => { if (busy || (!draft && !validate())) return; setBusy("save"); await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); let payload = data; if ([...readSavedBills(), ...readDrafts()].some((row) => row.id === data.number && row.id !== activeEditId)) { payload = { ...data, number: nextNumber() }; setData(payload); } const row = record(payload); try { if (draft) { writeDrafts([row, ...readDrafts().filter((saved) => saved.id !== row.id && saved.id !== activeEditId)].slice(0, 10)); setMessage(`Draft ${row.id} saved.`); } else { writeSaved([row, ...readSavedBills().filter((saved) => saved.id !== row.id && saved.id !== activeEditId)]); writeDrafts(readDrafts().filter((saved) => saved.id !== row.id && saved.id !== activeEditId)); setMessage(`Invoice ${row.id} saved in All Bills.`); } baseline.current = payload; } catch { setMessage("Browser storage is full. Remove a large logo or an old draft."); } finally { setBusy(""); } };
  const uploadLogo = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; if (!file.type.match(/^image\/(png|jpeg)$/) || file.size > 2_000_000) { setMessage("Choose a PNG or JPG logo smaller than 2 MB."); return; } const version = formVersionRef.current, reader = new FileReader(); reader.onload = () => { if (formVersionRef.current === version) patch("logo", String(reader.result)); }; reader.readAsDataURL(file); };
  const startNewBill = () => { if (hasUnsavedChanges) { setConfirmNewBill(true); return; } resetToNewBill(); };
  const resetToNewBill = () => { const fresh = createEmptyInvoice(); setData(fresh); baseline.current = fresh; setActiveEditId(undefined); setErrors({}); setPreview(false); setConfirmNewBill(false); setMessage("New invoice started. Changes are saved only when you choose Save Draft or Save Bill."); formVersionRef.current += 1; setFormVersion(formVersionRef.current); if (logoInput.current) logoInput.current.value = ""; const url = new URL(window.location.href); url.searchParams.delete("bill"); window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`); const pageScroller = document.querySelector<HTMLElement>("#services-app"); if (pageScroller) pageScroller.scrollTo({ top: 0, behavior: "smooth" }); else window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openPreview = () => { if (validate()) setPreview(true); }, download = async () => { if (busy || !validate()) return; setBusy("download"); setMessage("Preparing searchable A4 PDF…"); try { await downloadChallan(data); setMessage(`Invoice_${data.number}.pdf downloaded.`); } catch { setMessage("PDF generation failed. Please try again."); } finally { setBusy(""); } }, share = async () => { if (busy || !validate()) return; setBusy("share"); try { const outcome = await shareChallan(data); setMessage(outcome === "shared" ? "Invoice shared." : "Sharing is unavailable, so the PDF was downloaded."); } catch (error) { if ((error as DOMException).name !== "AbortError") setMessage("Sharing was cancelled or unavailable."); } finally { setBusy(""); } };
  return <div className="invoice-create-page"><header className="invoice-page-header"><div><button className="invoice-icon-button" type="button" onClick={onBack} aria-label="Back to dashboard"><ArrowLeft /></button><div><h1>{activeEditId ? `Edit ${activeEditId}` : "Create Invoice"}</h1><p>Enter the details below to generate a professional invoice.</p></div></div><div className="invoice-header-actions"><button type="button" className="invoice-button secondary" onClick={openPreview} disabled={Boolean(busy)}><Eye />Preview Invoice</button><button type="button" className="invoice-button secondary new-bill-button" onClick={startNewBill} disabled={Boolean(busy)}><FilePlus2 />+ New Bill</button><button type="button" className="invoice-button secondary" onClick={() => save(true)} disabled={Boolean(busy)}><Save />{busy === "save" ? "Saving…" : "Save Draft"}</button><button type="button" className="invoice-button primary" onClick={() => save(false)} disabled={Boolean(busy)}><FileText />{busy === "save" ? "Saving…" : "Save Bill"}</button></div></header><div className="invoice-builder"><form className="invoice-form" onSubmit={(event) => { event.preventDefault(); save(false); }} noValidate>
    <section><SectionTitle icon={<Building2 />}>Company Information <span>(Your Business)</span></SectionTitle><div className="invoice-logo-and-fields"><div className="invoice-logo-upload">{data.logo ? <img src={data.logo} alt="Company logo preview" /> : <Building2 />}<button type="button" onClick={() => logoInput.current?.click()}><Upload />Upload Logo</button>{data.logo && <button className="remove" type="button" onClick={() => patch("logo", "")}><X />Remove</button>}<small>PNG or JPG, max 2 MB</small><input ref={logoInput} type="file" accept="image/png,image/jpeg" hidden onChange={uploadLogo} /></div><div className="invoice-fields-grid company-grid"><Field label="Company name" value={data.company} change={(v) => patch("company", v)} required error={errors.company} icon={<Building2 />} /><Field label="Company slogan" value={data.companyTagline} change={(v) => patch("companyTagline", v)} icon={<Send />} /><div className="span-2"><Field label="Address" value={data.companyAddress} change={(v) => patch("companyAddress", v)} icon={<MapPin />} /></div><Field label="City" value={data.companyCity} change={(v) => patch("companyCity", v)} /><Field label="State" value={data.companyState} change={(v) => patch("companyState", v)} /><Field label="PIN Code" value={data.companyPin} change={(v) => patch("companyPin", v)} /><Field label="Phone number" value={data.companyPhone} change={(v) => patch("companyPhone", v)} type="tel" icon={<Phone />} /><Field label="Email address" value={data.companyEmail} change={(v) => patch("companyEmail", v)} type="email" icon={<Mail />} /><Field label="Website" value={data.companyWebsite} change={(v) => patch("companyWebsite", v)} icon={<Globe2 />} /></div></div></section>
    <section><SectionTitle icon={<FileText />}>Invoice Details</SectionTitle><div className="invoice-fields-grid four"><Field label="Invoice number" value={data.number} change={(v) => patch("number", v.toUpperCase())} required error={errors.number} icon={<FileText />} /><Field label="Invoice date" value={data.date} change={(v) => patch("date", v)} type="date" required error={errors.date} icon={<CalendarDays />} /><Field label="Due date" value={data.dueDate} change={(v) => patch("dueDate", v)} type="date" required error={errors.dueDate} icon={<CalendarDays />} /><label className="invoice-field"><span>Payment status</span><span className="invoice-control"><i><CircleDollarSign /></i><select value={data.paymentStatus} onChange={(event) => patch("paymentStatus", event.target.value as BillData["paymentStatus"])}><option>Unpaid</option><option>Partially Paid</option><option>Paid</option></select></span></label></div></section>
    <section><SectionTitle icon={<UserRound />}>Bill To <span>(Customer)</span></SectionTitle><div className="invoice-fields-grid customer-grid"><Field label="Customer name" value={data.customer} change={(v) => patch("customer", v)} required error={errors.customer} icon={<UserRound />} /><Field label="Company name" value={data.customerCompany} change={(v) => patch("customerCompany", v)} icon={<Building2 />} /><div className="span-2"><Field label="Address" value={data.customerAddress} change={(v) => patch("customerAddress", v)} icon={<MapPin />} /></div><Field label="City" value={data.customerCity} change={(v) => patch("customerCity", v)} /><Field label="State" value={data.customerState} change={(v) => patch("customerState", v)} /><Field label="PIN Code" value={data.customerPin} change={(v) => patch("customerPin", v)} /><Field label="Phone number" value={data.customerPhone} change={(v) => patch("customerPhone", v)} type="tel" icon={<Phone />} /><Field label="Email address" value={data.customerEmail} change={(v) => patch("customerEmail", v)} type="email" icon={<Mail />} /></div></section>
    <section><SectionTitle icon={<FilePenLine />}>Project / Service Details</SectionTitle><div className="invoice-fields-grid two project-grid"><Area label="Project or service description" value={data.project} change={(v) => patch("project", v)} /><Field label="P.O. number (Optional)" value={data.poNumber} change={(v) => patch("poNumber", v)} icon={<FileText />} /></div></section>
    <section><div className="invoice-section-head"><SectionTitle icon={<PackagePlus />}>Invoice Items</SectionTitle><button className="invoice-button add" type="button" onClick={() => patch("items", [...data.items, { id: Math.max(0, ...data.items.map((row) => row.id)) + 1, description: "", quantity: 1, rate: 0 }])}><Plus />Add Item</button></div><div className={`invoice-items${errors.items ? " has-error" : ""}`}><table><thead><tr><th>#</th><th>Description</th><th>Hours / Qty</th><th>Rate (₹)</th><th>Amount (₹)</th><th>Action</th></tr></thead><tbody>{data.items.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td><input aria-label={`Item ${index + 1} description`} value={row.description} onChange={(event) => itemPatch(row.id, "description", event.target.value)} aria-invalid={Boolean(errors.items)} aria-describedby={errors.items ? "invoice-items-error" : undefined} /></td><td><input aria-label={`Item ${index + 1} quantity`} type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => itemPatch(row.id, "quantity", Number(event.target.value))} aria-invalid={Boolean(errors.items && row.quantity <= 0)} aria-describedby={errors.items ? "invoice-items-error" : undefined} /></td><td><input aria-label={`Item ${index + 1} rate`} type="number" min="0" step="0.01" value={row.rate} onChange={(event) => itemPatch(row.id, "rate", Number(event.target.value))} /></td><td><strong>{money(rowAmount(row))}</strong></td><td><button className="invoice-delete" type="button" onClick={() => patch("items", data.items.length > 1 ? data.items.filter((entry) => entry.id !== row.id) : [{ id: 1, description: "", quantity: 1, rate: 0 }])} aria-label={`Delete item ${index + 1}`}><Trash2 /></button></td></tr>)}</tbody></table></div>{errors.items && <p className="invoice-table-error" id="invoice-items-error">{errors.items}</p>}<div className="invoice-total"><span>Invoice total</span><strong>{money(total)}</strong></div></section>
    <section><SectionTitle icon={<FilePenLine />}>Notes & Footer</SectionTitle><div className="invoice-fields-grid four"><Area label="Payment instructions" value={data.paymentInstructions} change={(v) => patch("paymentInstructions", v)} /><Field label="Payment terms" value={data.paymentTerms} change={(v) => patch("paymentTerms", v)} /><Area label="Additional notes" value={data.notes} change={(v) => patch("notes", v)} /><Area label="Thank-you message" value={data.thankYou} change={(v) => patch("thankYou", v)} /><div className="signature-grid-row"><DigitalSignature key={formVersion} value={data.signature} onChange={(value) => { if (formVersionRef.current === formVersion) patch("signature", value); }} onMessage={(value) => { if (formVersionRef.current === formVersion) setMessage(value); }} /></div></div></section>
    <footer className="invoice-save-bar"><span aria-live="polite">{message}</span><div><button className="invoice-button secondary" type="button" onClick={openPreview} disabled={Boolean(busy)}><Eye />Preview</button><button className="invoice-button secondary" type="button" onClick={() => save(true)} disabled={Boolean(busy)}><Save />Save Draft</button><button className="invoice-button primary" type="submit" disabled={Boolean(busy)}><CheckCircle2 />{busy === "save" ? "Saving…" : activeEditId ? "Save Changes" : "Save Bill"}</button></div></footer>
  </form></div>
  {preview && <div ref={modalRef} className="invoice-modal" role="dialog" aria-modal="true" aria-label="Invoice preview" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(false); }}><div className="invoice-modal-panel"><div className="invoice-modal-actions"><button ref={closeRef} type="button" onClick={() => setPreview(false)}><X />Close</button><button type="button" onClick={() => setPreview(false)}><FilePenLine />Edit Bill</button><button type="button" onClick={download} disabled={Boolean(busy)}><Download />{busy === "download" ? "Preparing…" : "Download PDF"}</button><button type="button" onClick={() => { try { printChallan(data); } catch (error) { setMessage((error as Error).message); } }} disabled={Boolean(busy)}><Printer />Print Invoice</button><button type="button" onClick={share} disabled={Boolean(busy)}><Share2 />{busy === "share" ? "Preparing…" : "Share Invoice"}</button></div><InvoiceDocument data={data} /></div></div>}
  {confirmNewBill && <div className="invoice-modal new-bill-confirm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="new-bill-confirm-title" aria-describedby="new-bill-confirm-message"><div className="new-bill-confirm-panel"><h2 id="new-bill-confirm-title">Create New Bill?</h2><p id="new-bill-confirm-message">You have unsaved changes. Creating a new bill will discard these changes. Do you want to continue?</p><div className="new-bill-confirm-actions"><button className="invoice-button secondary" type="button" onClick={() => setConfirmNewBill(false)}>Cancel</button><button className="invoice-button primary" type="button" onClick={resetToNewBill}>Create New Bill</button></div></div></div>}</div>;
}
