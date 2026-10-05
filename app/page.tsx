"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient, User } from "@supabase/supabase-js";
import { Pig, Insemination, FarrowingLitter, FarmTask, UserProfile, AuditLog, FarmConfig } from "../types/farm";
import { PigCard } from "../components/PigCard";
import { EditPigModal } from "../components/EditPigModal";
import { LoginModal, ChangePasswordModal } from "../components/AuthModals";
import { OverviewTab } from "../components/OverviewTab";
import { PigletTab } from "../components/PigletTab";
import { SettingsTab } from "../components/SettingsTab";

export default function FarmApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changePwdMsg, setChangePwdMsg] = useState("");

  const [pigs, setPigs] = useState<Pig[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [litters, setLitters] = useState<FarrowingLitter[]>([]);
  const [dbTasks, setDbTasks] = useState<FarmTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Lan lai Hương", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire"],
    stages: ["Hậu bị", "Chờ phối", "Đang chửa", "Nuôi con", "Cai sữa", "Vỗ béo thịt", "Đực giống"],
    pens: ["CA1", "CA2", "CA3", "CA4", "CA5", "CB1", "CB2", "CB3", "CB4", "CD1", "CD2"]
  });

  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const supabase = useMemo(() => {
    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl, rawKey.trim());
  }, []);

  const loadProfile = async (uEmail: string) => {
    const cleanEmail = (uEmail || "").trim().toLowerCase();
    const { data } = await supabase.from("user_profiles").select("*").ilike("email", cleanEmail).maybeSingle();
    if (data) setProfile(data);
    else if (cleanEmail === "haquangdu.cb@gmail.com") {
      setProfile({ id: "admin-root", email: cleanEmail, full_name: "Hà Quang Dự", role: "ADMIN", is_active: true, created_at: new Date().toISOString() });
    }
  };

  const loadAllProfiles = async () => {
    const { data } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
    if (data) setAllProfiles(data);
  };

  const fetchData = async () => {
    const [pRes, tRes, farRes, insemRes, penRes, logRes] = await Promise.all([
      supabase.from("pigs").select("*").order("created_at", { ascending: false }),
      supabase.from("farm_tasks").select("*").order("due_date", { ascending: true }),
      supabase.from("farrowings").select("*").order("farrow_date", { ascending: false }),
      supabase.from("inseminations").select("*").order("mating_date", { ascending: false }),
      supabase.from("pens").select("pen_code").order("pen_code", { ascending: true }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20)
    ]);
    if (pRes.data) setPigs(pRes.data);
    if (tRes.data) setDbTasks(tRes.data);
    if (farRes.data) setLitters(farRes.data);
    if (insemRes.data) setInseminations(insemRes.data);
    if (logRes.data) setAuditLogs(logRes.data);
    if (penRes.data && penRes.data.length > 0) {
      setConfig(prev => ({ ...prev, pens: Array.from(new Set([...config.pens, ...penRes.data.map((p: any) => p.pen_code)])) }));
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) loadProfile(session.user.email);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) loadProfile(session.user.email);
      else setProfile(null);
    });
    fetchData();
    return () => subscription.unsubscribe();
  }, [supabase]);

  const isAdmin = useMemo(() => profile?.role === "ADMIN" || user?.email?.toLowerCase().trim() === "haquangdu.cb@gmail.com", [profile, user]);

  useEffect(() => {
    if (isAdmin) loadAllProfiles();
  }, [isAdmin]);

  const logAction = async (actionType: string, targetId: string, details: string) => {
    await supabase.from("audit_logs").insert([{ action_type: actionType, target_id: targetId, performed_by: profile?.email || user?.email || "Khách", details }]);
  };

  const normalize = (text?: string) => text ? text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim() : "";
  const isIndividualPiglet = (pig: Pig) => (pig.ear_tag || "").toUpperCase().includes("-C") || (pig.ear_tag || "").toUpperCase().includes("CON");
  const isMeat = (pig: Pig) => !isIndividualPiglet(pig) && normalize(pig.stage).includes("thit");
  const isSow = (pig: Pig) => !isIndividualPiglet(pig) && !isMeat(pig) && (normalize(pig.sex).includes("cai") || normalize(pig.sex) === "c");
  const isBoar = (pig: Pig) => !isIndividualPiglet(pig) && !isMeat(pig) && !isSow(pig);
  const checkSowState = (pig: Pig) => {
    const st = normalize(pig.stage);
    return st.includes("chua") || st.includes("phoi") ? "CHUA" : st.includes("nuoi con") ? "NUOICON" : "CHOPHOI";
  };

  const sowList = pigs.filter(isSow);
  const boarList = pigs.filter(isBoar);
  const meatList = pigs.filter(isMeat);
  const activeLitters = litters.filter(l => !(l.notes || "").toLowerCase().includes("da cai"));

  const fullTasks = useMemo(() => {
    const taskMap = new Map<string, FarmTask>();
    const today = new Date();
    const diff = (dStr: string) => Math.floor((today.getTime() - new Date(dStr).getTime()) / (1000 * 3600 * 24));
    const addD = (dStr: string, days: number) => { const d = new Date(dStr); d.setDate(d.getDate() + days); return d.toISOString().split("T")[0]; };

    inseminations.forEach(ins => {
      if (!ins.mating_date) return;
      const d = diff(ins.mating_date);
      if (d >= 16 && d <= 25) taskMap.set(`l1-${ins.sow_ear_tag}`, { id: `l1-${ins.sow_ear_tag}`, title: `[SINH SẢN] Kiểm tra lốc chu kỳ 1 (21 ngày) nái ${ins.sow_ear_tag}`, due_date: addD(ins.mating_date, 21), related_tag: ins.sow_ear_tag, category: "REPRO", is_completed: false, is_auto: true });
      if (d >= 104 && d <= 112) taskMap.set(`cd-${ins.sow_ear_tag}`, { id: `cd-${ins.sow_ear_tag}`, title: `[CHUẨN BỊ ĐẺ] Chuyển nái ${ins.sow_ear_tag} lên chuồng đẻ & sát trùng vú`, due_date: addD(ins.mating_date, 107), related_tag: ins.sow_ear_tag, category: "REPRO", is_completed: false, is_auto: true });
    });

    activeLitters.forEach(lit => {
      if (!lit.farrow_date) return;
      const age = diff(lit.farrow_date);
      if (age >= 24) taskMap.set(`w-${lit.sow_ear_tag}`, { id: `w-${lit.sow_ear_tag}`, title: `${age >= 28 ? "⚠️ QUÁ HẠN: " : "🔔 "}Cai sữa đàn con nái ${lit.sow_ear_tag} (${lit.alive_born} con)`, due_date: lit.weaning_date || addD(lit.farrow_date, 28), related_tag: lit.sow_ear_tag, category: "WEAN", is_completed: false, is_auto: true });
    });

    dbTasks.forEach(t => { if (!taskMap.has(t.title)) taskMap.set(t.title, t); });
    return Array.from(taskMap.values());
  }, [inseminations, activeLitters, dbTasks]);

  const filteredTasks = fullTasks.filter(t => taskCategoryFilter === "ALL" || t.category === taskCategoryFilter);

  const handleUpdatePig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPig || !user) return;
    setIsSavingEdit(true);
    await supabase.from("pigs").update({ ...editingPig }).eq("id", editingPig.id);
    await logAction("UPDATE_PIG", editingPig.ear_tag, `Sửa cá thể ${editingPig.ear_tag}`);
    setEditingPig(null);
    fetchData();
    setIsSavingEdit(false);
  };

  const handleWeanLitter = async (litter: FarrowingLitter) => {
    if (!user) return alert("Chỉ kỹ thuật viên mới có quyền cai sữa!");
    if (!confirm(`Xác nhận cai sữa cho đàn con nái ${litter.sow_ear_tag}?`)) return;
    await supabase.from("pigs").update({ stage: "Chờ phối" }).eq("ear_tag", litter.sow_ear_tag);
    await supabase.from("farrowings").update({ notes: "Đã cai sữa", weaning_date: new Date().toISOString().split("T")[0] }).eq("id", litter.id);
    await logAction("WEAN_LITTER", litter.sow_ear_tag, `Cai sữa ${litter.alive_born} con`);
    alert("Đã cai sữa thành công!");
    fetchData();
  };

  const toggleTask = async (task: FarmTask) => {
    if (!user) return alert("Vui lòng đăng nhập để thao tác!");
    if (task.is_auto && task.category === "WEAN") return alert("Hãy vào tab Lợn con để xác nhận cai sữa!");
    if (task.is_auto) await supabase.from("farm_tasks").insert([{ title: task.title, due_date: task.due_date, related_tag: task.related_tag, is_completed: true }]);
    else await supabase.from("farm_tasks").update({ is_completed: !task.is_completed }).eq("id", task.id);
    fetchData();
  };

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, sans-serif", color: "#2d1633", maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      <div style={{ paddingBottom: "50px" }}>
        <header style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setIsSidebarOpen(true)} style={{ background: "none", border: "none", fontSize: "22px" }}>☰</button>
            <h1 style={{ fontSize: "17px", fontWeight: "900", margin: 0, color: "#1e1b4b" }}>{currentMenu}</h1>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {user ? (
              <>
                <button onClick={() => setShowChangePwdModal(true)} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "11px", fontWeight: "700" }}>Đổi MK</button>
                <button onClick={() => { supabase.auth.signOut(); setUser(null); }} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontSize: "11px", fontWeight: "700", color: "#ef4444" }}>Thoát</button>
              </>
            ) : (
              <button onClick={() => setShowAuthModal(true)} style={{ padding: "5px 12px", borderRadius: "8px", border: "none", background: "#5b21b6", color: "#fff", fontSize: "11px", fontWeight: "700" }}>Đăng nhập</button>
            )}
          </div>
        </header>

        {isSidebarOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
            <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
            <div style={{ width: "260px", backgroundColor: "#fff", height: "100%", zIndex: 101, padding: "20px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, color: "#5b21b6" }}>APPTRAILON</h2>
              {["OVERVIEW", "SOW", "BOAR", "PIGLET", "MEAT", "SEARCH", "SETTINGS"].map(m => (
                <button key={m} onClick={() => { setCurrentMenu(m as any); setIsSidebarOpen(false); }} style={{ padding: "10px", textAlign: "left", borderRadius: "8px", border: "none", background: currentMenu === m ? "#ede9fe" : "none", color: currentMenu === m ? "#5b21b6" : "#334155", fontWeight: "700" }}>{m}</button>
              ))}
            </div>
          </div>
        )}

        {currentMenu === "OVERVIEW" && (
          <OverviewTab
            totalCount={sowList.length + boarList.length + meatList.length + activeLitters.reduce((s, l) => s + l.alive_born, 0)}
            sowCount={sowList.length}
            sowChua={sowList.filter(p => checkSowState(p) === "CHUA").length}
            sowNuoiCon={sowList.filter(p => checkSowState(p) === "NUOICON").length}
            sowChoPhoi={sowList.filter(p => checkSowState(p) === "CHOPHOI").length}
            boarCount={boarList.length}
            totalPigletsCount={activeLitters.reduce((s, l) => s + l.alive_born, 0)}
            activeLittersCount={activeLitters.length}
            meatCount={meatList.length}
            filteredTasks={filteredTasks}
            taskCategoryFilter={taskCategoryFilter}
            setTaskCategoryFilter={setTaskCategoryFilter}
            onNavigate={(m, s) => { setCurrentMenu(m); if (s) setSubFilter(s); }}
            onToggleTask={toggleTask}
            isLoggedIn={!!user}
          />
        )}

        {currentMenu === "SOW" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
              {["ALL", "CHUA", "NUOICON", "CHOPHOI"].map(tab => (
                <button key={tab} onClick={() => setSubFilter(tab)} style={{ padding: "6px 12px", borderRadius: "16px", border: "none", background: subFilter === tab ? "#db2777" : "#fff", color: subFilter === tab ? "#fff" : "#333", fontWeight: "700" }}>{tab}</button>
              ))}
            </div>
            {sowList.filter(p => subFilter === "ALL" || checkSowState(p) === subFilter).map(p => <PigCard key={p.id} pig={p} isLoggedIn={!!user} onEdit={setEditingPig} />)}
          </div>
        )}

        {currentMenu === "BOAR" && <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>{boarList.map(p => <PigCard key={p.id} pig={p} isLoggedIn={!!user} onEdit={setEditingPig} />)}</div>}

        {currentMenu === "PIGLET" && (
          <PigletTab activeLitters={activeLitters} totalPigletsCount={activeLitters.reduce((s, l) => s + l.alive_born, 0)} pigs={pigs} isLoggedIn={!!user} onWean={handleWeanLitter} />
        )}

        {currentMenu === "MEAT" && <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>{meatList.map(p => <PigCard key={p.id} pig={p} isLoggedIn={!!user} onEdit={setEditingPig} />)}</div>}

        {currentMenu === "SEARCH" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <input placeholder="Tìm số tai..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
            {pigs.filter(p => !isIndividualPiglet(p)).filter(p => p.ear_tag.toLowerCase().includes(searchQuery.toLowerCase())).map(p => <PigCard key={p.id} pig={p} isLoggedIn={!!user} onEdit={setEditingPig} />)}
          </div>
        )}

        {currentMenu === "SETTINGS" && (
          <SettingsTab
            isAdmin={isAdmin}
            isLoggedIn={!!user}
            currentUserId={user?.id}
            allProfiles={allProfiles}
            supabase={supabase}
            auditLogs={auditLogs}
            config={config}
            onRefreshProfiles={loadAllProfiles}
            onLog={logAction}
            onSaveConfig={(cfg) => { setConfig(cfg); localStorage.setItem("farm_config", JSON.stringify(cfg)); }}
            onOpenLogin={() => setShowAuthModal(true)}
          />
        )}
      </div>

      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "36px", backgroundColor: "rgba(253, 248, 251, 0.95)", borderTop: "1px solid #f1e5f0", display: "flex", alignItems: "center", paddingLeft: "16px", zIndex: 40, maxWidth: "480px", margin: "0 auto", pointerEvents: "none" }}>
        <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b" }}>AppWeb: Trại Lợn Nà Roác</span>
      </footer>

      {editingPig && user && (
        <EditPigModal pig={editingPig} config={config} boarList={boarList} sowList={sowList} isSaving={isSavingEdit} onClose={() => setEditingPig(null)} onSave={handleUpdatePig} onChange={setEditingPig} />
      )}

      <LoginModal show={showAuthModal} email={authEmail} setEmail={setAuthEmail} pass={authPassword} setPass={setAuthPassword} errorMsg={authError} onClose={() => setShowAuthModal(false)} onSubmit={async (e) => {
        e.preventDefault();
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) setAuthError(error.message);
        else { loadProfile(data.user?.email || ""); setShowAuthModal(false); }
      }} />

      <ChangePasswordModal show={showChangePwdModal} newPass={newPassword} setNewPass={setNewPassword} msg={changePwdMsg} onClose={() => setShowChangePwdModal(false)} onSubmit={async (e) => {
        e.preventDefault();
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) setChangePwdMsg(error.message);
        else { alert("Đổi mật khẩu thành công!"); setShowChangePwdModal(false); }
      }} />
    </div>
  );
}
