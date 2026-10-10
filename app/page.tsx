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
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "PEDIGREE" | "GUIDE" | "SEARCH" | "SETTINGS">("OVERVIEW");
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

  // =========================================================================
  // MODAL HỒ SƠ TỔNG HỢP: SỬA + SINH SẢN + GIA PHẢ 2 CHIỀU
  // =========================================================================
  const [activeProfilePig, setActiveProfilePig] = useState<Pig | null>(null);
  const [profileTab, setProfileTab] = useState<"EDIT" | "REPRO" | "PEDIGREE">("EDIT");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Form lứa đẻ trong tab Sinh sản
  const [showLitterForm, setShowLitterForm] = useState(false);
  const [editingLitterId, setEditingLitterId] = useState<string | null>(null);
  const [litterFormData, setLitterFormData] = useState({
    litter_code: "",
    farrow_date: new Date().toISOString().split("T")[0],
    alive_born: 10,
    boar_used: "",
    notes: ""
  });

  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [viewingLitter, setViewingLitter] = useState<FarrowingLitter | null>(null);

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
      await logAction("LOGIN", loginAccount, "Đăng nhập");
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
      alert("Đổi mật khẩu thành công!");
      setShowChangePwdModal(false);
      setNewPassword("");
    }
  };

  const handleSaveDisplayName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDisplayName.trim()) return;
    const name = inputDisplayName.trim();
    setCustomDisplayName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("farm_display_name_permanent", name);
    }
    logAction("UPDATE_NAME", name, `Đổi tên thành ${name}`);
    alert(`Đã lưu tên người thực hiện: "${name}"`);
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

  // ĐÀN CON: LỌC BỎ LỨA LỊCH SỬ / ĐÃ BÁN
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
    return {
      daysPassed,
      pct,
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

  // LƯU FORM SỬA THÔNG TIN NÁI TRỰC TIẾP
  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfilePig) return;
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
      alert(`✅ Đã lưu thành công! Nái ${cleanTag} hiện có trạng thái: "${updatedPayload.stage}".`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu nái: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // THÊM/SỬA LỨA ĐẺ TRONG PROFILE
  const handleSaveLitter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfilePig) return;

    const sowTag = activeProfilePig.ear_tag.trim().toUpperCase();
    const boarNote = litterFormData.boar_used.trim() ? `[Đực: ${litterFormData.boar_used.trim().toUpperCase()}]` : "";
    const cleanNotes = `${boarNote} ${litterFormData.notes.trim()}`.trim();

    try {
      if (editingLitterId) {
        const payload = {
          litter_code: litterFormData.litter_code.trim().toUpperCase(),
          farrow_date: litterFormData.farrow_date,
          alive_born: Number(litterFormData.alive_born || 0),
          notes: cleanNotes || "Lịch sử nái",
          status: "DA_XUAT_BAN"
        };
        const { error } = await supabase.from("farrowings").update(payload).eq("id", editingLitterId);
        if (error) throw error;
        alert("Đã cập nhật lứa đẻ!");
      } else {
        const payload = {
          litter_code: litterFormData.litter_code.trim().toUpperCase() || `L-${sowTag}-${Date.now().toString().slice(-4)}`,
          sow_ear_tag: sowTag,
          farrow_date: litterFormData.farrow_date,
          alive_born: Number(litterFormData.alive_born || 0),
          weaning_date: litterFormData.farrow_date,
          notes: cleanNotes || "Lịch sử nái rạ (Đã xuất bán)",
          status: "DA_XUAT_BAN"
        };
        const { error } = await supabase.from("farrowings").insert([payload]);
        if (error) throw error;
        alert(`Đã lưu lứa ${payload.litter_code} cho nái ${sowTag}!`);
      }

      setShowLitterForm(false);
      setEditingLitterId(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu lứa: " + err.message);
    }
  };

  const handleDeleteLitter = async (litterId: string, litterCode: string) => {
    if (!confirm(`Xác nhận xóa bỏ lứa đẻ "${litterCode}"?`)) return;

    try {
      const { error } = await supabase.from("farrowings").delete().eq("id", litterId);
      if (error) throw error;
      alert(`Đã xóa thành công lứa đẻ ${litterCode}!`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  // XUẤT FILE WORD BÁO CÁO CƠ CẤU ĐÀN
  const handleExportWord = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yy = String(today.getFullYear()).slice(-2);
    const filename = `baocao_${reportDays}ngay_${dd}_${mm}_${yy}.doc`;
    const formatNum = (n: number) => String(n).padStart(2, "0");

    const masterRows: { stt: number; type: string; details: string; count: string; operator: string }[] = [];
    let counter = 1;

    boarList.forEach(b => {
      masterRows.push({
        stt: counter++,
        type: `Đực giống ${b.breed_id || ""}`,
        details: `Khai thác tinh dịch phối giống`,
        count: "01 con",
        operator: activeOperator
      });
    });

    sowList.forEach(s => {
      masterRows.push({
        stt: counter++,
        type: `Nái sinh sản ${s.breed_id || ""}`,
        details: `${formatVietnameseStage(s.stage)} (Ô: ${s.current_pen_code || "—"})`,
        count: "01 con",
        operator: activeOperator
      });
    });

    if (suckingPigletsCount > 0) {
      masterRows.push({
        stt: counter++,
        type: `Lợn con theo mẹ (Bú sữa)`,
        details: `Đang theo ${suckingLitters.length} nái mẹ`,
        count: `${formatNum(suckingPigletsCount)} con`,
        operator: activeOperator
      });
    }

    if (weanedPigletsCount > 0) {
      masterRows.push({
        stt: counter++,
        type: `Lợn con cai sữa (Tách mẹ)`,
        details: `Đã tách mẹ (${weanedLitters.length} lô)`,
        count: `${formatNum(weanedPigletsCount)} con`,
        operator: activeOperator
      });
    }

    let contentHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Báo Cáo</title></head>
      <body>
        <h2 style='text-align:center;'>TRẠI LỢN NÀ ROÁC</h2>
        <h3 style='text-align:center;'>BÁO CÁO CƠ CẤU ĐÀN (${reportDays} NGÀY QUA)</h3>
        <p style='text-align:center;'><i>Người thực hiện: ${activeOperator} - Ngày ${dd}/${mm}/20${yy}</i></p>
        <p><b>Tổng quy mô: ${formatNum(grandTotal)} con</b> (Nái: ${sowList.length} | Đực: ${boarList.length} | Lợn con: ${totalPigletsCount} | Lợn thịt: ${meatList.length}).</p>
        <table border='1' cellspacing='0' cellpadding='6' style='width:100%; border-collapse:collapse;'>
          <thead><tr style='background:#f2f2f2;'><th>STT</th><th>Phân loại</th><th>Chi tiết</th><th>Số lượng</th><th>Người làm</th></tr></thead>
          <tbody>
            ${masterRows.map(r => `<tr><td align='center'>${r.stt}</td><td>${r.type}</td><td>${r.details}</td><td align='center'>${r.count}</td><td align='center'>${r.operator}</td></tr>`).join("")}
          </tbody>
        </table>
      </body></html>
    `;

    const blob = new Blob([contentHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // RENDER THẺ CÁ THỂ: CHỈ CÒN DUY NHẤT 1 NÚT GỌN GÀNG "⚙️ HỒ SƠ & CHI TIẾT"
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
            ⚙️ Hồ Sơ & Chi Tiết
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
              <span style={{ color: "#3b82f6" }}>⏳ Ngày {gestation.daysPassed}/114 thai kỳ</span>
              <span style={{ color: "#64748b" }}>Dự sinh: {formatDateVN(gestation.expectedFarrowDate)}</span>
            </div>
            <div style={{ height: "6px", width: "100%", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gestation.pct}%`, background: "#3b82f6" }} />
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

  if (!mounted) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>Đang tải...</div>;

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
            {currentMenu === "PEDIGREE" && "GIA PHẢ ĐÀN"}
            {currentMenu === "GUIDE" && "QUY TRÌNH THÚ Y"}
            {currentMenu === "SEARCH" && "TRA CỨU"}
            {currentMenu === "SETTINGS" && "CÀI ĐẶT"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => setShowChangePwdModal(true)} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Đổi MK</button>
          {user ? (
            <button onClick={handleLogout} style={{ padding: "5px 8px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontSize: "11px", fontWeight: "700", color: "#ef4444", cursor: "pointer" }}>Thoát</button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: "5px 10px", borderRadius: "8px", border: "none", background: "#5b21b6", color: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Đăng nhập</button>
          )}
        </div>
      </header>

      {/* MENU TRƯỢT ☰ */}
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
              { k: "PEDIGREE", l: "Gia phả toàn đàn", icon: "🌳" },
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

      {/* NÚT THAO TÁC TAB SOW */}
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

          {/* BÁO CÁO CƠ CẤU ĐÀN (.DOC) */}
          <div style={{ backgroundColor: "#eff6ff", borderRadius: "14px", padding: "14px", marginBottom: "16px", border: "1px solid #bfdbfe" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: "900", color: "#1e40af" }}>📄 BÁO CÁO CƠ CẤU ĐÀN (.DOC)</span>
              <span style={{ fontSize: "11px", color: "#64748b" }}>1 bảng duy nhất</span>
            </div>

            <form onSubmit={handleSaveDisplayName} style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              <input
                type="text"
                placeholder="Tên người thực hiện..."
                value={inputDisplayName}
                onChange={(e) => setInputDisplayName(e.target.value)}
                style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
              />
              <button type="submit" style={{ padding: "6px 12px", background: "#5b21b6", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", fontSize: "11px", cursor: "pointer" }}>
                Lưu cố định
              </button>
            </form>

            <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
              {[7, 10, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setReportDays(d as any)}
                  style={{
                    flex: 1, padding: "7px 0", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight:
