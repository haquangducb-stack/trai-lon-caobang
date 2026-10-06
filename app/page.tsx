"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient, User } from "@supabase/supabase-js";

interface Pig {
  id: string;
  ear_tag: string;
  breed_id: string;
  sex: string;
  stage: string;
  status: string;
  current_pen_code: string;
  sire_ear_tag?: string;
  dam_ear_tag?: string;
  birth_date?: string;
  notes?: string;
}

interface Insemination {
  id: string;
  sow_ear_tag: string;
  boar_ear_tag: string;
  mating_date: string;
  expected_farrow_date: string;
  status: string;
}

interface FarrowingLitter {
  id: string;
  litter_code: string;
  sow_ear_tag: string;
  farrow_date: string;
  alive_born: number;
  weaning_date: string;
  notes?: string;
  status?: string;
}

interface FarmTask {
  id: string;
  title: string;
  due_date: string;
  related_tag: string;
  category: "REPRO" | "VET" | "WEAN" | "GENERAL";
  is_completed: boolean;
  is_auto?: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "ADMIN" | "STAFF";
  is_active: boolean;
  created_at: string;
}

interface AuditLog {
  id: string;
  action_type: string;
  target_id: string;
  performed_by: string;
  details: string;
  created_at: string;
}

interface FarmConfig {
  breeds: string[];
  stages: string[];
  pens: string[];
}

