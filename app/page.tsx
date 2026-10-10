"use client";

export const dynamic = "force-dynamic";

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

const formatDateVN = (dStr?: string) => {
  if (!dStr) return "—";
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatVietnameseSex = (rawSex?: string) => {
  if (!rawSex) return "Cái";
  const s = rawSex.trim().toLowerCase();
  if (s === "male" || s === "m" || s === "duc" || s === "đực") return "Đực";
  return "Cái";
};

const formatVietnameseStage = (rawStage?: string) => {
  if (!rawStage) return "Hậu bị";
  const s = rawStage.toUpperCase().trim();
  if (s === "DUC_GIONG" || s === "DUC" || s === "BOAR") return "Đực giống";
  if (s === "CHUA" || s === "DANG_CHUA" || s === "PREGNANT" || s.includes("CHỬA") || s.includes("CHUA")) return "Đang chửa";
  if (s === "NUOICON" || s === "NUOI_CON" || s === "LACTATING" || s.includes("NUÔI") || s.includes("NUOI")) return "Nuôi con";
  if (s === "HAU_BI" || s === "HAUBI" || s === "GILT" || s.includes("HẬU") || s.includes("HAU")) return "Hậu bị";
  if (s === "CHO_PHOI" || s === "CHOPHOI" || s === "WEANED" || s.includes("CHỜ") || s.includes("CHO")) return "Chờ phối";
  if (s === "CAI_SUA" || s === "CAISUA" || s === "DA_CAI_SUA") return "Đã cai sữa";
  if (s === "THIT" || s === "VO_BEO" || s === "VO_BEO_THIT" || s === "FATTEN" || s.includes("THỊT") || s.includes("THIT")) return "Vỗ béo thịt";
  return rawStage;
};

export default function FarmApp() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [customDisplayName, setCustomDisplayName] = useState<string>("Hà Quang Dự");
  const [inputDisplayName, setInputDisplayName] = useState<string>("Hà Quang Dự");

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAccount, setAuthAccount] = useState("");
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

  const [completedTaskKeys, setCompletedTaskKeys] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Tabs điều hướng
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "GUIDE" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportDays, setReportDays] = useState<7 | 10 | 30>(7);

  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Lan lai Hương", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire"],
    stages: ["Hậu bị", "Chờ phối", "Đang chửa", "Nuôi con", "Đã cai sữa", "Vỗ béo thịt", "Đực giống"],
    pens: ["CA1", "CA2", "CA3", "CA4", "CA5", "CB1", "CB2", "CB3", "CB4", "CD1", "CD2"]
  });

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

  // Modal Chi tiết & Sửa tổng hợp
  const [activeProfilePig, setActiveProfilePig] = useState<Pig | null>(null);
  const [profileTab, setProfileTab] = useState<"EDIT" | "REPRO" | "PEDIGREE">("EDIT");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Lứa đẻ trong modal
  const [showLitterForm, setShowLitterForm] = useState(false);
  const [editingLitterId, setEditingLitterId] = useState<string | null>(null);
  const [litterFormData, setLitterFormData] = useState({
    litter_code: "",
    farrow_date: new Date().toISOString().split("T")[0],
    alive_born: 10,
    boar_used: "",
    notes: ""
  });

  // Task & Lô con
  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [viewingLitter, setViewingLitter] = useState<FarrowingLitter | null>(null);
  const [selectedPigletTags, setSelectedPigletTags] = useState<string[]>([]);

  // Phối giống
  const [showMatingModal, setShowMatingModal] = useState(false);
  const [matingSowTag, setMatingSowTag] = useState("");
  const [selectedBoarTag, setSelectedBoarTag] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const savedName = localStorage.getItem("farm_display_name_permanent");
        if (savedName?.trim()) {
          setCustomDisplayName(savedName.trim());
          setInputDisplayName(savedName.trim());
        }
        const savedLogs = localStorage.getItem("farm_local_audit_logs");
        if (savedLogs) {
          const parsed = JSON.parse(savedLogs);
          if (Array.isArray(parsed)) setAuditLogs(parsed);
        }
        const savedDone = localStorage.getItem("farm_done_task_keys");
        if (savedDone) {
          const parsed = JSON.parse(savedDone);
          if (Array.isArray(parsed)) setCompletedTaskKeys(parsed);
        }
      } catch (e) {}
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

  const activeOperator = useMemo(() => {
    if (customDisplayName?.trim()) return customDisplayName.trim();
    return "Hà Quang Dự";
  }, [customDisplayName]);

  const logAction = useCallback(async (actionType: string, targetId: string, details: string) => {
    const newEntry: AuditLog = {
      id: "log-" + Date.now(),
      action_type: actionType,
      target_id: targetId,
      performed_by: activeOperator,
      details,
      created_at: new Date().toISOString()
    };

    setAuditLogs(prev => {
      const updated = [newEntry, ...prev].slice(0, 50);
      if (typeof window !== "undefined") {
        try { localStorage.setItem("farm_local_audit_logs", JSON.stringify(updated)); } catch (e) {}
      }
      return updated;
    });

    try {
      await supabase.from("audit_logs").insert([
        { action_type: actionType, target_id: targetId, performed_by: activeOperator, details }
      ]);
    } catch (e) {}
  }, [supabase, activeOperator]);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, tRes, farRes, insemRes, logRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("farrowings").select("*").order("farrow_date", { ascending: false }),
        supabase.from("inseminations").select("*").order("mating_date", { ascending: false }),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(60)
      ]);
      if (pRes?.data) setPigs(pRes.data);
      if (tRes?.data) setDbTasks(tRes.data);
      if (farRes?.data) setLitters(farRes.data);
      if (insemRes?.data) setInseminations(insemRes.data);
      if (logRes?.data && logRes.data.length > 0) setAuditLogs(logRes.data);
    } catch (e) {}
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    let loginAccount = authAccount.trim().toLowerCase();
    if (!loginAccount.includes("@")) loginAccount = `${loginAccount}@trailon.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email: loginAccount,
      password: authPassword.trim()
    });

    if (error) {
      setAuthError("Tên đăng nhập hoặc mật khẩu không chính xác!");
    } else {
      setShowAuthModal(false);
      setAuthPassword("");
      await logAction("LOGIN", loginAccount, "Đăng nhập hệ thống");
      fetchData();
    }
  };

  const handleLogout = async () => {
    await logAction("LOGOUT", user?.email || "", "Đăng xuất hệ thống");
    await supabase.auth.signOut();
    setUser(null);
  };

  const isIndividualPiglet = (pig?: Pig) => {
    if (!pig) return false;
    const tag = String(pig.ear_tag || "").toUpperCase();
    return tag.includes("-C") || tag.includes("CON");
  };

  const isMeat = (pig?: Pig) => {
    if (!pig || isIndividualPiglet(pig)) return false;
    const st = (pig.stage || "").toLowerCase();
    return st.includes("thịt") || st.includes("thit") || st.includes("vỗ béo") || st.includes("vo beo");
  };

  const isBoar = (pig?: Pig) => {
    if (!pig || isIndividualPiglet(pig) || isMeat(pig)) return false;
    const sx = (pig.sex || "").trim().toLowerCase();
    const st = (pig.stage || "").trim().toLowerCase();
    return (sx === "đực" || sx === "duc" || st.includes("đực") || st.includes("duc")) && !sx.includes("cái") && !sx.includes("cai");
  };

  const isSow = (pig?: Pig) => {
    if (!pig || isIndividualPiglet(pig) || isMeat(pig) || isBoar(pig)) return false;
    return true;
  };

  const checkSowState = useCallback((pig?: Pig) => {
    if (!pig) return "HAUBI";
    const st = (pig.stage || "").toLowerCase().trim();

    if (st.includes("chửa") || st.includes("chua")) return "CHUA";
    if (st.includes("nuôi con") || st.includes("nuoi con")) return "NUOICON";
    if (st.includes("chờ phối") || st.includes("cho phoi")) return "CHOPHOI";
    if (st.includes("hậu bị") || st.includes("hau bi")) return "HAUBI";

    return "HAUBI";
  }, []);

  const safePigs = Array.isArray(pigs) ? pigs : [];
  const sowList = safePigs.filter(isSow);
  const boarList = safePigs.filter(isBoar);
  const meatList = safePigs.filter(isMeat);

  const suckingLitters = useMemo(() => {
    return (Array.isArray(litters) ? litters : []).filter(l => {
      if (!l?.sow_ear_tag) return false;
      const st = (l?.status || "").toUpperCase();
      const n = (l?.notes || "").toLowerCase();
      if (st === "DA_XUAT_BAN" || st === "LICH_SU" || n.includes("xuat ban") || n.includes("nái rạ") || n.includes("lịch sử")) {
        return false;
      }
      return !n.includes("da cai") && !n.includes("cai sua") && !st.includes("cai");
    });
  }, [litters]);

  const weanedLitters = useMemo(() => {
    return (Array.isArray(litters) ? litters : []).filter(l => {
      if (!l?.sow_ear_tag) return false;
      const st = (l?.status || "").toUpperCase();
      const n = (l?.notes || "").toLowerCase();
      if (st === "DA_XUAT_BAN" || st === "LICH_SU" || n.includes("xuat ban") || n.includes("nái rạ") || n.includes("lịch sử")) {
        return false;
      }
      return n.includes("da cai") || n.includes("cai sua") || st.includes("cai");
    });
  }, [litters]);

  const suckingPigletsCount = suckingLitters.reduce((s, l) => s + Number(l?.alive_born || 0), 0);
  const weanedPigletsCount = weanedLitters.reduce((s, l) => s + Number(l?.alive_born || 0), 0);
  const totalPigletsCount = suckingPigletsCount + weanedPigletsCount;
  const grandTotal = sowList.length + boarList.length + meatList.length + totalPigletsCount;

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

  const getGestationProgress = useCallback((sowTag: string) => {
    const sTag = sowTag.trim().toUpperCase();
    const latestInsem = inseminations.find(ins => (ins.sow_ear_tag || "").trim().toUpperCase() === sTag);
    if (!latestInsem?.mating_date) return null;

    const daysPassed = safeDateDiff(latestInsem.mating_date);
    if (daysPassed < 0 || daysPassed > 120) return null;

    const pct = Math.min(100, Math.max(0, (daysPassed / 114) * 100));
    let stageTitle = "Ổn định phôi";
    let badgeColor = "#3b82f6";
    if (daysPassed <= 21) {
      stageTitle = "Theo dõi lốc chu kỳ 1 (18-21 ngày)";
      badgeColor = "#ef4444";
    } else if (daysPassed <= 80) {
      stageTitle = "Nuôi thai ổn định (Khẩu phần chuẩn)";
      badgeColor = "#3b82f6";
    } else if (daysPassed <= 106) {
      stageTitle = "Thúc thai & Tuyến vú (Tăng cám)";
      badgeColor = "#f59e0b";
    } else {
      stageTitle = "Lên chuồng đẻ & Sát trùng vú";
      badgeColor = "#10b981";
    }

    return {
      daysPassed,
      pct,
      stageTitle,
      badgeColor,
      matingDate: latestInsem.mating_date,
      expectedFarrowDate: latestInsem.expected_farrow_date,
      boarTag: latestInsem.boar_ear_tag || "—"
    };
  }, [inseminations]);

  const getSowReproAnalysis = useCallback((sowTag: string) => {
    const sTag = sowTag.trim().toUpperCase();
    const sowLitters = (Array.isArray(litters) ? litters : [])
      .filter(l => (l.sow_ear_tag || "").trim().toUpperCase() === sTag)
      .sort((a, b) => new Date(a.farrow_date).getTime() - new Date(b.farrow_date).getTime());

    const sowInsems = (Array.isArray(inseminations) ? inseminations : [])
      .filter(i => (i.sow_ear_tag || "").trim().toUpperCase() === sTag)
      .sort((a, b) => new Date(b.mating_date).getTime() - new Date(a.mating_date).getTime());

    const totalLitters = sowLitters.length;
    const totalBorn = sowLitters.reduce((acc, l) => acc + Number(l.alive_born || 0), 0);
    const avgBorn = totalLitters > 0 ? (totalBorn / totalLitters).toFixed(1) : "0";

    return { totalLitters, totalBorn, avgBorn, sowLitters, sowInsems };
  }, [litters, inseminations]);

  // LƯU FORM SỬA THÔNG TIN NÁI
  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfilePig || !user) return;
    setIsSavingEdit(true);

    try {
      const cleanTag = activeProfilePig.ear_tag.trim().toUpperCase();
      const updatedPayload = {
        ear_tag: cleanTag,
        breed_id: activeProfilePig.breed_id,
        sex: formatVietnameseSex(activeProfilePig.sex),
        stage: formatVietnameseStage(activeProfilePig.stage),
        current_pen_code: activeProfilePig.current_pen_code,
        status: activeProfilePig.status || "Bình thường",
        sire_ear_tag: activeProfilePig.sire_ear_tag?.trim().toUpperCase() || null,
        dam_ear_tag: activeProfilePig.dam_ear_tag?.trim().toUpperCase() || null,
        notes: activeProfilePig.notes || null
      };

      const { error } = await supabase.from("pigs").update(updatedPayload).eq("id", activeProfilePig.id);
      if (error) throw error;

      setPigs(prev => prev.map(p => p.id === activeProfilePig.id ? { ...p, ...updatedPayload } : p));
      setActiveProfilePig(prev => prev ? { ...prev, ...updatedPayload } : null);

      await logAction("UPDATE_PIG", cleanTag, `Đổi trạng thái nái ${cleanTag} sang "${updatedPayload.stage}"`);
      alert(`✅ Đã lưu thành công! Nái ${cleanTag} hiện là "${updatedPayload.stage}".`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu nái: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // NHIỆM VỤ
  const fullTasks = useMemo(() => {
    const taskMap = new Map<string, FarmTask>();

    (Array.isArray(inseminations) ? inseminations : []).forEach(ins => {
      if (!ins?.mating_date || !ins?.sow_ear_tag) return;
      const tagUpper = ins.sow_ear_tag.trim().toUpperCase();
      const d = safeDateDiff(ins.mating_date);
      if (d === -999) return;

      if (d >= 16 && d <= 25) {
        const key = `repro-l1-${tagUpper}`;
        taskMap.set(key, {
          id: key,
          title: `[SINH SẢN] Kiểm tra lốc chu kỳ 1 (21 ngày) nái ${ins.sow_ear_tag}`,
          due_date: safeAddDays(ins.mating_date, 21),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: completedTaskKeys.includes(key),
          is_auto: true
        });
      }
      if (d >= 104 && d <= 116) {
        const key = `repro-cd-${tagUpper}`;
        taskMap.set(key, {
          id: key,
          title: `[CHUẨN BỊ ĐẺ] Chuyển nái ${ins.sow_ear_tag} lên chuồng đẻ & sát trùng vú`,
          due_date: safeAddDays(ins.mating_date, 107),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: completedTaskKeys.includes(key),
          is_auto: true
        });
      }
    });

    (Array.isArray(dbTasks) ? dbTasks : []).forEach(t => {
      if (!t?.title) return;
      const cleanTitle = t.title.trim();
      const tag = (t.related_tag || "").trim().toUpperCase();
      const uniqueKey = `${cleanTitle}-${tag}`;

      let cat = t.category;
      const normTitle = cleanTitle.toLowerCase();
      if (normTitle.includes("vaccine") || normTitle.includes("tiêm") || normTitle.includes("phòng") || normTitle.includes("e.coli")) {
        cat = "VET";
      }

      if (taskMap.has(uniqueKey)) {
        const existing = taskMap.get(uniqueKey)!;
        if (!existing.is_completed && t.is_completed) {
          taskMap.set(uniqueKey, { ...t, category: cat });
        }
      } else {
        taskMap.set(uniqueKey, { ...t, category: cat });
      }
    });

    return Array.from(taskMap.values()).filter(t => !t.is_dismissed);
  }, [inseminations, dbTasks, completedTaskKeys]);

  const filteredTasks = fullTasks.filter(t => taskCategoryFilter === "ALL" || t?.category === taskCategoryFilter);
  const pendingTasks = filteredTasks.filter(t => !t.is_completed);
  const completedTasks = filteredTasks.filter(t => t.is_completed);

  // RENDER THẺ CÁ THỂ
  const renderPigCard = (pig: Pig) => {
    const isThisSow = isSow(pig);
    const reproData = isThisSow ? getSowReproAnalysis(pig.ear_tag) : null;
    const currentState = isThisSow ? checkSowState(pig) : "";
    const gestation = isThisSow && currentState === "CHUA" ? getGestationProgress(pig.ear_tag) : null;

    return (
      <div
        key={pig.id}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "14px",
          padding: "14px 16px",
          border: "1px solid #f1e5f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: "6px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: "900", color: "#1e1b4b" }}>{pig.ear_tag}</span>
          
          <button
            onClick={() => {
              setActiveProfilePig({ ...pig });
              setProfileTab("EDIT");
              setShowLitterForm(false);
            }}
            style={{
              fontSize: "12px", fontWeight: "800", padding: "6px 14px", borderRadius: "8px",
              background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", cursor: "pointer"
            }}
          >
            ⚙️ Sửa & Chi tiết
          </button>
        </div>

        <div style={{ fontSize: "13px", color: "#475569" }}>
          Giống: <strong style={{ color: "#0f172a" }}>{pig.breed_id || "—"}</strong> | Giới tính: <strong>{formatVietnameseSex(pig.sex)}</strong>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
          <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#f1f5f9", fontWeight: "600", color: "#334155" }}>
            Ô: {pig.current_pen_code || "Chưa xếp"}
          </span>
          <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#ecfdf5", color: "#047857", fontWeight: "700" }}>
            {formatVietnameseStage(pig.stage)}
          </span>
          {isThisSow && (
            <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", background: "#eff6ff", color: "#1d4ed8", fontWeight: "700" }}>
              Đã đẻ: {reproData?.totalLitters || 0} lứa
            </span>
          )}
        </div>

        {gestation && (
          <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>
              <span style={{ color: gestation.badgeColor }}>⏳ Ngày {gestation.daysPassed}/114 thai kỳ</span>
              <span style={{ color: "#64748b" }}>Dự sinh: {formatDateVN(gestation.expectedFarrowDate)}</span>
            </div>
            <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gestation.pct}%`, background: gestation.badgeColor }} />
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px", fontSize: "11px", color: "#475569", display: "flex", justifyContent: "space-between" }}>
          <span>Bố: <strong style={{ color: "#1e40af" }}>{pig.sire_ear_tag || "—"}</strong></span>
          <span>Mẹ: <strong style={{ color: "#b91c1c" }}>{pig.dam_ear_tag || "—"}</strong></span>
        </div>
      </div>
    );
  };

  if (!mounted) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Đang tải...</div>;
  }

  const sowPct = grandTotal > 0 ? ((sowList.length / grandTotal) * 100).toFixed(0) : "0";
  const boarPct = grandTotal > 0 ? ((boarList.length / grandTotal) * 100).toFixed(0) : "0";
  const pigletPct = grandTotal > 0 ? ((totalPigletsCount / grandTotal) * 100).toFixed(0) : "0";
  const meatPct = grandTotal > 0 ? ((meatList.length / grandTotal) * 100).toFixed(0) : "0";

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto", position: "relative", paddingBottom: "70px" }}>
      
      {/* HEADER */}
      <header style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => setIsSidebarOpen(true)} style={{ background: "none", border: "none", fontSize: "22px", cursor: "pointer" }}>☰</button>
          <h1 style={{ fontSize: "17px", fontWeight: "900", margin: 0, color: "#1e1b4b" }}>
            {currentMenu === "OVERVIEW" && "TỔNG QUAN"}
            {currentMenu === "SOW" && "QUẢN LÝ NÁI"}
            {currentMenu === "BOAR" && "QUẢN LÝ ĐỰC"}
            {currentMenu === "PIGLET" && "LỢN CON THEO LÔ"}
            {currentMenu === "MEAT" && "LỢN THỊT"}
            {currentMenu === "GUIDE" && "QUY TRÌNH THÚ Y"}
            {currentMenu === "SEARCH" && "TRA CỨU"}
            {currentMenu === "SETTINGS" && "CÀI ĐẶT"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {user ? (
            <button onClick={handleLogout} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontSize: "11px", fontWeight: "700", color: "#ef4444", cursor: "pointer" }}>Thoát</button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: "5px 12px", borderRadius: "8px", border: "none", background: "#5b21b6", color: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Đăng nhập</button>
          )}
        </div>
      </header>

      {/* MENU TRƯỢT BÊN TRÁI */}
      {isSidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
          <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
          <div style={{ width: "260px", backgroundColor: "#fff", height: "100%", zIndex: 101, padding: "20px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h2 style={{ margin: "0 0 10px 0", color: "#5b21b6", fontSize: "18px" }}>Trại Lợn Nà Roác</h2>
            {[
              { k: "OVERVIEW", l: "Tổng quan", icon: "📊" },
              { k: "SOW", l: "Quản lý nái", icon: "🐖" },
              { k: "BOAR", l: "Quản lý đực", icon: "🐗" },
              { k: "PIGLET", l: "Lợn con theo lô", icon: "🍼" },
              { k: "MEAT", l: "Lợn thịt", icon: "🥩" },
              { k: "GUIDE", l: "Quy trình thú y", icon: "🩺" },
              { k: "SEARCH", l: "Tra cứu cá thể", icon: "🔍" },
              { k: "SETTINGS", l: "Cài đặt & Nhật ký", icon: "⚙️" },
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

      {/* NÚT THAO TÁC TAB NÁI */}
      {currentMenu === "SOW" && (
        <div style={{ padding: "12px 16px 0 16px", display: "flex", gap: "8px" }}>
          <button onClick={() => setShowAddPigModal(true)} style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}>
            + Thêm nái mới
          </button>
          <button onClick={() => setShowMatingModal(true)} style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#7c3aed", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}>
            🔬 Phối giống (Tránh cận huyết)
          </button>
        </div>
      )}

      {/* 1. MÀN HÌNH TỔNG QUAN */}
      {currentMenu === "OVERVIEW" && (
        <div style={{ padding: "16px" }}>
          <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", borderRadius: "16px", padding: "16px 18px", marginBottom: "14px", color: "#fff" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#a5b4fc" }}>Quy mô trang trại</div>
            <div style={{ fontSize: "26px", fontWeight: "900", margin: "2px 0 6px 0" }}>{grandTotal} <span style={{ fontSize: "14px", color: "#c7d2fe" }}>cá thể</span></div>
            <div style={{ height: "7px", width: "100%", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "4px", overflow: "hidden", display: "flex", margin: "8px 0" }}>
              <div style={{ width: `${sowPct}%`, backgroundColor: "#ec4899" }} />
              <div style={{ width: `${boarPct}%`, backgroundColor: "#3b82f6" }} />
              <div style={{ width: `${pigletPct}%`, backgroundColor: "#10b981" }} />
              <div style={{ width: `${meatPct}%`, backgroundColor: "#eab308" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#cbd5e1" }}>
              <span>● Nái: {sowList.length}</span>
              <span>● Đực: {boarList.length}</span>
              <span>● Con: {totalPigletsCount}</span>
              <span>● Thịt: {meatList.length}</span>
            </div>
          </div>

          {/* 4 Ô CƠ CẤU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
            <div onClick={() => { setCurrentMenu("SOW"); setSubFilter("ALL"); }} style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #fce7f3" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowList.length} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Chửa: <strong>{sowList.filter(p => checkSowState(p) === "CHUA").length}</strong></div>
                <div>• Nuôi con: <strong>{sowList.filter(p => checkSowState(p) === "NUOICON").length}</strong></div>
                <div>• Chờ phối: <strong>{sowList.filter(p => checkSowState(p) === "CHOPHOI").length}</strong></div>
                <div>• Hậu bị: <strong>{sowList.filter(p => checkSowState(p) === "HAUBI").length}</strong></div>
              </div>
            </div>

            <div onClick={() => setCurrentMenu("BOAR")} style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #dbeafe" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarList.length} con</div>
              <div style={{ fontSize: "11px", color: "#475569" }}>• Đang khai thác tinh</div>
            </div>

            <div onClick={() => setCurrentMenu("PIGLET")} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #dcfce7" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{totalPigletsCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569" }}>
                <div>• Theo mẹ: {suckingPigletsCount}</div>
                <div>• Cai sữa: {weanedPigletsCount}</div>
              </div>
            </div>

            <div onClick={() => setCurrentMenu("MEAT")} style={{ backgroundColor: "#fefce8", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #fef08a" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatList.length} con</div>
              <div style={{ fontSize: "11px", color: "#475569" }}>• Đang vỗ béo</div>
            </div>
          </div>

          {/* VIỆC CẦN LÀM */}
          <h3 style={{ fontSize: "15px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 10px 0" }}>
            🔔 VIỆC CẦN LÀM ({pendingTasks.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingTasks.length === 0 ? (
              <div style={{ padding: "12px", background: "#fff", borderRadius: "10px", fontSize: "12px", color: "#64748b", textAlign: "center" }}>
                ✨ Không có công việc nào tồn đọng.
              </div>
            ) : (
              pendingTasks.map(t => (
                <div key={t.id} style={{ background: "#fff", padding: "10px 12px", borderRadius: "10px", border: "1px solid #f1e5f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e1b4b" }}>{t.title}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Hạn: {formatDateVN(t.due_date)} {t.related_tag && `(Tai: ${t.related_tag})`}</div>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed" }}>{t.category}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. TAB QUẢN LÝ NÁI */}
      {currentMenu === "SOW" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "14px", overflowX: "auto" }}>
            {[
              { id: "ALL", label: `Tất cả (${sowList.length})` },
              { id: "CHUA", label: `Chửa (${sowList.filter(p => checkSowState(p) === "CHUA").length})` },
              { id: "NUOICON", label: `Nuôi con (${sowList.filter(p => checkSowState(p) === "NUOICON").length})` },
              { id: "CHOPHOI", label: `Chờ phối (${sowList.filter(p => checkSowState(p) === "CHOPHOI").length})` },
              { id: "HAUBI", label: `Hậu bị (${sowList.filter(p => checkSowState(p) === "HAUBI").length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSubFilter(tab.id)}
                style={{
                  padding: "8px 12px", borderRadius: "20px", border: "none", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                  backgroundColor: subFilter === tab.id ? "#db2777" : "#fff",
                  color: subFilter === tab.id ? "#fff" : "#475569"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {sowList.filter(p => (subFilter === "ALL" ? true : checkSowState(p) === subFilter)).map(renderPigCard)}
          </div>
        </div>
      )}

      {/* 3. TAB ĐỰC */}
      {currentMenu === "BOAR" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#2563eb", marginBottom: "12px" }}>ĐÀN ĐỰC GIỐNG ({boarList.length} CON)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{boarList.map(renderPigCard)}</div>
        </div>
      )}

      {/* 4. TAB LỢN CON THEO LÔ */}
      {currentMenu === "PIGLET" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#16a34a", marginBottom: "12px" }}>
            TỔNG ĐÀN CON: {totalPigletsCount} CON (Theo mẹ: {suckingPigletsCount} • Cai sữa: {weanedPigletsCount})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {suckingLitters.map(lit => (
              <div key={lit.id} style={{ background: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #f1e5f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800" }}>
                  <span>Lô nái {lit.sow_ear_tag} ({lit.litter_code})</span>
                  <span style={{ color: "#059669" }}>{lit.alive_born} con</span>
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", margin: "4px 0" }}>Ngày đẻ: {formatDateVN(lit.farrow_date)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB THỊT */}
      {currentMenu === "MEAT" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: "800", color: "#854d0e", marginBottom: "12px" }}>ĐÀN LỢN THỊT ({meatList.length} CON)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{meatList.map(renderPigCard)}</div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG (BOTTOM NAVIGATION) - CÓ SẴN ĐỂ BẤM CHUYỂN TAB */}
      {/* ========================================================================= */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "56px", backgroundColor: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 40, maxWidth: "480px", margin: "0 auto" }}>
        {[
          { k: "OVERVIEW", l: "Tổng quan", icon: "📊" },
          { k: "SOW", l: "Nái", icon: "🐖" },
          { k: "BOAR", l: "Đực", icon: "🐗" },
          { k: "PIGLET", l: "Lợn con", icon: "🍼" },
          { k: "MEAT", l: "Thịt", icon: "🥩" },
        ].map(tab => (
          <button
            key={tab.k}
            onClick={() => setCurrentMenu(tab.k as any)}
            style={{
              background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center",
              cursor: "pointer", color: currentMenu === tab.k ? "#5b21b6" : "#64748b",
              fontWeight: currentMenu === tab.k ? "800" : "500", fontSize: "11px", gap: "2px"
            }}
          >
            <span style={{ fontSize: "18px" }}>{tab.icon}</span>
            <span>{tab.l}</span>
          </button>
        ))}
      </nav>

      {/* ========================================================================= */}
      {/* MODAL HỒ SƠ TỔNG HỢP: SỬA TRẠNG THÁI + SINH SẢN + GIA PHẢ                  */}
      {/* ========================================================================= */}
      {activeProfilePig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "440px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "18px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>
                  Hồ Sơ: {activeProfilePig.ear_tag}
                </h3>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Giống: {activeProfilePig.breed_id} • Ô: {activeProfilePig.current_pen_code}</span>
              </div>
              <button onClick={() => setActiveProfilePig(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "900" }}>✕</button>
            </div>

            {/* Chuyển tab con */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "10px", padding: "3px", marginBottom: "14px" }}>
              {[
                { k: "EDIT", label: "📝 Sửa & Trạng Thái" },
                { k: "REPRO", label: "📊 Sinh Sản" },
                { k: "PEDIGREE", label: "🌳 Gia Phả" }
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setProfileTab(t.k as any)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: "8px", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer",
                    background: profileTab === t.k ? "#fff" : "transparent",
                    color: profileTab === t.k ? "#5b21b6" : "#64748b"
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {/* TAB 1: SỬA TRẠNG THÁI */}
              {profileTab === "EDIT" && (
                <form onSubmit={handleSaveProfileEdit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai (*):</label>
                      <input
                        required
                        value={activeProfilePig.ear_tag}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, ear_tag: e.target.value })}
                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Giống:</label>
                      <select
                        value={activeProfilePig.breed_id || config.breeds[0]}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, breed_id: e.target.value })}
                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      >
                        {config.breeds.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* CHỌN TRỰC TIẾP TRẠNG THÁI SANG ĐANG CHỬA */}
                  <div style={{ background: "#fdf2f4", padding: "10px", borderRadius: "8px", border: "1px solid #fce7f3" }}>
                    <label style={{ fontSize: "11px", fontWeight: "800", color: "#db2777" }}>Trạng thái sinh sản hiện tại (*):</label>
                    <select
                      value={activeProfilePig.stage}
                      onChange={(e) => setActiveProfilePig({ ...activeProfilePig, stage: e.target.value })}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #f472b6", marginTop: "4px", fontWeight: "800" }}
                    >
                      <option value="Đang chửa">🤰 Đang chửa</option>
                      <option value="Nuôi con">🍼 Nuôi con</option>
                      <option value="Chờ phối">⏳ Chờ phối</option>
                      <option value="Hậu bị">🐖 Hậu bị</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Ô Chuồng:</label>
                      <select
                        value={activeProfilePig.current_pen_code || config.pens[0]}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, current_pen_code: e.target.value })}
                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      >
                        {config.pens.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Thể trạng:</label>
                      <input
                        value={activeProfilePig.status || "Bình thường"}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, status: e.target.value })}
                        style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {user ? (
                    <button
                      type="submit"
                      disabled={isSavingEdit}
                      style={{ padding: "10px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer", marginTop: "6px" }}
                    >
                      {isSavingEdit ? "Đang lưu..." : "💾 Lưu Thay Đổi Nái"}
                    </button>
                  ) : (
                    <div style={{ fontSize: "11px", color: "#64748b", textAlign: "center" }}>Vui lòng đăng nhập để lưu.</div>
                  )}
                </form>
              )}

              {/* TAB 2: SINH SẢN */}
              {profileTab === "REPRO" && (() => {
                const analysis = getSowReproAnalysis(activeProfilePig.ear_tag);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", textAlign: "center" }}>
                      <div style={{ background: "#fdf2f4", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#db2777" }}>TỔNG LỨA</div>
                        <b>{analysis.totalLitters}</b>
                      </div>
                      <div style={{ background: "#eff6ff", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#2563eb" }}>TỔNG CON</div>
                        <b>{analysis.totalBorn}</b>
                      </div>
                      <div style={{ background: "#ecfdf5", padding: "8px", borderRadius: "6px" }}>
                        <div style={{ fontSize: "10px", color: "#059669" }}>TB/LỨA</div>
                        <b>{analysis.avgBorn}</b>
                      </div>
                    </div>

                    <div style={{ marginTop: "8px" }}>
                      <b>Danh sách lứa đẻ:</b>
                      {analysis.sowLitters.map((l, idx) => (
                        <div key={l.id} style={{ background: "#f8fafc", padding: "8px", borderRadius: "6px", border: "1px solid #e2e8f0", marginTop: "4px" }}>
                          Lứa {idx + 1} ({formatDateVN(l.farrow_date)}): <b>{l.alive_born} con</b> - {l.notes || "—"}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* TAB 3: GIA PHẢ */}
              {profileTab === "PEDIGREE" && (
                <div style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ background: "#ede9fe", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                    Cá thể: <b>{activeProfilePig.ear_tag}</b> ({activeProfilePig.breed_id})
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div style={{ background: "#eff6ff", padding: "8px", borderRadius: "6px" }}>
                      Bố: <b>{activeProfilePig.sire_ear_tag || "Chưa rõ"}</b>
                    </div>
                    <div style={{ background: "#fdf2f4", padding: "8px", borderRadius: "6px" }}>
                      Mẹ: <b>{activeProfilePig.dam_ear_tag || "Chưa rõ"}</b>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "10px", textAlign: "right" }}>
              <button onClick={() => setActiveProfilePig(null)} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                Đóng
              </button>
            </div>
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
              <input type="text" required placeholder="Tên đăng nhập..." value={authAccount} onChange={(e) => setAuthAccount(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <input type="password" required placeholder="Mật khẩu..." value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAuthModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#5b21b6", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>Vào</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM CÁ THỂ MỚI */}
      {showAddPigModal && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "380px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "800", color: "#059669" }}>+ Thêm Cá Thể Mới</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newPig.ear_tag?.trim()) return;
              setIsAddingPig(true);
              try {
                const payload = {
                  ear_tag: newPig.ear_tag.trim().toUpperCase(),
                  breed_id: newPig.breed_id || config.breeds[0] || "Hạ Lang",
                  sex: "Cái",
                  stage: formatVietnameseStage(newPig.stage || "Hậu bị"),
                  current_pen_code: newPig.current_pen_code || "CA1",
                  status: "Bình thường"
                };
                await supabase.from("pigs").insert([payload]);
                setShowAddPigModal(false);
                setNewPig({ ear_tag: "", stage: "Hậu bị" });
                await fetchData();
              } finally {
                setIsAddingPig(false);
              }
            }} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input required placeholder="Số tai (VD: HL-01...)" value={newPig.ear_tag} onChange={e => setNewPig({ ...newPig, ear_tag: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <select value={newPig.stage || "Hậu bị"} onChange={e => setNewPig({ ...newPig, stage: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="Hậu bị">Hậu bị</option>
                <option value="Chờ phối">Chờ phối</option>
                <option value="Đang chửa">Đang chửa</option>
                <option value="Nuôi con">Nuôi con</option>
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={isAddingPig} style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PHỐI GIỐNG */}
      {showMatingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "380px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#5b21b6" }}>🔬 Lập Kế Hoạch Phối Giống</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!user) return alert("Vui lòng đăng nhập!");
              if (!matingSowTag || !selectedBoarTag) return;
              const expFarrow = safeAddDays(matingDate, 114);
              const payload = {
                sow_ear_tag: matingSowTag.trim().toUpperCase(),
                boar_ear_tag: selectedBoarTag.trim().toUpperCase(),
                mating_date: matingDate,
                expected_farrow_date: expFarrow,
                status: "Đã phối"
              };
              await supabase.from("inseminations").insert([payload]);
              await supabase.from("pigs").update({ stage: "Đang chửa" }).eq("ear_tag", matingSowTag);
              alert("Đã ghi nhận phối giống!");
              setShowMatingModal(false);
              await fetchData();
            }} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <select required value={matingSowTag} onChange={e => setMatingSowTag(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="">-- Chọn Nái giống --</option>
                {sowList.map(s => <option key={s.id} value={s.ear_tag}>{s.ear_tag} ({s.breed_id})</option>)}
              </select>
              <select required value={selectedBoarTag} onChange={e => setSelectedBoarTag(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="">-- Chọn Đực giống --</option>
                {boarList.map(b => <option key={b.id} value={b.ear_tag}>{b.ear_tag} ({b.breed_id})</option>)}
              </select>
              <input type="date" required value={matingDate} onChange={e => setMatingDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#7c3aed", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Xác nhận Phối</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
