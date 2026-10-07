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

const formatVietnameseSex = (rawSex?: string) => {
  if (!rawSex) return "Cái";
  const s = rawSex.trim().toLowerCase();
  if (s === "male" || s === "m" || s === "duc" || s === "đực") return "Đực";
  return "Cái";
};

const formatVietnameseStage = (rawStage?: string) => {
  if (!rawStage) return "Bình thường";
  const s = rawStage.toUpperCase().trim();
  if (s === "DUC_GIONG" || s === "DUC" || s === "BOAR") return "Đực giống";
  if (s === "CHUA" || s === "DANG_CHUA" || s === "PREGNANT") return "Đang chửa";
  if (s === "NUOICON" || s === "NUOI_CON" || s === "LACTATING") return "Nuôi con";
  if (s === "HAU_BI" || s === "HAUBI" || s === "GILT") return "Hậu bị";
  if (s === "CHO_PHOI" || s === "CHOPHOI" || s === "WEANED") return "Chờ phối";
  if (s === "CAI_SUA" || s === "CAISUA" || s === "DA_CAI_SUA") return "Đã cai sữa";
  if (s === "THIT" || s === "VO_BEO" || s === "VO_BEO_THIT" || s === "FATTEN") return "Vỗ béo thịt";
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
  const [localWeanedTags, setLocalWeanedTags] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

  const [newBreedInput, setNewBreedInput] = useState("");
  const [newStageInput, setNewStageInput] = useState("");
  const [newPenInput, setNewPenInput] = useState("");

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

  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [viewingLitter, setViewingLitter] = useState<FarrowingLitter | null>(null);

  const navigateTo = useCallback((menu: typeof currentMenu) => {
    setCurrentMenu(menu);
    if (typeof window !== "undefined" && window.history) {
      window.history.pushState({ menu }, "", "");
    }
  }, []);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (viewingLitter) {
        setViewingLitter(null);
        return;
      }
      if (editingPig) {
        setEditingPig(null);
        return;
      }
      if (showTaskModal) {
        setShowTaskModal(false);
        return;
      }
      if (showAddPigModal) {
        setShowAddPigModal(false);
        return;
      }
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        return;
      }

      if (e.state && e.state.menu) {
        setCurrentMenu(e.state.menu);
      } else {
        setCurrentMenu("OVERVIEW");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [viewingLitter, editingPig, showTaskModal, showAddPigModal, isSidebarOpen]);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("farm_config_persistent");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.breeds && parsed?.stages && parsed?.pens) {
            if (!parsed.stages.includes("Đã cai sữa")) parsed.stages.push("Đã cai sữa");
            setConfig(parsed);
          }
        }

        const savedName = localStorage.getItem("farm_display_name_permanent");
        if (savedName?.trim()) {
          setCustomDisplayName(savedName.trim());
          setInputDisplayName(savedName.trim());
        }

        const savedLogs = localStorage.getItem("farm_local_audit_logs");
        if (savedLogs) {
          const parsedLogs = JSON.parse(savedLogs);
          if (Array.isArray(parsedLogs)) setAuditLogs(parsedLogs);
        }

        const savedDoneTasks = localStorage.getItem("farm_done_task_keys");
        if (savedDoneTasks) {
          const parsedDone = JSON.parse(savedDoneTasks);
          if (Array.isArray(parsedDone)) setCompletedTaskKeys(parsedDone);
        }

        const savedWeaned = localStorage.getItem("farm_local_weaned_tags");
        if (savedWeaned) {
          const parsedWeaned = JSON.parse(savedWeaned);
          if (Array.isArray(parsedWeaned)) setLocalWeanedTags(parsedWeaned);
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
      await logAction("LOGIN", loginAccount, "Đăng nhập hệ thống");
      fetchData();
    }
  };

  const handleLogout = async () => {
    await logAction("LOGOUT", user?.email || "", "Đăng xuất hệ thống");
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

  const handleSaveDisplayName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDisplayName.trim()) return;
    const name = inputDisplayName.trim();
    setCustomDisplayName(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("farm_display_name_permanent", name);
    }
    logAction("UPDATE_NAME", name, `Đổi tên người thực hiện thành ${name}`);
    alert(`Đã lưu cố định tên hiển thị: "${name}"`);
  };

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

  const handleCreatePig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Vui lòng đăng nhập để thêm lợn!");
    if (!newPig.ear_tag?.trim()) return alert("Vui lòng nhập số tai!");

    setIsAddingPig(true);
    try {
      const pigPayload = {
        ear_tag: newPig.ear_tag.trim().toUpperCase(),
        breed_id: newPig.breed_id || config.breeds[0] || "Hạ Lang",
        sex: formatVietnameseSex(newPig.sex),
        stage: formatVietnameseStage(newPig.stage || config.stages[0] || "Hậu bị"),
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
        await logAction("CREATE_PIG", pigPayload.ear_tag, `Thêm cá thể mới ${pigPayload.ear_tag} (${pigPayload.breed_id})`);
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

  const isIndividualPiglet = (pig?: Pig) => {
    if (!pig) return false;
    const tag = String(pig.ear_tag || "").toUpperCase();
    return tag.includes("-C") || tag.includes("CON");
  };

  // PHÂN LOẠI CHÍNH XÁC THEO NGHIỆP VỤ - SẴN SÀNG THÊM NHIỀU ĐỰC SAU NÀY
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
    if (!pig) return "CHOPHOI";
    const tagUpper = (pig.ear_tag || "").trim().toUpperCase();

    if (localWeanedTags.includes(tagUpper)) return "CHOPHOI";

    const st = (pig.stage || "").toLowerCase();
    if (st.includes("chờ phối") || st.includes("cho phoi") || st.includes("cai sữa") || st.includes("cai sua") || st.includes("đã cai") || st.includes("da cai")) {
      return "CHOPHOI";
    }
    if (st.includes("nuôi con") || st.includes("nuoi con") || st.includes("đẻ") || st.includes("de")) {
      return "NUOICON";
    }
    if (st.includes("hậu bị") || st.includes("hau bi")) {
      return "HAUBI";
    }
    if (st.includes("chửa") || st.includes("chua")) {
      return "CHUA";
    }

    return "CHOPHOI";
  }, [localWeanedTags]);

  const safePigs = Array.isArray(pigs) ? pigs : [];
  const sowList = safePigs.filter(isSow);
  const boarList = safePigs.filter(isBoar);
  const meatList = safePigs.filter(isMeat);

  const suckingLitters = useMemo(() => {
    return (Array.isArray(litters) ? litters : []).filter(l => {
      if (!l?.sow_ear_tag) return false;
      const tag = l.sow_ear_tag.trim().toUpperCase();
      if (localWeanedTags.includes(tag)) return false;

      const sowInFarm = safePigs.find(p => p.ear_tag.trim().toUpperCase() === tag);
      if (sowInFarm && checkSowState(sowInFarm) === "CHOPHOI") return false;

      const n = (l?.notes || "").toLowerCase();
      const st = (l?.status || "").toLowerCase();
      return !n.includes("da cai") && !n.includes("cai sua") && !st.includes("cai");
    });
  }, [litters, localWeanedTags, safePigs, checkSowState]);

  const weanedLitters = useMemo(() => {
    return (Array.isArray(litters) ? litters : []).filter(l => {
      if (!l?.sow_ear_tag) return false;
      const tag = l.sow_ear_tag.trim().toUpperCase();
      if (localWeanedTags.includes(tag)) return true;

      const sowInFarm = safePigs.find(p => p.ear_tag.trim().toUpperCase() === tag);
      if (sowInFarm && checkSowState(sowInFarm) === "CHOPHOI") return true;

      const n = (l?.notes || "").toLowerCase();
      const st = (l?.status || "").toLowerCase();
      return n.includes("da cai") || n.includes("cai sua") || st.includes("cai");
    });
  }, [litters, localWeanedTags, safePigs, checkSowState]);

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

  const executeWeaning = async (sowTag: string, litterId?: string, litterCount?: number) => {
    if (!user) return alert("Vui lòng đăng nhập để thực hiện cai sữa!");
    if (!confirm(`Xác nhận cai sữa cho đàn con của nái ${sowTag}? Nái mẹ sẽ chuyển sang "Chờ phối" và đàn con (${litterCount || ""} con) chuyển sang "Lợn con cai sữa".`)) return;

    const tagUpper = sowTag.trim().toUpperCase();
    const todayStr = new Date().toISOString().split("T")[0];

    const newWeaned = Array.from(new Set([...localWeanedTags, tagUpper]));
    setLocalWeanedTags(newWeaned);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_local_weaned_tags", JSON.stringify(newWeaned)); } catch (e) {}
    }

    setPigs(prev => prev.map(p => p.ear_tag.trim().toUpperCase() === tagUpper ? { ...p, stage: "Chờ phối" } : p));
    setLitters(prev => prev.map(l => (l.id === litterId || l.sow_ear_tag.trim().toUpperCase() === tagUpper) ? { ...l, notes: "Đã cai sữa", status: "DA_CAI_SUA", weaning_date: todayStr } : l));

    const taskKey = `wean-${tagUpper}`;
    const newDone = Array.from(new Set([...completedTaskKeys, taskKey]));
    setCompletedTaskKeys(newDone);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_done_task_keys", JSON.stringify(newDone)); } catch (e) {}
    }

    try {
      await supabase.from("pigs").update({ stage: "Chờ phối" }).eq("ear_tag", sowTag);
      let q = supabase.from("farrowings").update({ notes: "Đã cai sữa", status: "DA_CAI_SUA", weaning_date: todayStr });
      if (litterId) q = q.eq("id", litterId);
      else q = q.eq("sow_ear_tag", sowTag);
      await q;

      await supabase.from("farm_tasks").insert([{
        title: `Cai sữa đàn con nái ${sowTag}`,
        due_date: todayStr,
        related_tag: sowTag,
        category: "WEAN",
        is_completed: true,
        is_dismissed: false
      }]);
    } catch (err) {
      console.error("Lỗi DB:", err);
    }

    await logAction("WEAN_LITTER", sowTag, `Cai sữa đàn con nái ${sowTag} (${litterCount || ""} con) -> Nái chuyển Chờ phối`);
    alert(`Đã hoàn tất cai sữa đàn nái ${sowTag}!\n- Nái mẹ: Đã chuyển sang "Chờ phối".\n- Lô con (${litterCount || ""} con): Đã chuyển sang nhóm "Lợn con cai sữa".`);
    fetchData();
  };

  const handleConvertPiglet = async (
    targetStage: "Hậu bị" | "Vỗ béo thịt" | "Xuất bán",
    pigletTag: string,
    sowTag: string,
    litter: FarrowingLitter
  ) => {
    if (!user) return alert("Vui lòng đăng nhập để thực hiện!");

    const insem = inseminations.find(ins => ins.sow_ear_tag === sowTag);
    const sireTag = insem?.boar_ear_tag || "";
    const damSow = safePigs.find(p => p.ear_tag === sowTag);
    const breed = damSow?.breed_id || config.breeds[0] || "Hạ Lang";

    if (targetStage === "Xuất bán") {
      if (!confirm(`Xác nhận xuất bán con ${pigletTag}?`)) return;
      const newAlive = Math.max(0, Number(litter.alive_born || 0) - 1);
      setLitters(prev => prev.map(l => l.id === litter.id ? { ...l, alive_born: newAlive } : l));
      await supabase.from("farrowings").update({ alive_born: newAlive }).eq("id", litter.id);
      await logAction("SELL_PIGLET", pigletTag, `Xuất bán lợn ${pigletTag} (Mẹ ${sowTag})`);
      alert(`Đã ghi nhận xuất bán cá thể ${pigletTag}!`);
      fetchData();
      return;
    }

    const actionText = targetStage === "Hậu bị" ? "chọn làm lợn HẬU BỊ" : "chuyển sang NUÔI THỊT";
    if (!confirm(`Xác nhận ${actionText} cho cá thể ${pigletTag}?`)) return;

    const payload = {
      ear_tag: pigletTag,
      breed_id: breed,
      sex: targetStage === "Hậu bị" ? "Cái" : "Đực",
      stage: targetStage,
      current_pen_code: targetStage === "Hậu bị" ? "CA1" : "CB1",
      status: "Bình thường",
      sire_ear_tag: sireTag || null,
      dam_ear_tag: sowTag || null,
      notes: `Tách từ đàn con nái ${sowTag} (${litter.litter_code})`
    };

    const { error } = await supabase.from("pigs").insert([payload]);
    if (error) {
      alert("Lỗi tạo cá thể: " + error.message);
    } else {
      const newAlive = Math.max(0, Number(litter.alive_born || 0) - 1);
      setLitters(prev => prev.map(l => l.id === litter.id ? { ...l, alive_born: newAlive } : l));
      await supabase.from("farrowings").update({ alive_born: newAlive }).eq("id", litter.id);

      await logAction("SELECT_PIGLET", pigletTag, `Tuyển chọn ${pigletTag} làm ${targetStage} (Bố: ${sireTag || "—"}, Mẹ: ${sowTag})`);
      alert(`Đã chuyển thành công cá thể ${pigletTag} sang đàn ${targetStage}!\n- Bố: ${sireTag || "Chưa rõ"}\n- Mẹ: ${sowTag}`);
      fetchData();
    }
  };

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

    suckingLitters.forEach(lit => {
      if (!lit?.farrow_date || !lit?.sow_ear_tag) return;
      const tagUpper = lit.sow_ear_tag.trim().toUpperCase();
      const key = `wean-${tagUpper}`;

      const age = safeDateDiff(lit.farrow_date);
      if (age === -999) return;

      if (age >= 24) {
        taskMap.set(key, {
          id: key,
          title: `${age >= 28 ? "⚠️ QUÁ HẠN: " : "🔔 "}Cai sữa đàn con nái ${lit.sow_ear_tag} (${Number(lit.alive_born || 0)} con)`,
          due_date: lit.weaning_date || safeAddDays(lit.farrow_date, 28),
          related_tag: lit.sow_ear_tag,
          category: "WEAN",
          is_completed: completedTaskKeys.includes(key),
          is_auto: true
        });
      }
    });

    (Array.isArray(dbTasks) ? dbTasks : []).forEach(t => {
      if (!t?.title) return;
      const cleanTitle = t.title.trim();
      const dedupKey = `${cleanTitle}-${t.related_tag || ""}`;

      let cat = t.category;
      const normTitle = cleanTitle.toLowerCase();
      if (
        normTitle.includes("vaccine") ||
        normTitle.includes("tiêm") ||
        normTitle.includes("tiem") ||
        normTitle.includes("phòng") ||
        normTitle.includes("thú y") ||
        normTitle.includes("thu y") ||
        normTitle.includes("e.coli") ||
        normTitle.includes("dịch tả") ||
        normTitle.includes("tai xanh") ||
        normTitle.includes("lở mồm") ||
        normTitle.includes("giun")
      ) {
        cat = "VET";
      }

      taskMap.set(dedupKey, {
        ...t,
        category: cat
      });
    });

    return Array.from(taskMap.values()).filter(t => !t.is_dismissed);
  }, [inseminations, suckingLitters, dbTasks, completedTaskKeys]);

  const filteredTasks = fullTasks.filter(t => taskCategoryFilter === "ALL" || t?.category === taskCategoryFilter);
  const pendingTasks = filteredTasks.filter(t => !t.is_completed);
  const completedTasks = filteredTasks.filter(t => t.is_completed);

  const handleTaskClick = (task: FarmTask) => {
    if (!user) return alert("Vui lòng đăng nhập để xử lý công việc!");
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const confirmCompleteTask = async () => {
    if (!selectedTask) return;

    if (selectedTask.category === "WEAN") {
      setShowTaskModal(false);
      setSelectedTask(null);
      navigateTo("PIGLET");
      alert(`Đã chuyển sang tab "Lợn con theo lô". Anh vui lòng bấm nút "✓ Cai sữa đàn này" tại nái ${selectedTask.related_tag}!`);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const taskKey = selectedTask.id;

    const newDone = Array.from(new Set([...completedTaskKeys, taskKey]));
    setCompletedTaskKeys(newDone);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_done_task_keys", JSON.stringify(newDone)); } catch (e) {}
    }

    if (selectedTask.is_auto && selectedTask.id.startsWith("repro-cd-")) {
      const sowTag = selectedTask.related_tag;
      setPigs(prev => prev.map(p => p.ear_tag.trim().toUpperCase() === sowTag.trim().toUpperCase() ? { ...p, current_pen_code: "CD1" } : p));
      try {
        await supabase.from("pigs").update({ current_pen_code: "CD1" }).eq("ear_tag", sowTag);
      } catch (e) {}
    }

    try {
      if (selectedTask.is_auto) {
        await supabase.from("farm_tasks").insert([{
          title: selectedTask.title,
          due_date: selectedTask.due_date,
          related_tag: selectedTask.related_tag,
          category: selectedTask.category,
          is_completed: true,
          is_dismissed: false
        }]);
      } else {
        await supabase.from("farm_tasks").update({ is_completed: true }).eq("id", selectedTask.id);
      }
    } catch (e) {}

    await logAction("COMPLETE_TASK", selectedTask.related_tag || "TASK", `Xong việc: ${selectedTask.title}`);
    setShowTaskModal(false);
    setSelectedTask(null);
    fetchData();
  };

  const confirmDismissTask = async () => {
    if (!selectedTask) return;
    const taskKey = selectedTask.id;

    const newDone = Array.from(new Set([...completedTaskKeys, taskKey]));
    setCompletedTaskKeys(newDone);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_done_task_keys", JSON.stringify(newDone)); } catch (e) {}
    }

    try {
      if (selectedTask.is_auto) {
        await supabase.from("farm_tasks").insert([{
          title: selectedTask.title,
          due_date: selectedTask.due_date,
          related_tag: selectedTask.related_tag,
          category: selectedTask.category,
          is_completed: false,
          is_dismissed: true
        }]);
      } else {
        await supabase.from("farm_tasks").update({ is_dismissed: true }).eq("id", selectedTask.id);
      }
    } catch (e) {}

    await logAction("DISMISS_TASK", selectedTask.related_tag || "TASK", `Bỏ qua việc: ${selectedTask.title}`);
    setShowTaskModal(false);
    setSelectedTask(null);
    fetchData();
  };

  const confirmPostponeTask = async () => {
    if (!selectedTask) return;
    const newDueDate = safeAddDays(new Date().toISOString().split("T")[0], 3);
    const newTitle = selectedTask.title.replace("⚠️ QUÁ HẠN: ", "").replace("🔔 ", "") + " (Gia hạn)";

    const newDone = Array.from(new Set([...completedTaskKeys, selectedTask.id]));
    setCompletedTaskKeys(newDone);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_done_task_keys", JSON.stringify(newDone)); } catch (e) {}
    }

    try {
      if (selectedTask.is_auto) {
        await supabase.from("farm_tasks").insert([
          { title: selectedTask.title, due_date: selectedTask.due_date, related_tag: selectedTask.related_tag, category: selectedTask.category, is_dismissed: true, is_completed: false },
          { title: newTitle, due_date: newDueDate, related_tag: selectedTask.related_tag, category: selectedTask.category, is_completed: false, is_dismissed: false }
        ]);
      } else {
        await supabase.from("farm_tasks").update({ title: newTitle, due_date: newDueDate }).eq("id", selectedTask.id);
      }
    } catch (e) {}

    await logAction("POSTPONE_TASK", selectedTask.related_tag || "TASK", `Gia hạn việc đến ngày ${newDueDate}`);
    setShowTaskModal(false);
    setSelectedTask(null);
    fetchData();
  };

  const handleUpdatePig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPig || !user) return;
    setIsSavingEdit(true);
    await supabase.from("pigs").update({
      ...editingPig,
      sex: formatVietnameseSex(editingPig.sex),
      stage: formatVietnameseStage(editingPig.stage)
    }).eq("id", editingPig.id);
    await logAction("UPDATE_PIG", editingPig.ear_tag, `Sửa cá thể ${editingPig.ear_tag} (Bố: ${editingPig.sire_ear_tag || "—"}, Mẹ: ${editingPig.dam_ear_tag || "—"})`);
    setEditingPig(null);
    fetchData();
    setIsSavingEdit(false);
  };

  const handleExportWord = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yy = String(today.getFullYear()).slice(-2);
    const filename = `baocao_${reportDays}ngay_${dd}_${mm}_${yy}.doc`;

    const formatNum = (n: number) => String(n).padStart(2, "0");

    const masterRows: { stt: number; type: string; details: string; count: string; operator: string }[] = [];
    let counter = 1;

    const boarByBreed: Record<string, number> = {};
    boarList.forEach(b => {
      const br = b.breed_id?.trim() || "Chưa rõ";
      boarByBreed[br] = (boarByBreed[br] || 0) + 1;
    });
    Object.entries(boarByBreed).forEach(([br, cnt]) => {
      if (cnt > 0) {
        masterRows.push({
          stt: counter++,
          type: `Đực giống ${br}`,
          details: `Khai thác tinh dịch phối giống`,
          count: `${formatNum(cnt)} con`,
          operator: activeOperator
        });
      }
    });

    const sowByBreedAndStage: Record<string, Record<string, number>> = {};
    sowList.forEach(s => {
      const br = s.breed_id?.trim() || "Chưa rõ";
      const st = formatVietnameseStage(s.stage);
      if (!sowByBreedAndStage[br]) sowByBreedAndStage[br] = {};
      sowByBreedAndStage[br][st] = (sowByBreedAndStage[br][st] || 0) + 1;
    });
    Object.entries(sowByBreedAndStage).forEach(([br, stages]) => {
      const stageText = Object.entries(stages)
        .filter(([_, cnt]) => cnt > 0)
        .map(([st, cnt]) => `${st} ${formatNum(cnt)} con`)
        .join(", ");
      const totalSow = Object.values(stages).reduce((a, b) => a + b, 0);
      if (totalSow > 0) {
        masterRows.push({
          stt: counter++,
          type: `Nái sinh sản ${br}`,
          details: stageText,
          count: `${formatNum(totalSow)} con`,
          operator: activeOperator
        });
      }
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

    const meatByBreed: Record<string, number> = {};
    meatList.forEach(m => {
      const br = m.breed_id?.trim() || "Chưa rõ";
      meatByBreed[br] = (meatByBreed[br] || 0) + 1;
    });
    Object.entries(meatByBreed).forEach(([br, cnt]) => {
      if (cnt > 0) {
        masterRows.push({
          stt: counter++,
          type: `Lợn thịt (${br})`,
          details: `Đang nuôi vỗ béo xuất bán`,
          count: `${formatNum(cnt)} con`,
          operator: activeOperator
        });
      }
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - reportDays);
    const recentCompletedTasks = completedTasks.filter(t => {
      if (!t.due_date) return false;
      return new Date(t.due_date) >= pastDate;
    });
    recentCompletedTasks.forEach(t => {
      masterRows.push({
        stt: counter++,
        type: `Kỹ thuật / Thú y`,
        details: `Đã làm: ${t.title}`,
        count: `1 nhiệm vụ`,
        operator: activeOperator
      });
    });

    let contentHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Báo Cáo Trại Lợn Nà Roác</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.6; margin: 35px; }
          h2, h3 { text-align: center; margin-bottom: 4px; text-transform: uppercase; }
          .header-info { text-align: center; margin-bottom: 20px; font-style: italic; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 25px; }
          th, td { border: 1px solid #333; padding: 8px 10px; font-size: 11pt; text-align: left; }
          th { background-color: #f2f2f2; text-align: center; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>TRẠI LỢN NÀ ROÁC</h2>
        <h3>BÁO CÁO TỔNG HỢP CƠ CẤU ĐÀN & VẬN HÀNH KỸ THUẬT (${reportDays} NGÀY QUA)</h3>
        <div class='header-info'>Thời điểm lập: Ngày ${dd}/${mm}/20${yy} | Người thực hiện: ${activeOperator}</div>

        <p><b>Tổng quy mô đàn hiện diện: ${formatNum(grandTotal)} con</b> (Nái: ${formatNum(sowList.length)} con | Đực giống: ${formatNum(boarList.length)} con | Tổng lợn con: ${formatNum(totalPigletsCount)} con [Theo mẹ: ${formatNum(suckingPigletsCount)}, Đã cai sữa: ${formatNum(weanedPigletsCount)}] | Lợn thịt: ${formatNum(meatList.length)} con).</p>

        <table>
          <thead>
            <tr>
              <th style='width: 40px;'>STT</th>
              <th style='width: 180px;'>Phân Loại & Giống Lợn</th>
              <th>Chi Tiết Số Lượng & Trạng Thái</th>
              <th style='width: 100px;'>Số Lượng</th>
              <th style='width: 130px;'>Người Thực Hiện</th>
            </tr>
          </thead>
          <tbody>
            ${masterRows.length === 0 ? `<tr><td colspan='5' style='text-align: center;'>Chưa có dữ liệu</td></tr>` :
              masterRows.map(r => `
                <tr>
                  <td style='text-align: center;'>${r.stt}</td>
                  <td><b>${r.type}</b></td>
                  <td>${r.details}</td>
                  <td style='text-align: center;'><b>${r.count}</b></td>
                  <td style='text-align: center;'><b>${r.operator}</b></td>
                </tr>
              `).join("")
            }
          </tbody>
        </table>

        <br/>
        <table style='border: none; margin-top: 30px;'>
          <tr style='border: none;'>
            <td style='border: none; text-align: center; width: 50%;'></td>
            <td style='border: none; text-align: center; width: 50%;'>
              <b>NGƯỜI THỰC HIỆN BÁO CÁO</b><br/>
              <i>(Ký và ghi rõ họ tên)</i><br/><br/><br/><br/>
              <b>${activeOperator}</b>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([contentHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
        Giống: <strong style={{ color: "#0f172a" }}>{pig.breed_id || "—"}</strong> | Giới tính: <strong>{formatVietnameseSex(pig.sex)}</strong>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#f1f5f9", fontWeight: "600", color: "#334155" }}>
          Ô: {pig.current_pen_code || "Chưa xếp"}
        </span>
        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#ecfdf5", color: "#047857", fontWeight: "700" }}>
          {formatVietnameseStage(pig.stage)}
        </span>
      </div>

      <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px", fontSize: "11px", color: "#475569", display: "flex", justifyContent: "space-between" }}>
        <span>Bố: <strong style={{ color: "#1e40af" }}>{pig.sire_ear_tag || "—"}</strong></span>
        <span>Mẹ: <strong style={{ color: "#b91c1c" }}>{pig.dam_ear_tag || "—"}</strong></span>
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

  const sowPct = grandTotal > 0 ? ((sowList.length / grandTotal) * 100).toFixed(0) : "0";
  const boarPct = grandTotal > 0 ? ((boarList.length / grandTotal) * 100).toFixed(0) : "0";
  const pigletPct = grandTotal > 0 ? ((totalPigletsCount / grandTotal) * 100).toFixed(0) : "0";
  const meatPct = grandTotal > 0 ? ((meatList.length / grandTotal) * 100).toFixed(0) : "0";

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
              {currentMenu === "GUIDE" && "QUY TRÌNH THÚ Y"}
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

        {/* NÚT THÊM LỢN NHANH */}
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
              style={{ width: "100%", padding: "10px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", fontSize: "13px", cursor: "pointer" }}
            >
              + Thêm cá thể lợn mới
            </button>
          </div>
        )}

        {/* MENU TRƯỢT */}
        {isSidebarOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
            <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
            <div style={{ width: "260px", backgroundColor: "#fff", height: "100%", zIndex: 101, padding: "20px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h2 style={{ margin: 0, color: "#5b21b6" }}>APPTRAILON</h2>
              <div style={{ fontSize: "12px", color: user ? "#059669" : "#64748b", fontWeight: "700", marginBottom: "8px" }}>
                {user ? `👤 Người thực hiện: ${activeOperator}` : "👀 Chế độ Khách (Chỉ xem)"}
              </div>
              {[
                { k: "OVERVIEW", l: "Tổng quan", icon: "📊" },
                { k: "SOW", l: "Quản lý nái", icon: "🐖" },
                { k: "BOAR", l: "Quản lý đực", icon: "🐗" },
                { k: "PIGLET", l: "Lợn con theo lô", icon: "🍼" },
                { k: "MEAT", l: "Lợn thịt", icon: "🥩" },
                { k: "GUIDE", l: "Quy trình thú y", icon: "🩺" },
                { k: "SEARCH", l: "Tra cứu cá thể", icon: "🔍" },
                { k: "SETTINGS", l: "Cài đặt", icon: "⚙️" },
              ].map(item => (
                <button
                  key={item.k}
                  onClick={() => { navigateTo(item.k as any); setIsSidebarOpen(false); }}
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

        {/* 1. TỔNG QUAN SINH ĐỘNG */}
        {currentMenu === "OVERVIEW" && (
          <div style={{ padding: "16px" }}>
            
            {/* THẺ TỔNG ĐÀN GRADIENT */}
            <div style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
              borderRadius: "16px",
              padding: "16px 18px",
              marginBottom: "14px",
              color: "#fff",
              boxShadow: "0 4px 12px rgba(49, 46, 129, 0.2)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#a5b4fc", letterSpacing: "0.5px" }}>
                    Quy mô trang trại
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: "900", margin: "2px 0 6px 0" }}>
                    {grandTotal} <span style={{ fontSize: "14px", fontWeight: "600", color: "#c7d2fe" }}>cá thể</span>
                  </div>
                </div>
                {user && (
                  <button
                    onClick={() => setShowAddPigModal(true)}
                    style={{ padding: "8px 14px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer", boxShadow: "0 2px 6px rgba(5,150,105,0.3)" }}
                  >
                    + Thêm Lợn
                  </button>
                )}
              </div>

              {/* THANH TỶ LỆ CƠ CẤU */}
              <div style={{ height: "7px", width: "100%", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "4px", overflow: "hidden", display: "flex", margin: "6px 0 8px 0" }}>
                <div style={{ width: `${sowPct}%`, backgroundColor: "#ec4899" }} title="Nái" />
                <div style={{ width: `${boarPct}%`, backgroundColor: "#3b82f6" }} title="Đực" />
                <div style={{ width: `${pigletPct}%`, backgroundColor: "#10b981" }} title="Lợn con" />
                <div style={{ width: `${meatPct}%`, backgroundColor: "#eab308" }} title="Thịt" />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#cbd5e1" }}>
                <span><span style={{ color: "#ec4899" }}>●</span> Nái: {sowList.length}</span>
                <span><span style={{ color: "#3b82f6" }}>●</span> Đực: {boarList.length}</span>
                <span><span style={{ color: "#10b981" }}>●</span> Con: {totalPigletsCount}</span>
                <span><span style={{ color: "#eab308" }}>●</span> Thịt: {meatList.length}</span>
              </div>
            </div>

            {/* KHỐI XUẤT BÁO CÁO & ĐỔI TÊN */}
            <div style={{ backgroundColor: "#eff6ff", borderRadius: "14px", padding: "14px", marginBottom: "16px", border: "1px solid #bfdbfe" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "900", color: "#1e40af" }}>📄 BÁO CÁO CƠ CẤU ĐÀN (.DOC)</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>1 bảng duy nhất</span>
              </div>

              <form onSubmit={handleSaveDisplayName} style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                <input
                  type="text"
                  placeholder="Tên người thực hiện / ký tên..."
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
                      flex: 1, padding: "7px 0", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer",
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
                style={{ width: "100%", padding: "9px", borderRadius: "8px", background: "#1d4ed8", color: "#fff", border: "none", fontWeight: "900", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <span>📥 Tải File Word Báo Cáo ({reportDays} ngày)</span>
              </button>
            </div>

            {/* BẢNG 4 Ô CƠ CẤU */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
              <div onClick={() => { navigateTo("SOW"); setSubFilter("ALL"); }} style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #fce7f3" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowList.length} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Chửa: <strong>{sowList.filter(p => checkSowState(p) === "CHUA").length}</strong> con</div>
                  <div>• Nuôi con: <strong>{sowList.filter(p => checkSowState(p) === "NUOICON").length}</strong> con</div>
                  <div>• Chờ phối: <strong style={{ color: "#2563eb" }}>{sowList.filter(p => checkSowState(p) === "CHOPHOI").length}</strong> con</div>
                </div>
              </div>

              <div onClick={() => { navigateTo("BOAR"); }} style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #dbeafe" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarList.length} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Đang khai thác tinh</div>
                </div>
              </div>

              <div onClick={() => { navigateTo("PIGLET"); }} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #dcfce7" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{totalPigletsCount} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Theo mẹ: <strong>{suckingPigletsCount}</strong> con ({suckingLitters.length} lô)</div>
                  <div>• Đã cai sữa: <strong style={{ color: "#047857" }}>{weanedPigletsCount}</strong> con ({weanedLitters.length} lô)</div>
                </div>
              </div>

              <div onClick={() => { navigateTo("MEAT"); }} style={{ backgroundColor: "#fefce8", borderRadius: "16px", padding: "14px", cursor: "pointer", border: "1px solid #fef08a" }}>
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
                {[{ id: "ALL", label: "Tất cả" }, { id: "VET", label: "Thú y" }, { id: "REPRO", label: "Sinh sản" }, { id: "WEAN", label: "Cai sữa" }].map((tab) => (
                  <button key={tab.id} onClick={() => setTaskCategoryFilter(tab.id)} style={{ padding: "6px 10px", borderRadius: "16px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer", backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#e2e8f0", color: taskCategoryFilter === tab.id ? "#fff" : "#475569" }}>
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {pendingTasks.length === 0 ? (
                  <div style={{ padding: "14px", textAlign: "center", background: "#fff", borderRadius: "10px", fontSize: "12px", color: "#64748b" }}>
                    ✨ Không có công việc nào tồn đọng trong mục này.
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
                            Hạn: <strong>{task.due_date}</strong> {task.related_tag && `(Tai: ${task.related_tag})`} • <span style={{ color: "#7c3aed", fontWeight: "700" }}>{task.category === "VET" ? "Thú y" : task.category === "REPRO" ? "Sinh sản" : task.category === "WEAN" ? "Cai sữa" : "Chung"}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: "18px" }}>⚪</div>
                      </div>
                    );
                  })
                )}
              </div>

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
                          <div style={{ fontSize: "11px", color: "#64748b" }}>Đã hoàn thành (Hạn: {task.due_date})</div>
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
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#16a34a", marginBottom: "12px" }}>
              TỔNG ĐÀN CON: {totalPigletsCount} CON (Theo mẹ: {suckingPigletsCount} • Đã cai sữa: {weanedPigletsCount})
            </div>

            <h4 style={{ fontSize: "13px", fontWeight: "800", color: "#ea580c", margin: "0 0 10px 0" }}>
              🍼 LỢN CON ĐANG THEO MẸ ({suckingPigletsCount} CON / {suckingLitters.length} LÔ)
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              {suckingLitters.length === 0 ? (
                <div style={{ padding: "12px", background: "#fff", borderRadius: "10px", fontSize: "12px", color: "#64748b" }}>
                  Không có lô con nào đang bú mẹ.
                </div>
              ) : (
                suckingLitters.map((lit) => {
                  const sow = safePigs.find(p => p.ear_tag === lit.sow_ear_tag);
                  const ageDays = safeDateDiff(lit.farrow_date);
                  const isReadyWean = ageDays >= 24;
                  return (
                    <div
                      key={lit.id}
                      style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "16px", border: isReadyWean ? "1px solid #fed7aa" : "1px solid #f1e5f0" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>
                          Lô nái {lit.sow_ear_tag} ({lit.litter_code})
                        </span>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#047857" }}>{lit.alive_born} con</span>
                      </div>
                      <div style={{ margin: "8px 0", fontSize: "12px", color: isReadyWean ? "#ea580c" : "#64748b", fontWeight: "700" }}>
                        Chuồng: {sow?.current_pen_code || "—"} | {ageDays !== -999 ? ageDays : 0} ngày tuổi {isReadyWean && "🔔 (Đến hạn cai sữa)"}
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <button
                          onClick={() => setViewingLitter(lit)}
                          style={{
                            flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #c7d2fe",
                            backgroundColor: "#e0e7ff", color: "#4338ca", fontSize: "12px", fontWeight: "800", cursor: "pointer"
                          }}
                        >
                          🔍 Xem & Chọn cá thể
                        </button>
                        {user && (
                          <button
                            onClick={() => executeWeaning(lit.sow_ear_tag, lit.id, lit.alive_born)}
                            style={{
                              flex: 1, padding: "8px", borderRadius: "8px", border: "none",
                              backgroundColor: isReadyWean ? "#ea580c" : "#0f172a",
                              color: "#fff", fontSize: "12px", fontWeight: "800", cursor: "pointer"
                            }}
                          >
                            ✓ Cai sữa đàn này
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {weanedLitters.length > 0 && (
              <div>
                <h4 style={{ fontSize: "13px", fontWeight: "800", color: "#047857", margin: "0 0 10px 0" }}>
                  ✅ LỢN CON ĐÃ CAI SỮA ({weanedPigletsCount} CON / {weanedLitters.length} LÔ)
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {weanedLitters.map((lit) => (
                    <div
                      key={lit.id}
                      style={{ backgroundColor: "#f0fdf4", borderRadius: "12px", padding: "12px 14px", border: "1px solid #bbf7d0" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "15px", fontWeight: "800", color: "#166534" }}>
                          Lô nái {lit.sow_ear_tag} ({lit.litter_code})
                        </span>
                        <span style={{ padding: "2px 8px", borderRadius: "10px", fontSize: "12px", fontWeight: "800", backgroundColor: "#dcfce7", color: "#15803d" }}>{lit.alive_born} con</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", margin: "4px 0 8px 0" }}>
                        Trạng thái: <strong>Đã cai sữa tách mẹ</strong> {lit.weaning_date && `(Ngày cai: ${lit.weaning_date})`}
                      </div>
                      <button
                        onClick={() => setViewingLitter(lit)}
                        style={{
                          width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #bbf7d0",
                          backgroundColor: "#fff", color: "#166534", fontSize: "11px", fontWeight: "800", cursor: "pointer"
                        }}
                      >
                        🔍 Xem & Chọn cá thể lợn con
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* 5. LỢN THỊT */}
        {currentMenu === "MEAT" && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#854d0e", marginBottom: "12px" }}>ĐÀN LỢN THỊT ({meatList.length} CON)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{meatList.map(renderPigCard)}</div>
          </div>
        )}

        {/* 6. TAB QUY TRÌNH THÚ Y */}
        {currentMenu === "GUIDE" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: "#eff6ff", borderRadius: "12px", padding: "14px", border: "1px solid #bfdbfe" }}>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "900", color: "#1e40af" }}>
                🩺 CẨM NANG QUY TRÌNH PHÒNG BỆNH VACCINE
              </h3>
              <div style={{ fontSize: "12px", color: "#475569" }}>
                Áp dụng chuẩn quy trình chăn nuôi an toàn sinh học tại Trại Lợn Nà Roác.
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "800", color: "#047857" }}>
                1. Quy Trình Lợn Con Theo Mẹ & Lợn Thịt
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 3 ngày tuổi:</b> Tiêm Sắt (Dextran 200mg) + Nhỏ thuốc phòng Cầu trùng (Toltrazuril).
                </div>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 7 - 10 ngày tuổi:</b> Tiêm phòng Suyễn lợn (Mycoplasma hyopneumoniae) mũi 1.
                </div>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 14 - 16 ngày tuổi:</b> Tiêm phòng Phù đầu / Phân trắng (E.Coli + Phù đầu).
                </div>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 21 ngày tuổi (trước cai sữa):</b> Tiêm nhắc lại Suyễn mũi 2 hoặc phòng PRRS (Tai xanh).
                </div>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 30 - 35 ngày tuổi (sau cai sữa):</b> Tiêm Vaccine Dịch tả lợn cổ điển mũi 1 (CSF).
                </div>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 45 - 50 ngày tuổi:</b> Tiêm Vaccine Lở mồm long móng (FMD) mũi 1.
                </div>
                <div style={{ padding: "8px", background: "#f8fafc", borderRadius: "6px" }}>
                  <b>• 60 ngày tuổi:</b> Tiêm nhắc lại Dịch tả mũi 2 + Tẩy giun sán đường ruột.
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "800", color: "#db2777" }}>
                2. Quy Trình Nái Hậu Bị & Nái Chửa
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ padding: "8px", background: "#fdf2f4", borderRadius: "6px" }}>
                  <b>• Trước phối 4 tuần (Hậu bị):</b> Tiêm Parvovirus (Khô thai) mũi 1 + Giả dại (Aujeszky).
                </div>
                <div style={{ padding: "8px", background: "#fdf2f4", borderRadius: "6px" }}>
                  <b>• Trước phối 2 tuần (Hậu bị):</b> Tiêm nhắc lại Parvovirus mũi 2 + Dịch tả cổ điển.
                </div>
                <div style={{ padding: "8px", background: "#fdf2f4", borderRadius: "6px" }}>
                  <b>• Chửa 80 - 85 ngày:</b> Tiêm Vaccine Tai xanh (PRRS) hoặc Dịch tả định kỳ lứa chửa.
                </div>
                <div style={{ padding: "8px", background: "#fdf2f4", borderRadius: "6px" }}>
                  <b>• Chửa 95 - 100 ngày:</b> Tiêm phòng E.Coli tạo kháng thể mẹ truyền sữa đầu phòng tiêu chảy phân trắng cho đàn con.
                </div>
                <div style={{ padding: "8px", background: "#fdf2f4", borderRadius: "6px" }}>
                  <b>• Chửa 107 ngày:</b> Tắm rửa sạch sẽ, sát trùng vú và chuyển lên ô chuồng đẻ.
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #2563eb" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", fontWeight: "800", color: "#2563eb" }}>
                3. Quy Trình Đực Giống
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ padding: "8px", background: "#f0f5ff", borderRadius: "6px" }}>
                  <b>• Định kỳ 6 tháng/lần:</b> Tiêm nhắc lại Vaccine Lở mồm long móng (FMD) + Dịch tả lợn cổ điển.
                </div>
                <div style={{ padding: "8px", background: "#f0f5ff", borderRadius: "6px" }}>
                  <b>• Định kỳ 6 tháng/lần:</b> Tiêm Ivermectin tẩy giun sán nội ngoại ký sinh trùng.
                </div>
                <div style={{ padding: "8px", background: "#f0f5ff", borderRadius: "6px" }}>
                  <b>• Định kỳ 1 năm/lần:</b> Tiêm phòng Khô thai (Parvo) và Giả dại (Aujeszky).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7. TRA CỨU */}
        {currentMenu === "SEARCH" && (
          <div style={{ padding: "16px" }}>
            <input placeholder="Gõ số tai, chuồng, giống..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", boxSizing: "border-box", marginBottom: "14px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {safePigs.filter(p => !isIndividualPiglet(p)).filter(p => String(p?.ear_tag || "").toLowerCase().includes(searchQuery.toLowerCase()) || String(p?.breed_id || "").toLowerCase().includes(searchQuery.toLowerCase())).map(renderPigCard)}
            </div>
          </div>
        )}

        {/* 8. CÀI ĐẶT */}
        {currentMenu === "SETTINGS" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "800", color: "#1e1b4b" }}>Trạng thái tài khoản</h4>
              <div style={{ fontSize: "13px", color: user ? "#059669" : "#64748b", fontWeight: "700" }}>
                {user ? `Đang đăng nhập: ${user.email} (${activeOperator})` : "Chế độ xem tự do (Khách)"}
              </div>
            </div>

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

            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Giai đoạn / Trạng thái</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {(config?.stages || []).map((st) => (
                  <span key={st} style={{ padding: "4px 10px", borderRadius: "20px", background: "#ecfdf5", color: "#047857", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {formatVietnameseStage(st)}
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

            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800", color: "#1e1b4b" }}>📜 Nhật Ký Thao Tác Gần Đây</h4>
              {(auditLogs || []).length === 0 ? (
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>Chưa có lịch sử thao tác nào.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                  {(auditLogs || []).map((log) => {
                    let formattedTime = "";
                    if (log.created_at) {
                      const t = new Date(log.created_at);
                      if (!isNaN(t.getTime())) {
                        formattedTime = t.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " - " + t.toLocaleDateString("vi-VN");
                      }
                    }
                    return (
                      <div key={log.id} style={{ fontSize: "11px", padding: "8px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                          <span style={{ color: "#5b21b6" }}>👤 {log.performed_by || "Hà Quang Dự"}</span>
                          <span style={{ color: "#64748b" }}>{formattedTime}</span>
                        </div>
                        <div style={{ color: "#334155", marginTop: "3px" }}>{log.details}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "36px", backgroundColor: "rgba(253, 248, 251, 0.95)", borderTop: "1px solid #f1e5f0", display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: "16px", zIndex: 40, maxWidth: "480px", margin: "0 auto", pointerEvents: "none" }}>
        <span style={{ fontSize: "12px", fontWeight: "800", color: "#64748b" }}>AppWeb: Trại Lợn Nà Roác</span>
      </footer>

      {/* MODAL THÊM CÁ THỂ LỢN */}
      {showAddPigModal && user && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800", color: "#059669" }}>+ Thêm Cá Thể Lợn Mới</h3>
            <form onSubmit={handleCreatePig} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai (*):</label>
                <input required placeholder="VD: HL-01, D-01..." value={newPig.ear_tag} onChange={(e) => setNewPig({ ...newPig, ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
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
                    {config.stages.map(st => <option key={st} value={st}>{formatVietnameseStage(st)}</option>)}
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

      {/* MODAL DIALOG XÁC NHẬN CÔNG VIỆC */}
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
              Hạn: <strong>{selectedTask.due_date}</strong> {selectedTask.related_tag && `(Tai: ${selectedTask.related_tag})`}
            </div>

            {selectedTask.category === "WEAN" ? (
              <div>
                <div style={{ fontSize: "12px", color: "#0369a1", background: "#f0f9ff", padding: "10px", borderRadius: "8px", marginBottom: "14px" }}>
                  💡 Để đảm bảo chuẩn quy trình, hệ thống sẽ dẫn anh sang tab <b>Lợn con theo lô</b> để xác nhận trực tiếp.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button onClick={confirmCompleteTask} style={{ padding: "10px", borderRadius: "8px", background: "#0284c7", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer", fontSize: "13px" }}>
                    👉 Chuyển đến tab Lợn con để thực hiện
                  </button>
                  <button onClick={() => setShowTaskModal(false)} style={{ padding: "8px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "12px" }}>
                    Đóng lại
                  </button>
                </div>
              </div>
            ) : String(selectedTask.title).includes("QUÁ HẠN") ? (
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
                  Bấm xác nhận hệ thống sẽ tự động cập nhật trạng thái cá thể và hoàn tất công việc.
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
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "420px", padding: "20px" }}>
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
                  <select value={formatVietnameseSex(editingPig.sex)} onChange={(e) => setEditingPig({ ...editingPig, sex: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Cái">Cái</option>
                    <option value="Đực">Đực</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Trạng thái:</label>
                  <select value={formatVietnameseStage(editingPig.stage)} onChange={(e) => setEditingPig({ ...editingPig, stage: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.stages.map(st => <option key={st} value={st}>{formatVietnameseStage(st)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>Chuồng:</label>
                  <select value={editingPig.current_pen_code || config.pens[0]} onChange={(e) => setEditingPig({ ...editingPig, current_pen_code: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    {config.pens.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>

              {/* Ô NHẬP BỐ & MẸ */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "#f8fafc", padding: "8px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "#1e40af" }}>Số tai Bố (Đực giống):</label>
                  <input
                    placeholder="VD: D-01..."
                    value={editingPig.sire_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, sire_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "12px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "#b91c1c" }}>Số tai Mẹ (Nái mẹ):</label>
                  <input
                    placeholder="VD: HL01, HL02..."
                    value={editingPig.dam_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, dam_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "12px" }}
                  />
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

      {/* MODAL XEM CHI TIẾT TỪNG CON TRONG LÔ LỢN CON */}
      {viewingLitter && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 125, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "440px", maxHeight: "85vh", display: "flex", flexDirection: "column", padding: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#1e1b4b" }}>
                  Lô nái {viewingLitter.sow_ear_tag} ({viewingLitter.alive_born} con)
                </h3>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Mã lô: {viewingLitter.litter_code} • Ngày đẻ: {viewingLitter.farrow_date}</span>
              </div>
              <button onClick={() => setViewingLitter(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "900" }}>✕</button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
              {Array.from({ length: Number(viewingLitter.alive_born || 0) }).map((_, idx) => {
                const pigletTag = `${viewingLitter.sow_ear_tag}-C${String(idx + 1).padStart(2, "0")}`;
                return (
                  <div key={idx} style={{ background: "#f8fafc", borderRadius: "10px", padding: "10px 12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "900", color: "#0f172a" }}>{pigletTag}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Mẹ: <strong>{viewingLitter.sow_ear_tag}</strong></div>
                    </div>

                    {user ? (
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          onClick={() => handleConvertPiglet("Hậu bị", pigletTag, viewingLitter.sow_ear_tag, viewingLitter)}
                          style={{ padding: "5px 7px", borderRadius: "6px", background: "#db2777", color: "#fff", border: "none", fontSize: "10px", fontWeight: "800", cursor: "pointer" }}
                        >
                          Chọn Hậu bị
                        </button>
                        <button
                          onClick={() => handleConvertPiglet("Vỗ béo thịt", pigletTag, viewingLitter.sow_ear_tag, viewingLitter)}
                          style={{ padding: "5px 7px", borderRadius: "6px", background: "#854d0e", color: "#fff", border: "none", fontSize: "10px", fontWeight: "800", cursor: "pointer" }}
                        >
                          Nuôi Thịt
                        </button>
                        <button
                          onClick={() => handleConvertPiglet("Xuất bán", pigletTag, viewingLitter.sow_ear_tag, viewingLitter)}
                          style={{ padding: "5px 7px", borderRadius: "6px", background: "#0284c7", color: "#fff", border: "none", fontSize: "10px", fontWeight: "800", cursor: "pointer" }}
                        >
                          Bán
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#94a3b8" }}>Chỉ xem</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "12px", textAlign: "right" }}>
              <button onClick={() => setViewingLitter(null)} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
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