export default function FarmApp() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);

  // Auth Modals
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changePwdMsg, setChangePwdMsg] = useState("");

  // Admin Add User
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [addMsg, setAddMsg] = useState("");

  // Data states
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [litters, setLitters] = useState<FarrowingLitter[]>([]);
  const [dbTasks, setDbTasks] = useState<FarmTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Navigation
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Lan lai Hương", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire"],
    stages: ["Hậu bị", "Chờ phối", "Đang chửa", "Nuôi con", "Cai sữa", "Vỗ béo thịt", "Đực giống"],
    pens: ["CA1", "CA2", "CA3", "CA4", "CA5", "CB1", "CB2", "CB3", "CB4", "CD1", "CD2"]
  });

  const [newBreedInput, setNewBreedInput] = useState("");
  const [newStageInput, setNewStageInput] = useState("");
  const [newPenInput, setNewPenInput] = useState("");

  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const supabase = useMemo(() => {
    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl, rawKey.trim());
  }, []);

  const loadProfile = async (uEmail: string) => {
    if (!uEmail) return;
    const cleanEmail = uEmail.trim().toLowerCase();
    try {
      const { data } = await supabase.from("user_profiles").select("*").ilike("email", cleanEmail).maybeSingle();
      if (data) {
        setProfile(data);
      } else if (cleanEmail === "haquangdu.cb@gmail.com") {
        setProfile({
          id: "admin-root",
          email: cleanEmail,
          full_name: "Hà Quang Dự",
          role: "ADMIN",
          is_active: true,
          created_at: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadAllProfiles = async () => {
    try {
      const { data } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: false });
      if (data && Array.isArray(data)) setAllProfiles(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    try {
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
        const penCodes = Array.from(new Set([...config.pens, ...penRes.data.map((p: any) => p.pen_code)]));
        setConfig(prev => ({ ...prev, pens: penCodes }));
      }
    } catch (e) {
      console.error(e);
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

  const isAdmin = useMemo(() => {
    return profile?.role === "ADMIN" || user?.email?.toLowerCase().trim() === "haquangdu.cb@gmail.com";
  }, [profile, user]);

  useEffect(() => {
    if (isAdmin) loadAllProfiles();
  }, [isAdmin]);

  const logAction = async (actionType: string, targetId: string, details: string) => {
    try {
      await supabase.from("audit_logs").insert([
        { action_type: actionType, target_id: targetId, performed_by: profile?.email || user?.email || "Khách", details }
      ]);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword.trim()
    });
    if (error) {
      setAuthError(error.message);
    } else if (data.user?.email) {
      await loadProfile(data.user.email);
      setShowAuthModal(false);
      setAuthPassword("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePwdMsg("");
    if (newPassword.length < 6) {
      setChangePwdMsg("Mật khẩu mới phải từ 6 ký tự trở lên!");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setChangePwdMsg("Lỗi: " + error.message);
    } else {
      await logAction("CHANGE_PASSWORD", user?.id || "", "Tự đổi mật khẩu tài khoản");
      alert("Đổi mật khẩu thành công!");
      setShowChangePwdModal(false);
      setNewPassword("");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddMsg("");
    if (newPwd.length < 6) {
      setAddMsg("Mật khẩu phải từ 6 ký tự trở lên!");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("admin_create_user", {
        new_email: newEmail.trim().toLowerCase(),
        new_password: newPwd.trim(),
        new_full_name: newFullName.trim() || newEmail.split("@")[0],
        new_role: newRole
      });
      if (error) {
        setAddMsg("Lỗi: " + error.message);
      } else if (data && typeof data === "object" && (data as any).success === false) {
        setAddMsg("Lỗi: " + (data as any).message);
      } else {
        await logAction("CREATE_USER", newEmail, `Admin tạo tài khoản quyền ${newRole}`);
        alert("Đã tạo tài khoản nhân viên thành công!");
        setShowAddUser(false);
        setNewEmail("");
        setNewPwd("");
        setNewFullName("");
        loadAllProfiles();
      }
    } catch (err: any) {
      setAddMsg("Lỗi: " + (err?.message || "Không thể tạo"));
    }
  };

  const handleToggleRole = async (target: UserProfile) => {
    if (!target?.id) return;
    const nextRole = target.role === "ADMIN" ? "STAFF" : "ADMIN";
    if (!confirm(`Xác nhận đổi vai trò của ${target.email} thành ${nextRole}?`)) return;
    await supabase.from("user_profiles").update({ role: nextRole }).eq("id", target.id);
    await logAction("UPDATE_ROLE", target.email, `Đổi vai trò thành ${nextRole}`);
    loadAllProfiles();
  };

  const handleToggleBan = async (target: UserProfile) => {
    if (!target?.id) return;
    if (target.id === user?.id) {
      alert("Không thể tự khóa tài khoản của chính mình!");
      return;
    }
    const nextStatus = !target.is_active;
    const actionName = nextStatus ? "Mở khóa" : "Khóa (Ban)";
    if (!confirm(`Xác nhận ${actionName} tài khoản ${target.email}?`)) return;
    await supabase.from("user_profiles").update({ is_active: nextStatus }).eq("id", target.id);
    await logAction("BAN_USER", target.email, `${actionName} tài khoản`);
    loadAllProfiles();
  };

  const saveConfig = (newCfg: FarmConfig) => {
    setConfig(newCfg);
    if (typeof window !== "undefined") {
      localStorage.setItem("farm_config", JSON.stringify(newCfg));
    }
  };

  const normalize = (text?: string) => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
  };

  const isIndividualPiglet = (pig: Pig) => {
    const tag = (pig?.ear_tag || "").toUpperCase();
    return tag.includes("-C") || tag.includes("CON");
  };

  const isMeat = (pig: Pig) => {
    if (isIndividualPiglet(pig)) return false;
    return normalize(pig?.stage).includes("thit");
  };

  const isSow = (pig: Pig) => {
    if (isIndividualPiglet(pig) || isMeat(pig)) return false;
    const sx = normalize(pig?.sex);
    return sx.includes("cai") || sx === "c";
  };

  const isBoar = (pig: Pig) => {
    if (isIndividualPiglet(pig) || isMeat(pig) || isSow(pig)) return false;
    return true;
  };

  const checkSowState = (pig: Pig) => {
    const st = normalize(pig?.stage);
    return st.includes("chua") || st.includes("phoi") ? "CHUA" : st.includes("nuoi con") ? "NUOICON" : "CHOPHOI";
  };

  const sowList = (pigs || []).filter(isSow);
  const boarList = (pigs || []).filter(isBoar);
  const meatList = (pigs || []).filter(isMeat);
  const activeLitters = (litters || []).filter(l => !(l?.notes || "").toLowerCase().includes("da cai"));

  // Bọc an toàn ngày tháng tránh sập React
  const safeDateDiff = (dStr?: string) => {
    if (!dStr) return -999;
    const t = new Date(dStr).getTime();
    if (isNaN(t)) return -999;
    return Math.floor((new Date().getTime() - t) / (1000 * 3600 * 24));
  };

  const safeAddDays = (dStr: string, days: number) => {
    if (!dStr) return "";
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  const fullTasks = useMemo(() => {
    const taskMap = new Map<string, FarmTask>();

    (inseminations || []).forEach(ins => {
      if (!ins?.mating_date || !ins?.sow_ear_tag) return;
      const d = safeDateDiff(ins.mating_date);
      if (d === -999) return;

      if (d >= 16 && d <= 25) {
        taskMap.set(`l1-${ins.sow_ear_tag}`, {
          id: `l1-${ins.sow_ear_tag}`,
          title: `[SINH SẢN] Kiểm tra lốc chu kỳ 1 (21 ngày) nái ${ins.sow_ear_tag}`,
          due_date: safeAddDays(ins.mating_date, 21),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }
      if (d >= 104 && d <= 112) {
        taskMap.set(`cd-${ins.sow_ear_tag}`, {
          id: `cd-${ins.sow_ear_tag}`,
          title: `[CHUẨN BỊ ĐẺ] Chuyển nái ${ins.sow_ear_tag} lên chuồng đẻ & sát trùng vú`,
          due_date: safeAddDays(ins.mating_date, 107),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }
    });

    activeLitters.forEach(lit => {
      if (!lit?.farrow_date || !lit?.sow_ear_tag) return;
      const age = safeDateDiff(lit.farrow_date);
      if (age === -999) return;

      if (age >= 24) {
        taskMap.set(`w-${lit.sow_ear_tag}`, {
          id: `w-${lit.sow_ear_tag}`,
          title: `${age >= 28 ? "⚠️ QUÁ HẠN: " : "🔔 "}Cai sữa đàn con nái ${lit.sow_ear_tag} (${lit.alive_born || 0} con)`,
          due_date: lit.weaning_date || safeAddDays(lit.farrow_date, 28),
          related_tag: lit.sow_ear_tag,
          category: "WEAN",
          is_completed: false,
          is_auto: true
        });
      }
    });

    (dbTasks || []).forEach(t => {
      if (t?.title && !taskMap.has(t.title)) taskMap.set(t.title, t);
    });

    return Array.from(taskMap.values());
  }, [inseminations, activeLitters, dbTasks]);

  const filteredTasks = fullTasks.filter(t => taskCategoryFilter === "ALL" || t?.category === taskCategoryFilter);

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
    if (task.is_auto) {
      await supabase.from("farm_tasks").insert([{ title: task.title, due_date: task.due_date, related_tag: task.related_tag, is_completed: true }]);
    } else {
      await supabase.from("farm_tasks").update({ is_completed: !task.is_completed }).eq("id", task.id);
    }
    fetchData();
  };

  const totalPiglets = activeLitters.reduce((s, l) => s + (l?.alive_born || 0), 0);
  const grandTotal = sowList.length + boarList.length + meatList.length + totalPiglets;

  const renderPigCard = (pig: Pig) => (
    <div
      key={pig.id}
      onClick={() => {
        if (!user) return alert("Chế độ khách chỉ có quyền xem!");
        setEditingPig({ ...pig });
      }}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        padding: "14px 16px",
        border: "1px solid #f1e5f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        cursor: user ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "18px", fontWeight: "900", color: "#1e1b4b" }}>{pig.ear_tag}</span>
        {user ? (
          <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px", background: "#f3e8ff", color: "#6b21a8" }}>
            Sửa ✎
          </span>
        ) : (
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Chỉ xem</span>
        )}
      </div>

      <div style={{ fontSize: "13px", color: "#475569" }}>
        Giống: <strong style={{ color: "#0f172a" }}>{pig.breed_id || "—"}</strong>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#f1f5f9", fontWeight: "600", color: "#334155" }}>
          Ô: {pig.current_pen_code || "Chưa xếp"}
        </span>
        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#ecfdf5", color: "#047857", fontWeight: "700" }}>
          {pig.stage || "Bình thường"}
        </span>
      </div>

      <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px", fontSize: "11px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
        <span>Bố: <strong>{pig.sire_ear_tag || "—"}</strong></span>
        <span>Mẹ: <strong>{pig.dam_ear_tag || "—"}</strong></span>
      </div>
    </div>
  );

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdf8fb", fontFamily: "sans-serif" }}>
        Đang tải Trại Lợn Nà Roác...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#2d1633", maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      <div style={{ paddingBottom: "50px" }}>
        
        {/* HEADER */}
        <header style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setIsSidebarOpen(true)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer" }}>☰</button>
            <h1 style={{ fontSize: "17px", fontWeight: "900", margin: 0, color: "#1e1b4b" }}>
              {currentMenu === "OVERVIEW" && "TỔNG QUAN"}
              {currentMenu === "SOW" && "QUẢN LÝ NÁI"}
              {currentMenu === "BOAR" && "QUẢN LÝ ĐỰC"}
              {currentMenu === "PIGLET" && "LỢN CON THEO LÔ"}
              {currentMenu === "MEAT" && "LỢN THỊT"}
              {currentMenu === "SEARCH" && "TRA CỨU"}
              {currentMenu === "SETTINGS" && "CÀI ĐẶT & NHÂN SỰ"}
            </h1>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {user ? (
              <>
                <button onClick={() => setShowChangePwdModal(true)} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Đổi MK</button>
                <button onClick={handleLogout} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontSize: "11px", fontWeight: "700", color: "#ef4444", cursor: "pointer" }}>Thoát</button>
              </>
            ) : (
              <button onClick={() => setShowAuthModal(true)} style={{ padding: "5px 12px", borderRadius: "8px", border: "none", background: "#5b21b6", color: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Đăng nhập</button>
            )}
          </div>
        </header>

        {/* DRAWER MENU */}
        {isSidebarOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
            <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
            <div style={{ width: "260px", backgroundColor: "#fff", height: "100%", zIndex: 101, padding: "20px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, color: "#5b21b6" }}>APPTRAILON</h2>
              <div style={{ fontSize: "11px", color: user ? "#059669" : "#64748b", fontWeight: "700", marginBottom: "8px" }}>
                {user ? `${user.email} (${isAdmin ? "Admin" : "Kỹ thuật"})` : "👀 Chế độ Khách"}
              </div>
              {[
                { k: "OVERVIEW", l: "Tổng quan", icon: "📊" },
                { k: "SOW", l: "Quản lý nái", icon: "🐖" },
                { k: "BOAR", l: "Quản lý đực", icon: "🐗" },
                { k: "PIGLET", l: "Lợn con theo lô", icon: "🍼" },
                { k: "MEAT", l: "Lợn thịt", icon: "🥩" },
                { k: "SEARCH", l: "Tra cứu cá thể", icon: "🔍" },
                { k: "SETTINGS", l: "Cài đặt & Nhân sự", icon: "⚙️" },
              ].map(item => (
                <button
                  key={item.k}
                  onClick={() => { setCurrentMenu(item.k as any); setIsSidebarOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", borderRadius: "10px", border: "none",
                    background: currentMenu === item.k ? "#ede9fe" : "none",
                    color: currentMenu === item.k ? "#5b21b6" : "#334155",
                    fontWeight: currentMenu === item.k ? "800" : "600",
                    fontSize: "14px", cursor: "pointer", textAlign: "left"
                  }}
                >
                  <span>{item.icon}</span>
                  <span>{item.l}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 1. TỔNG QUAN */}
        {currentMenu === "OVERVIEW" && (
          <div style={{ padding: "16px" }}>
            <div style={{ backgroundColor: "#eae7ec", borderRadius: "14px", padding: "16px 18px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px", fontWeight: "900", color: "#1e1b4b" }}>TỔNG ĐÀN: {grandTotal} con</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
              <div onClick={() => { setCurrentMenu("SOW"); setSubFilter("ALL"); }} style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowList.length} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Chửa: <strong>{sowList.filter(p => checkSowState(p) === "CHUA").length}</strong></div>
                  <div>• Nuôi con: <strong>{sowList.filter(p => checkSowState(p) === "NUOICON").length}</strong></div>
                  <div>• Chờ phối: <strong>{sowList.filter(p => checkSowState(p) === "CHOPHOI").length}</strong></div>
                </div>
              </div>

              <div onClick={() => { setCurrentMenu("BOAR"); }} style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarList.length} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Đang khai thác tinh</div>
                </div>
              </div>

              <div onClick={() => { setCurrentMenu("PIGLET"); }} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{totalPiglets} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Theo {activeLitters.length} lô mẹ</div>
                  <div>• Đang bú sữa</div>
                </div>
              </div>

              <div onClick={() => { setCurrentMenu("MEAT"); }} style={{ backgroundColor: "#f6f1f2", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatList.length} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Đang vỗ béo</div>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 8px 0" }}>
                LỊCH KỸ THUẬT & VIỆC CẦN LÀM ({filteredTasks.filter(t => !t.is_completed).length})
              </h3>
              <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto" }}>
                {[{ id: "ALL", label: "Tất cả" }, { id: "REPRO", label: "Sinh sản" }, { id: "VET", label: "Thú y" }, { id: "WEAN", label: "Cai sữa" }].map((tab) => (
                  <button key={tab.id} onClick={() => setTaskCategoryFilter(tab.id)} style={{ padding: "6px 10px", borderRadius: "16px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer", backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#e2e8f0", color: taskCategoryFilter === tab.id ? "#fff" : "#475569" }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredTasks.map((task) => (
                  <div key={task.id} onClick={() => toggleTask(task)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: user ? "pointer" : "not-allowed", background: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "#fef2f2" : "#fff", padding: "10px 14px", borderRadius: "10px", border: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "1px solid #fecaca" : "1px solid #f1e5f0" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "700", color: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "#b91c1c" : "#1e1b4b", textDecoration: task.is_completed ? "line-through" : "none" }}>{task.title}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Hạn: <strong>{task.due_date}</strong> {task.related_tag && `(Tai: ${task.related_tag})`}</div>
                    </div>
                    <div style={{ fontSize: "20px" }}>{task.is_completed ? "🟢" : "⚪"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. QUẢN LÝ NÁI */}
        {currentMenu === "SOW" && (
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px", overflowX: "auto" }}>
              {[{ id: "ALL", label: `Tất cả (${sowList.length})` }, { id: "CHUA", label: `Chửa` }, { id: "NUOICON", label: `Nuôi con` }, { id: "CHOPHOI", label: `Chờ phối` }].map((tab) => (
                <button key={tab.id} onClick={() => setSubFilter(tab.id)} style={{ padding: "8px 12px", borderRadius: "20px", border: "none", fontSize: "12px", fontWeight: "700", cursor: "pointer", backgroundColor: subFilter === tab.id ? "#db2777" : "#fff", color: subFilter === tab.id ? "#fff" : "#475569" }}>{tab.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sowList.filter((p) => (subFilter === "ALL" ? true : checkSowState(p) === subFilter)).map(renderPigCard)}
            </div>
          </div>
        )}

        {/* 3. QUẢN LÝ ĐỰC */}
        {currentMenu === "BOAR" && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#2563eb", marginBottom: "12px" }}>ĐÀN ĐỰC GIỐNG ({boarList.length} CON)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{boarList.map(renderPigCard)}</div>
          </div>
        )}

        {/* 4. LỢN CON THEO LÔ */}
        {currentMenu === "PIGLET" && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#16a34a", marginBottom: "12px" }}>ĐANG NUÔI: {activeLitters.length} LÔ ({totalPiglets} CON)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeLitters.map((lit) => {
                const sow = pigs.find((p) => p.ear_tag === lit.sow_ear_tag);
                const ageDays = safeDateDiff(lit.farrow_date);
                const isReadyWean = ageDays >= 24;
                return (
                  <div key={lit.id} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "16px", border: isReadyWean ? "1px solid #fed7aa" : "1px solid #f1e5f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "17px", fontWeight: "900" }}>Lô nái {lit.sow_ear_tag} ({lit.litter_code})</span>
                      <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#047857" }}>{lit.alive_born} con</span>
                    </div>
                    <div style={{ margin: "8px 0", fontSize: "12px", color: isReadyWean ? "#ea580c" : "#64748b", fontWeight: "700" }}>
                      Chuồng: {sow?.current_pen_code || "—"} | {ageDays !== -999 ? ageDays : 0} ngày tuổi {isReadyWean && "🔔 (Đến hạn cai sữa)"}
                    </div>
                    {user && (
                      <button onClick={() => handleWeanLitter(lit)} style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "none", backgroundColor: isReadyWean ? "#ea580c" : "#0f172a", color: "#fff", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                        ✓ Xác nhận Cai sữa đàn này
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. LỢN THỊT */}
        {currentMenu === "MEAT" && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#854d0e", marginBottom: "12px" }}>ĐÀN LỢN THỊT ({meatList.length} CON)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{meatList.map(renderPigCard)}</div>
          </div>
        )}

        {/* 6. TRA CỨU */}
        {currentMenu === "SEARCH" && (
          <div style={{ padding: "16px" }}>
            <input placeholder="Gõ số tai, chuồng, giống..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", boxSizing: "border-box", marginBottom: "14px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pigs.filter(p => !isIndividualPiglet(p)).filter(p => (p.ear_tag || "").toLowerCase().includes(searchQuery.toLowerCase()) || (p.breed_id || "").toLowerCase().includes(searchQuery.toLowerCase())).map(renderPigCard)}
            </div>
          </div>
        )}

        {/* 7. CÀI ĐẶT & QUẢN LÝ NHÂN SỰ */}
        {currentMenu === "SETTINGS" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* KHU VỰC QUẢN TRỊ ADMIN */}
            {isAdmin ? (
              <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #fed7aa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "900", color: "#c2410c" }}>
                    👑 Quản Lý Nhân Sự & Tài Khoản
                  </h4>
                  <button
                    onClick={() => setShowAddUser(!showAddUser)}
                    style={{ padding: "5px 10px", borderRadius: "8px", background: "#ea580c", color: "#fff", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                  >
                    {showAddUser ? "Đóng Form" : "+ Thêm Nhân Viên"}
                  </button>
                </div>

                {showAddUser && (
                  <form onSubmit={handleCreateUser} style={{ background: "#fff7ed", padding: "12px", borderRadius: "10px", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "800", color: "#9a3412" }}>CẤP TÀI KHOẢN MỚI TRỰC TIẾP</div>
                    {addMsg && <div style={{ fontSize: "11px", color: "#ef4444" }}>{addMsg}</div>}
                    <input type="email" required placeholder="Email nhân viên..." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }} />
                    <input type="text" placeholder="Họ và tên..." value={newFullName} onChange={(e) => setNewFullName(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }} />
                    <input type="password" required placeholder="Mật khẩu (>= 6 ký tự)..." value={newPwd} onChange={(e) => setNewPwd(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }} />
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} style={{ padding: "6px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }}>
                        <option value="STAFF">Kỹ thuật viên</option>
                        <option value="ADMIN">Quản trị viên</option>
                      </select>
                      <button type="submit" style={{ marginLeft: "auto", padding: "7px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}>
                        Tạo Ngay
                      </button>
                    </div>
                  </form>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(allProfiles || []).map((p) => (
                    <div key={p.id} style={{ padding: "10px", borderRadius: "8px", background: p.is_active ? "#f8fafc" : "#fef2f2", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>
                          {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                          {!p.is_active && <span style={{ marginLeft: "6px", color: "#ef4444", fontSize: "11px" }}>[BỊ KHÓA]</span>}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          Quyền: <strong style={{ color: p.role === "ADMIN" ? "#b45309" : "#0369a1" }}>{p.role}</strong>
                        </div>
                      </div>

                      {p.id !== user?.id && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => handleToggleRole(p)} style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                            {p.role === "ADMIN" ? "Hạ Staff" : "Lên Admin"}
                          </button>
                          <button onClick={() => handleToggleBan(p)} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", background: p.is_active ? "#ef4444" : "#10b981", color: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                            {p.is_active ? "Khóa" : "Mở"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: "#fff", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1e5f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e1b4b" }}>Quản lý Nhân sự & Phân quyền</div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    {user ? "Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập." : "Vui lòng đăng nhập tài khoản Admin."}
                  </div>
                </div>
                {!user && (
                  <button onClick={() => setShowAuthModal(true)} style={{ padding: "6px 12px", borderRadius: "8px", background: "#5b21b6", color: "#fff", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                    Đăng nhập
                  </button>
                )}
              </div>
            )}

            {/* DANH MỤC GIỐNG */}
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Giống lợn</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {(config?.breeds || []).map((b) => (
                  <span key={b} style={{ padding: "4px 10px", borderRadius: "20px", background: "#f1f5f9", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {b}
                    {user && <span onClick={() => saveConfig({ ...config, breeds: config.breeds.filter(item => item !== b) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>}
                  </span>
                ))}
              </div>
              {user && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input placeholder="Thêm giống mới..." value={newBreedInput} onChange={(e) => setNewBreedInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                  <button onClick={() => { if (newBreedInput.trim() && !config.breeds.includes(newBreedInput.trim())) { saveConfig({ ...config, breeds: [...config.breeds, newBreedInput.trim()] }); setNewBreedInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
                </div>
              )}
            </div>

            {/* DANH MỤC GIAI ĐOẠN */}
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Giai đoạn / Trạng thái</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {(config?.stages || []).map((st) => (
                  <span key={st} style={{ padding: "4px 10px", borderRadius: "20px", background: "#ecfdf5", color: "#047857", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {st}
                    {user && <span onClick={() => saveConfig({ ...config, stages: config.stages.filter(item => item !== st) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>}
                  </span>
                ))}
              </div>
              {user && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input placeholder="Thêm trạng thái..." value={newStageInput} onChange={(e) => setNewStageInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                  <button onClick={() => { if (newStageInput.trim() && !config.stages.includes(newStageInput.trim())) { saveConfig({ ...config, stages: [...config.stages, newStageInput.trim()] }); setNewStageInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
                </div>
              )}
            </div>

            {/* DANH MỤC Ô CHUỒNG */}
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Ô Chuồng</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {(config?.pens || []).map((pen) => (
                  <span key={pen} style={{ padding: "4px 10px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {pen}
                    {user && <span onClick={() => saveConfig({ ...config, pens: config.pens.filter(item => item !== pen) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>}
                  </span>
                ))}
              </div>
              {user && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input placeholder="Mã ô chuồng..." value={newPenInput} onChange={(e) => setNewPenInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                  <button onClick={() => { if (newPenInput.trim() && !config.pens.includes(newPenInput.trim())) { saveConfig({ ...config, pens: [...config.pens, newPenInput.trim().toUpperCase()] }); setNewPenInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
                </div>
              )}
            </div>

            {/* NHẬT KÝ THAO TÁC */}
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800", color: "#1e1b4b" }}>📜 Nhật Ký Gần Đây</h4>
              {(auditLogs || []).length === 0 ? (
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Chưa có lịch sử thao tác nào.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                  {(auditLogs || []).map((log) => {
                    let formattedTime = "";
                    if (log.created_at) {
                      const t = new Date(log.created_at);
                      if (!isNaN(t.getTime())) {
                        formattedTime = t.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
                      }
                    }
                    return (
                      <div key={log.id} style={{ fontSize: "11px", padding: "8px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                          <span>{log.performed_by}</span>
                          <span>{formattedTime}</span>
                        </div>
                        <div style={{ color: "#334155", marginTop: "2px" }}>{log.details}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* FOOTER CỐ ĐỊNH Ở ĐÁY - LỆCH TRÁI */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "36px", backgroundColor: "rgba(253, 248, 251, 0.95)", borderTop: "1px solid #f1e5f0", display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: "16px", zIndex: 40, maxWidth: "480px", margin: "0 auto", pointerEvents: "none" }}>
        <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b" }}>AppWeb: Trại Lợn Nà Roác</span>
      </footer>

      {/* MODAL SỬA CÁ THỂ */}
      {editingPig && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800" }}>Sửa cá thể: {editingPig.ear_tag}</h3>
            <form onSubmit={handleUpdatePig} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai:</label>
                <input required value={editingPig.ear_tag} onChange={(e) => setEditingPig({ ...editingPig, ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Giống:</label>
                  <select value={editingPig.breed_id || config.breeds[0]} onChange={(e) => setEditingPig({ ...editingPig, breed_id: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.breeds.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Giới tính:</label>
                  <select value={editingPig.sex || "Cái"} onChange={(e) => setEditingPig({ ...editingPig, sex: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Cái">Cái</option>
                    <option value="Đực">Đực</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Trạng thái:</label>
                  <select value={editingPig.stage || config.stages[0]} onChange={(e) => setEditingPig({ ...editingPig, stage: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.stages.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Chuồng:</label>
                  <select value={editingPig.current_pen_code || config.pens[0]} onChange={(e) => setEditingPig({ ...editingPig, current_pen_code: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.pens.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Ghi chú:</label>
                <input value={editingPig.notes || ""} onChange={(e) => setEditingPig({ ...editingPig, notes: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setEditingPig(null)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" disabled={isSavingEdit} style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700" }}>
                  {isSavingEdit ? "Lưu..." : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP */}
      {showAuthModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800" }}>Đăng nhập</h3>
            {authError && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "8px" }}>{authError}</div>}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="email" required placeholder="Email..." value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <input type="password" required placeholder="Mật khẩu..." value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAuthModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#5b21b6", color: "#fff", border: "none", fontWeight: "700" }}>Vào</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI MẬT KHẨU */}
      {showChangePwdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800" }}>Đổi Mật Khẩu</h3>
            {changePwdMsg && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "8px" }}>{changePwdMsg}</div>}
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input type="password" required placeholder="Mật khẩu mới (>= 6 ký tự)..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowChangePwdModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700" }}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
