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

      if (d >= 16 && d <=
