"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  is_dismissed?: boolean;
  is_auto?: boolean;
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

  // Modal Auth & Đổi MK
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAccount, setAuthAccount] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [showChangePwdModal, setShowChangePwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changePwdMsg, setChangePwdMsg] = useState("");

  // Dữ liệu
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [litters, setLitters] = useState<FarrowingLitter[]>([]);
  const [dbTasks, setDbTasks] = useState<FarmTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Điều hướng
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Cấu hình danh mục (Ưu tiên đọc từ LocalStorage nếu có để không bị hồi phục lại cái cũ)
  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Lan lai Hương", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire"],
    stages: ["Hậu bị", "Chờ phối", "Đang chửa", "Nuôi con", "Cai sữa", "Vỗ béo thịt", "Đực giống"],
    pens: ["CA1", "CA2", "CA3", "CA4", "CA5", "CB1", "CB2", "CB3", "CB4", "CD1", "CD2"]
  });

  const [newBreedInput, setNewBreedInput] = useState("");
  const [newStageInput, setNewStageInput] = useState("");
  const [newPenInput, setNewPenInput] = useState("");

  // Modal Thêm lợn mới
  const [showAddPigModal, setShowAddPigModal] = useState(false);
  const [newPig, setNewPig] = useState<Partial<Pig>>({
    ear_tag: "",
    breed_id: "",
    sex: "Cái",
    stage: "Hậu bị",
    current_pen_code: "CA1",
    status: "Bình thường",
    sire_ear_tag: "",
    dam_ear_tag: "",
    notes: ""
  });
  const [isAddingPig, setIsAddingPig] = useState(false);

  // Modal Sửa lợn
  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal Xử lý Công việc (Hoàn thành / Quá hạn / Gia hạn)
  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Khởi tạo và nạp danh mục đã lưu
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("farm_config_persistent");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.breeds && parsed.stages && parsed.pens) {
            setConfig(parsed);
          }
        }
      } catch (e) {
        console.error("Lỗi nạp config:", e);
      }
    }
  }, []);

  const supabase = useMemo(() => {
    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl, rawKey.trim());
  }, []);

  const logAction = useCallback(async (actionType: string, targetId: string, details: string) => {
    try {
      const displayName = user?.email?.replace("@trailon.local", "") || "Khách";
      await supabase.from("audit_logs").insert([
        { action_type: actionType, target_id: targetId, performed_by: displayName, details }
      ]);
    } catch (e) {
      console.error(e);
    }
  }, [supabase, user]);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, tRes, farRes, insemRes, logRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("farrowings").select("*").order("farrow_date", { ascending: false }),
        supabase.from("inseminations").select("*").order("mating_date", { ascending: false }),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20)
      ]);
      if (pRes?.data) setPigs(pRes.data);
      if (tRes?.data) setDbTasks(tRes.data);
      if (farRes?.data) setLitters(farRes.data);
      if (insemRes?.data) setInseminations(insemRes.data);
      if (logRes?.data) setAuditLogs(logRes.data);
    } catch (e) {
      console.error(e);
    }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchData();
    return () => subscription.unsubscribe();
  }, [supabase, fetchData]);

  // Đăng nhập Username
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    let loginAccount = authAccount.trim().toLowerCase();
    if (!loginAccount.includes("@")) {
      loginAccount = `${loginAccount}@trailon.local`;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginAccount,
      password: authPassword.trim()
    });

    if (error) {
      setAuthError("Tên đăng nhập hoặc mật khẩu không chính xác!");
    } else {
      setShowAuthModal(false);
      setAuthPassword("");
      fetchData();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
      fetchData();
    }
  };

  // Lưu danh mục cố định không bị reset
  const saveConfig = (newCfg: FarmConfig) => {
    setConfig(newCfg);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("farm_config_persistent", JSON.stringify(newCfg));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Xử lý Thêm Lợn Mới
  const handleCreatePig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Vui lòng đăng nhập để thêm lợn!");
    if (!newPig.ear_tag?.trim()) return alert("Vui lòng nhập số tai!");

    setIsAddingPig(true);
    try {
      const pigPayload = {
        ear_tag: newPig.ear_tag.trim().toUpperCase(),
        breed_id: newPig.breed_id || config.breeds[0] || "Hạ Lang",
        sex: newPig.sex || "Cái",
        stage: newPig.stage || config.stages[0] || "Hậu bị",
        current_pen_code: newPig.current_pen_code || config.pens[0] || "CA1",
        status: newPig.status || "Bình thường",
        sire_ear_tag: newPig.sire_ear_tag?.trim() || null,
        dam_ear_tag: newPig.dam_ear_tag?.trim() || null,
        notes: newPig.notes?.trim() || null
      };

      const { error } = await supabase.from("pigs").insert([pigPayload]);
      if (error) {
        alert("Lỗi thêm lợn: " + error.message);
      } else {
        await logAction("CREATE_PIG", pigPayload.ear_tag, `Thêm mới cá thể ${pigPayload.ear_tag} (${pigPayload.breed_id})`);
        alert(`Đã thêm thành công cá thể ${pigPayload.ear_tag}!`);
        setShowAddPigModal(false);
        setNewPig({
          ear_tag: "",
          breed_id: config.breeds[0] || "Hạ Lang",
          sex: "Cái",
          stage: config.stages[0] || "Hậu bị",
          current_pen_code: config.pens[0] || "CA1",
          status: "Bình thường",
          sire_ear_tag: "",
          dam_ear_tag: "",
          notes: ""
        });
        fetchData();
      }
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setIsAddingPig(false);
    }
  };

  const normalize = (text?: string) => {
    if (!text) return "";
    return String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
  };

  const isIndividualPiglet = (pig?: Pig) => {
    if (!pig) return false;
    const tag = String(pig.ear_tag || "").toUpperCase();
    return tag.includes("-C") || tag.includes("CON");
  };

  const isMeat = (pig?: Pig) => {
    if (!pig || isIndividualPiglet(pig)) return false;
    const st = normalize(pig.stage);
    return st.includes("thit") || st.includes("vo beo");
  };

  const isSow = (pig?: Pig) => {
    if (!pig || isIndividualPiglet(pig) || isMeat(pig)) return false;
    const sx = normalize(pig.sex);
    const st = normalize(pig.stage);
    const isFemaleSex = sx.includes("cai") || sx === "c" || sx === "f" || sx.includes("female") || sx.includes("nai");
    const isSowStage = st.includes("chua") || st.includes("phoi") || st.includes("de") || st.includes("nuoi con") || st.includes("hau bi");
    return isFemaleSex || isSowStage;
  };

  const isBoar = (pig?: Pig) => {
    if (!pig || isIndividualPiglet(pig) || isMeat(pig) || isSow(pig)) return false;
    return true;
  };

  const checkSowState = (pig?: Pig) => {
    if (!pig) return "CHOPHOI";
    const st = normalize(pig.stage);
    return st.includes("chua") || st.includes("phoi") ? "CHUA" : st.includes("nuoi con") ? "NUOICON" : "CHOPHOI";
  };

  const safePigs = Array.isArray(pigs) ? pigs : [];
  const sowList = safePigs.filter(isSow);
  const boarList = safePigs.filter(isBoar);
  const meatList = safePigs.filter(isMeat);
  const activeLitters = (Array.isArray(litters) ? litters : []).filter(l => !String(l?.notes || "").toLowerCase().includes("da cai"));

  const safeDateDiff = (dStr?: string) => {
    if (!dStr) return -999;
    const t = new Date(dStr).getTime();
    if (isNaN(t)) return -999;
    return Math.floor((new Date().getTime() - t) / (1000 * 3600 * 24));
  };

  const safeAddDays = (dStr?: string, days: number = 0) => {
    if (!dStr) return "";
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  // Tổng hợp nhiệm vụ tự động và cơ sở dữ liệu
  const fullTasks = useMemo(() => {
    const taskMap = new Map<string, FarmTask>();

    (Array.isArray(inseminations) ? inseminations : []).forEach(ins => {
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
          title: `${age >= 28 ? "⚠️ QUÁ HẠN: " : "🔔 "}Cai sữa đàn con nái ${lit.sow_ear_tag} (${Number(lit.alive_born || 0)} con)`,
          due_date: lit.weaning_date || safeAddDays(lit.farrow_date, 28),
          related_tag: lit.sow_ear_tag,
          category: "WEAN",
          is_completed: false,
          is_auto: true
        });
      }
    });

    (Array.isArray(dbTasks) ? dbTasks : []).forEach(t => {
      if (t?.title) {
        taskMap.set(t.title, t);
      }
    });

    return Array.from(taskMap.values()).filter(t => !t.is_dismissed);
  }, [inseminations, activeLitters, dbTasks]);

  const filteredTasks = fullTasks.filter(t => taskCategoryFilter === "ALL" || t?.category === taskCategoryFilter);

  // Phân chia danh sách việc chưa làm & việc đã làm
  const pendingTasks = filteredTasks.filter(t => !t.is_completed);
  const completedTasks = filteredTasks.filter(t => t.is_completed);

  // Mở modal xác nhận việc cần làm
  const handleTaskClick = (task: FarmTask) => {
    if (!user) return alert("Vui lòng đăng nhập để xử lý công việc!");
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  // Xác nhận ĐÃ LÀM XONG
  const confirmCompleteTask = async () => {
    if (!selectedTask) return;
    if (selectedTask.is_auto) {
      await supabase.from("farm_tasks").insert([{
        title: selectedTask.title,
        due_date: selectedTask.due_date,
        related_tag: selectedTask.related_tag,
        is_completed: true,
        is_dismissed: false
      }]);
    } else {
      await supabase.from("farm_tasks").update({ is_completed: true }).eq("id", selectedTask.id);
    }
    await logAction("COMPLETE_TASK", selectedTask.related_tag || "TASK", `Hoàn thành việc: ${selectedTask.title}`);
    setShowTaskModal(false);
    setSelectedTask(null);
    fetchData();
  };

  // BỎ QUA VIỆC QUÁ HẠN (Biến mất vĩnh viễn)
  const confirmDismissTask = async () => {
    if (!selectedTask) return;
    if (selectedTask.is_auto) {
      await supabase.from("farm_tasks").insert([{
        title: selectedTask.title,
        due_date: selectedTask.due_date,
        related_tag: selectedTask.related_tag,
        is_completed: false,
        is_dismissed: true
      }]);
    } else {
      await supabase.from("farm_tasks").update({ is_dismissed: true }).eq("id", selectedTask.id);
    }
    await logAction("DISMISS_TASK", selectedTask.related_tag || "TASK", `Bỏ qua việc: ${selectedTask.title}`);
    setShowTaskModal(false);
    setSelectedTask(null);
    fetchData();
  };

  // GIA HẠN THÊM NGÀY (Làm tiếp, treo thêm 3 ngày)
  const confirmPostponeTask = async () => {
    if (!selectedTask) return;
    const newDueDate = safeAddDays(new Date().toISOString().split("T")[0], 3);
    const newTitle = selectedTask.title.replace("⚠️ QUÁ HẠN: ", "").replace("🔔 ", "") + " (Gia hạn)";
    if (selectedTask.is_auto) {
      // Ẩn việc auto cũ đi và tạo việc mới với hạn mới
      await supabase.from("farm_tasks").insert([
        { title: selectedTask.title, due_date: selectedTask.due_date, related_tag: selectedTask.related_tag, is_dismissed: true, is_completed: false },
        { title: newTitle, due_date: newDueDate, related_tag: selectedTask.related_tag, is_completed: false, is_dismissed: false }
      ]);
    } else {
      await supabase.from("farm_tasks").update({ title: newTitle, due_date: newDueDate }).eq("id", selectedTask.id);
    }
    await logAction("POSTPONE_TASK", selectedTask.related_tag || "TASK", `Gia hạn việc đến ngày ${newDueDate}`);
    setShowTaskModal(false);
    setSelectedTask(null);
    fetchData();
  };

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
    if (!user) return alert("Vui lòng đăng nhập tài khoản để thực hiện!");
    if (!confirm(`Xác nhận cai sữa cho đàn con nái ${litter.sow_ear_tag}?`)) return;
    await supabase.from("pigs").update({ stage: "Chờ phối" }).eq("ear_tag", litter.sow_ear_tag);
    await supabase.from("farrowings").update({ notes: "Đã cai sữa", weaning_date: new Date().toISOString().split("T")[0] }).eq("id", litter.id);
    await logAction("WEAN_LITTER", litter.sow_ear_tag, `Cai sữa ${litter.alive_born} con`);
    alert("Đã cai sữa thành công!");
    fetchData();
  };

  const totalPiglets = activeLitters.reduce((s, l) => s + Number(l?.alive_born || 0), 0);
  const grandTotal = sowList.length + boarList.length + meatList.length + totalPiglets;
  const displayUser = user?.email?.replace("@trailon.local", "") || "";

  const renderPigCard = (pig: Pig) => (
    <div
      key={pig.id}
      onClick={() => {
        if (!user) return alert("Chế độ khách chỉ có quyền xem! Hãy đăng nhập để sửa.");
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
        Giống: <strong style={{ color: "#0f172a" }}>{pig.breed_id || "—"}</strong> | Giới tính: <strong>{pig.sex || "—"}</strong>
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
              {currentMenu === "SETTINGS" && "CÀI ĐẶT"}
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

        {/* NÚT BẤM THÊM LỢN MỚI CỐ ĐỊNH Ở MÀN HÌNH NÁI / ĐỰC / THỊT */}
        {(currentMenu === "SOW" || currentMenu === "BOAR" || currentMenu === "MEAT") && (
          <div style={{ padding: "12px 16px 0 16px" }}>
            <button
              onClick={() => {
                if (!user) return alert("Vui lòng đăng nhập để thêm lợn!");
                setNewPig(prev => ({
                  ...prev,
                  sex: currentMenu === "BOAR" ? "Đực" : "Cái",
                  stage: currentMenu === "MEAT" ? "Vỗ béo thịt" : currentMenu === "BOAR" ? "Đực giống" : "Hậu bị"
                }));
                setShowAddPigModal(true);
              }}
              style={{ width: "100%", padding: "10px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", fontSize: "13px", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}
            >
              <span>+ Thêm cá thể lợn mới</span>
            </button>
          </div>
        )}

        {/* DRAWER MENU */}
        {isSidebarOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
            <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
            <div style={{ width: "260px", backgroundColor: "#fff", height: "100%", zIndex: 101, padding: "20px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, color: "#5b21b6" }}>APPTRAILON</h2>
              <div style={{ fontSize: "12px", color: user ? "#059669" : "#64748b", fontWeight: "700", marginBottom: "8px" }}>
                {user ? `👤 Tài khoản: ${displayUser}` : "👀 Chế độ Khách (Chỉ xem)"}
              </div>
              {[
                { k: "OVERVIEW", l: "Tổng quan", icon: "📊" },
                { k: "SOW", l: "Quản lý nái", icon: "🐖" },
                { k: "BOAR", l: "Quản lý đực", icon: "🐗" },
                { k: "PIGLET", l: "Lợn con theo lô", icon: "🍼" },
                { k: "MEAT", l: "Lợn thịt", icon: "🥩" },
                { k: "SEARCH", l: "Tra cứu cá thể", icon: "🔍" },
                { k: "SETTINGS", l: "Cài đặt & Danh mục", icon: "⚙️" },
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "900", color: "#1e1b4b", margin: 0 }}>
                  🔔 VIỆC CẦN LÀM ({pendingTasks.length})
                </h3>
              </div>

              <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto" }}>
                {[{ id: "ALL", label: "Tất cả" }, { id: "REPRO", label: "Sinh sản" }, { id: "VET", label: "Thú y" }, { id: "WEAN", label: "Cai sữa" }].map((tab) => (
                  <button key={tab.id} onClick={() => setTaskCategoryFilter(tab.id)} style={{ padding: "6px 10px", borderRadius: "16px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer", backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#e2e8f0", color: taskCategoryFilter === tab.id ? "#fff" : "#475569" }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* KHỐI 1: VIỆC CHƯA HOÀN THÀNH */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {pendingTasks.length === 0 ? (
                  <div style={{ padding: "14px", textAlign: "center", background: "#fff", borderRadius: "10px", fontSize: "12px", color: "#64748b" }}>
                    ✨ Tuyệt vời! Hiện tại không có công việc nào tồn đọng.
                  </div>
                ) : (
                  pendingTasks.map((task) => {
                    const isOverdue = String(task.title).includes("QUÁ HẠN");
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          cursor: user ? "pointer" : "not-allowed",
                          background: isOverdue ? "#fef2f2" : "#fff",
                          padding: "10px 14px", borderRadius: "10px",
                          border: isOverdue ? "1px solid #fecaca" : "1px solid #f1e5f0"
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: isOverdue ? "#b91c1c" : "#1e1b4b" }}>{task.title}</div>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            Hạn: <strong>{task.due_date}</strong> {task.related_tag && `(Tai: ${task.related_tag})`}
                          </div>
                        </div>
                        <div style={{ fontSize: "18px" }}>⚪</div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* KHỐI 2: VIỆC ĐÃ HOÀN THÀNH */}
              {completedTasks.length > 0 && (
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#047857", margin: "0 0 8px 0" }}>
                    ✅ CÔNG VIỆC ĐÃ LÀM XONG ({completedTasks.length})
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "#f0fdf4", padding: "8px 12px", borderRadius: "8px",
                          border: "1px solid #bbf7d0", opacity: 0.85
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "#166534", textDecoration: "line-through" }}>{task.title}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>Đã xử lý (Hạn cũ: {task.due_date})</div>
                        </div>
                        <div style={{ fontSize: "16px" }}>🟢</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                const sow = safePigs.find((p) => p.ear_tag === lit.sow_ear_tag);
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
              {safePigs.filter(p => !isIndividualPiglet(p)).filter(p => String(p?.ear_tag || "").toLowerCase().includes(searchQuery.toLowerCase()) || String(p?.breed_id || "").toLowerCase().includes(searchQuery.toLowerCase())).map(renderPigCard)}
            </div>
          </div>
        )}

        {/* 7. CÀI ĐẶT & DANH MỤC */}
        {currentMenu === "SETTINGS" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* THÔNG TIN TÀI KHOẢN */}
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "800", color: "#1e1b4b" }}>Trạng thái tài khoản</h4>
              <div style={{ fontSize: "13px", color: user ? "#059669" : "#64748b", fontWeight: "700" }}>
                {user ? `Đang đăng nhập: ${displayUser}` : "Chế độ xem tự do (Khách)"}
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                * Quản trị viên cấp/thêm tài khoản trực tiếp trong mục Authentication trên Supabase.
              </div>
            </div>

            {/* DANH MỤC GIỐNG */}
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Giống lợn</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {(config?.breeds || []).map((b) => (
                  <span key={b} style={{ padding: "4px 10px", borderRadius: "20px", background: "#f1f5f9", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {b}
                    {user && (
                      <span
                        onClick={() => saveConfig({ ...config, breeds: config.breeds.filter(item => item !== b) })}
                        style={{ cursor: "pointer", color: "#ef4444", fontWeight: "800" }}
                      >
                        ✕
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {user && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input placeholder="Thêm giống mới..." value={newBreedInput} onChange={(e) => setNewBreedInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                  <button onClick={() => { if (newBreedInput.trim() && !config.breeds.includes(newBreedInput.trim())) { saveConfig({ ...config, breeds: [...config.breeds, newBreedInput.trim()] }); setNewBreedInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}>+ Thêm</button>
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
                    {user && (
                      <span
                        onClick={() => saveConfig({ ...config, stages: config.stages.filter(item => item !== st) })}
                        style={{ cursor: "pointer", color: "#ef4444", fontWeight: "800" }}
                      >
                        ✕
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {user && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input placeholder="Thêm trạng thái..." value={newStageInput} onChange={(e) => setNewStageInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                  <button onClick={() => { if (newStageInput.trim() && !config.stages.includes(newStageInput.trim())) { saveConfig({ ...config, stages: [...config.stages, newStageInput.trim()] }); setNewStageInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}>+ Thêm</button>
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
                    {user && (
                      <span
                        onClick={() => saveConfig({ ...config, pens: config.pens.filter(item => item !== pen) })}
                        style={{ cursor: "pointer", color: "#ef4444", fontWeight: "800" }}
                      >
                        ✕
                      </span>
                    )}
                  </span>
                ))}
              </div>
              {user && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input placeholder="Mã ô chuồng..." value={newPenInput} onChange={(e) => setNewPenInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                  <button onClick={() => { if (newPenInput.trim() && !config.pens.includes(newPenInput.trim())) { saveConfig({ ...config, pens: [...config.pens, newPenInput.trim().toUpperCase()] }); setNewPenInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}>+ Thêm</button>
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

      {/* FOOTER CỐ ĐỊNH Ở ĐÁY */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "36px", backgroundColor: "rgba(253, 248, 251, 0.95)", borderTop: "1px solid #f1e5f0", display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: "16px", zIndex: 40, maxWidth: "480px", margin: "0 auto", pointerEvents: "none" }}>
        <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b" }}>AppWeb: Trại Lợn Nà Roác</span>
      </footer>

      {/* MODAL THÊM CÁ THỂ LỢN MỚI */}
      {showAddPigModal && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800", color: "#059669" }}>+ Thêm Cá Thể Lợn Mới</h3>
            <form onSubmit={handleCreatePig} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai (*):</label>
                <input required placeholder="VD: HL-01, V3-02..." value={newPig.ear_tag} onChange={(e) => setNewPig({ ...newPig, ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Giống:</label>
                  <select value={newPig.breed_id || config.breeds[0]} onChange={(e) => setNewPig({ ...newPig, breed_id: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.breeds.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Giới tính:</label>
                  <select value={newPig.sex} onChange={(e) => setNewPig({ ...newPig, sex: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Cái">Cái</option>
                    <option value="Đực">Đực</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Giai đoạn:</label>
                  <select value={newPig.stage || config.stages[0]} onChange={(e) => setNewPig({ ...newPig, stage: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.stages.map(st => <option key={st} value={st}>{st}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Ô Chuồng:</label>
                  <select value={newPig.current_pen_code || config.pens[0]} onChange={(e) => setNewPig({ ...newPig, current_pen_code: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.pens.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai Bố:</label>
                  <input placeholder="Trống nếu không rõ" value={newPig.sire_ear_tag} onChange={(e) => setNewPig({ ...newPig, sire_ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai Mẹ:</label>
                  <input placeholder="Trống nếu không rõ" value={newPig.dam_ear_tag} onChange={(e) => setNewPig({ ...newPig, dam_ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Ghi chú:</label>
                <input placeholder="Ghi chú thêm..." value={newPig.notes} onChange={(e) => setNewPig({ ...newPig, notes: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: "7px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={isAddingPig} style={{ padding: "7px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>
                  {isAddingPig ? "Đang lưu..." : "Thêm Ngay"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN / GIA HẠN CÔNG VIỆC */}
      {showTaskModal && selectedTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "360px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#1e1b4b" }}>
              Xác nhận công việc
            </h3>
            <div style={{ fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "8px", lineHeight: "1.4" }}>
              {selectedTask.title}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "16px" }}>
              Hạn thực hiện: <strong>{selectedTask.due_date}</strong> {selectedTask.related_tag && `(Tai: ${selectedTask.related_tag})`}
            </div>

            {String(selectedTask.title).includes("QUÁ HẠN") ? (
              <div>
                <div style={{ fontSize: "12px", color: "#b91c1c", fontWeight: "700", marginBottom: "14px", background: "#fef2f2", padding: "8px", borderRadius: "6px" }}>
                  ⚠️ Công việc này đã quá hạn! Bạn muốn làm tiếp hay bỏ qua?
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button onClick={confirmCompleteTask} style={{ padding: "10px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer", fontSize: "13px" }}>
                    ✓ Đã làm xong ngay bây giờ
                  </button>
                  <button onClick={confirmPostponeTask} style={{ padding: "9px", borderRadius: "8px", background: "#f59e0b", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer", fontSize: "13px" }}>
                    ⏳ Làm tiếp (Gia hạn thêm 3 ngày)
                  </button>
                  <button onClick={confirmDismissTask} style={{ padding: "9px", borderRadius: "8px", background: "#ef4444", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer", fontSize: "13px" }}>
                    ✕ Bỏ qua (Xóa khỏi danh sách)
                  </button>
                  <button onClick={() => setShowTaskModal(false)} style={{ padding: "8px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "12px" }}>
                    Đóng lại
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "12px", color: "#475569", marginBottom: "16px" }}>
                  Bạn đã hoàn thành công việc kỹ thuật này đúng quy trình chưa?
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button onClick={() => setShowTaskModal(false)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer", fontWeight: "700" }}>
                    Chưa làm
                  </button>
                  <button onClick={confirmCompleteTask} style={{ padding: "8px 16px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>
                    ✓ Xác nhận đã làm xong
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
                <button type="button" onClick={() => setEditingPig(null)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={isSavingEdit} style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>
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
              <input
                type="text"
                required
                placeholder="Tên đăng nhập (VD: kithuat1)..."
                value={authAccount}
                onChange={(e) => setAuthAccount(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
              <input
                type="password"
                required
                placeholder="Mật khẩu..."
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAuthModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#5b21b6", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>Vào</button>
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
                <button type="button" onClick={() => setShowChangePwdModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
