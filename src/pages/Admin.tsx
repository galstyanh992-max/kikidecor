import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Eye, ChevronLeft, ChevronRight,
  LogOut, LayoutGrid, List,
  Phone as PhoneIcon, MessageSquare, Mail as MailIcon,
  Users, CalendarDays, Loader2, Menu, X,
  Image as ImageIcon, Film,
} from "lucide-react";
import AdminLogin from "@/components/AdminLogin";
import type { Session } from "@supabase/supabase-js";
import { isAdminUser } from "@/lib/admin";

// Lazy-load admin sub-panels
const AdminCalendar = lazy(() => import("@/components/AdminCalendar"));
const AdminDecorImageGenerator = lazy(() => import("@/components/admin/AdminDecorImageGenerator"));
const AdminWanVideo = lazy(() => import("@/components/admin/AdminWanVideo"));

type Lead = {
  id: string; name: string; phone: string; email: string; event_type: string;
  event_date: string | null; location: string | null; guests: number | null;
  message: string | null; status: string; notes: string | null; created_at: string;
};

const STATUSES = [
  { value: "new", label: "Новая", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "contacted", label: "Связались", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { value: "consultation", label: "Консультация", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { value: "proposal", label: "КП отправлено", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { value: "booked", label: "Забронировано", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "order", label: "Заказ оформлен", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "completed", label: "Завершено", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "lost", label: "Потеряно", color: "bg-red-100 text-red-800 border-red-200" },
];

const getStatusBadge = (status: string) => {
  const s = STATUSES.find((st) => st.value === status);
  return s ? <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>{s.label}</span> : <Badge variant="outline">{status}</Badge>;
};

type Section = "leads" | "calendar" | "ai-image" | "ai-video";

const NAV_ITEMS: { key: Section; label: string; icon: any; group?: string }[] = [
  { key: "leads", label: "Лиды", icon: Users, group: "CRM" },
  { key: "calendar", label: "Календарь", icon: CalendarDays, group: "CRM" },
  { key: "ai-image", label: "Генерация изображения", icon: ImageIcon, group: "AI" },
  { key: "ai-video", label: "Генерация видео", icon: Film, group: "AI" },
];

const Admin = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [section, setSection] = useState<Section>("leads");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");
  const [page, setPage] = useState(0);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 20;


  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
      if (session?.user?.id) {
        // Defer Supabase calls outside of the auth callback
        setTimeout(() => {
          isAdminUser(session.user.id).then(setIsAdmin);
        }, 0);
      } else {
        setIsAdmin(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session?.user?.id) {
        isAdminUser(session.user.id).then(setIsAdmin);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setIsAdmin(null); };

  const fetchLeads = async () => {
    setLoading(true);
    const { data: all } = await supabase.from("event_leads").select("*").order("created_at", { ascending: false });
    if (all) setAllLeads(all);

    let query = supabase.from("event_leads").select("*").order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (search.trim()) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data } = await query;
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { if (session) { fetchLeads(); } }, [filterStatus, page, session]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  if (!session) return <AdminLogin onLogin={() => { }} />;
  if (isAdmin === null) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg font-medium text-destructive">Доступ запрещён</p>
        <p className="text-sm text-muted-foreground">У вас нет прав администратора</p>
        <button onClick={handleLogout} className="text-sm underline text-muted-foreground hover:text-foreground">Выйти</button>
      </div>
    );
  }

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(0); fetchLeads(); };

  const updateStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase.from("event_leads").update({ status: newStatus }).eq("id", id);
    if (error) { toast.error("Ошибка"); return; }
    toast.success("Статус обновлён");
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
    if (selectedLead?.id === id) setSelectedLead((prev) => prev ? { ...prev, status: newStatus } : null);
  };

  const saveNotes = async () => {
    if (!selectedLead) return;
    const { error } = await supabase.from("event_leads").update({ notes: editNotes }).eq("id", selectedLead.id);
    if (error) { toast.error("Ошибка"); return; }
    toast.success("Заметки сохранены");
    setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, notes: editNotes } : l)));
    setSelectedLead((prev) => prev ? { ...prev, notes: editNotes } : null);
  };

  const openDetail = (lead: Lead) => { setSelectedLead(lead); setEditNotes(lead.notes || ""); };



  const navigateTo = (s: Section) => { setSection(s); setSidebarOpen(false); };

  const sidebarInner = (
    <>
      <div style={{ padding: "18px 14px 14px", borderBottom: "1px solid #F0F0F0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}>
            <span style={{ color: "#fff", fontSize: "15px", fontWeight: 700, fontFamily: "serif" }}>K</span>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#000", fontFamily: '"Cormorant Garamond", Georgia, serif', lineHeight: 1.15 }}>KiKi</p>
            <p style={{ margin: 0, fontSize: "0.65rem", color: "#999", fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>Admin</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: "8px 8px", overflowY: "auto" }}>
        {(() => {
          const groups = Array.from(new Set(NAV_ITEMS.map(i => i.group)));
          return groups.map(group => {
            const items = NAV_ITEMS.filter(i => i.group === group);
            return (
              <div key={group} style={{ marginBottom: "6px" }}>
                <p style={{ fontSize: "0.625rem", fontWeight: 700, color: "#BBB", textTransform: "uppercase", letterSpacing: "0.08em", padding: "6px 10px 2px", margin: 0 }}>{group}</p>
                {items.map(item => {
                  const active = section === item.key;
                  return (
                    <button key={item.key} onClick={() => navigateTo(item.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "9px", padding: "8px 10px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: active ? 700 : 600, color: active ? "#000" : "#444", background: active ? "#F0EDFF" : "transparent", marginBottom: "1px", textAlign: "left", transition: "all 0.15s" }}>
                      <item.icon size={14} style={{ color: active ? "#7C3AED" : "#999", flexShrink: 0 }} />
                      {item.label}
                      {active && <span style={{ marginLeft: "auto", width: "5px", height: "5px", borderRadius: "50%", background: "#7C3AED", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            );
          });
        })()}
      </nav>
      <div style={{ padding: "10px 8px 14px", borderTop: "1px solid #F0F0F0", flexShrink: 0 }}>
        <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 10px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, color: "#888", background: "transparent", transition: "all 0.15s" }}>
          <LogOut size={14} style={{ flexShrink: 0 }} />
          Выйти
        </button>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", background: "#F3F4F6", fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif" }}>
      <title>Admin — KiKi</title>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(3px)" }} />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex" style={{ position: "sticky", top: 0, height: "100dvh", width: "220px", minWidth: "220px", background: "#ffffff", borderRight: "1px solid #E8E8E8", flexDirection: "column", overflowY: "auto", flexShrink: 0, zIndex: 10 }}>
        {sidebarInner}
      </aside>

      {/* Mobile Sidebar */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-[70] transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ width: "260px", background: "#ffffff", borderRight: "1px solid #E8E8E8", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {sidebarInner}
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflowX: "hidden" }}>

        {/* Top header bar (always visible) */}
        <header style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#ffffff",
          borderBottom: "1px solid #EEEEEE",
          padding: "0 20px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          flexShrink: 0,
        }}>
          {/* Hamburger on mobile */}
          <button
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            style={{ border: "none", background: "transparent", cursor: "pointer", padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center", color: "#333" }}
          >
            <Menu size={20} />
          </button>

          {/* Active section title */}
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#000" }}>
            {NAV_ITEMS.find(n => n.key === section)?.label ?? "Admin"}
          </span>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Logo on mobile */}
          <span className="md:hidden" style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: "1.1rem", fontWeight: 700, color: "#000" }}>KiKi</span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: "16px 12px", overflowX: "hidden" }} className="sm:p-6">
         <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-primary" size={24} /></div>}>
          {/* ═══ LEADS ═══ */}
          {section === "leads" && (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "8px" }}>
                <h2 style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: "1.5rem", fontWeight: 700, color: "#000000", margin: 0, letterSpacing: "-0.02em" }}>CRM Pipeline</h2>
              </div>

              <div className="flex flex-col gap-3 items-stretch mb-5">
                <div className="flex items-center gap-3 flex-wrap">
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#F5F5F5", borderRadius: "10px", padding: "4px", flexShrink: 0 }}>
                    <button onClick={() => setViewMode("pipeline")} style={{ padding: "6px 10px", borderRadius: "7px", border: "none", cursor: "pointer", background: viewMode === "pipeline" ? "#000000" : "transparent", color: viewMode === "pipeline" ? "#ffffff" : "#666666", transition: "all 0.15s", display: "flex", alignItems: "center" }}><LayoutGrid size={14} /></button>
                    <button onClick={() => setViewMode("table")} style={{ padding: "6px 10px", borderRadius: "7px", border: "none", cursor: "pointer", background: viewMode === "table" ? "#000000" : "transparent", color: viewMode === "table" ? "#ffffff" : "#666666", transition: "all 0.15s", display: "flex", alignItems: "center" }}><List size={14} /></button>
                  </div>
                  {viewMode === "table" && (
                    <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(0); }}>
                      <SelectTrigger className="w-[140px] sm:w-[160px] rounded-none border-border"><SelectValue placeholder="Все" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск..." className="pl-9 rounded-none border-border" />
                  </div>
                  <Button type="submit" variant="outline" className="rounded-none"><Search size={16} /></Button>
                </form>
              </div>

              {viewMode === "pipeline" && (
                <div ref={pipelineRef} className="flex flex-col md:flex-row gap-2 sm:gap-3 md:overflow-x-auto pb-4 md:-mx-3 md:px-3 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
                  {STATUSES.map((stage) => {
                    const sl = allLeads.filter((l) => l.status === stage.value);
                    return (
                      <div key={stage.value} className="w-full md:min-w-[240px] md:w-[240px] md:flex-shrink-0 bg-background border border-border flex flex-col max-h-[40vh] md:max-h-[65vh]">
                        <div className="px-2.5 sm:px-3 py-2 sm:py-2.5 border-b border-border flex items-center justify-between">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold ${stage.color}`}>{stage.label}</span>
                          <span className="text-[9px] sm:text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5">{sl.length}</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                          {sl.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground/40 text-[10px] uppercase tracking-wider">Пусто</div>
                          ) : sl.map((lead) => (
                            <button key={lead.id} onClick={() => openDetail(lead)} className="w-full text-left p-2 sm:p-2.5 border border-border/60 bg-card hover:border-primary/40 transition-colors group">
                              <p className="text-xs sm:text-sm font-medium truncate">{lead.name}</p>
                              <p className="text-[10px] sm:text-[11px] text-muted-foreground">{lead.event_type === "showroom_request" ? "🛍️ Запрос из каталога" : lead.event_type === "ai_consultation" ? "🤖 AI Консультация" : lead.event_type}</p>
                              {lead.event_date && <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1">{new Date(lead.event_date).toLocaleDateString("ru-RU")}</p>}
                              <div className="flex gap-1.5 mt-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} className="p-1 border border-border hover:border-primary hover:text-primary transition-colors rounded-sm"><PhoneIcon size={10} /></a>
                                <a href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Здравствуйте, ${lead.name}! Это KiKi.`)}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 border border-border hover:border-green-500 hover:text-green-600 transition-colors rounded-sm"><MessageSquare size={10} /></a>
                                <a href={`mailto:${lead.email}`} onClick={(e) => e.stopPropagation()} className="p-1 border border-border hover:border-primary hover:text-primary transition-colors rounded-sm"><MailIcon size={10} /></a>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode === "table" && (
                <>
                  <div className="bg-background border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Имя</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Телефон</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden lg:table-cell">Email</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Тип</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium hidden md:table-cell">Дата</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">Статус</th>
                          <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Загрузка...</td></tr>
                        ) : leads.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Заявок нет</td></tr>
                        ) : leads.map((lead) => (
                          <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{lead.name}</td>
                            <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{lead.phone}</td>
                            <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{lead.email}</td>
                            <td className="px-4 py-3">{lead.event_type === "showroom_request" ? "🛍️ Запрос из каталога" : lead.event_type === "ai_consultation" ? "🤖 AI Консультация" : lead.event_type}</td>
                            <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{lead.event_date ? new Date(lead.event_date).toLocaleDateString("ru-RU") : "—"}</td>
                            <td className="px-4 py-3">{getStatusBadge(lead.status)}</td>
                            <td className="px-4 py-3"><Button variant="ghost" size="sm" onClick={() => openDetail(lead)}><Eye size={16} /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <Button variant="outline" size="sm" className="rounded-none" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} /> Назад</Button>
                    <span className="text-sm text-muted-foreground">Стр. {page + 1}</span>
                    <Button variant="outline" size="sm" className="rounded-none" disabled={leads.length < PAGE_SIZE} onClick={() => setPage((p) => p + 1)}>Далее <ChevronRight size={16} /></Button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══ CALENDAR ═══ */}
          {section === "calendar" && (
            <>
              <h2 className="font-display text-2xl font-light mb-6">Календарь бронирований</h2>
              <AdminCalendar onLeadUpdated={fetchLeads} />
            </>
          )}

          {/* ═══ AI IMAGE GENERATOR ═══ */}
          {section === "ai-image" && <AdminDecorImageGenerator />}

          {/* ═══ AI VIDEO GENERATOR ═══ */}
          {section === "ai-video" && <AdminWanVideo />}
         </Suspense>
        </main>
      </div>

      {/* Lead Detail Dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-lg rounded-none max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-light">Детали заявки</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {[
                  ["Имя", selectedLead.name],
                  ["Телефон", selectedLead.phone],
                  ["Email", selectedLead.email],
                  ["Тип", selectedLead.event_type],
                  ["Дата", selectedLead.event_date ? new Date(selectedLead.event_date).toLocaleDateString("ru-RU") : "—"],
                  ["Локация", selectedLead.location || "—"],
                  ["Гостей", selectedLead.guests || "—"],
                  ["Создана", new Date(selectedLead.created_at).toLocaleDateString("ru-RU")],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                    <p className="mt-0.5">{String(value)}</p>
                  </div>
                ))}
              </div>

              {selectedLead.message && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Сообщение</span>
                  <p className="mt-1 text-sm bg-muted/50 p-3 border border-border">{selectedLead.message}</p>
                </div>
              )}

              <div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">Статус</span>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {STATUSES.map((s) => (
                    <button key={s.value} onClick={() => updateStatus(selectedLead.id, s.value)} className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs border transition-all ${selectedLead.status === s.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary text-muted-foreground hover:text-foreground"}`}>{s.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-2">Заметки</span>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} placeholder="Заметки..." className="rounded-none border-border resize-none" />
                <Button onClick={saveNotes} className="mt-2 rounded-none text-xs uppercase tracking-wider" size="sm">Сохранить</Button>
              </div>

              {/* Quick actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
                <a href={`tel:${selectedLead.phone}`} className="flex-1 text-center py-2.5 sm:py-2 text-xs border border-border hover:border-primary hover:text-primary transition-colors"><PhoneIcon size={12} className="inline mr-1" />Позвонить</a>
                <a href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Здравствуйте, ${selectedLead.name}! Это KiKi.`)}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2.5 sm:py-2 text-xs border border-border hover:border-green-500 hover:text-green-600 transition-colors"><MessageSquare size={12} className="inline mr-1" />WhatsApp</a>
                <a href={`mailto:${selectedLead.email}`} className="flex-1 text-center py-2.5 sm:py-2 text-xs border border-border hover:border-primary hover:text-primary transition-colors"><MailIcon size={12} className="inline mr-1" />Email</a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default Admin;
