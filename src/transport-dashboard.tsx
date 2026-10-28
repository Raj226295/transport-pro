/* eslint-disable react/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ArrowLeft, ArrowRight, ArrowUpDown, Bell, Building2, CalendarDays, ChartNoAxesColumn, CheckCircle2, ChevronDown, Clock3, Download, Eye, FilePlus2, FileText, Files, Home, IndianRupee, LayoutDashboard, List, LogOut, MapPin, Menu, MoreHorizontal, Package, Pencil, Pin, Plus, Printer, Route, Search, Settings, Share2, Truck, Users, WalletCards, X, Zap, type LucideIcon } from "lucide-react";
import VenomButton from "./components/VenomButton";
import CreateBillWorkspace, { downloadChallan, printChallan, readSavedBills, shareChallan, type BillData } from "./create-invoice";
import "./transport-dashboard.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";

type BillStatus = "Delivered" | "In transit" | "Pending";

type Bill = {
  id: string;
  date: string;
  party: string;
  from: string;
  to: string;
  vehicle: string;
  goods: string;
  quantity: number;
  unit: string;
  amount: number;
  status: BillStatus;
  paymentStatus?: BillData["paymentStatus"];
  invoiceDate?: string;
  payload?: BillData;
};

type BillItem = {
  id: number;
  name: string;
  hsn: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  gst: number;
};

const bills: Bill[] = [
  { id: "AUTO-000128", date: "24 Oct 2026", party: "ABC Traders", from: "Patna", to: "Delhi", vehicle: "BR01AB1234", goods: "Cement", quantity: 10, unit: "ton", amount: 45000, status: "Delivered" },
  { id: "AUTO-000127", date: "23 Oct 2026", party: "Shree Enterprises", from: "Ranchi", to: "Kolkata", vehicle: "JH05CD5678", goods: "Steel", quantity: 5, unit: "ton", amount: 28500, status: "In transit" },
  { id: "AUTO-000126", date: "22 Oct 2026", party: "Kumar Construction", from: "Delhi", to: "Patna", vehicle: "UP32EF9012", goods: "Sand", quantity: 12, unit: "ton", amount: 52000, status: "Delivered" },
  { id: "AUTO-000125", date: "21 Oct 2026", party: "Om Traders", from: "Jaipur", to: "Bangalore", vehicle: "RJ14GH3456", goods: "Machinery", quantity: 1, unit: "piece", amount: 38000, status: "Pending" },
  { id: "AUTO-000124", date: "20 Oct 2026", party: "Vardhan Logistics", from: "Bhopal", to: "Indore", vehicle: "MP09KL7788", goods: "Gravel", quantity: 8, unit: "ton", amount: 31500, status: "Delivered" },
];

const routes = {
  dashboard: "/dashboard",
  bills: "/dashboard/bills",
  vehicles: "/dashboard/vehicles",
  goods: "/dashboard/goods",
  revenue: "/dashboard/revenue",
  create: "/dashboard/create-bill",
} as const;

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);

const billStatusOptions = [
  { value: "all", label: "All statuses" },
  { value: "payment:Paid", label: "Paid" },
  { value: "payment:Partially Paid", label: "Partially Paid" },
  { value: "payment:Unpaid", label: "Unpaid" },
];

function AllBillsStatusFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = billStatusOptions.find((option) => option.value === value) ?? billStatusOptions[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className={`all-bills-status-filter${open ? " is-open" : ""}`} ref={rootRef}>
    <button type="button" className="all-bills-status-trigger" aria-label="Filter by payment status" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((shown) => !shown)}>
      <span>{current.label}</span><ChevronDown className="all-bills-status-chevron" aria-hidden="true" />
    </button>
    {open && <div className="all-bills-status-options" role="listbox" aria-label="Payment status">
      {billStatusOptions.map((option) => <button type="button" role="option" aria-selected={value === option.value} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>
        <span>{option.label}</span><span className="all-bills-status-radio" aria-hidden="true" />
      </button>)}
    </div>}
  </div>;
}
const currentDate = new Date();
const defaultBillDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;

function Icon({ name }: { name: string }) {
  const icons: Record<string, LucideIcon> = { dashboard: LayoutDashboard, create: FilePlus2, bills: List, vehicles: Truck, goods: Package, revenue: IndianRupee, parties: Users, routes: Route, expenses: WalletCards, reports: ChartNoAxesColumn, settings: Settings, bell: Bell, calendar: CalendarDays, search: Search, back: ArrowLeft, plus: Plus, view: Eye, edit: Pencil, download: Download, share: Share2, truck: Truck, menu: Menu, pin: Pin };
  const Glyph = icons[name] ?? LayoutDashboard;
  return <Glyph aria-hidden="true" strokeWidth={2.15} />;
}

function useDashboardLocation() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((next: string) => {
    const url = new URL(next, window.location.origin);
    const destination = `${url.pathname}${url.search}`;
    if (`${window.location.pathname}${window.location.search}` !== destination) window.history.pushState({}, "", destination);
    setPath(url.pathname);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  return { path, navigate };
}

function Status({ value }: { value: BillStatus }) {
  return <span className={`ops-status ops-status-${value.toLowerCase().replace(" ", "-")}`}>{value}</span>;
}

function StatCard({ label, value, trend, image, route, onNavigate }: { label: string; value: React.ReactNode; trend: string; image: string; route: string; onNavigate: (route: string) => void }) {
  return (
    <button className="ops-stat ops-glass" type="button" onClick={() => onNavigate(route)} aria-label={`${label}: ${typeof value === "string" ? value : "view details"}`}>
      <span className="ops-stat-icon" aria-hidden="true"><img src={image} alt="" /></span>
      <span className="ops-stat-copy"><span className="ops-stat-label">{label}</span><strong className="ops-stat-value">{value}</strong><span className="ops-stat-trend">{trend}</span></span>
      <svg className="ops-stat-sparkline" viewBox="0 0 58 24" aria-hidden="true"><path d="M1 20C7 20 8 15 14 17s7 2 12-3 7-1 12-3 7 2 11-2 5-6 8-8" /></svg>
      <span className="ops-stat-arrow" aria-hidden="true"><ArrowRight /></span>
    </button>
  );
}

function PageHeader({ title, description, onBack, action }: { title: string; description: string; onBack?: () => void; action?: React.ReactNode }) {
  return <header className="dashboard-page-header"><div>{onBack && <button className="ops-icon-button dashboard-back" type="button" onClick={onBack} aria-label="Back to dashboard"><Icon name="back" /></button>}<div><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div></div>{action}</header>;
}

function ActionButtons({ bill, navigate, notify }: { bill: Bill; navigate: (route: string) => void; notify: (message: string) => void }) {
  const saved = readSavedBills().find((row) => row.id === bill.id);
  const view = () => navigate(`${routes.bills}?view=${encodeURIComponent(bill.id)}`);
  const edit = () => navigate(`${routes.create}?bill=${encodeURIComponent(bill.id)}`);
  const download = async () => {
    if (saved?.payload) {
      try { await downloadChallan(saved.payload); notify(`${bill.id} PDF downloaded.`); } catch { notify("PDF generation failed. Please try again."); }
      return;
    }
    const content = [`TransportPro bill ${bill.id}`, `Date: ${bill.date}`, `Party: ${bill.party}`, `Route: ${bill.from} to ${bill.to}`, `Vehicle: ${bill.vehicle}`, `Goods: ${bill.goods} (${bill.quantity} ${bill.unit})`, `Amount: ${money(bill.amount)}`, `Status: ${bill.status}`].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${bill.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(`${bill.id} downloaded.`);
  };
  const share = async () => {
    if (saved?.payload) {
      try { const result = await shareChallan(saved.payload); notify(result === "shared" ? `${bill.id} PDF shared.` : `${bill.id} PDF downloaded.`); } catch (error) { if ((error as DOMException).name !== "AbortError") notify("Sharing is unavailable in this browser."); }
      return;
    }
    const text = `${bill.id} · ${bill.party} · ${money(bill.amount)} · ${bill.status}`;
    const canShare = typeof navigator.share === "function";
    try {
      if (canShare) await navigator.share({ title: `TransportPro bill ${bill.id}`, text });
      else await navigator.clipboard.writeText(text);
      notify(canShare ? `${bill.id} shared.` : `${bill.id} copied to clipboard.`);
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") notify("Sharing is unavailable in this browser.");
    }
  };
  const print = () => { if (!saved?.payload) return; try { printChallan(saved.payload); } catch (error) { notify((error as Error).message); } };
  return <div className="ops-row-actions"><button type="button" onClick={view} aria-label={`View ${bill.id}`} title="View"><Icon name="view" /></button>{saved?.payload && <button type="button" onClick={edit} aria-label={`Edit ${bill.id}`} title="Edit"><Icon name="edit" /></button>}<button type="button" onClick={download} aria-label={`Download ${bill.id}`} title="Download"><Icon name="download" /></button>{saved?.payload && <button type="button" onClick={print} aria-label={`Print ${bill.id}`} title="Print"><Printer size={17} /></button>}<button type="button" onClick={share} aria-label={`Share ${bill.id}`} title="Share"><Icon name="share" /></button></div>;
}

function BillsTable({ rows, navigate, notify, compact = false }: { rows: Bill[]; navigate: (route: string) => void; notify: (message: string) => void; compact?: boolean }) {
  return <div className="ops-table-scroll"><table className="ops-history-table"><thead><tr><th>Bill no.</th><th>Date</th><th>Company / party</th><th>Route</th>{!compact && <th>Vehicle</th>}<th>Goods</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((bill) => <tr key={bill.id}><td><strong>{bill.id}</strong></td><td>{bill.date}</td><td>{bill.party}</td><td>{bill.from} → {bill.to}</td>{!compact && <td>{bill.vehicle}</td>}<td>{bill.goods} ({bill.quantity} {bill.unit})</td><td>{money(bill.amount)}</td><td><Status value={bill.status} /></td><td><ActionButtons bill={bill} navigate={navigate} notify={notify} /></td></tr>)}</tbody></table></div>;
}

type BillSortKey = "id" | "date" | "party" | "amount" | "status";
const isoBillDate = (bill: Bill) => {
  if (bill.invoiceDate) return bill.invoiceDate;
  const parsed = new Date(bill.date);
  return Number.isNaN(parsed.getTime()) ? "" : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
};

function PaymentBadge({ value }: { value: BillData["paymentStatus"] }) {
  const IconGlyph = value === "Paid" ? CheckCircle2 : value === "Partially Paid" ? IndianRupee : Clock3;
  return <span className={`all-bills-payment all-bills-payment-${value.toLowerCase().replaceAll(" ", "-")}`}><IconGlyph aria-hidden="true" />{value}</span>;
}

function AllBillsActions({ bill, navigate, notify }: { bill: Bill; navigate: (route: string) => void; notify: (message: string) => void }) {
  const payload = bill.payload;
  const requirePayload = () => { if (payload) return payload; notify(`Invoice data for ${bill.id} is unavailable.`); return undefined; };
  const view = () => navigate(`${routes.bills}?view=${encodeURIComponent(bill.id)}`);
  const edit = () => navigate(`${routes.create}?bill=${encodeURIComponent(bill.id)}`);
  const download = async () => { const invoice = requirePayload(); if (!invoice) return; try { await downloadChallan(invoice); notify(`${bill.id} PDF downloaded.`); } catch { notify("PDF generation failed. Please try again."); } };
  const share = async () => { const invoice = requirePayload(); if (!invoice) return; try { const result = await shareChallan(invoice); notify(result === "shared" ? `${bill.id} PDF shared.` : `${bill.id} PDF downloaded.`); } catch (error) { if ((error as DOMException).name !== "AbortError") notify("Sharing is unavailable in this browser."); } };
  const print = () => { const invoice = requirePayload(); if (!invoice) return; try { printChallan(invoice); } catch (error) { notify((error as Error).message); } };
  return <div className="all-bills-actions">
    <button type="button" onClick={view} aria-label={`Preview bill ${bill.id}`} title="Preview bill"><Eye /></button>
    {payload && <button type="button" onClick={edit} aria-label={`Edit bill ${bill.id}`} title="Edit bill"><Pencil /></button>}
    <button type="button" onClick={download} aria-label={`Download bill ${bill.id}`} title="Download PDF"><Download /></button>
    <button type="button" onClick={share} aria-label={`Share bill ${bill.id}`} title="Share bill"><Share2 /></button>
    <details className="all-bills-more"><summary aria-label={`More actions for ${bill.id}`} title="More actions"><MoreHorizontal /></summary><div role="menu"><button type="button" role="menuitem" onClick={print}><Printer />Print PDF</button><button type="button" role="menuitem" onClick={view}><Eye />Bill details</button></div></details>
  </div>;
}

function AllBillsTable({ rows, navigate, notify, selectedIds, onSelect, onSelectVisible, allVisibleSelected, sortBy, sortDirection, onSort }: {
  rows: Bill[]; navigate: (route: string) => void; notify: (message: string) => void; selectedIds: Set<string>; onSelect: (id: string) => void; onSelectVisible: () => void; allVisibleSelected: boolean; sortBy: BillSortKey; sortDirection: "asc" | "desc"; onSort: (key: BillSortKey) => void;
}) {
  const sortButton = (key: BillSortKey, label: string, aria: string) => <button type="button" className="all-bills-sort" onClick={() => onSort(key)} aria-label={`Sort by ${aria}`} aria-pressed={sortBy === key} title={sortBy === key ? `Sorted ${sortDirection === "asc" ? "ascending" : "descending"}` : `Sort by ${aria}`}>{label}<ArrowUpDown aria-hidden="true" /></button>;
  return <div className="all-bills-table-scroll"><table className="all-bills-table"><thead><tr><th className="all-bills-check"><input type="checkbox" aria-label="Select all visible bills" checked={allVisibleSelected} onChange={onSelectVisible} /></th><th>{sortButton("id", "Bill No.", "bill number")}</th><th>{sortButton("date", "Date", "date")}</th><th>{sortButton("party", "Company / Party", "company or party")}</th><th>Route</th><th>Vehicle</th><th>Description</th><th className="all-bills-amount-head">{sortButton("amount", "Amount (₹)", "amount")}</th><th>{sortButton("status", "Status", "status")}</th><th>Actions</th></tr></thead><tbody>{rows.map((bill) => <tr key={bill.id}><td className="all-bills-check"><input type="checkbox" aria-label={`Select bill ${bill.id}`} checked={selectedIds.has(bill.id)} onChange={() => onSelect(bill.id)} /></td><td><strong className="all-bills-number">{bill.id}</strong></td><td>{bill.date}</td><td><span className="all-bills-party"><Building2 aria-hidden="true" />{bill.party}</span></td><td><span className="all-bills-route"><MapPin aria-hidden="true" />{bill.from} → {bill.to}</span></td><td><span className="all-bills-vehicle"><Truck aria-hidden="true" />{bill.vehicle || "—"}</span></td><td>{bill.goods || "—"}{bill.quantity ? ` (${bill.quantity} ${bill.unit})` : ""}</td><td className="all-bills-amount">{money(bill.amount)}</td><td><div className="all-bills-status">{bill.paymentStatus ? <PaymentBadge value={bill.paymentStatus} /> : <Status value={bill.status} />}</div></td><td><AllBillsActions bill={bill} navigate={navigate} notify={notify} /></td></tr>)}</tbody></table></div>;
}

function DashboardHome({ navigate, notify }: { navigate: (route: string) => void; notify: (message: string) => void }) {
  const statsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const section = statsRef.current;
    if (!section || !("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = [...section.querySelectorAll<HTMLElement>(".ops-stat")];
    if (!cards.length) return;

    section.classList.add("is-motion-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => target.classList.toggle("is-visible", isIntersecting));
    }, { threshold: 0.18 });
    cards.forEach((card) => observer.observe(card));
    return () => {
      observer.disconnect();
      section.classList.remove("is-motion-ready");
      cards.forEach((card) => card.classList.remove("is-visible"));
    };
  }, []);
  const quickActions = [
    { label: "Create Bill", detail: "Generate new transport bill", icon: "plus", tone: "primary", action: () => navigate(routes.create) },
    { label: "All Bills", detail: "View and manage bills", icon: "bills", tone: "blue", action: () => navigate(routes.bills) },
    { label: "Vehicles", detail: "Manage your vehicles", icon: "vehicles", tone: "violet", action: () => navigate(routes.vehicles) },
  ];
  return <>
    <h1 className="sr-only" tabIndex={-1}>TransportPro dashboard</h1>
    <section ref={statsRef} className="ops-stats" aria-label="Billing overview">
      <StatCard label="Total Bills" value="128" trend="+12% this month" image="/kpi-icons/total-bills.png" route={routes.bills} onNavigate={navigate} />
      <StatCard label="Total Vehicles" value="24" trend="+2 new this month" image="/kpi-icons/total-vehicles.png" route={routes.vehicles} onNavigate={navigate} />
      <StatCard label="Goods Moved" value={<>542.5 <small>ton</small></>} trend="+18% this month" image="/kpi-icons/goods-moved.png" route={routes.goods} onNavigate={navigate} />
      <StatCard label="Total Revenue" value="₹12,45,680" trend="+22% this month" image="/kpi-icons/total-revenue.png" route={routes.revenue} onNavigate={navigate} />
    </section>
    <section className="dashboard-section quick-actions-panel ops-glass" aria-labelledby="quick-actions-title"><div className="dashboard-section-heading"><div><h2 id="quick-actions-title"><span className="section-title-icon" aria-hidden="true"><Zap size={22} strokeWidth={2.35} /></span>Quick Actions</h2><p>Manage your transport operations quickly</p></div></div><div className="quick-actions">{quickActions.map((item) => <button className={`quick-action quick-action-${item.tone}`} type="button" onClick={item.action} key={item.label}><span><Icon name={item.icon} /></span><strong>{item.label}</strong><small>{item.detail}</small><b aria-hidden="true"><ArrowRight /></b></button>)}</div></section>
    <div className="dashboard-overview-grid">
      <section className="ops-panel ops-glass dashboard-recent" aria-labelledby="recent-bills-title"><header className="ops-panel-head"><div><h2 className="ops-panel-title" id="recent-bills-title"><Icon name="bills" />Recent Bills</h2><p>Latest transport bills and their status</p></div><button className="ops-button ops-button-soft recent-view-all" type="button" onClick={() => navigate(routes.bills)}>View all bills <ArrowRight aria-hidden="true" /></button></header><BillsTable rows={bills} navigate={navigate} notify={notify} /></section>
      <aside className="ops-panel ops-glass dashboard-activity" aria-labelledby="recent-activity-title"><header className="ops-panel-head"><div><h2 className="ops-panel-title" id="recent-activity-title"><Icon name="calendar" />Recent Activity</h2></div><button className="ops-text-button" type="button" onClick={() => navigate(routes.bills)}>View all <ArrowRight aria-hidden="true" /></button></header><ul><li><span className="activity-dot activity-in-transit" aria-hidden="true" /><span className="activity-symbol activity-symbol-blue"><Icon name="bills" /></span><div><strong>New Bill Created</strong><span>{bills[0].id} for {bills[0].party}</span><small>2 min ago</small></div></li><li><span className="activity-dot activity-delivered" aria-hidden="true" /><span className="activity-symbol activity-symbol-green"><Icon name="revenue" /></span><div><strong>Payment Received</strong><span>{money(bills[0].amount)} received from {bills[0].party}</span><small>15 min ago</small></div></li><li><span className="activity-dot activity-violet" aria-hidden="true" /><span className="activity-symbol activity-symbol-violet"><Icon name="vehicles" /></span><div><strong>Vehicle Updated</strong><span>{bills[0].vehicle} details updated</span><small>1 hour ago</small></div></li><li><span className="activity-dot activity-orange" aria-hidden="true" /><span className="activity-symbol activity-symbol-orange"><Icon name="view" /></span><div><strong>Bill Delivered</strong><span>{bills[2].id} marked as delivered</span><small>3 hours ago</small></div></li><li><span className="activity-dot activity-violet" aria-hidden="true" /><span className="activity-symbol activity-symbol-violet"><Icon name="plus" /></span><div><strong>New Vehicle Added</strong><span>{bills[4].vehicle} added to fleet</span><small>5 hours ago</small></div></li></ul></aside>
    </div>
  </>;
}

function FilterBar({ query, onQuery, status, onStatus, placeholder }: { query: string; onQuery: (value: string) => void; status: string; onStatus: (value: string) => void; placeholder: string }) {
  return <div className="dashboard-filters"><label className="dashboard-filter-search"><Icon name="search" /><span className="sr-only">Search</span><input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={placeholder} /></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => onStatus(event.target.value)}><option value="all">All statuses</option><option value="Delivered">Delivered</option><option value="In transit">In transit</option><option value="Pending">Pending</option></select></label></div>;
}

function BillsPage({ navigate, notify }: { navigate: (route: string) => void; notify: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [sortBy, setSortBy] = useState<BillSortKey>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedId = new URLSearchParams(window.location.search).get("view");
  const availableBills: Bill[] = readSavedBills().map((bill) => ({ ...bill, invoiceDate: bill.payload.date, paymentStatus: bill.payload.paymentStatus }));
  const selected = availableBills.find((bill) => bill.id === selectedId);
  const rows = availableBills.filter((bill) => {
    if (status.startsWith("payment:") && bill.paymentStatus !== status.slice(8)) return false;
    if (status.startsWith("delivery:") && (bill.paymentStatus || bill.status !== status.slice(9))) return false;
    const date = isoBillDate(bill);
    if (dateFrom && (!date || date < dateFrom)) return false;
    if (dateTo && (!date || date > dateTo)) return false;
    const searchable = [bill.id, bill.party, bill.from, bill.to, bill.vehicle, bill.goods, bill.quantity, bill.unit, bill.payload?.customerCompany, bill.payload?.customer, bill.payload?.project, bill.payload?.poNumber].join(" ").toLocaleLowerCase();
    return searchable.includes(query.trim().toLocaleLowerCase());
  }).sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sortBy === "amount") return (a.amount - b.amount) * direction;
    if (sortBy === "date") return (isoBillDate(a).localeCompare(isoBillDate(b))) * direction;
    if (sortBy === "status") return ((a.paymentStatus || a.status).localeCompare(b.paymentStatus || b.status)) * direction;
    return a[sortBy].localeCompare(b[sortBy], undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((bill) => selectedIds.has(bill.id));
  const totalAmount = availableBills.reduce((sum, bill) => sum + bill.amount, 0);
  const paidAmount = availableBills.filter((bill) => bill.paymentStatus === "Paid").reduce((sum, bill) => sum + bill.amount, 0);
  const unpaidAmount = availableBills.filter((bill) => bill.paymentStatus === "Unpaid").reduce((sum, bill) => sum + bill.amount, 0);
  const hasPartialPayments = availableBills.some((bill) => bill.paymentStatus === "Partially Paid");
  const selectOne = (id: string) => setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const selectVisible = () => setSelectedIds((current) => { const next = new Set(current); if (allVisibleSelected) visibleRows.forEach((bill) => next.delete(bill.id)); else visibleRows.forEach((bill) => next.add(bill.id)); return next; });
  const sort = (key: BillSortKey) => { if (sortBy === key) setSortDirection((value) => value === "asc" ? "desc" : "asc"); else { setSortBy(key); setSortDirection(key === "date" ? "desc" : "asc"); } };
  const firstVisible = rows.length ? (page - 1) * pageSize + 1 : 0, lastVisible = Math.min(page * pageSize, rows.length);
  return <section className="all-bills-shell" aria-labelledby="all-bills-title">
    <div className="all-bills-heading">
      <div className="all-bills-title-block"><span className="all-bills-title-icon"><Files aria-hidden="true" /></span><div><h1 id="all-bills-title">All Bills</h1><p>Search, filter, and view all your generated bills in one place.</p></div></div>
      <div className="all-bills-summary" aria-label="Saved invoice summaries">
        <article className="all-bills-stat all-bills-stat-count"><span className="all-bills-stat-icon"><Files aria-hidden="true" /></span><div><span>Total Bills</span><strong>{availableBills.length.toLocaleString("en-IN")}</strong><small>Saved invoices</small></div></article>
        <article className="all-bills-stat all-bills-stat-total"><span className="all-bills-stat-icon"><IndianRupee aria-hidden="true" /></span><div><span>Total Amount</span><strong>{money(totalAmount)}</strong><small>Across saved invoices</small></div></article>
        <article className="all-bills-stat all-bills-stat-paid"><span className="all-bills-stat-icon"><CheckCircle2 aria-hidden="true" /></span><div><span>Paid Amount</span><strong>{money(paidAmount)}</strong><small>Confirmed as paid</small></div></article>
        <article className="all-bills-stat all-bills-stat-pending"><span className="all-bills-stat-icon"><Clock3 aria-hidden="true" /></span><div><span>Pending Amount</span><strong>{money(unpaidAmount)}</strong><small>{hasPartialPayments ? "Partial balances unavailable" : "Unpaid invoices"}</small></div></article>
      </div>
    </div>
    <div className="all-bills-toolbar">
      <label className="all-bills-search"><Search aria-hidden="true" /><span className="sr-only">Search saved bills</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search bill no., company, route, vehicle or description…" /></label>
      <div className="all-bills-date-range"><CalendarDays aria-hidden="true" /><label><span className="sr-only">Date from</span><input aria-label="Date from" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label><span aria-hidden="true">to</span><label><span className="sr-only">Date to</span><input aria-label="Date to" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label></div>
      <AllBillsStatusFilter value={status} onChange={(value) => { setStatus(value); setPage(1); }} />
      <button className="all-bills-create" type="button" onClick={() => navigate(routes.create)}><Plus aria-hidden="true" />Create Bill</button>
    </div>
    {selected && <div className="bill-detail"><div><span>Selected bill</span><strong>{selected.id}</strong><small>{selected.party} · {selected.from} → {selected.to}</small></div><div><PaymentBadge value={selected.paymentStatus!} /><strong>{money(selected.amount)}</strong><button type="button" onClick={() => navigate(routes.bills)} aria-label="Close bill details"><X aria-hidden="true" /></button></div></div>}
    {rows.length ? <>
      <AllBillsTable rows={visibleRows} navigate={navigate} notify={notify} selectedIds={selectedIds} onSelect={selectOne} onSelectVisible={selectVisible} allVisibleSelected={allVisibleSelected} sortBy={sortBy} sortDirection={sortDirection} onSort={sort} />
      <footer className="all-bills-pagination"><p>Showing <strong>{firstVisible}–{lastVisible}</strong> of <strong>{rows.length}</strong> bills{selectedIds.size > 0 && <span> · {selectedIds.size} selected</span>}</p><div className="all-bills-page-controls"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ArrowLeft /></button><div className="all-bills-page-numbers">{Array.from({ length: Math.min(5, pageCount) }, (_, index) => Math.max(1, Math.min(page - 2, pageCount - 4)) + index).map((number) => <button type="button" key={number} aria-current={page === number ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>)}</div><button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}><ArrowRight /></button><label><span className="sr-only">Rows per page</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={5}>5 per page</option><option value={10}>10 per page</option><option value={20}>20 per page</option><option value={50}>50 per page</option></select></label></div></footer>
    </> : <div className="all-bills-empty"><span><Files aria-hidden="true" /></span><h2>{availableBills.length ? "No bills match these filters" : "No saved bills yet"}</h2><p>{availableBills.length ? "Try another search or adjust the date and status filters." : "Create your first invoice to see it here."}</p>{!availableBills.length && <button className="all-bills-create" type="button" onClick={() => navigate(routes.create)}><Plus aria-hidden="true" />Create Bill</button>}</div>}
  </section>;
}

function DataPage({ kind, navigate }: { kind: "vehicles" | "goods" | "revenue"; navigate: (route: string) => void }) {
  const isVehiclePage = kind === "vehicles";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const config = {
    vehicles: { title: "Vehicles", description: "Vehicles represented in the current billing records.", placeholder: "Search vehicle, party or route…" },
    goods: { title: "Goods moved", description: "Goods movement derived from available transport bills.", placeholder: "Search goods, bill or route…" },
    revenue: { title: "Revenue", description: "Revenue recorded across the current bill history.", placeholder: "Search bill, party or amount…" },
  }[kind];
  const rows = bills.filter((bill) => (status === "all" || bill.status === status) && Object.values(bill).join(" ").toLowerCase().includes(query.toLowerCase()));
  return <div className={isVehiclePage ? "vehicle-management-page" : undefined}>
    <PageHeader title={config.title} description={config.description} onBack={() => navigate(routes.dashboard)} action={kind !== "revenue" ? <button className="ops-button ops-button-primary" type="button" onClick={() => navigate(routes.create)}><Icon name="plus" />Create bill</button> : undefined} />
    <section className={`ops-panel ops-glass dashboard-data-panel${isVehiclePage ? " vehicle-management-panel" : ""}`}>
      <FilterBar query={query} onQuery={setQuery} status={status} onStatus={setStatus} placeholder={config.placeholder} />
      <div className="ops-table-scroll"><table className={`ops-history-table${isVehiclePage ? " vehicle-management-table" : ""}`}>
        <thead><tr>{kind === "vehicles" && <><th>Vehicle</th><th>Latest bill</th><th>Party</th><th>Current route</th><th>Status</th><th>Action</th></>}{kind === "goods" && <><th>Goods</th><th>Quantity</th><th>Bill</th><th>Route</th><th>Status</th><th>Action</th></>}{kind === "revenue" && <><th>Date</th><th>Bill</th><th>Company / party</th><th>Status</th><th className="align-right">Amount</th><th>Action</th></>}</tr></thead>
        <tbody>{rows.map((bill) => <tr key={bill.id}>{kind === "vehicles" && <><td><strong className="vehicle-management-vehicle"><Truck aria-hidden="true" />{bill.vehicle}</strong></td><td><span className="vehicle-management-bill"><FileText aria-hidden="true" />{bill.id}</span></td><td>{bill.party}</td><td><span className="vehicle-management-route"><MapPin aria-hidden="true" />{bill.from} → {bill.to}</span></td><td><Status value={bill.status} /></td><td><button className="ops-text-button vehicle-management-view" type="button" onClick={() => navigate(`${routes.bills}?view=${bill.id}`)}><Eye aria-hidden="true" />View bill</button></td></>}{kind === "goods" && <><td><strong>{bill.goods}</strong></td><td>{bill.quantity} {bill.unit}</td><td>{bill.id}</td><td>{bill.from} → {bill.to}</td><td><Status value={bill.status} /></td><td><button className="ops-text-button" type="button" onClick={() => navigate(`${routes.bills}?view=${bill.id}`)}>View bill</button></td></>}{kind === "revenue" && <><td>{bill.date}</td><td><strong>{bill.id}</strong></td><td>{bill.party}</td><td><Status value={bill.status} /></td><td className="align-right"><strong>{money(bill.amount)}</strong></td><td><button className="ops-text-button" type="button" onClick={() => navigate(`${routes.bills}?view=${bill.id}`)}>View bill</button></td></>}</tr>)}</tbody>
        {kind === "revenue" && <tfoot><tr><td colSpan={4}>Visible revenue</td><td className="align-right">{money(rows.reduce((sum, bill) => sum + bill.amount, 0))}</td><td /></tr></tfoot>}
      </table></div>{!rows.length && <p className="dashboard-empty">No records match the selected filters.</p>}
    </section>
  </div>;
}

export function LegacyCreateBillPage({ navigate }: { navigate: (route: string) => void }) {
  const editId = new URLSearchParams(window.location.search).get("bill");
  const source = bills.find((bill) => bill.id === editId);
  const [items, setItems] = useState<BillItem[]>([{ id: 1, name: source?.goods ?? "", hsn: "", quantity: source?.quantity ?? 1, unit: source?.unit === "ton" ? "Ton" : source?.unit === "piece" ? "Piece" : "Kg", price: source ? source.amount / source.quantity : 0, discount: 0, gst: 18 }]);
  const [message, setMessage] = useState("Billing is a preview; no bill is saved.");
  const totals = useMemo(() => items.reduce((sum, item) => { const base = Math.max(0, item.quantity) * Math.max(0, item.price); const discount = base * Math.min(100, Math.max(0, item.discount)) / 100; const tax = (base - discount) * Math.max(0, item.gst) / 100; return { subtotal: sum.subtotal + base, discount: sum.discount + discount, tax: sum.tax + tax }; }, { subtotal: 0, discount: 0, tax: 0 }), [items]);
  const updateItem = (id: number, field: keyof BillItem, value: string | number) => setItems((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  const addItem = () => setItems((current) => [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, name: "", hsn: "", quantity: 1, unit: "Kg", price: 0, discount: 0, gst: 18 }]);
  const removeItem = (id: number) => setItems((current) => current.length === 1 ? [{ ...current[0], name: "", hsn: "", quantity: 1, price: 0, discount: 0, gst: 18 }] : current.filter((item) => item.id !== id));
  const submit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setMessage("Billing is a preview; no bill was saved because no billing service is connected."); };
  return <><PageHeader title={source ? `Edit ${source.id}` : "Create transport bill"} description="Enter consignment details and review the calculated bill summary." onBack={() => navigate(routes.dashboard)} /><div className="ops-workspace create-bill-workspace"><section className="ops-panel ops-glass"><header className="ops-panel-head"><h2 className="ops-panel-title"><Icon name="create" />Bill details</h2><div className="ops-meta"><div className="ops-field"><label htmlFor="dashboard-bill-date">Bill date</label><input id="dashboard-bill-date" name="billDate" type="date" defaultValue={defaultBillDate} required /></div><div className="ops-field"><label htmlFor="dashboard-bill-number">Bill no.</label><input id="dashboard-bill-number" value={source?.id ?? "AUTO-000129"} readOnly /></div></div></header><form className="ops-form" onSubmit={submit}>
    <section className="ops-form-section"><h3 className="ops-section-title">Company / party details</h3><div className="ops-fields"><div className="ops-field"><label htmlFor="dashboard-party-name">Company / seller name <span>*</span></label><input id="dashboard-party-name" name="party" defaultValue={source?.party} placeholder="Enter company name" required /></div><div className="ops-field"><label htmlFor="dashboard-party-gstin">GSTIN</label><input id="dashboard-party-gstin" name="gstin" placeholder="Enter GSTIN" maxLength={15} /></div><div className="ops-field"><label htmlFor="dashboard-party-phone">Phone no.</label><input id="dashboard-party-phone" name="phone" type="tel" placeholder="Enter phone number" /></div><div className="ops-field ops-field-wide"><label htmlFor="dashboard-party-address">Address</label><input id="dashboard-party-address" name="address" placeholder="Enter full address" /></div><div className="ops-field"><label htmlFor="dashboard-party-email">Email ID</label><input id="dashboard-party-email" name="email" type="email" placeholder="Enter email" /></div><div className="ops-field"><label htmlFor="dashboard-party-state">State</label><select id="dashboard-party-state" name="state" defaultValue=""><option value="">Select state</option><option>Delhi</option><option>Haryana</option><option>Maharashtra</option><option>Uttar Pradesh</option><option>West Bengal</option></select></div></div></section>
    <section className="ops-form-section"><h3 className="ops-section-title">Consignment details</h3><div className="ops-fields ops-fields-4"><div className="ops-field"><label htmlFor="dashboard-pickup">From (pickup location) <span>*</span></label><input id="dashboard-pickup" name="pickup" defaultValue={source?.from} placeholder="Enter pickup location" required /></div><div className="ops-field"><label htmlFor="dashboard-delivery">To (delivery location) <span>*</span></label><input id="dashboard-delivery" name="delivery" defaultValue={source?.to} placeholder="Enter delivery location" required /></div><div className="ops-field"><label htmlFor="dashboard-driver">Transporter / driver</label><input id="dashboard-driver" name="driver" placeholder="Enter name" /></div><div className="ops-field"><label htmlFor="dashboard-driver-phone">Driver mobile no.</label><input id="dashboard-driver-phone" name="driverPhone" type="tel" placeholder="Enter mobile number" /></div><div className="ops-field"><label htmlFor="dashboard-vehicle">Vehicle number <span>*</span></label><input id="dashboard-vehicle" name="vehicle" defaultValue={source?.vehicle} placeholder="Enter vehicle number" required /></div><div className="ops-field"><label htmlFor="dashboard-invoice">Invoice no.</label><input id="dashboard-invoice" name="invoice" placeholder="Enter invoice no." /></div><div className="ops-field"><label htmlFor="dashboard-delivery-date">Delivery date</label><input id="dashboard-delivery-date" name="deliveryDate" type="date" /></div></div></section>
    <section className="ops-form-section"><h3 className="ops-section-title">Items / goods details</h3><div className="ops-table-scroll"><table className="ops-items"><thead><tr><th>Item name</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Price / unit</th><th>Discount %</th><th>GST %</th><th>Amount</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{items.map((item) => { const base = item.quantity * item.price; const amount = (base - base * item.discount / 100) * (1 + item.gst / 100); return <tr key={item.id}><td><input aria-label="Item name" value={item.name} onChange={(event) => updateItem(item.id, "name", event.target.value)} placeholder="Enter item name" /></td><td><input aria-label="HSN code" value={item.hsn} onChange={(event) => updateItem(item.id, "hsn", event.target.value)} placeholder="HSN" /></td><td><input aria-label="Quantity" type="number" min="0" step="any" value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", Number(event.target.value))} /></td><td><select aria-label="Unit" value={item.unit} onChange={(event) => updateItem(item.id, "unit", event.target.value)}><option>Kg</option><option>Ton</option><option>Piece</option><option>Box</option></select></td><td><input aria-label="Price per unit" type="number" min="0" step="any" value={item.price || ""} onChange={(event) => updateItem(item.id, "price", Number(event.target.value))} placeholder="0.00" /></td><td><input aria-label="Discount percentage" type="number" min="0" max="100" step="any" value={item.discount} onChange={(event) => updateItem(item.id, "discount", Number(event.target.value))} /></td><td><select aria-label="GST rate" value={item.gst} onChange={(event) => updateItem(item.id, "gst", Number(event.target.value))}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></td><td className="ops-amount">{money(amount)}</td><td><button className="ops-remove-row" type="button" onClick={() => removeItem(item.id)} aria-label="Remove item"><X aria-hidden="true" /></button></td></tr>; })}</tbody></table></div><button className="ops-button ops-button-soft ops-add-item" type="button" onClick={addItem}><Icon name="plus" />Add item</button></section>
    <div className="ops-submit-row"><span className="ops-note" aria-live="polite">{message}</span><VenomButton text="Save Bill" type="submit" width={160} height={50} aria-label="Save bill" /></div>
  </form></section><aside className="ops-panel ops-glass ops-summary" aria-label="Bill summary"><h2>Bill summary</h2><div className="ops-summary-line"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div><div className="ops-summary-line"><span>Discount</span><strong>− {money(totals.discount)}</strong></div><div className="ops-summary-line"><span>CGST</span><strong>{money(totals.tax / 2)}</strong></div><div className="ops-summary-line"><span>SGST</span><strong>{money(totals.tax / 2)}</strong></div><div className="ops-summary-line"><span>Other charges</span><strong>{money(0)}</strong></div><div className="ops-summary-total"><span>Grand total</span><strong>{money(totals.subtotal - totals.discount + totals.tax)}</strong></div><p className="ops-summary-hint">GST is calculated from the item rows. Review details before creating a bill.</p></aside></div></>;
}

function CreateBillPage({ navigate }: { navigate: (route: string) => void }) {
  const editId = new URLSearchParams(window.location.search).get("bill");
  const editing = readSavedBills().find((bill) => bill.id === editId);
  return <CreateBillWorkspace onBack={() => navigate(routes.dashboard)} editing={editing} />;
}

function TopNavigation({ path, navigate, onNavigate }: { path: string; navigate: (route: string) => void; onNavigate?: () => void }) {
  const items = [
    { label: "Dashboard", Icon: LayoutDashboard, route: routes.dashboard },
    { label: "Create Bill", Icon: FilePlus2, route: routes.create },
    { label: "All Bills", Icon: Files, route: routes.bills },
    { label: "Vehicles", Icon: Truck, route: routes.vehicles },
  ];
  return <nav id="dashboard-primary-navigation" className="ops-primary-nav" aria-label="Primary navigation">{items.map(({ label, Icon: NavIcon, route }) => <button key={label} className="ops-primary-nav-item" type="button" aria-current={path === route ? "page" : undefined} onClick={() => { navigate(route); onNavigate?.(); }}><NavIcon size={18} strokeWidth={2.15} /><span>{label}</span></button>)}</nav>;
}

function TransportDashboard() {
  const { path, navigate } = useDashboardLocation();
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { setMobileNavOpen(false); }, [path]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileNavOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);
  const logout = () => {
    try { sessionStorage.removeItem("transport-login-entered-v2"); } catch { /* Session storage can be unavailable in restricted browsers. */ }
    window.history.replaceState({}, "", "/");
    window.location.reload();
  };
  useEffect(() => {
    if (path.startsWith("/dashboard")) window.requestAnimationFrame(() => document.querySelector<HTMLElement>(".dashboard-page-header h1")?.focus({ preventScroll: true }));
  }, [path]);
  useEffect(() => {
    const app = document.getElementById("services-app");
    const website = document.querySelector<HTMLElement>(".track");
    if (!app || !website) return;
    const showWebsite = () => {
      setMobileNavOpen(false);
      app.hidden = true;
      app.setAttribute("aria-hidden", "true");
      website.hidden = false;
      document.dispatchEvent(new Event("homepage:reset"));
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
      document.getElementById("open-services")?.focus({ preventScroll: true });
    };
    const open = () => { setMobileNavOpen(false); website.hidden = true; app.hidden = false; app.setAttribute("aria-hidden", "false"); if (!window.location.pathname.startsWith("/dashboard")) navigate(routes.dashboard); };
    const close = () => { showWebsite(); window.history.pushState({}, "", "/"); };
    const onPop = () => { if (window.location.pathname.startsWith("/dashboard")) open(); else showWebsite(); };
    const onKey = (event: KeyboardEvent) => { if (!app.hidden && event.key === "Escape") close(); };
    document.addEventListener("services:open", open);
    document.addEventListener("services:close", close);
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    if (window.location.pathname.startsWith("/dashboard")) open();
    return () => { document.removeEventListener("services:open", open); document.removeEventListener("services:close", close); window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey); };
  }, [navigate]);
  const page = path === routes.create ? <CreateBillPage navigate={navigate} /> : path === routes.bills ? <BillsPage navigate={navigate} notify={setNotice} /> : path === routes.vehicles ? <DataPage kind="vehicles" navigate={navigate} /> : path === routes.goods ? <DataPage kind="goods" navigate={navigate} /> : path === routes.revenue ? <DataPage kind="revenue" navigate={navigate} /> : <DashboardHome navigate={navigate} notify={setNotice} />;
  return <div className={`dashboard-app${mobileNavOpen ? " mobile-nav-open" : ""}`}><div className="ops-layout"><div className="ops-main"><header className="ops-topbar"><button className="ops-brand" type="button" onClick={() => document.dispatchEvent(new Event("services:close"))} aria-label="Raj.vSingh — back to website"><img className="ops-brand-logo" src="/raj-v-singh-logo.png" alt="Raj.vSingh" /></button><button className="mobile-nav-toggle" type="button" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} aria-controls="dashboard-primary-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button><TopNavigation path={path} navigate={navigate} onNavigate={() => setMobileNavOpen(false)} /><button className="ops-home-link" type="button" onClick={() => document.dispatchEvent(new Event("services:close"))}><Home size={19} strokeWidth={2.2} /><span>Back to Home</span></button><button className="ops-logout" type="button" onClick={logout} aria-label="Logout"><LogOut size={19} strokeWidth={2.2} /><span>Logout</span></button></header><main className="ops-shell" tabIndex={-1}>{page}</main></div></div>{mobileNavOpen && <button className="mobile-nav-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}{notice && <div className="dashboard-toast" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification"><X aria-hidden="true" /></button></div>}</div>;
}

const root = document.getElementById("transport-dashboard-root") as (HTMLElement & { __transportDashboardRoot?: Root }) | null;
if (root) {
  root.__transportDashboardRoot ??= createRoot(root);
  root.__transportDashboardRoot.render(<TransportDashboard />);
}
