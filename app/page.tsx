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

  // Modal Hồ Sơ Nái Hợp Nhất
  const [activeProfilePig, setActiveProfilePig] = useState<Pig | null>(null);
  const [profileTab, setProfileTab] = useState<"EDIT" | "REPRO" | "PEDIGREE">("EDIT");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Form lứa đẻ
  const [showLitterForm, setShowLitterForm] = useState(false);
  const [editingLitterId, setEditingLitterId] = useState<string | null>(null);
  const [litterFormData, setLitterFormData] = useState({
    litter_code: "",
    farrow_date: new Date().toISOString().split("T")[0],
    alive_born: 10,
    boar_used: "",
    notes: ""
  });

  // Task Modal & Thao tác
  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Modal Phối giống
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
          const parsedDone = JSON.parse(savedDone);
          if (Array.isArray(parsedDone)) setCompletedTaskKeys(parsedDone);
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

  // HÀM CAI SỮA
  const executeWeaning = async (sowTag: string, litterId?: string, litterCount?: number) => {
    const cleanTag = sowTag.trim().toUpperCase();
    if (!confirm(`Xác nhận cai sữa cho đàn con nái ${cleanTag} (${litterCount || ""} con)?\n- Nái mẹ sẽ chuyển sang "Chờ phối".\n- Đàn con chuyển sang nhóm "Đã cai sữa".`)) {
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];

    try {
      await supabase.from("pigs").update({ stage: "Chờ phối" }).eq("ear_tag", cleanTag);
      let q = supabase.from("farrowings").update({ status: "DA_CAI_SUA", weaning_date: todayStr, notes: "Đã cai sữa" });
      if (litterId) q = q.eq("id", litterId);
      else q = q.eq("sow_ear_tag", cleanTag);
      await q;

      await logAction("WEAN_LITTER", cleanTag, `Cai sữa đàn con nái ${cleanTag} (${litterCount || ""} con)`);
      alert(`✅ Đã cai sữa thành công đàn nái ${cleanTag}!`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi khi cập nhật cai sữa: " + (err?.message || JSON.stringify(err)));
    }
  };

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

      await logAction("UPDATE_PIG", cleanTag, `Cập nhật thông tin nái ${cleanTag} sang "${updatedPayload.stage}", ô "${updatedPayload.current_pen_code}"`);
      alert(`✅ Đã lưu thành công! Nái ${cleanTag} hiện có trạng thái: "${updatedPayload.stage}".`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu nái: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // THÊM/SỬA LỨA ĐẺ
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
        await supabase.from("farrowings").update(payload).eq("id", editingLitterId);
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
        await supabase.from("farrowings").insert([payload]);
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
      await supabase.from("farrowings").delete().eq("id", litterId);
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

  // =========================================================================
  // XỬ LÝ NHIỆM VỤ THÔNG MINH:
  // NẾU NÁI ĐÃ Ở Ô CHUỒNG ĐẺ (CD1, CD2,...) -> TỰ ĐỘNG XEM NHƯ ĐÃ XONG VÀ ẨN ĐI
  // =========================================================================
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
        
        // KIỂM TRA: NẾU NÁI NÀY ĐÃ Ở Ô CHUỒNG ĐẺ (CD1, CD2 HOẶC CHỨA CHỮ ĐẺ)
        const currentSow = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === tagUpper);
        const currentPen = (currentSow?.current_pen_code || "").toUpperCase();
        const alreadyInFarrowingPen = currentPen.includes("CD") || currentPen.includes("DE");

        taskMap.set(key, {
          id: key,
          title: `[CHUẨN BỊ ĐẺ] Chuyển nái ${ins.sow_ear_tag} lên chuồng đẻ & sát trùng vú`,
          due_date: safeAddDays(ins.mating_date, 107),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          // Đã ở ô đẻ hoặc đã tích xong -> xem như xong
          is_completed: completedTaskKeys.includes(key) || alreadyInFarrowingPen,
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
  }, [inseminations, dbTasks, completedTaskKeys, safePigs]);

  const filteredTasks = fullTasks.filter(t => taskCategoryFilter === "ALL" || t?.category === taskCategoryFilter);
  const pendingTasks = filteredTasks.filter(t => !t.is_completed);
  const completedTasks = filteredTasks.filter(t => t.is_completed);

  // XÁC NHẬN HOÀN THÀNH NHIỆM VỤ (BẤM LÀ ĂN NGAY)
  const confirmCompleteTask = async () => {
    if (!selectedTask) return;
    const taskKey = selectedTask.id;
    const sowTag = selectedTask.related_tag?.trim().toUpperCase();

    // 1. Lưu key hoàn thành vào máy
    const newDone = Array.from(new Set([...completedTaskKeys, taskKey]));
    setCompletedTaskKeys(newDone);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_done_task_keys", JSON.stringify(newDone)); } catch (e) {}
    }

    // 2. Nếu là việc chuyển lên chuồng đẻ -> tự động đổi chuồng nái sang CD1
    if (selectedTask.id.startsWith("repro-cd-") && sowTag) {
      await supabase.from("pigs").update({ current_pen_code: "CD1" }).eq("ear_tag", sowTag);
      setPigs(prev => prev.map(p => (p.ear_tag || "").trim().toUpperCase() === sowTag ? { ...p, current_pen_code: "CD1" } : p));
    }

    // 3. Ghi vào database
    try {
      await supabase.from("farm_tasks").insert([{
        title: selectedTask.title,
        due_date: selectedTask.due_date,
        related_tag: selectedTask.related_tag,
        category: selectedTask.category,
        is_completed: true,
        is_dismissed: false
      }]);
    } catch (e) {}

    await logAction("COMPLETE_TASK", selectedTask.related_tag || "TASK", `Xong việc: ${selectedTask.title}`);
    alert(`✅ Đã xác nhận hoàn thành công việc!`);
    setShowTaskModal(false);
    setSelectedTask(null);
    await fetchData();
  };

  // RENDER THẺ CÁ THỂ: CỠ CHỮ TO RÕ RÀNG
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
          padding: "16px 18px",
          border: "1.5px solid #e2e8f0",
          boxShadow: "0 2px 5px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "21px", fontWeight: "900", color: "#1e1b4b", letterSpacing: "0.5px" }}>
            {pig.ear_tag}
          </span>
          
          <button
            onClick={() => {
              setActiveProfilePig({ ...pig });
              setProfileTab("EDIT");
              setShowLitterForm(false);
            }}
            style={{
              fontSize: "13px", fontWeight: "800", padding: "7px 16px", borderRadius: "10px",
              background: "#ede9fe", color: "#6d28d9", border: "1.5px solid #ddd6fe", cursor: "pointer"
            }}
          >
            ⚙️ Hồ Sơ & Chi Tiết
          </button>
        </div>

        <div style={{ fontSize: "14px", color: "#334155" }}>
          Giống: <strong style={{ color: "#0f172a" }}>{pig.breed_id || "—"}</strong> | Giới tính: <strong>{formatVietnameseSex(pig.sex)}</strong>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
          <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "13px", background: "#f1f5f9", fontWeight: "700", color: "#1e293b" }}>
            Ô: {pig.current_pen_code || "Chưa xếp"}
          </span>
          <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "13px", background: "#ecfdf5", color: "#047857", fontWeight: "800" }}>
            {formatVietnameseStage(pig.stage)}
          </span>
          {isThisSow && (
            <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "13px", background: "#eff6ff", color: "#1d4ed8", fontWeight: "800" }}>
              Đã đẻ: {reproData?.totalLitters || 0} lứa
            </span>
          )}
        </div>

        {gestation && (
          <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginTop: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "800", marginBottom: "6px" }}>
              <span style={{ color: gestation.badgeColor }}>⏳ Ngày {gestation.daysPassed}/114 thai kỳ</span>
              <span style={{ color: "#475569" }}>Dự sinh: {formatDateVN(gestation.expectedFarrowDate)}</span>
            </div>
            <div style={{ height: "8px", width: "100%", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gestation.pct}%`, background: gestation.badgeColor }} />
            </div>
          </div>
        )}

        <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: "8px", marginTop: "4px", fontSize: "13px", color: "#475569", display: "flex", justifyContent: "space-between" }}>
          <span>Bố: <strong style={{ color: "#1e40af" }}>{pig.sire_ear_tag || "—"}</strong></span>
          <span>Mẹ: <strong style={{ color: "#b91c1c" }}>{pig.dam_ear_tag || "—"}</strong></span>
        </div>
      </div>
    );
  };

  if (!mounted) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>Đang tải...</div>;

  const sowPct = grandTotal > 0 ? ((sowList.length / grandTotal) * 100).toFixed(0) : "0";
  const boarPct = grandTotal > 0 ? ((boarList.length / grandTotal) * 100).toFixed(0) : "0";
  const pigletPct = grandTotal > 0 ? ((totalPigletsCount / grandTotal) * 100).toFixed(0) : "0";
  const meatPct = grandTotal > 0 ? ((meatList.length / grandTotal) * 100).toFixed(0) : "0";

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto", position: "relative", paddingBottom: "75px" }}>
      
      {/* HEADER */}
      <header style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => setIsSidebarOpen(true)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>☰</button>
          <h1 style={{ fontSize: "19px", fontWeight: "900", margin: 0, color: "#1e1b4b" }}>
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
          <button onClick={() => setShowChangePwdModal(true)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Đổi MK</button>
          {user ? (
            <button onClick={handleLogout} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontSize: "12px", fontWeight: "800", color: "#ef4444", cursor: "pointer" }}>Thoát</button>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: "#5b21b6", color: "#fff", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Đăng nhập</button>
          )}
        </div>
      </header>

      {/* MENU TRƯỢT ☰ */}
      {isSidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
          <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
          <div style={{ width: "270px", backgroundColor: "#fff", height: "100%", zIndex: 101, padding: "20px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <h2 style={{ margin: "0 0 10px 0", color: "#5b21b6", fontSize: "20px", fontWeight: "900" }}>Trại Lợn Nà Roác</h2>
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
                  display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", border: "none",
                  background: currentMenu === item.k ? "#ede9fe" : "none",
                  color: currentMenu === item.k ? "#5b21b6" : "#334155",
                  fontWeight: currentMenu === item.k ? "900" : "700",
                  fontSize: "15px", cursor: "pointer", textAlign: "left"
                }}
              >
                <span style={{ fontSize: "18px" }}>{item.icon}</span>
                <span>{item.l}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* NÚT THAO TÁC TAB SOW */}
      {currentMenu === "SOW" && (
        <div style={{ padding: "12px 16px 0 16px", display: "flex", gap: "8px" }}>
          <button onClick={() => setShowAddPigModal(true)} style={{ flex: 1, padding: "11px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "900", fontSize: "13px", cursor: "pointer" }}>
            + Thêm nái mới
          </button>
          <button onClick={() => setShowMatingModal(true)} style={{ flex: 1, padding: "11px", borderRadius: "10px", background: "#7c3aed", color: "#fff", border: "none", fontWeight: "900", fontSize: "13px", cursor: "pointer" }}>
            🔬 Phối giống (Tránh cận huyết)
          </button>
        </div>
      )}

      {/* 1. MÀN HÌNH TỔNG QUAN */}
      {currentMenu === "OVERVIEW" && (
        <div style={{ padding: "16px" }}>
          
          {/* QUY MÔ TRANG TRẠI */}
          <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", borderRadius: "16px", padding: "18px 20px", marginBottom: "16px", color: "#fff" }}>
            <div style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#a5b4fc" }}>Quy mô trang trại</div>
            <div style={{ fontSize: "28px", fontWeight: "900", margin: "4px 0 8px 0" }}>{grandTotal} <span style={{ fontSize: "16px", color: "#c7d2fe" }}>cá thể</span></div>
            <div style={{ height: "8px", width: "100%", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "4px", overflow: "hidden", display: "flex", margin: "8px 0" }}>
              <div style={{ width: `${sowPct}%`, backgroundColor: "#ec4899" }} />
              <div style={{ width: `${boarPct}%`, backgroundColor: "#3b82f6" }} />
              <div style={{ width: `${pigletPct}%`, backgroundColor: "#10b981" }} />
              <div style={{ width: `${meatPct}%`, backgroundColor: "#eab308" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#cbd5e1", fontWeight: "700" }}>
              <span>● Nái: {sowList.length}</span>
              <span>● Đực: {boarList.length}</span>
              <span>● Con: {totalPigletsCount}</span>
              <span>● Thịt: {meatList.length}</span>
            </div>
          </div>

          {/* BÁO CÁO CƠ CẤU ĐÀN (.DOC) */}
          <div style={{ backgroundColor: "#eff6ff", borderRadius: "14px", padding: "16px", marginBottom: "18px", border: "1.5px solid #bfdbfe" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "900", color: "#1e40af" }}>📄 BÁO CÁO CƠ CẤU ĐÀN (.DOC)</span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>1 bảng duy nhất</span>
            </div>

            <form onSubmit={handleSaveDisplayName} style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                type="text"
                placeholder="Tên người thực hiện..."
                value={inputDisplayName}
                onChange={(e) => setInputDisplayName(e.target.value)}
                style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
              <button type="submit" style={{ padding: "8px 14px", background: "#5b21b6", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}>
                Lưu cố định
              </button>
            </form>

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              {[7, 10, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setReportDays(d as any)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer",
                    background: reportDays === d ? "#2563eb" : "#dbeafe",
                    color: reportDays === d ? "#fff" : "#1e40af"
                  }}
                >
                  {d} ngày qua
                </button>
              ))}
            </div>
            <button
              onClick={handleExportWord}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "#1d4ed8", color: "#fff", border: "none", fontWeight: "900", fontSize: "13px", cursor: "pointer" }}
            >
              📥 Tải File Word Báo Cáo ({reportDays} ngày)
            </button>
          </div>

          {/* 4 Ô CƠ CẤU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "22px" }}>
            <div onClick={() => { setCurrentMenu("SOW"); setSubFilter("ALL"); }} style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "16px", cursor: "pointer", border: "1.5px solid #fce7f3" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowList.length} con</div>
              <div style={{ fontSize: "12px", color: "#334155", lineHeight: "1.7" }}>
                <div>• Chửa: <strong>{sowList.filter(p => checkSowState(p) === "CHUA").length}</strong> con</div>
                <div>• Nuôi con: <strong>{sowList.filter(p => checkSowState(p) === "NUOICON").length}</strong> con</div>
                <div>• Chờ phối: <strong>{sowList.filter(p => checkSowState(p) === "CHOPHOI").length}</strong> con</div>
                <div>• Hậu bị: <strong style={{ color: "#7c3aed" }}>{sowList.filter(p => checkSowState(p) === "HAUBI").length}</strong> con</div>
              </div>
            </div>

            <div onClick={() => setCurrentMenu("BOAR")} style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "16px", cursor: "pointer", border: "1.5px solid #dbeafe" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarList.length} con</div>
              <div style={{ fontSize: "12px", color: "#334155" }}>• Đang khai thác tinh</div>
            </div>

            <div onClick={() => setCurrentMenu("PIGLET")} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "16px", cursor: "pointer", border: "1.5px solid #dcfce7" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{totalPigletsCount} con</div>
              <div style={{ fontSize: "12px", color: "#334155", lineHeight: "1.7" }}>
                <div>• Theo mẹ: <strong>{suckingPigletsCount}</strong> con</div>
                <div>• Cai sữa: <strong>{weanedPigletsCount}</strong> con</div>
              </div>
            </div>

            <div onClick={() => setCurrentMenu("MEAT")} style={{ backgroundColor: "#fefce8", borderRadius: "16px", padding: "16px", cursor: "pointer", border: "1.5px solid #fef08a" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatList.length} con</div>
              <div style={{ fontSize: "12px", color: "#334155" }}>• Đang vỗ béo</div>
            </div>
          </div>

          {/* DANH SÁCH VIỆC CẦN LÀM */}
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 10px 0" }}>
              🔔 VIỆC CẦN LÀM ({pendingTasks.length})
            </h3>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px", overflowX: "auto" }}>
              {[{ id: "ALL", label: "Tất cả" }, { id: "VET", label: "Thú y" }, { id: "REPRO", label: "Sinh sản" }, { id: "WEAN", label: "Cai sữa" }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTaskCategoryFilter(tab.id)}
                  style={{
                    padding: "7px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer",
                    backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#e2e8f0",
                    color: taskCategoryFilter === tab.id ? "#fff" : "#475569"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "22px" }}>
              {pendingTasks.length === 0 ? (
                <div style={{ padding: "14px", textAlign: "center", background: "#fff", borderRadius: "10px", fontSize: "13px", color: "#64748b" }}>
                  ✨ Không có công việc nào tồn đọng.
                </div>
              ) : (
                pendingTasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTask(t); setShowTaskModal(true); }}
                    style={{ background: "#fff", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e1b4b" }}>{t.title}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                        Hạn: <b>{formatDateVN(t.due_date)}</b> {t.related_tag && `(Tai: ${t.related_tag})`}
                      </div>
                    </div>
                    <span style={{ fontSize: "18px", color: "#2563eb" }}>👉 ⚪</span>
                  </div>
                ))
              )}
            </div>

            {/* DANH SÁCH VIỆC ĐÃ HOÀN THÀNH */}
            {completedTasks.length > 0 && (
              <div>
                <h4 style={{ fontSize: "15px", fontWeight: "900", color: "#047857", margin: "0 0 10px 0" }}>
                  ✅ CÔNG VIỆC ĐÃ LÀM XONG ({completedTasks.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {completedTasks.map(t => (
                    <div key={t.id} style={{ background: "#f0fdf4", padding: "10px 14px", borderRadius: "10px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "800", color: "#166534", textDecoration: "line-through" }}>{t.title}</div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>Đã xong (Hạn: {formatDateVN(t.due_date)})</div>
                      </div>
                      <span style={{ fontSize: "18px" }}>🟢</span>
                    </div>
                  ))}
                </div>
              </div>
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
                  padding: "9px 14px", borderRadius: "20px", border: "none", fontSize: "13px", fontWeight: "800", cursor: "pointer",
                  backgroundColor: subFilter === tab.id ? "#db2777" : "#fff",
                  color: subFilter === tab.id ? "#fff" : "#475569"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {sowList.filter(p => (subFilter === "ALL" ? true : checkSowState(p) === subFilter)).map(renderPigCard)}
          </div>
        </div>
      )}

      {/* 3. TAB ĐỰC */}
      {currentMenu === "BOAR" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "15px", fontWeight: "900", color: "#2563eb", marginBottom: "12px" }}>ĐÀN ĐỰC GIỐNG ({boarList.length} CON)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{boarList.map(renderPigCard)}</div>
        </div>
      )}

      {/* 4. TAB LỢN CON THEO LÔ */}
      {currentMenu === "PIGLET" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "15px", fontWeight: "900", color: "#16a34a", marginBottom: "14px" }}>
            TỔNG ĐÀN CON: {totalPigletsCount} CON (Theo mẹ: {suckingPigletsCount} • Cai sữa: {weanedPigletsCount})
          </div>

          <h4 style={{ fontSize: "14px", fontWeight: "900", color: "#ea580c", margin: "0 0 10px 0" }}>🍼 LỢN CON THEO MẸ ({suckingPigletsCount} CON)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
            {suckingLitters.map(lit => (
              <div key={lit.id} style={{ background: "#fff", padding: "14px", borderRadius: "12px", border: "1.5px solid #fed7aa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: "15px" }}>
                  <span>Lô nái {lit.sow_ear_tag} ({lit.litter_code})</span>
                  <span style={{ color: "#047857" }}>{lit.alive_born} con</span>
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", margin: "6px 0" }}>Ngày đẻ: {formatDateVN(lit.farrow_date)}</div>
                <button
                  onClick={() => executeWeaning(lit.sow_ear_tag, lit.id, lit.alive_born)}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#0f172a", color: "#fff", border: "none", fontSize: "13px", fontWeight: "800", cursor: "pointer", marginTop: "4px" }}
                >
                  ✓ Cai sữa đàn này
                </button>
              </div>
            ))}
          </div>

          {weanedLitters.length > 0 && (
            <div>
              <h4 style={{ fontSize: "14px", fontWeight: "900", color: "#047857", margin: "0 0 10px 0" }}>✅ LỢN CON ĐÃ CAI SỮA ({weanedPigletsCount} CON)</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {weanedLitters.map(lit => (
                  <div key={lit.id} style={{ background: "#f0fdf4", padding: "14px", borderRadius: "12px", border: "1.5px solid #bbf7d0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: "15px", color: "#166534" }}>
                      <span>Lô nái {lit.sow_ear_tag} ({lit.litter_code})</span>
                      <span>{lit.alive_born} con</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b", margin: "4px 0" }}>Cai sữa: {formatDateVN(lit.weaning_date)} {lit.notes && `• ${lit.notes}`}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB THỊT */}
      {currentMenu === "MEAT" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "15px", fontWeight: "900", color: "#854d0e", marginBottom: "12px" }}>ĐÀN LỢN THỊT ({meatList.length} CON)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{meatList.map(renderPigCard)}</div>
        </div>
      )}

      {/* 6. GIA PHẢ TOÀN ĐÀN */}
      {currentMenu === "PEDIGREE" && (
        <div style={{ padding: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "900", color: "#5b21b6" }}>🌳 CÂY PHẢ HỆ TOÀN ĐÀN</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {safePigs.filter(p => !isIndividualPiglet(p)).map(pig => (
              <div key={pig.id} style={{ background: "#fff", padding: "12px 16px", borderRadius: "12px", border: "1px solid #f1e5f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b style={{ fontSize: "16px" }}>{pig.ear_tag}</b> ({pig.breed_id}) - {pig.stage}
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>Bố: {pig.sire_ear_tag || "—"} • Mẹ: {pig.dam_ear_tag || "—"}</div>
                </div>
                <button
                  onClick={() => {
                    setActiveProfilePig({ ...pig });
                    setProfileTab("PEDIGREE");
                  }}
                  style={{ padding: "6px 12px", borderRadius: "8px", background: "#ede9fe", color: "#6d28d9", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                >
                  Xem gia phả 🌳
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. QUY TRÌNH THÚ Y */}
      {currentMenu === "GUIDE" && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: "#1e40af" }}>🩺 LỊCH VACCINE PHÒNG BỆNH</h3>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0", fontSize: "13px", lineHeight: "1.8" }}>
            <b>• 3 ngày tuổi:</b> Tiêm Sắt + Nhỏ Cầu trùng.<br/>
            <b>• 7 - 10 ngày:</b> Tiêm Suyễn lợn mũi 1.<br/>
            <b>• 14 - 16 ngày:</b> Tiêm Phù đầu / Phân trắng.<br/>
            <b>• 21 ngày:</b> Tiêm nhắc lại Suyễn mũi 2 hoặc Tai xanh.<br/>
            <b>• 35 ngày:</b> Tiêm Dịch tả lợn cổ điển mũi 1.<br/>
            <b>• 45 ngày:</b> Tiêm Lở mồm long móng (FMD).
          </div>
        </div>
      )}

      {/* 8. TRA CỨU */}
      {currentMenu === "SEARCH" && (
        <div style={{ padding: "16px" }}>
          <input placeholder="Gõ số tai..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", boxSizing: "border-box", marginBottom: "14px", fontSize: "14px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {safePigs.filter(p => !isIndividualPiglet(p)).filter(p => String(p?.ear_tag || "").toLowerCase().includes(searchQuery.toLowerCase())).map(renderPigCard)}
          </div>
        </div>
      )}

      {/* 9. CÀI ĐẶT & NHẬT KÝ */}
      {currentMenu === "SETTINGS" && (
        <div style={{ padding: "16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0", marginBottom: "16px", fontSize: "14px" }}>
            <b>Người vận hành:</b> {activeOperator}
          </div>
          <h4 style={{ margin: "0 0 10px 0", fontSize: "15px" }}>Nhật ký thao tác gần đây</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {auditLogs.slice(0, 15).map(l => (
              <div key={l.id} style={{ background: "#fff", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                <b>{l.performed_by}:</b> {l.details}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG (BOTTOM NAVIGATION) */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "58px", backgroundColor: "#fff", borderTop: "1.5px solid #e2e8f0", display: "flex", justifyContent: "space-around", alignItems: "center", zIndex: 40, maxWidth: "480px", margin: "0 auto" }}>
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
              fontWeight: currentMenu === tab.k ? "900" : "600", fontSize: "12px", gap: "2px"
            }}
          >
            <span style={{ fontSize: "19px" }}>{tab.icon}</span>
            <span>{tab.l}</span>
          </button>
        ))}
      </nav>

      {/* ========================================================================= */}
      {/* 🎯 MODAL XÁC NHẬN CÔNG VIỆC: BẤM LÀ HOÀN TẤT ĂN NGAY                      */}
      {/* ========================================================================= */}
      {showTaskModal && selectedTask && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "380px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>
              Xác Nhận Công Việc
            </h3>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#334155", marginBottom: "8px", lineHeight: "1.4" }}>
              {selectedTask.title}
            </div>
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "18px" }}>
              Hạn: <b>{formatDateVN(selectedTask.due_date)}</b> {selectedTask.related_tag && `(Tai: ${selectedTask.related_tag})`}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={confirmCompleteTask}
                style={{ padding: "12px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "900", fontSize: "14px", cursor: "pointer" }}
              >
                ✓ Xác Nhận Đã Làm Xong
              </button>
              <button
                onClick={() => { setShowTaskModal(false); setSelectedTask(null); }}
                style={{ padding: "10px", borderRadius: "10px", background: "#f1f5f9", color: "#475569", border: "none", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
              >
                Chưa Làm / Đóng Lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎯 MODAL HỒ SƠ TỔNG HỢP: SỬA + SINH SẢN + GIA PHẢ 2 CHIỀU                   */}
      {/* ========================================================================= */}
      {activeProfilePig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "450px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "18px" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "#1e1b4b" }}>
                  Hồ Sơ: {activeProfilePig.ear_tag}
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Giống: {activeProfilePig.breed_id} • Ô: {activeProfilePig.current_pen_code}</span>
              </div>
              <button onClick={() => setActiveProfilePig(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontWeight: "900", fontSize: "14px" }}>✕</button>
            </div>

            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "10px", padding: "4px", marginBottom: "14px" }}>
              {[
                { k: "EDIT", label: "📝 Sửa & Trạng Thái" },
                { k: "REPRO", label: "📊 Sinh Sản" },
                { k: "PEDIGREE", label: "🌳 Gia Phả 2 Chiều" }
              ].map(t => (
                <button
                  key={t.k}
                  onClick={() => setProfileTab(t.k as any)}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: "900", cursor: "pointer",
                    background: profileTab === t.k ? "#fff" : "transparent",
                    color: profileTab === t.k ? "#5b21b6" : "#64748b",
                    boxShadow: profileTab === t.k ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px" }}>
              
              {/* TAB 1: SỬA THÔNG TIN */}
              {profileTab === "EDIT" && (
                <form onSubmit={handleSaveProfileEdit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "800" }}>Số tai (*):</label>
                      <input
                        required
                        value={activeProfilePig.ear_tag}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, ear_tag: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "14px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "800" }}>Giống:</label>
                      <select
                        value={activeProfilePig.breed_id || config.breeds[0]}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, breed_id: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      >
                        {config.breeds.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ background: "#fdf2f4", padding: "12px", borderRadius: "10px", border: "1px solid #fce7f3" }}>
                    <label style={{ fontSize: "12px", fontWeight: "900", color: "#db2777" }}>Trạng thái sinh sản hiện tại (*):</label>
                    <select
                      value={activeProfilePig.stage}
                      onChange={(e) => setActiveProfilePig({ ...activeProfilePig, stage: e.target.value })}
                      style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1.5px solid #f472b6", marginTop: "6px", fontWeight: "900", fontSize: "14px" }}
                    >
                      <option value="Đang chửa">🤰 Đang chửa</option>
                      <option value="Nuôi con">🍼 Nuôi con</option>
                      <option value="Chờ phối">⏳ Chờ phối</option>
                      <option value="Hậu bị">🐖 Hậu bị</option>
                    </select>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "800" }}>Ô Chuồng:</label>
                      <select
                        value={activeProfilePig.current_pen_code || config.pens[0]}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, current_pen_code: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      >
                        {config.pens.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "800" }}>Thể trạng:</label>
                      <input
                        value={activeProfilePig.status || "Bình thường"}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, status: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "14px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "800", color: "#1e40af" }}>Số tai Bố:</label>
                      <input
                        placeholder="Chưa rõ"
                        value={activeProfilePig.sire_ear_tag || ""}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, sire_ear_tag: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "13px" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "12px", fontWeight: "800", color: "#b91c1c" }}>Số tai Mẹ:</label>
                      <input
                        placeholder="Chưa rõ"
                        value={activeProfilePig.dam_ear_tag || ""}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, dam_ear_tag: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "13px" }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    style={{ padding: "12px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "900", fontSize: "14px", cursor: "pointer", marginTop: "6px" }}
                  >
                    {isSavingEdit ? "Đang lưu..." : "💾 Lưu Thay Đổi Nái"}
                  </button>
                </form>
              )}

              {/* TAB 2: SINH SẢN */}
              {profileTab === "REPRO" && (() => {
                const analysis = getSowReproAnalysis(activeProfilePig.ear_tag);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
                      <div style={{ background: "#fdf2f4", padding: "10px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "11px", color: "#db2777", fontWeight: "800" }}>TỔNG LỨA</div>
                        <b style={{ fontSize: "18px" }}>{analysis.totalLitters}</b>
                      </div>
                      <div style={{ background: "#eff6ff", padding: "10px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "11px", color: "#2563eb", fontWeight: "800" }}>TỔNG CON</div>
                        <b style={{ fontSize: "18px" }}>{analysis.totalBorn}</b>
                      </div>
                      <div style={{ background: "#ecfdf5", padding: "10px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "11px", color: "#059669", fontWeight: "800" }}>TB/LỨA</div>
                        <b style={{ fontSize: "18px" }}>{analysis.avgBorn}</b>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                      <b style={{ fontSize: "14px" }}>Danh sách lứa đẻ:</b>
                      <button
                        onClick={() => {
                          setEditingLitterId(null);
                          setLitterFormData({
                            litter_code: `L${analysis.totalLitters + 1}`,
                            farrow_date: new Date().toISOString().split("T")[0],
                            alive_born: 10,
                            boar_used: "",
                            notes: ""
                          });
                          setShowLitterForm(true);
                        }}
                        style={{ padding: "6px 10px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                      >
                        + Bổ sung lứa
                      </button>
                    </div>

                    {showLitterForm && (
                      <form onSubmit={handleSaveLitter} style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "900", color: "#059669" }}>{editingLitterId ? "✎ Sửa lứa đẻ" : "+ Thêm lứa đẻ"}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <input required placeholder="Mã lứa (VD: L1...)" value={litterFormData.litter_code} onChange={e => setLitterFormData({ ...litterFormData, litter_code: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }} />
                          <input placeholder="Đực phối" value={litterFormData.boar_used} onChange={e => setLitterFormData({ ...litterFormData, boar_used: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <input type="date" required value={litterFormData.farrow_date} onChange={e => setLitterFormData({ ...litterFormData, farrow_date: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }} />
                          <input type="number" required min="1" max="30" value={litterFormData.alive_born} onChange={e => setLitterFormData({ ...litterFormData, alive_born: Number(e.target.value) })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button type="button" onClick={() => setShowLitterForm(false)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px" }}>Hủy</button>
                          <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontSize: "12px", fontWeight: "800" }}>Lưu lứa</button>
                        </div>
                      </form>
                    )}

                    {analysis.sowLitters.map((l, idx) => (
                      <div key={l.id} style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800", fontSize: "13px" }}>
                          <span>Lứa {idx + 1} ({formatDateVN(l.farrow_date)})</span>
                          <span style={{ color: "#059669" }}>{l.alive_born} con</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b", margin: "3px 0" }}>Ghi chú: {l.notes || "—"}</div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                          <button
                            onClick={() => {
                              setEditingLitterId(l.id);
                              setLitterFormData({
                                litter_code: l.litter_code || `Lứa ${idx + 1}`,
                                farrow_date: l.farrow_date,
                                alive_born: Number(l.alive_born || 0),
                                boar_used: "",
                                notes: l.notes || ""
                              });
                              setShowLitterForm(true);
                            }}
                            style={{ padding: "4px 8px", borderRadius: "6px", background: "#ede9fe", color: "#6d28d9", border: "none", fontSize: "11px", fontWeight: "800" }}
                          >
                            ✎ Sửa
                          </button>
                          <button
                            onClick={() => handleDeleteLitter(l.id, l.litter_code || `Lứa ${idx + 1}`)}
                            style={{ padding: "4px 8px", borderRadius: "6px", background: "#fef2f2", color: "#ef4444", border: "none", fontSize: "11px", fontWeight: "800" }}
                          >
                            ✕ Xóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* TAB 3: GIA PHẢ 2 CHIỀU */}
              {profileTab === "PEDIGREE" && (() => {
                const tagUpper = activeProfilePig.ear_tag.trim().toUpperCase();
                const sire = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === (activeProfilePig.sire_ear_tag || "").trim().toUpperCase());
                const dam = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === (activeProfilePig.dam_ear_tag || "").trim().toUpperCase());
                const childPigs = safePigs.filter(p => (p.dam_ear_tag || "").trim().toUpperCase() === tagUpper && p.id !== activeProfilePig.id);
                const childLitters = (Array.isArray(litters) ? litters : []).filter(l => (l.sow_ear_tag || "").trim().toUpperCase() === tagUpper);

                return (
                  <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* KHỐI TỔ TIÊN */}
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "12px", fontWeight: "900", color: "#475569", marginBottom: "8px" }}>▲ THẾ HỆ TRƯỚC (BỐ MẸ)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div style={{ background: "#eff6ff", padding: "10px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                          <div style={{ fontSize: "11px", color: "#1d4ed8", fontWeight: "800" }}>BỐ (ĐỰC)</div>
                          <div style={{ fontSize: "16px", fontWeight: "900", color: "#1e3a8a" }}>{activeProfilePig.sire_ear_tag || "Chưa rõ"}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{sire ? `Giống: ${sire.breed_id}` : "Nhập ngoài"}</div>
                        </div>
                        <div style={{ background: "#fdf2f4", padding: "10px", borderRadius: "8px", border: "1px solid #fbcfe8" }}>
                          <div style={{ fontSize: "11px", color: "#be185d", fontWeight: "800" }}>MẸ (NÁI)</div>
                          <div style={{ fontSize: "16px", fontWeight: "900", color: "#831843" }}>{activeProfilePig.dam_ear_tag || "Chưa rõ"}</div>
                          <div style={{ fontSize: "11px", color: "#64748b" }}>{dam ? `Giống: ${dam.breed_id}` : "Nhập ngoài"}</div>
                        </div>
                      </div>
                    </div>

                    {/* CÁ THỂ HIỆN TẠI */}
                    <div style={{ background: "#ede9fe", padding: "10px", borderRadius: "10px", textAlign: "center", border: "1.5px solid #a78bfa" }}>
                      <div style={{ fontSize: "11px", color: "#6d28d9", fontWeight: "800" }}>CÁ THỂ HIỆN TẠI</div>
                      <div style={{ fontSize: "18px", fontWeight: "900", color: "#4c1d95" }}>{activeProfilePig.ear_tag}</div>
                      <div style={{ fontSize: "12px", color: "#5b21b6", fontWeight: "700" }}>Giống: {activeProfilePig.breed_id} • {activeProfilePig.stage}</div>
                    </div>

                    {/* KHỐI HẬU DUỆ */}
                    <div style={{ background: "#f0fdf4", padding: "12px", borderRadius: "10px", border: "1.5px solid #bbf7d0" }}>
                      <div style={{ fontSize: "12px", fontWeight: "900", color: "#15803d", marginBottom: "8px" }}>
                        ▼ THẾ HỆ SAU: ĐÀN CON ĐÃ TUYỂN CHỌN ({childPigs.length} CÁ THỂ)
                      </div>
                      
                      {childPigs.length === 0 ? (
                        <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>
                          Chưa có con nào được chọn làm giống/thịt riêng rẽ.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {childPigs.map(cp => (
                            <div key={cp.id} style={{ background: "#fff", padding: "8px 10px", borderRadius: "8px", border: "1px solid #dcfce7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <b style={{ fontSize: "14px" }}>{cp.ear_tag}</b> ({formatVietnameseSex(cp.sex)}) - <span style={{ color: "#047857", fontWeight: "800" }}>{cp.stage}</span>
                              </div>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Ô: {cp.current_pen_code || "—"}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ fontSize: "12px", fontWeight: "900", color: "#15803d", marginTop: "10px", marginBottom: "6px" }}>
                        CÁC LỨA ĐẺ / LÔ CON ({childLitters.length} LỨA):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {childLitters.map(cl => (
                          <div key={cl.id} style={{ background: "#fff", padding: "8px 10px", borderRadius: "8px", border: "1px solid #dcfce7", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                            <span>Lứa {cl.litter_code} (Đẻ {formatDateVN(cl.farrow_date)})</span>
                            <b>{cl.alive_born} con ({cl.status || "Đã cai sữa"})</b>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                );
              })()}

            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "12px", textAlign: "right" }}>
              <button onClick={() => setActiveProfilePig(null)} style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ĐỔI MẬT KHẨU */}
      {showChangePwdModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "320px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900" }}>Đổi Mật Khẩu</h3>
            {changePwdMsg && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "6px" }}>{changePwdMsg}</div>}
            <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input type="password" required placeholder="Mật khẩu mới (>= 6 ký tự)..." value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowChangePwdModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "800" }}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PHỐI GIỐNG */}
      {showMatingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "360px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#5b21b6" }}>🔬 Lập Kế Hoạch Phối Giống</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!matingSowTag || !selectedBoarTag) return;
              const expFarrow = safeAddDays(matingDate, 114);
              await supabase.from("inseminations").insert([{
                sow_ear_tag: matingSowTag.trim().toUpperCase(),
                boar_ear_tag: selectedBoarTag.trim().toUpperCase(),
                mating_date: matingDate,
                expected_farrow_date: expFarrow,
                status: "Đã phối"
              }]);
              await supabase.from("pigs").update({ stage: "Đang chửa" }).eq("ear_tag", matingSowTag);
              alert("Đã ghi nhận phối giống!");
              setShowMatingModal(false);
              await fetchData();
            }} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <select required value={matingSowTag} onChange={e => setMatingSowTag(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}>
                <option value="">-- Chọn Nái --</option>
                {sowList.map(s => <option key={s.id} value={s.ear_tag}>{s.ear_tag} ({s.breed_id})</option>)}
              </select>
              <select required value={selectedBoarTag} onChange={e => setSelectedBoarTag(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}>
                <option value="">-- Chọn Đực --</option>
                {boarList.map(b => <option key={b.id} value={b.ear_tag}>{b.ear_tag} ({b.breed_id})</option>)}
              </select>
              <input type="date" required value={matingDate} onChange={e => setMatingDate(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#7c3aed", color: "#fff", border: "none", fontWeight: "800" }}>Xác nhận Phối</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM CÁ THỂ MỚI */}
      {showAddPigModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "360px", padding: "18px" }}>
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
              <input required placeholder="Số tai..." value={newPig.ear_tag} onChange={e => setNewPig({ ...newPig, ear_tag: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }} />
              <select value={newPig.stage || "Hậu bị"} onChange={e => setNewPig({ ...newPig, stage: e.target.value })} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}>
                <option value="Hậu bị">Hậu bị</option>
                <option value="Chờ phối">Chờ phối</option>
                <option value="Đang chửa">Đang chửa</option>
                <option value="Nuôi con">Nuôi con</option>
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" disabled={isAddingPig} style={{ padding: "6px 14px", borderRadius: "6px", background: "#05966
