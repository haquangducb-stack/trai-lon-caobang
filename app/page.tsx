"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient, User } from "@supabase/supabase-js";
import FarmSpeciesNav from "@/components/FarmSpeciesNav";

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
  image_url?: string;
  task_id?: string;
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

const getBreedAbbr = (breedName?: string): string => {
  if (!breedName) return "L";
  const b = breedName.trim().toLowerCase();
  if (b.includes("hạ lang") || b.includes("ha lang") || b === "hl") return "HL";
  if (b.includes("móng cái") || b.includes("mong cai") || b === "mc") return "MC";
  if (b.includes("hương") || b.includes("huong")) return "LH";
  if (b.includes("táp ná") || b.includes("tap na")) return "TN";
  if (b.includes("duroc")) return "D";
  if (b.includes("landrace")) return "L";
  if (b.includes("yorkshire")) return "Y";
  if (b.includes("pietrain")) return "P";
  
  const words = breedName.trim().split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0].toUpperCase()).join("");
  }
  return breedName.slice(0, 2).toUpperCase();
};

const compressImage = (file: File, maxDim = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(e.target?.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [dismissedTaskKeys, setDismissedTaskKeys] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "PEDIGREE" | "GUIDE" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [reportDays, setReportDays] = useState<7 | 10 | 30>(7);

  const [pendingTaskDays, setPendingTaskDays] = useState<7 | 15 | 30>(7);
  const [completedTaskDays, setCompletedTaskDays] = useState<7 | 15 | 30>(7);

  // MODAL BẢNG TÍCH CHỌN TỪNG CON
  const [selectedLitter, setSelectedLitter] = useState<FarrowingLitter | null>(null);
  const [showLitterActionModal, setShowLitterActionModal] = useState(false);
  const [pigletSelections, setPigletSelections] = useState<Record<number, "NONE" | "GILT" | "MEAT">>({});
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  const [activityPhotoModal, setActivityPhotoModal] = useState<{
    isOpen: boolean;
    activityTitle: string;
    actionType: string;
    targetId: string;
    details: string;
    taskId?: string;
    existingLogId?: string;
    previewImg: string;
  } | null>(null);

  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Lan lai Hương", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire", "Lai (Landrace × Hạ Lang)", "Lai 3 máu [Y × (L × HL)]"],
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
    birth_date: "",
    notes: ""
  });
  const [isAddingPig, setIsAddingPig] = useState(false);

  const [activeProfilePig, setActiveProfilePig] = useState<Pig | null>(null);
  const [profileTab, setProfileTab] = useState<"EDIT" | "REPRO" | "PEDIGREE">("EDIT");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // LỨA ĐẺ
  const [showLitterForm, setShowLitterForm] = useState(false);
  const [editingLitterId, setEditingLitterId] = useState<string | null>(null);
  const [litterFormData, setLitterFormData] = useState({
    litter_code: "",
    farrow_date: new Date().toISOString().split("T")[0],
    weaning_date: new Date().toISOString().split("T")[0],
    alive_born: 10,
    boar_used: "",
    status: "DA_CAI_SUA",
    notes: ""
  });

  // FORM SỬA LỊCH SỬ PHỐI GIỐNG (INSEMINATION)
  const [editingInsemId, setEditingInsemId] = useState<string | null>(null);
  const [insemFormData, setInsemFormData] = useState({
    sow_ear_tag: "",
    boar_ear_tag: "",
    mating_date: new Date().toISOString().split("T")[0]
  });

  const [farrowingSow, setFarrowingSow] = useState<Pig | null>(null);
  const [farrowInput, setFarrowInput] = useState({
    farrow_date: new Date().toISOString().split("T")[0],
    alive_born: 10,
    dead_born: 0,
    notes: ""
  });

  const [selectedTask, setSelectedTask] = useState<FarmTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // MODAL PHỐI GIỐNG
  const [showMatingModal, setShowMatingModal] = useState(false);
  const [matingSowTag, setMatingSowTag] = useState("");
  const [selectedBoarTag, setSelectedBoarTag] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);

  const requireAuth = useCallback((actionName = "thao tác này"): boolean => {
    if (!user) {
      alert(`⚠️ Bạn đang ở chế độ KHÁCH (Chỉ xem).\nVui lòng ĐĂNG NHẬP để thực hiện ${actionName}!`);
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [user]);

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
        const savedDismissed = localStorage.getItem("farm_dismissed_task_keys");
        if (savedDismissed) {
          const parsedDismissed = JSON.parse(savedDismissed);
          if (Array.isArray(parsedDismissed)) setDismissedTaskKeys(parsedDismissed);
        }
      } catch (e) {}
    }
  }, []);

  const supabase = useMemo(() => {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl.trim(), rawKey.trim());
  }, []);

  const activeOperator = useMemo(() => {
    if (customDisplayName?.trim()) return customDisplayName.trim();
    return "Hà Quang Dự";
  }, [customDisplayName]);

  const logAction = useCallback(async (actionType: string, targetId: string, details: string, imageUrl?: string, taskId?: string) => {
    const newEntry: AuditLog = {
      id: "log-" + Date.now(),
      action_type: actionType,
      target_id: targetId,
      performed_by: activeOperator,
      details,
      image_url: imageUrl,
      task_id: taskId,
      created_at: new Date().toISOString()
    };

    setAuditLogs(prev => {
      const updated = [newEntry, ...prev].slice(0, 80);
      if (typeof window !== "undefined") {
        try { localStorage.setItem("farm_local_audit_logs", JSON.stringify(updated)); } catch (e) {}
      }
      return updated;
    });

    try {
      await supabase.from("audit_logs").insert([
        { action_type: actionType, target_id: targetId, performed_by: activeOperator, details, image_url: imageUrl }
      ]);
    } catch (e) {}
  }, [supabase, activeOperator]);

  const updateLogPhoto = useCallback(async (logId: string, imageUrl: string) => {
    if (!requireAuth("cập nhật ảnh minh chứng")) return;

    setAuditLogs(prev => {
      const updated = prev.map(l => l.id === logId ? { ...l, image_url: imageUrl } : l);
      if (typeof window !== "undefined") {
        try { localStorage.setItem("farm_local_audit_logs", JSON.stringify(updated)); } catch (e) {}
      }
      return updated;
    });

    try {
      if (!logId.startsWith("log-")) {
        await supabase.from("audit_logs").update({ image_url: imageUrl }).eq("id", logId);
      }
    } catch (e) {}
  }, [supabase, requireAuth]);

  const fetchData = useCallback(async () => {
    try {
      const [pRes, tRes, farRes, insemRes, logRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("farrowings").select("*").order("farrow_date", { ascending: false }),
        supabase.from("inseminations").select("*").order("mating_date", { ascending: false }),
        supabase
          .from("audit_logs")
          .select("*")
          .neq("action_type", "TELEGRAM_DAILY_SENT")
          .neq("action_type", "SYSTEM_CRON_LOCK")
          .order("created_at", { ascending: false })
          .limit(80)
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
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth("đổi mật khẩu")) return;

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
    if (!requireAuth("thay đổi tên người thao tác")) return;
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
    if (st.includes("thịt") || st.includes("thit") || st.includes("vỗ béo") || st.includes("vo beo")) return "THIT";
    if (st.includes("đực") || st.includes("duc")) return "DUC";
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

  const getBreedCategoryInfo = useCallback((breedName?: string, sireTag?: string, damTag?: string) => {
    const bName = (breedName || "").trim();
    const sire = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === (sireTag || "").trim().toUpperCase());
    const dam = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === (damTag || "").trim().toUpperCase());

    const sireBreed = sire?.breed_id || "";
    const damBreed = dam?.breed_id || "";

    const isYorkshireSire = sireBreed.toLowerCase().includes("york");
    const isLanDam = damBreed.toLowerCase().includes("lan") && (damBreed.toLowerCase().includes("hạ") || damBreed.toLowerCase().includes("hl"));

    if (isYorkshireSire && isLanDam) {
      return {
        label: "Lai 3 máu [Y × (L × HL)]",
        badgeColor: "#8b5cf6",
        blood: "75% Ngoại (Yorkshire, Landrace) + 25% Nội (Hạ Lang)"
      };
    }

    if (bName.includes("Hạ Lang") || bName.includes("Móng Cái") || bName.includes("Hương") || bName.includes("Táp Ná")) {
      return {
        label: "Thuần Nội (Bản địa)",
        badgeColor: "#059669",
        blood: "100% Giống nội bản địa"
      };
    }

    if (bName.includes("Duroc") || bName.includes("Landrace") || bName.includes("Yorkshire") || bName.includes("Pietrain")) {
      return {
        label: "Thuần Ngoại",
        badgeColor: "#2563eb",
        blood: "100% Giống ngoại siêu nạc"
      };
    }

    return {
      label: "Lợn Lai F1/F2",
      badgeColor: "#d97706",
      blood: "Tổ hợp lai kinh tế"
    };
  }, [safePigs]);

  const getNutritionAdvice = useCallback((pig: Pig) => {
    const currentState = checkSowState(pig);
    const tagUpper = pig.ear_tag.trim().toUpperCase();

    if (currentState === "THIT") {
      return {
        stage: "Vỗ béo lợn thịt thương phẩm",
        feed: "Ăn tự do (2.2 - 2.8 kg/ngày)",
        specs: "Đạm: 14-16% • Năng lượng: 3.100 - 3.200 kcal/kg ME",
        warning: "Cung cấp đủ nước sạch, chia bữa hoặc cho ăn máng tự động để đạt tăng trọng tối ưu."
      };
    }

    if (currentState === "CHUA") {
      const latestInsem = inseminations.find(ins => (ins.sow_ear_tag || "").trim().toUpperCase() === tagUpper);
      if (latestInsem?.mating_date) {
        const days = safeDateDiff(latestInsem.mating_date);
        if (days >= 0 && days <= 30) {
          return {
            stage: "Chửa kỳ 1 (0-30 ngày): An thai & bám phôi",
            feed: "1.8 - 2.0 kg/ngày",
            specs: "Đạm: 13-14% • Năng lượng: 2.950 kcal/kg ME",
            warning: "⚠️ Khẩu phần hạn chế, không cho ăn thừa tránh làm chết phôi non."
          };
        } else if (days > 30 && days <= 84) {
          return {
            stage: "Chửa kỳ 2 (31-84 ngày): Duy trì thể trạng",
            feed: "2.0 - 2.2 kg/ngày",
            specs: "Đạm: 13-14% • Năng lượng: 3.000 kcal/kg ME",
            warning: "Bổ sung rau xanh hoặc chất xơ để phòng chống táo bón."
          };
        } else if (days > 84 && days <= 110) {
          return {
            stage: "Chửa kỳ 3 (85-110 ngày): Thúc thai & phát triển tuyến vú",
            feed: "Tăng lên 2.8 - 3.2 kg/ngày",
            specs: "Đạm: 16-17% • Năng lượng: 3.150 kcal/kg ME",
            warning: "⚡ Thai tăng 60% khối lượng ở giai đoạn này. Đổi sang cám nái nuôi con."
          };
        } else if (days > 110) {
          return {
            stage: "Chờ đẻ (111-114 ngày): Chuẩn bị lâm bồn",
            feed: "Giảm dần còn 1.0 - 1.5 kg/ngày",
            specs: "Cám nhuận tràng • Bổ sung điện giải Gluco-C",
            warning: "🛑 Giảm thức ăn chống sốt sữa và chèn ép đường sinh. Ngày đẻ nhịn ăn."
          };
        }
      }
    }

    if (currentState === "NUOICON") {
      return {
        stage: "Nuôi con & Tiết sữa đỉnh cao",
        feed: "Khẩu phần: 2.0kg + 0.4kg x số con/ngày",
        specs: "Đạm cao: 17-18% • Năng lượng: 3.250 kcal/kg ME",
        warning: "🍼 Chia ăn 3-4 bữa/ngày. Đảm bảo núm uống nước sạch chảy mạnh (>2 lít/phút)."
      };
    }

    if (currentState === "CHOPHOI") {
      return {
        stage: "Cai sữa & Chờ phối giống",
        feed: "Ngày 1 cai sữa: NHỊN ĂN HOÀN TOÀN. Từ ngày 2: ăn 3.0 - 3.5 kg/ngày",
        specs: "Đạm: 15-16% • Bổ sung Vitamin A, D, E",
        warning: "🥛 Nhịn ăn ngày đầu để tiêu cặn sữa, ngừa viêm vú. Ngày 2 ăn thúc kích trứng rụng."
      };
    }

    if (currentState === "HAUBI" && isSow(pig)) {
      return {
        stage: "Hậu bị nuôi dưỡng chuẩn bị phối giống",
        feed: "Ăn khống chế 2.0 - 2.2 kg/ngày",
        specs: "Đạm: 14-15% • Năng lượng: 3.000 kcal/kg ME",
        warning: "Khống chế mỡ lưng tránh quá béo. Bổ sung Canxi/Photpho phát triển khung xương."
      };
    }

    return null;
  }, [inseminations, checkSowState]);

  const suckingLitters = useMemo(() => {
    return (Array.isArray(litters) ? litters : []).filter(l => {
      if (!l?.sow_ear_tag) return false;
      const st = (l?.status || "").toUpperCase();
      const n = (l?.notes || "").toLowerCase();

      if (st === "DA_XUAT_BAN" || st === "LICH_SU" || n.includes("xuat ban") || n.includes("nái rạ") || n.includes("lịch sử")) {
        return false;
      }
      if (st === "DA_CAI_SUA" || st.includes("CAI") || n.includes("da cai") || n.includes("cai sua")) {
        return false;
      }

      const sowInFarm = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === l.sow_ear_tag.trim().toUpperCase());
      if (sowInFarm && (checkSowState(sowInFarm) === "CHOPHOI" || checkSowState(sowInFarm) === "CHUA")) {
        return false;
      }

      return true;
    });
  }, [litters, safePigs, checkSowState]);

  const weanedLitters = useMemo(() => {
    return (Array.isArray(litters) ? litters : []).filter(l => {
      if (!l?.sow_ear_tag) return false;
      const st = (l?.status || "").toUpperCase();
      const n = (l?.notes || "").toLowerCase();

      if (st === "DA_XUAT_BAN" || st === "LICH_SU" || n.includes("xuat ban") || n.includes("nái rạ") || n.includes("lịch sử")) {
        return false;
      }

      const sowInFarm = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === l.sow_ear_tag.trim().toUpperCase());
      const isSowWeaned = sowInFarm && (checkSowState(sowInFarm) === "CHOPHOI" || checkSowState(sowInFarm) === "CHUA");

      return st === "DA_CAI_SUA" || st.includes("CAI") || n.includes("da cai") || n.includes("cai sua") || isSowWeaned;
    });
  }, [litters, safePigs, checkSowState]);

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

  const executeWeaning = async (sowTag: string, litterId?: string, litterCount?: number) => {
    if (!requireAuth("cai sữa lợn")) return;

    const cleanTag = sowTag.trim().toUpperCase();
    if (!confirm(`Xác nhận cai sữa cho đàn con nái ${cleanTag} (${litterCount || ""} con)?\n- Nái mẹ sẽ chuyển sang "Chờ phối".\n- Đàn con chuyển sang nhóm "Đã cai sữa".`)) {
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];

    setPigs(prev => prev.map(p => (p.ear_tag || "").trim().toUpperCase() === cleanTag ? { ...p, stage: "Chờ phối" } : p));
    setLitters(prev => prev.map(l => {
      const match = litterId ? l.id === litterId : (l.sow_ear_tag || "").trim().toUpperCase() === cleanTag;
      return match ? { ...l, status: "DA_CAI_SUA", weaning_date: todayStr, notes: "Đã cai sữa" } : l;
    }));

    try {
      await supabase.from("pigs").update({ stage: "Chờ phối" }).eq("ear_tag", cleanTag);
      let q = supabase.from("farrowings").update({ status: "DA_CAI_SUA", weaning_date: todayStr, notes: "Đã cai sữa" });
      if (litterId) q = q.eq("id", litterId);
      else q = q.eq("sow_ear_tag", cleanTag);
      await q;

      await supabase.from("farm_tasks").insert([{
        title: `Cai sữa đàn con nái ${cleanTag} (${litterCount || 0} con)`,
        due_date: todayStr,
        related_tag: cleanTag,
        category: "WEAN",
        is_completed: true,
        is_dismissed: false
      }]);

      const logId = "log-" + Date.now();
      const logDetails = `Cai sữa đàn con nái ${cleanTag} (${litterCount || ""} con). Nái mẹ chuyển Chờ phối.`;
      await logAction("WEAN_LITTER", cleanTag, logDetails);

      setActivityPhotoModal({
        isOpen: true,
        activityTitle: `Cai sữa đàn nái ${cleanTag} (${litterCount || ""} con)`,
        actionType: "WEAN_LITTER",
        targetId: cleanTag,
        details: logDetails,
        existingLogId: logId,
        previewImg: ""
      });

      await fetchData();
    } catch (err: any) {
      alert("Lỗi khi cập nhật cai sữa: " + (err?.message || JSON.stringify(err)));
    }
  };

  const generateUniqueTag = (prefix: string, existingTags: Set<string>): string => {
    let index = 1;
    while (true) {
      const candidate = `${prefix}_${String(index).padStart(2, "0")}`;
      if (!existingTags.has(candidate.toUpperCase())) {
        existingTags.add(candidate.toUpperCase());
        return candidate;
      }
      index++;
    }
  };

  const openTransferModal = (litter: FarrowingLitter) => {
    setSelectedLitter(litter);
    const count = litter.alive_born || 0;
    const initialMap: Record<number, "NONE" | "GILT" | "MEAT"> = {};
    for (let i = 1; i <= count; i++) {
      initialMap[i] = "NONE";
    }
    setPigletSelections(initialMap);
    setShowLitterActionModal(true);
  };

  const handleConfirmTransferSelections = async () => {
    if (!requireAuth("chuyển đàn lợn con")) return;
    if (!selectedLitter) return;

    const selections = Object.entries(pigletSelections);
    const giltList = selections.filter(([_, v]) => v === "GILT");
    const meatList = selections.filter(([_, v]) => v === "MEAT");

    const giltCount = giltList.length;
    const meatCount = meatList.length;

    if (giltCount === 0 && meatCount === 0) {
      alert("Bạn chưa tích chọn con nào để chuyển thành Hậu bị hoặc Nuôi thịt!");
      return;
    }

    setIsTransferring(true);
    try {
      const allExistingTags = new Set<string>();
      safePigs.forEach(p => {
        if (p?.ear_tag) allExistingTags.add(p.ear_tag.trim().toUpperCase());
      });

      const damTag = selectedLitter.sow_ear_tag.trim();
      const damPig = safePigs.find(p => p.ear_tag.trim().toUpperCase() === damTag.toUpperCase());
      
      let sireBreedAbbr = "";
      let boarUsedTag = "";
      const match = (selectedLitter.notes || "").match(/\[Đực:\s*([^\]]+)\]/i);
      if (match) boarUsedTag = match[1].trim();

      if (boarUsedTag) {
        const sirePig = safePigs.find(p => p.ear_tag.trim().toUpperCase() === boarUsedTag.toUpperCase());
        sireBreedAbbr = getBreedAbbr(sirePig?.breed_id);
      }

      const damBreedAbbr = getBreedAbbr(damPig?.breed_id);

      let giltPrefix = damBreedAbbr;
      let calculatedBreed = damPig?.breed_id || "Hạ Lang";

      if (sireBreedAbbr && sireBreedAbbr !== damBreedAbbr) {
        giltPrefix = `${sireBreedAbbr}_${damBreedAbbr}`;
        calculatedBreed = `Lai (${sireBreedAbbr} × ${damBreedAbbr})`;
      } else {
        giltPrefix = damBreedAbbr;
      }

      const newPigsToInsert: Partial<Pig>[] = [];
      const generatedTags: string[] = [];

      for (let i = 0; i < giltCount; i++) {
        const uniqueTag = generateUniqueTag(giltPrefix, allExistingTags);
        generatedTags.push(uniqueTag);
        newPigsToInsert.push({
          ear_tag: uniqueTag,
          breed_id: calculatedBreed,
          sex: "Cái",
          stage: "Hậu bị",
          current_pen_code: "CA1",
          status: "Bình thường",
          sire_ear_tag: boarUsedTag || undefined,
          dam_ear_tag: damTag,
          birth_date: selectedLitter.farrow_date,
          notes: `Tuyển hậu bị từ lứa ${selectedLitter.litter_code}`
        });
      }

      const meatPrefix = `${damTag}_T`;
      for (let i = 0; i < meatCount; i++) {
        const uniqueTag = generateUniqueTag(meatPrefix, allExistingTags);
        generatedTags.push(uniqueTag);
        newPigsToInsert.push({
          ear_tag: uniqueTag,
          breed_id: calculatedBreed,
          sex: "Đực",
          stage: "Vỗ béo thịt",
          current_pen_code: "CB1",
          status: "Bình thường",
          sire_ear_tag: boarUsedTag || undefined,
          dam_ear_tag: damTag,
          birth_date: selectedLitter.farrow_date,
          notes: `Chuyển thịt từ lứa ${selectedLitter.litter_code}`
        });
      }

      if (newPigsToInsert.length > 0) {
        const { error: insErr } = await supabase.from("pigs").insert(newPigsToInsert);
        if (insErr) throw insErr;
      }

      const totalInLitter = selectedLitter.alive_born || 0;
      const transferredTotal = giltCount + meatCount;
      const remainingCount = Math.max(0, totalInLitter - transferredTotal);

      await supabase.from("farrowings").update({
        alive_born: remainingCount,
        status: remainingCount === 0 ? "DA_XUAT_BAN" : selectedLitter.status,
        notes: `${selectedLitter.notes || ""} [Đã chuyển: ${giltCount} Hậu bị, ${meatCount} Thịt]`.trim()
      }).eq("id", selectedLitter.id);

      const logMsg = `Phân loại lô ${selectedLitter.litter_code} nái ${damTag}: tuyển ${giltCount} Hậu bị, ${meatCount} Thịt. Mã mới sinh: ${generatedTags.join(", ")}`;
      await logAction("TRANSFER_LITTER", damTag, logMsg);

      alert(`✅ Đã chuyển thành công!\n- ${giltCount} Hậu bị\n- ${meatCount} Lợn thịt\nMã thẻ tai vừa cấp: ${generatedTags.join(", ")}`);
      setShowLitterActionModal(false);
      setSelectedLitter(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi khi chuyển đàn: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleRevertPigToLitter = async (pig: Pig) => {
    if (!requireAuth("hoàn tác cá thể")) return;
    if (!confirm(`Xác nhận XÓA cá thể "${pig.ear_tag}" và trả lại 1 con vào lô con nái mẹ (${pig.dam_ear_tag || "lô gốc"})?`)) {
      return;
    }

    try {
      const { error: delErr } = await supabase.from("pigs").delete().eq("id", pig.id);
      if (delErr) throw delErr;

      if (pig.dam_ear_tag) {
        const normDam = pig.dam_ear_tag.trim().toUpperCase();
        const parentLitter = litters.find(l => (l.sow_ear_tag || "").trim().toUpperCase() === normDam);
        if (parentLitter) {
          await supabase.from("farrowings").update({
            alive_born: Number(parentLitter.alive_born || 0) + 1,
            status: "DA_CAI_SUA"
          }).eq("id", parentLitter.id);
        }
      }

      await logAction("REVERT_PIG", pig.ear_tag, `Hoàn tác xóa cá thể ${pig.ear_tag} và trả 1 con về lô con nái mẹ ${pig.dam_ear_tag || "—"}`);
      alert(`✅ Đã hoàn tác thành công cá thể ${pig.ear_tag}!`);
      setActiveProfilePig(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi khi hoàn tác cá thể: " + err.message);
    }
  };

  const handleSellLitter = async (litter: FarrowingLitter) => {
    if (!requireAuth("xuất bán lợn con")) return;
    const count = litter.alive_born || 0;
    if (!confirm(`Xác nhận XUẤT BÁN toàn bộ lô con nái ${litter.sow_ear_tag} (${count} con)?`)) return;

    try {
      await supabase.from("farrowings").update({
        status: "DA_XUAT_BAN",
        notes: `${litter.notes || ""} [Đã xuất bán ngày ${new Date().toLocaleDateString('vi-VN')}]`.trim()
      }).eq("id", litter.id);

      await logAction("SELL_LITTER", litter.sow_ear_tag, `Xuất bán toàn bộ lô con ${litter.litter_code} (${count} con)`);
      alert(`✅ Đã ghi nhận xuất bán thành công ${count} lợn con!`);
      setShowLitterActionModal(false);
      setSelectedLitter(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi xuất bán: " + err.message);
    }
  };

  const handleConfirmFarrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth("ghi nhận nái đẻ")) return;
    if (!farrowingSow) return;

    const sowTag = farrowingSow.ear_tag.trim().toUpperCase();
    const aliveCount = Number(farrowInput.alive_born || 0);
    const deadCount = Number(farrowInput.dead_born || 0);

    const analysis = getSowReproAnalysis(sowTag);
    const nextLitterNum = analysis.totalLitters + 1;
    const litterCode = `L${nextLitterNum}-${sowTag}`;

    try {
      const { error: farrowErr } = await supabase.from("farrowings").insert([{
        litter_code: litterCode,
        sow_ear_tag: sowTag,
        farrow_date: farrowInput.farrow_date,
        alive_born: aliveCount,
        weaning_date: safeAddDays(farrowInput.farrow_date, 28),
        status: "DANG_THEO_ME",
        notes: `Đẻ ${aliveCount} sống, ${deadCount} chết. ${farrowInput.notes || ""}`.trim()
      }]);
      if (farrowErr) throw farrowErr;

      await supabase.from("pigs").update({ stage: "Nuôi con" }).eq("ear_tag", sowTag);

      const sowInsems = (inseminations || []).filter(i => (i.sow_ear_tag || "").trim().toUpperCase() === sowTag);
      if (sowInsems.length > 0) {
        await supabase.from("inseminations").update({ status: "Đã đẻ" }).eq("id", sowInsems[0].id);
      }

      await supabase.from("farm_tasks").insert([{
        title: `Ghi nhận nái ${sowTag} đẻ lứa ${litterCode} (${aliveCount} con sống)`,
        due_date: farrowInput.farrow_date,
        related_tag: sowTag,
        category: "REPRO",
        is_completed: true,
        is_dismissed: false
      }]);

      await supabase.from("farm_tasks").insert([{
        title: `Tiêm Sắt + Nhỏ Cầu trùng đàn con nái ${sowTag} (${aliveCount} con)`,
        due_date: safeAddDays(farrowInput.farrow_date, 3),
        related_tag: sowTag,
        category: "VET",
        is_completed: false,
        is_dismissed: false
      }]);

      const logId = "log-" + Date.now();
      const logDetails = `Nái ${sowTag} đẻ lứa ${litterCode}: ${aliveCount} con sống, ${deadCount} con chết -> Nuôi con`;
      await logAction("FARROW_SOW", sowTag, logDetails);

      setFarrowingSow(null);

      setActivityPhotoModal({
        isOpen: true,
        activityTitle: `Nái ${sowTag} đẻ lứa ${litterCode}`,
        actionType: "FARROW_SOW",
        targetId: sowTag,
        details: logDetails,
        existingLogId: logId,
        previewImg: ""
      });

      await fetchData();
    } catch (err: any) {
      alert("Lỗi khi ghi nhận nái đẻ: " + (err?.message || JSON.stringify(err)));
    }
  };

  const handleSaveProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth("chỉnh sửa hồ sơ cá thể")) return;
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
        birth_date: activeProfilePig.birth_date || null,
        notes: activeProfilePig.notes || null
      };

      const { error } = await supabase.from("pigs").update(updatedPayload).eq("id", activeProfilePig.id);
      if (error) throw error;

      setPigs(prev => prev.map(p => p.id === activeProfilePig.id ? { ...p, ...updatedPayload } : p));
      setActiveProfilePig(prev => prev ? { ...prev, ...updatedPayload } : null);

      await logAction("UPDATE_PIG", cleanTag, `Cập nhật thông tin cá thể ${cleanTag} (${updatedPayload.sex} - ${updatedPayload.stage})`);
      alert(`✅ Đã lưu thành công! Cá thể ${cleanTag} hiện có trạng thái: "${updatedPayload.stage}".`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu nái: " + (err?.message || JSON.stringify(err)));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSaveLitter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth("thêm hoặc sửa lứa đẻ")) return;
    if (!activeProfilePig) return;

    const sowTag = activeProfilePig.ear_tag.trim().toUpperCase();
    const boarNote = litterFormData.boar_used.trim() ? `[Đực: ${litterFormData.boar_used.trim().toUpperCase()}]` : "";
    const cleanNotes = `${boarNote} ${litterFormData.notes.trim()}`.trim();
    const newAliveCount = Number(litterFormData.alive_born || 0);

    try {
      if (editingLitterId) {
        const oldLitter = litters.find(l => l.id === editingLitterId);
        const oldAlive = oldLitter ? oldLitter.alive_born : "?";

        const payload = {
          litter_code: litterFormData.litter_code.trim().toUpperCase(),
          farrow_date: litterFormData.farrow_date,
          weaning_date: litterFormData.weaning_date,
          alive_born: newAliveCount,
          status: litterFormData.status,
          notes: cleanNotes || "Lịch sử nái"
        };
        const { error } = await supabase.from("farrowings").update(payload).eq("id", editingLitterId);
        if (error) throw error;

        setLitters(prev => prev.map(l => l.id === editingLitterId ? { ...l, ...payload } : l));

        await logAction(
          "UPDATE_LITTER",
          sowTag,
          `Điều chỉnh lứa ${payload.litter_code} nái ${sowTag}: sửa số con từ ${oldAlive} xuống ${newAliveCount} con (Ngày đẻ: ${formatDateVN(payload.farrow_date)})`
        );

        alert(`✅ Đã cập nhật lứa ${payload.litter_code} và ghi nhận vào Nhật ký!`);
      } else {
        const payload = {
          litter_code: litterFormData.litter_code.trim().toUpperCase() || `L-${sowTag}-${Date.now().toString().slice(-4)}`,
          sow_ear_tag: sowTag,
          farrow_date: litterFormData.farrow_date,
          weaning_date: litterFormData.weaning_date,
          alive_born: newAliveCount,
          status: litterFormData.status,
          notes: cleanNotes || "Lịch sử nái"
        };
        const { error } = await supabase.from("farrowings").insert([payload]);
        if (error) throw error;

        await logAction(
          "CREATE_LITTER",
          sowTag,
          `Thêm lứa ${payload.litter_code} cho nái ${sowTag}: ${newAliveCount} con (Ngày đẻ: ${formatDateVN(payload.farrow_date)})`
        );

        alert(`✅ Đã lưu lứa ${payload.litter_code} vào Nhật ký!`);
      }

      setShowLitterForm(false);
      setEditingLitterId(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu lứa: " + err.message);
    }
  };

  const handleDeleteLitter = async (litterId: string, litterCode: string) => {
    if (!requireAuth("xóa lứa đẻ")) return;
    if (!confirm(`Xác nhận xóa bỏ lứa đẻ "${litterCode}"?`)) return;
    try {
      await supabase.from("farrowings").delete().eq("id", litterId);
      setLitters(prev => prev.filter(l => l.id !== litterId));
      alert(`Đã xóa thành công lứa đẻ ${litterCode}!`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  const handleSaveInsemEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requireAuth("sửa thông tin phối giống")) return;
    if (!editingInsemId) return;

    try {
      const expFarrow = safeAddDays(insemFormData.mating_date, 114);
      const payload = {
        boar_ear_tag: insemFormData.boar_ear_tag.trim().toUpperCase(),
        mating_date: insemFormData.mating_date,
        expected_farrow_date: expFarrow
      };

      const { error } = await supabase.from("inseminations").update(payload).eq("id", editingInsemId);
      if (error) throw error;

      setInseminations(prev => prev.map(ins => ins.id === editingInsemId ? { ...ins, ...payload } : ins));

      await logAction(
        "UPDATE_INSEMINATION",
        insemFormData.sow_ear_tag,
        `Sửa ngày phối nái ${insemFormData.sow_ear_tag} thành ${formatDateVN(payload.mating_date)} (Đực: ${payload.boar_ear_tag}). Dự sinh mới: ${formatDateVN(expFarrow)}`
      );

      alert(`✅ Đã sửa ngày phối thành công! Ngày dự sinh mới là: ${formatDateVN(expFarrow)}.`);
      setEditingInsemId(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi sửa ngày phối: " + err.message);
    }
  };

  const handleExportWord = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const yy = String(yyyy).slice(-2);
    const todayStr = today.toISOString().split("T")[0];
    const filename = `baocao_${reportDays}ngay_${dd}_${mm}_${yy}.doc`;
    const formatNum = (n: number) => String(n).padStart(2, "0");

    const recentEvents: string[] = [];
    (Array.isArray(litters) ? litters : []).forEach(l => {
      const dDiff = safeDateDiff(l.farrow_date);
      if (dDiff >= 0 && dDiff <= reportDays) {
        const sowInfo = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === (l.sow_ear_tag || "").trim().toUpperCase());
        const bName = sowInfo?.breed_id ? `Hạ Lang ${l.sow_ear_tag}` : l.sow_ear_tag;
        let noteStr = `Ngày ${formatDateVN(l.farrow_date)} – Lợn nái ${bName} đẻ ${formatNum(l.alive_born)} con`;
        if (l.weaning_date && (l.status === "DA_CAI_SUA" || (l.notes || "").includes("cai sữa"))) {
          noteStr += ` (đã cai sữa ngày ${formatDateVN(l.weaning_date)})`;
        }
        recentEvents.push(noteStr);
      }
    });

    const boarsByBreed: Record<string, number> = {};
    boarList.forEach(b => {
      const br = b.breed_id || "Landrace";
      boarsByBreed[br] = (boarsByBreed[br] || 0) + 1;
    });

    const sowsGrouped: Record<string, Record<string, number>> = {};
    sowList.forEach(s => {
      let br = s.breed_id || "Hạ Lang";
      if (br.toLowerCase().includes("hạ lang") || br.toLowerCase().includes("ha lang")) br = "Nái sinh sản Hạ Lang";
      else if (br.toLowerCase().includes("hương") || br.toLowerCase().includes("huong")) br = "Nái sinh sản Hương";
      else if (br.toLowerCase().includes("lai") || br.toLowerCase().includes("york")) br = "Nái sinh sản Lai";
      else br = `Nái sinh sản ${br}`;

      if (!sowsGrouped[br]) sowsGrouped[br] = {};
      const st = formatVietnameseStage(s.stage);
      sowsGrouped[br][st] = (sowsGrouped[br][st] || 0) + 1;
    });

    const doneTasksList = filteredCompletedTasks.map(t => `• ${t.title}`);
    const doneTasksText = doneTasksList.length > 0 
      ? doneTasksList.join("<br/>")
      : "• Không có công việc phát sinh đặc biệt.";

    const validUpcomingTasks = fullTasks.filter(t => {
      if (t.is_completed || t.is_dismissed) return false;
      if (t.due_date && t.due_date < todayStr) return false;
      
      const dDiff = safeDateDiff(t.due_date);
      return Math.abs(dDiff) <= reportDays;
    }).map(t => `• ${t.title}`);

    const nextTasksText = validUpcomingTasks.length > 0
      ? validUpcomingTasks.join("<br/>")
      : "• Tiếp tục theo dõi chăm sóc nuôi dưỡng và duy trì an toàn sinh học toàn trại.";

    let tableRowsHtml = "";
    let stt = 1;

    Object.entries(boarsByBreed).forEach(([br, cnt]) => {
      tableRowsHtml += `
        <tr>
          <td align="center">${stt++}</td>
          <td>Đực giống ${br}</td>
          <td align="center">Khai thác</td>
          <td align="center">${formatNum(cnt)} con</td>
          <td align="center">${formatNum(cnt)}</td>
        </tr>
      `;
    });

    Object.entries(sowsGrouped).forEach(([groupName, stages]) => {
      const stageEntries = Object.entries(stages);
      const totalInGroup = stageEntries.reduce((sum, [_, c]) => sum + c, 0);
      const rowSpan = stageEntries.length;

      stageEntries.forEach(([stName, cnt], idx) => {
        if (idx === 0) {
          tableRowsHtml += `
            <tr>
              <td rowspan="${rowSpan}" align="center">${stt++}</td>
              <td rowspan="${rowSpan}">${groupName}</td>
              <td align="center">${stName}</td>
              <td align="center">${formatNum(cnt)} con</td>
              <td rowspan="${rowSpan}" align="center">${formatNum(totalInGroup)}</td>
            </tr>
          `;
        } else {
          tableRowsHtml += `
            <tr>
              <td align="center">${stName}</td>
              <td align="center">${formatNum(cnt)} con</td>
            </tr>
          `;
        }
      });
    });

    tableRowsHtml += `
      <tr>
        <td rowspan="2" align="center">${stt++}</td>
        <td rowspan="2">Lợn con</td>
        <td align="center">Theo mẹ</td>
        <td align="center">${formatNum(suckingPigletsCount)} con</td>
        <td rowspan="2" align="center">${formatNum(totalPigletsCount)}</td>
      </tr>
      <tr>
        <td align="center">Cai sữa</td>
        <td align="center">${formatNum(weanedPigletsCount)} con</td>
      </tr>
    `;

    tableRowsHtml += `
      <tr>
        <td align="center">${stt++}</td>
        <td>Lợn thịt</td>
        <td align="center">Vỗ béo</td>
        <td align="center">${formatNum(meatList.length)} con</td>
        <td align="center">${formatNum(meatList.length)}</td>
      </tr>
    `;

    tableRowsHtml += `
      <tr style="background:#f2f2f2; font-weight:bold;">
        <td colspan="4" align="center">Tổng</td>
        <td align="center">${grandTotal}</td>
      </tr>
    `;

    const wordHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Báo Cáo</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.5; }
          h2 { text-align: center; font-size: 17pt; font-weight: bold; margin-bottom: 2px; }
          p.sub { text-align: center; font-style: italic; font-size: 12pt; margin-top: 0; margin-bottom: 16px; }
          h3 { font-size: 13.5pt; font-weight: bold; margin-top: 14px; margin-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12pt; }
          th, td { border: 1px solid black; padding: 6px 8px; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <h2>BÁO CÁO NHANH BỘ PHẬN CHĂN NUÔI</h2>
        <p class="sub">Người báo cáo: ${activeOperator} - Ngày ${dd}/${mm}/${yyyy}</p>

        <h3>I. CƠ CẤU ĐÀN (${reportDays} NGÀY QUA)</h3>
        <p><b>Tổng đàn: ${grandTotal} con</b> (Nái: ${sowList.length} | Đực: ${boarList.length} | Lợn con: ${totalPigletsCount} | Lợn thịt: ${meatList.length}).</p>

        <p><b>Biến động đàn:</b><br/>
          ${recentEvents.length > 0 
            ? recentEvents.map(e => `&nbsp;&nbsp;&nbsp;&nbsp;${e}`).join("<br/>") 
            : "&nbsp;&nbsp;&nbsp;&nbsp;Không có biến động đẻ/cai sữa trong kỳ báo cáo."}
        </p>

        <table>
          <thead>
            <tr>
              <th style="width: 8%;">STT</th>
              <th style="width: 38%;">Phân loại</th>
              <th style="width: 24%;">Trạng thái</th>
              <th style="width: 18%;">Số lượng</th>
              <th style="width: 12%;">Tổng</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>

        <h3>II. NHỮNG CÔNG VIỆC ĐÃ THỰC HIỆN (${reportDays} NGÀY QUA)</h3>
        <div style="font-size: 12pt; line-height: 1.6; margin-left: 10px;">
          ${doneTasksText}
        </div>

        <h3>III. KẾ HOẠCH CÔNG VIỆC THỜI GIAN TIẾP THEO</h3>
        <div style="font-size: 12pt; line-height: 1.6; margin-left: 10px;">
          ${nextTasksText}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          is_dismissed: dismissedTaskKeys.includes(key),
          is_auto: true
        });
      }

      if (d >= 104 && d <= 116) {
        const key = `repro-cd-${tagUpper}`;
        const currentSow = safePigs.find(p => (p.ear_tag || "").trim().toUpperCase() === tagUpper);
        const currentPen = (currentSow?.current_pen_code || "").toUpperCase();
        const alreadyInFarrowingPen = currentPen.includes("CD") || currentPen.includes("DE");

        taskMap.set(key, {
          id: key,
          title: `[CHUẨN BỊ ĐẺ] Chuyển nái ${ins.sow_ear_tag} lên chuồng đẻ & sát trùng vú`,
          due_date: safeAddDays(ins.mating_date, 107),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: completedTaskKeys.includes(key) || alreadyInFarrowingPen,
          is_dismissed: dismissedTaskKeys.includes(key),
          is_auto: true
        });
      }
    });

    suckingLitters.forEach(lit => {
      if (!lit?.farrow_date || !lit?.sow_ear_tag) return;
      const tagUpper = lit.sow_ear_tag.trim().toUpperCase();
      const ageDays = safeDateDiff(lit.farrow_date);
      if (ageDays === -999) return;

      const ironKey = `vet-iron-${tagUpper}-${lit.farrow_date}`;
      taskMap.set(ironKey, {
        id: ironKey,
        title: `[THÚ Y] Tiêm Sắt + Nhỏ Cầu trùng đàn nái ${lit.sow_ear_tag} (${lit.alive_born} con)`,
        due_date: safeAddDays(lit.farrow_date, 3),
        related_tag: lit.sow_ear_tag,
        category: "VET",
        is_completed: completedTaskKeys.includes(ironKey) || ageDays > 6,
        is_dismissed: dismissedTaskKeys.includes(ironKey),
        is_auto: true
      });

      const mycoKey = `vet-myco-${tagUpper}-${lit.farrow_date}`;
      taskMap.set(mycoKey, {
        id: mycoKey,
        title: `[THÚ Y] Tiêm phòng Suyễn lợn mũi 1 đàn nái ${lit.sow_ear_tag}`,
        due_date: safeAddDays(lit.farrow_date, 7),
        related_tag: lit.sow_ear_tag,
        category: "VET",
        is_completed: completedTaskKeys.includes(mycoKey) || ageDays > 12,
        is_dismissed: dismissedTaskKeys.includes(mycoKey),
        is_auto: true
      });
    });

    sowList.filter(p => checkSowState(p) === "HAUBI" && p.birth_date).forEach(hb => {
      const tagUpper = hb.ear_tag.trim().toUpperCase();
      const ageDays = safeDateDiff(hb.birth_date);
      if (ageDays === -999) return;

      if (ageDays >= 140 && ageDays <= 220) {
        const parvoKey = `vet-parvo-${tagUpper}`;
        const isParvoDoneInDb = (Array.isArray(dbTasks) ? dbTasks : []).some(
          t => (t.related_tag || "").trim().toUpperCase() === tagUpper &&
               (t.title || "").toLowerCase().includes("parvovirus") &&
               t.is_completed
        );

        taskMap.set(parvoKey, {
          id: parvoKey,
          title: `[HẬU BỊ] Tiêm vaccine Parvovirus (khô thai) nái hậu bị ${hb.ear_tag}`,
          due_date: safeAddDays(hb.birth_date, 160),
          related_tag: hb.ear_tag,
          category: "VET",
          is_completed: completedTaskKeys.includes(parvoKey) || isParvoDoneInDb,
          is_dismissed: dismissedTaskKeys.includes(parvoKey),
          is_auto: true
        });

        const heatKey = `repro-heat-${tagUpper}`;
        const isHeatDoneInDb = (Array.isArray(dbTasks) ? dbTasks : []).some(
          t => (t.related_tag || "").trim().toUpperCase() === tagUpper &&
               (t.title || "").toLowerCase().includes("theo dõi biểu hiện động dục") &&
               t.is_completed
        );

        taskMap.set(heatKey, {
          id: heatKey,
          title: `[HẬU BỊ] Theo dõi biểu hiện động dục & tiếp xúc đực thí nghiệm nái ${hb.ear_tag}`,
          due_date: safeAddDays(hb.birth_date, 175),
          related_tag: hb.ear_tag,
          category: "REPRO",
          is_completed: completedTaskKeys.includes(heatKey) || isHeatDoneInDb,
          is_dismissed: dismissedTaskKeys.includes(heatKey),
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

      const isDismissed = t.is_dismissed || dismissedTaskKeys.includes(uniqueKey);

      if (taskMap.has(uniqueKey)) {
        const existing = taskMap.get(uniqueKey)!;
        if (!existing.is_completed && t.is_completed) {
          taskMap.set(uniqueKey, { ...t, category: cat, is_dismissed: isDismissed });
        }
      } else {
        taskMap.set(uniqueKey, { ...t, category: cat, is_dismissed: isDismissed });
      }
    });

    return Array.from(taskMap.values());
  }, [inseminations, suckingLitters, sowList, checkSowState, dbTasks, completedTaskKeys, dismissedTaskKeys, safePigs]);

  const filteredPendingTasks = useMemo(() => {
    return fullTasks.filter(t => {
      if (t.is_completed || t.is_dismissed) return false;
      if (taskCategoryFilter !== "ALL" && t.category !== taskCategoryFilter) return false;

      const dDiff = safeDateDiff(t.due_date);
      if (dDiff === -999) return true;
      return dDiff >= 0 || Math.abs(dDiff) <= pendingTaskDays;
    });
  }, [fullTasks, taskCategoryFilter, pendingTaskDays]);

  const filteredCompletedTasks = useMemo(() => {
    return fullTasks.filter(t => {
      if (!t.is_completed || t.is_dismissed) return false;
      if (taskCategoryFilter !== "ALL" && t.category !== taskCategoryFilter) return false;

      const dDiff = safeDateDiff(t.due_date);
      if (dDiff === -999) return true;
      return dDiff >= 0 && dDiff <= completedTaskDays;
    });
  }, [fullTasks, taskCategoryFilter, completedTaskDays]);

  const confirmCompleteTask = async () => {
    if (!requireAuth("xác nhận hoàn thành công việc")) return;
    if (!selectedTask) return;
    const taskKey = selectedTask.id;
    const sowTag = selectedTask.related_tag?.trim().toUpperCase();
    const taskTitle = selectedTask.title;

    const newDone = Array.from(new Set([...completedTaskKeys, taskKey]));
    setCompletedTaskKeys(newDone);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_done_task_keys", JSON.stringify(newDone)); } catch (e) {}
    }

    if (selectedTask.id.startsWith("repro-cd-") && sowTag) {
      await supabase.from("pigs").update({ current_pen_code: "CD1" }).eq("ear_tag", sowTag);
      setPigs(prev => prev.map(p => (p.ear_tag || "").trim().toUpperCase() === sowTag ? { ...p, current_pen_code: "CD1" } : p));
    }

    try {
      await supabase.from("farm_tasks").insert([{
        title: taskTitle,
        due_date: selectedTask.due_date,
        related_tag: selectedTask.related_tag,
        category: selectedTask.category,
        is_completed: true,
        is_dismissed: false
      }]);
    } catch (e) {}

    const logId = "log-" + Date.now();
    const logDetails = `Đã hoàn thành công việc: ${taskTitle}`;
    await logAction("COMPLETE_TASK", sowTag || "TASK", logDetails, undefined, taskKey);

    setActivityPhotoModal({
      isOpen: true,
      activityTitle: taskTitle,
      actionType: "COMPLETE_TASK",
      targetId: sowTag || "TASK",
      details: logDetails,
      taskId: taskKey,
      existingLogId: logId,
      previewImg: ""
    });

    setShowTaskModal(false);
    setSelectedTask(null);
    await fetchData();
  };

  const handleDismissTask = async (task: FarmTask) => {
    if (!requireAuth("bỏ qua công việc")) return;
    if (!confirm(`Bạn có chắc chắn muốn BỎ QUA công việc này?\n"${task.title}"\n(Bạn có thể khôi phục lại bất kỳ lúc nào trong mục Cài đặt & Nhật ký).`)) {
      return;
    }

    const taskKey = task.id;
    const newDismissed = Array.from(new Set([...dismissedTaskKeys, taskKey]));
    setDismissedTaskKeys(newDismissed);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_dismissed_task_keys", JSON.stringify(newDismissed)); } catch (e) {}
    }

    await logAction("DISMISS_TASK", task.related_tag || "TASK", `[ĐÃ BỎ QUA] Công việc: ${task.title}`, undefined, taskKey);
    alert(`Đã bỏ qua công việc "${task.title}".`);
    setShowTaskModal(false);
    setSelectedTask(null);
  };

  const handleRestoreTask = async (taskId?: string, taskTitle?: string) => {
    if (!requireAuth("khôi phục công việc")) return;
    if (!taskId) return;
    if (!confirm(`Khôi phục lại công việc này về danh sách Việc Cần Làm?\n"${taskTitle || ""}"`)) return;

    const newDismissed = dismissedTaskKeys.filter(k => k !== taskId);
    setDismissedTaskKeys(newDismissed);
    if (typeof window !== "undefined") {
      try { localStorage.setItem("farm_dismissed_task_keys", JSON.stringify(newDismissed)); } catch (e) {}
    }

    await logAction("RESTORE_TASK", "TASK", `[KHÔI PHỤC] Đã khôi phục lại công việc: ${taskTitle || ""}`);
    alert(`✅ Đã khôi phục thành công! Công việc đã xuất hiện trở lại trong Việc Cần Làm.`);
    await fetchData();
  };

  const renderPigCard = (pig: Pig) => {
    const isThisSow = isSow(pig);
    const reproData = isThisSow ? getSowReproAnalysis(pig.ear_tag) : null;
    const currentState = checkSowState(pig);
    const gestation = isThisSow && currentState === "CHUA" ? getGestationProgress(pig.ear_tag) : null;
    const nutri = getNutritionAdvice(pig);
    const breedCat = getBreedCategoryInfo(pig.breed_id, pig.sire_ear_tag, pig.dam_ear_tag);
    const canMate = isThisSow && (currentState === "CHOPHOI" || currentState === "HAUBI");

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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "21px", fontWeight: "900", color: "#1e1b4b", letterSpacing: "0.5px" }}>
              {pig.ear_tag}
            </span>
            <span style={{ fontSize: "11px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px", background: "#f5f3ff", color: breedCat.badgeColor, border: `1px solid ${breedCat.badgeColor}33` }}>
              {breedCat.label}
            </span>
          </div>
          
          <div style={{ display: "flex", gap: "6px" }}>
            {canMate && (
              <button
                onClick={() => {
                  if (!requireAuth("phối giống")) return;
                  setMatingSowTag(pig.ear_tag);
                  setSelectedBoarTag(boarList[0]?.ear_tag || "");
                  setMatingDate(new Date().toISOString().split("T")[0]);
                  setShowMatingModal(true);
                }}
                style={{
                  fontSize: "13px", fontWeight: "900", padding: "7px 12px", borderRadius: "10px",
                  background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer"
                }}
              >
                🔬 Phối giống
              </button>
            )}

            {isThisSow && currentState === "CHUA" && (
              <button
                onClick={() => {
                  if (!requireAuth("báo đẻ")) return;
                  setFarrowInput({
                    farrow_date: new Date().toISOString().split("T")[0],
                    alive_born: 10,
                    dead_born: 0,
                    notes: ""
                  });
                  setFarrowingSow(pig);
                }}
                style={{
                  fontSize: "13px", fontWeight: "900", padding: "7px 12px", borderRadius: "10px",
                  background: "#10b981", color: "#fff", border: "none", cursor: "pointer"
                }}
              >
                🐷 Báo đẻ
              </button>
            )}

            <button
              onClick={() => {
                setActiveProfilePig({ ...pig });
                setProfileTab("EDIT");
                setShowLitterForm(false);
                setEditingInsemId(null);
              }}
              style={{
                fontSize: "13px", fontWeight: "800", padding: "7px 14px", borderRadius: "10px",
                background: "#ede9fe", color: "#6d28d9", border: "1.5px solid #ddd6fe", cursor: "pointer"
              }}
            >
              ⚙️ Hồ Sơ & Chi Tiết
            </button>
          </div>
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
              <span style={{ color: "#3b82f6" }}>⏳ Ngày {gestation.daysPassed}/114 thai kỳ (Đực: {gestation.boarTag})</span>
              <span style={{ color: "#475569" }}>Dự sinh: {formatDateVN(gestation.expectedFarrowDate)}</span>
            </div>
            <div style={{ height: "8px", width: "100%", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${gestation.pct}%`, background: "#3b82f6" }} />
            </div>
          </div>
        )}

        {nutri && (
          <div style={{ background: "#fefce8", border: "1.5px solid #fef08a", borderRadius: "10px", padding: "10px 12px", marginTop: "4px" }}>
            <div style={{ fontSize: "12px", fontWeight: "900", color: "#854d0e", marginBottom: "4px", display: "flex", justifyContent: "space-between" }}>
              <span>🌾 DINH DƯỠNG: {nutri.stage}</span>
              <span style={{ color: "#b45309", fontWeight: "800" }}>{nutri.feed}</span>
            </div>
            <div style={{ fontSize: "12px", color: "#451a03", fontWeight: "700" }}>
              • Tiêu chuẩn: {nutri.specs}
            </div>
            <div style={{ fontSize: "11px", color: "#92400e", marginTop: "3px", fontStyle: "italic" }}>
              {nutri.warning}
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

  if (!mounted) {
    return (
      <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>🐖</div>
          <div style={{ fontSize: "15px", fontWeight: "800", color: "#5b21b6" }}>Đang tải Trại Lợn Nà Roác...</div>
        </div>
      </div>
    );
  }

  const sowPct = grandTotal > 0 ? ((sowList.length / grandTotal) * 100).toFixed(0) : "0";
  const boarPct = grandTotal > 0 ? ((boarList.length / grandTotal) * 100).toFixed(0) : "0";
  const pigletPct = grandTotal > 0 ? ((totalPigletsCount / grandTotal) * 100).toFixed(0) : "0";
  const meatPct = grandTotal > 0 ? ((meatList.length / grandTotal) * 100).toFixed(0) : "0";

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto", position: "relative", paddingBottom: "75px" }}>
      
      {/* THANH ĐIỀU HƯỚNG VẬT NUÔI DÙNG CHUNG */}
      <FarmSpeciesNav />

      {/* HEADER */}
      <header style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff", position: "sticky", top: "58px", zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => setIsSidebarOpen(true)} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>☰</button>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "900", margin: 0, color: "#1e1b4b", display: "flex", alignItems: "center", gap: "6px" }}>
              {currentMenu === "OVERVIEW" && "TỔNG QUAN"}
              {currentMenu === "SOW" && "QUẢN LÝ NÁI"}
              {currentMenu === "BOAR" && "QUẢN LÝ ĐỰC"}
              {currentMenu === "PIGLET" && "LỢN CON THEO LÔ"}
              {currentMenu === "MEAT" && "LỢN THỊT"}
              {currentMenu === "PEDIGREE" && "GIA PHẢ ĐÀN"}
              {currentMenu === "GUIDE" && "QUY TRÌNH THÚ Y"}
              {currentMenu === "SEARCH" && "TRA CỨU"}
              {currentMenu === "SETTINGS" && "CÀI ĐẶT"}
              {!user && <span style={{ fontSize: "10px", background: "#fef3c7", color: "#d97706", padding: "2px 6px", borderRadius: "4px", fontWeight: "800" }}>Khách</span>}
            </h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {user ? (
            <>
              <button onClick={() => setShowChangePwdModal(true)} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Đổi MK</button>
              <button onClick={handleLogout} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", fontSize: "12px", fontWeight: "800", color: "#ef4444", cursor: "pointer" }}>Thoát</button>
            </>
          ) : (
            <button onClick={() => setShowAuthModal(true)} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", background: "#5b21b6", color: "#fff", fontSize: "12px", fontWeight: "900", cursor: "pointer" }}>🔑 Đăng nhập</button>
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
          <button onClick={() => { if (requireAuth("thêm nái mới")) setShowAddPigModal(true); }} style={{ flex: 1, padding: "11px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "900", fontSize: "13px", cursor: "pointer" }}>
            + Thêm nái mới
          </button>
          <button onClick={() => {
            if (requireAuth("lập kế hoạch phối giống")) {
              setMatingSowTag(sowList[0]?.ear_tag || "");
              setSelectedBoarTag(boarList[0]?.ear_tag || "");
              setMatingDate(new Date().toISOString().split("T")[0]);
              setShowMatingModal(true);
            }
          }} style={{ flex: 1, padding: "11px", borderRadius: "10px", background: "#7c3aed", color: "#fff", border: "none", fontWeight: "900", fontSize: "13px", cursor: "pointer" }}>
            🔬 Phối giống (Tránh cận huyết)
          </button>
        </div>
      )}

      {/* 1. MÀN HÌNH TỔNG QUAN */}
      {currentMenu === "OVERVIEW" && (
        <div style={{ padding: "16px" }}>
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

          <div style={{ marginBottom: "22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: 0 }}>
                🔔 VIỆC CẦN LÀM ({filteredPendingTasks.length})
              </h3>

              <div style={{ display: "flex", gap: "4px" }}>
                {[7, 15, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setPendingTaskDays(d as any)}
                    style={{
                      padding: "4px 8px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer",
                      background: pendingTaskDays === d ? "#5b21b6" : "#e2e8f0",
                      color: pendingTaskDays === d ? "#fff" : "#475569"
                    }}
                  >
                    {d} ngày
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto" }}>
              {[{ id: "ALL", label: "Tất cả" }, { id: "VET", label: "Thú y" }, { id: "REPRO", label: "Sinh sản" }, { id: "WEAN", label: "Cai sữa" }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTaskCategoryFilter(tab.id)}
                  style={{
                    padding: "6px 10px", borderRadius: "14px", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer",
                    backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#f1f5f9",
                    color: taskCategoryFilter === tab.id ? "#fff" : "#475569"
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredPendingTasks.length === 0 ? (
                <div style={{ padding: "14px", textAlign: "center", background: "#fff", borderRadius: "10px", fontSize: "13px", color: "#64748b" }}>
                  ✨ Không có công việc nào trong {pendingTaskDays} ngày tới.
                </div>
              ) : (
                filteredPendingTasks.map(t => (
                  <div
                    key={t.id}
                    style={{ background: "#fff", padding: "12px 16px", borderRadius: "12px", border: "1.5px solid #cbd5e1", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}
                  >
                    <div
                      onClick={() => { setSelectedTask(t); setShowTaskModal(true); }}
                      style={{ flex: 1, cursor: "pointer" }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e1b4b" }}>{t.title}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                        Hạn: <b>{formatDateVN(t.due_date)}</b> {t.related_tag && `(Tai: ${t.related_tag})`}
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: "6px", marginLeft: "10px" }}>
                      <button
                        onClick={() => { setSelectedTask(t); setShowTaskModal(true); }}
                        style={{ padding: "6px 10px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                      >
                        ✓ Xong
                      </button>
                      <button
                        onClick={() => handleDismissTask(t)}
                        style={{ padding: "6px 10px", borderRadius: "8px", background: "#f1f5f9", color: "#64748b", border: "1px solid #cbd5e1", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                      >
                        Bỏ qua
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ fontSize: "15px", fontWeight: "900", color: "#047857", margin: 0 }}>
                ✅ CÔNG VIỆC ĐÃ LÀM XONG ({filteredCompletedTasks.length})
              </h4>

              <div style={{ display: "flex", gap: "4px" }}>
                {[7, 15, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setCompletedTaskDays(d as any)}
                    style={{
                      padding: "4px 8px", borderRadius: "6px", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer",
                      background: completedTaskDays === d ? "#059669" : "#e2e8f0",
                      color: completedTaskDays === d ? "#fff" : "#475569"
                    }}
                  >
                    {d} ngày qua
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredCompletedTasks.length === 0 ? (
                <div style={{ padding: "12px", textAlign: "center", background: "#f0fdf4", borderRadius: "10px", fontSize: "12px", color: "#047857" }}>
                  Chưa có công việc nào hoàn thành trong {completedTaskDays} ngày qua.
                </div>
              ) : (
                filteredCompletedTasks.map(t => (
                  <div key={t.id} style={{ background: "#f0fdf4", padding: "10px 14px", borderRadius: "10px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "800", color: "#166534", textDecoration: "line-through" }}>{t.title}</div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>Đã xong (Ngày: {formatDateVN(t.due_date)})</div>
                    </div>
                    <span style={{ fontSize: "18px" }}>🟢</span>
                  </div>
                ))
              )}
            </div>
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

      {/* 4. TAB LỢN CON THEO LÔ (CÓ BẢNG TÍCH CHỌN PHÂN LOẠI) */}
      {currentMenu === "PIGLET" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "15px", fontWeight: "900", color: "#16a34a", marginBottom: "14px" }}>
            TỔNG ĐÀN CON: {totalPigletsCount} CON (Theo mẹ: {suckingPigletsCount} • Cai sữa: {weanedPigletsCount})
          </div>

          <h4 style={{ fontSize: "14px", fontWeight: "900", color: "#ea580c", margin: "0 0 10px 0" }}>🍼 LỢN CON THEO MẸ ({suckingPigletsCount} CON)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
            {suckingLitters.length === 0 ? (
              <div style={{ padding: "12px", background: "#fff", borderRadius: "10px", fontSize: "13px", color: "#64748b", textAlign: "center" }}>
                Không có lô con nào đang theo mẹ.
              </div>
            ) : (
              suckingLitters.map(lit => (
                <div key={lit.id} style={{ background: "#fff", padding: "14px", borderRadius: "12px", border: "1.5px solid #fed7aa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "900", fontSize: "15px" }}>
                    <span>Lô nái {lit.sow_ear_tag} ({lit.litter_code})</span>
                    <span style={{ color: "#047857" }}>{lit.alive_born} con</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", margin: "6px 0" }}>Ngày đẻ: {formatDateVN(lit.farrow_date)}</div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                    <button
                      onClick={() => executeWeaning(lit.sow_ear_tag, lit.id, lit.alive_born)}
                      style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#0f172a", color: "#fff", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                    >
                      ✓ Cai sữa đàn này
                    </button>
                    <button
                      onClick={() => openTransferModal(lit)}
                      style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                    >
                      ⚙️ Tuyển Hậu Bị / Thịt
                    </button>
                  </div>
                </div>
              ))
            )}
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
                    <div style={{ fontSize: "13px", color: "#64748b", margin: "4px 0" }}>
                      Ngày cai sữa: <b>{formatDateVN(lit.weaning_date)}</b> {lit.notes && `• ${lit.notes}`}
                    </div>
                    <div style={{ marginTop: "8px" }}>
                      <button
                        onClick={() => openTransferModal(lit)}
                        style={{ width: "100%", padding: "8px", borderRadius: "8px", background: "#7c3aed", color: "#fff", border: "none", fontSize: "12px", fontWeight: "900", cursor: "pointer" }}
                      >
                        ⚙️ Tích Chọn Tuyển Hậu Bị / Chuyển Thịt
                      </button>
                    </div>
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
            {safePigs.filter(p => !isIndividualPiglet(p)).map(pig => {
              const bCat = getBreedCategoryInfo(pig.breed_id, pig.sire_ear_tag, pig.dam_ear_tag);
              return (
                <div key={pig.id} style={{ background: "#fff", padding: "12px 16px", borderRadius: "12px", border: "1px solid #f1e5f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <b style={{ fontSize: "16px" }}>{pig.ear_tag}</b>
                      <span style={{ fontSize: "10px", fontWeight: "800", padding: "2px 6px", borderRadius: "4px", background: "#f5f3ff", color: bCat.badgeColor }}>{bCat.label}</span>
                    </div>
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
              );
            })}
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
            <b>• 45 ngày:</b> Tiêm Lở mồm long móng (FMD).<br/>
            <b>• Hậu bị (150-170 ngày):</b> Tiêm Parvovirus (khô thai) mũi 1 và nhắc mũi 2 trước phối giống 3 tuần.
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

      {/* 9. CÀI ĐẶT & NHẬT KÝ THAO TÁC CÓ ẢNH */}
      {currentMenu === "SETTINGS" && (
        <div style={{ padding: "16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0", marginBottom: "16px", fontSize: "14px" }}>
            <b>Người vận hành:</b> {activeOperator}
          </div>

          <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "900", color: "#1e1b4b" }}>
            📜 Nhật ký hoạt động & Hình ảnh ({auditLogs.length})
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {auditLogs.slice(0, 40).map(l => {
              const isDismissedLog = l.action_type === "DISMISS_TASK" || l.details.includes("[ĐÃ BỎ QUA]");

              return (
                <div key={l.id} style={{ background: isDismissedLog ? "#fff7ed" : "#fff", padding: "12px 14px", borderRadius: "10px", border: isDismissedLog ? "1.5px solid #ffedd5" : "1px solid #e2e8f0", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <b style={{ color: isDismissedLog ? "#c2410c" : "#5b21b6" }}>{l.performed_by}</b>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>{formatDateVN(l.created_at)}</span>
                  </div>
                  
                  <div style={{ color: "#334155", lineHeight: "1.4" }}>{l.details}</div>

                  {isDismissedLog && l.task_id && (
                    <div style={{ marginTop: "8px" }}>
                      <button
                        onClick={() => handleRestoreTask(l.task_id, l.details.replace("[ĐÃ BỎ QUA] Công việc: ", ""))}
                        style={{ padding: "5px 12px", borderRadius: "6px", background: "#ea580c", color: "#fff", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                      >
                        ↺ Khôi phục lại việc này
                      </button>
                    </div>
                  )}

                  {l.image_url ? (
                    <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={l.image_url}
                        alt="Ảnh hoạt động"
                        onClick={() => setEnlargedImage(l.image_url || null)}
                        style={{ width: "95px", height: "95px", objectFit: "cover", borderRadius: "8px", border: "1.5px solid #cbd5e1", cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ fontSize: "11px", color: "#2563eb", cursor: "pointer", fontWeight: "700" }} onClick={() => setEnlargedImage(l.image_url || null)}>
                          Chạm để phóng to 🔍
                        </div>
                        <button
                          onClick={() => {
                            if (!requireAuth("đổi ảnh hoạt động")) return;
                            setActivityPhotoModal({
                              isOpen: true,
                              activityTitle: `Đổi ảnh cho: ${l.details}`,
                              actionType: l.action_type,
                              targetId: l.target_id,
                              details: l.details,
                              existingLogId: l.id,
                              previewImg: l.image_url || ""
                            });
                          }}
                          style={{ marginTop: "6px", padding: "4px 8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                        >
                          📷 Đổi ảnh khác
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: "8px" }}>
                      <button
                        onClick={() => {
                          if (!requireAuth("bổ sung ảnh vào nhật ký")) return;
                          setActivityPhotoModal({
                            isOpen: true,
                            activityTitle: `Bổ sung ảnh cho: ${l.details}`,
                            actionType: l.action_type,
                            targetId: l.target_id,
                            details: l.details,
                            existingLogId: l.id,
                            previewImg: ""
                          });
                        }}
                        style={{ padding: "5px 10px", borderRadius: "6px", background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                      >
                        📷 + Bổ sung ảnh vào hoạt động này
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG */}
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

      {/* MODAL TÍCH CHỌN CHUYỂN ĐÀN */}
      {showLitterActionModal && selectedLitter && (() => {
        const total = selectedLitter.alive_born || 0;
        const selections = Object.entries(pigletSelections);
        const giltSelected = selections.filter(([_, v]) => v === "GILT").length;
        const meatSelected = selections.filter(([_, v]) => v === "MEAT").length;
        const unselected = Math.max(0, total - (giltSelected + meatSelected));

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 140, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
            <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "420px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "18px" }}>
              <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>
                  Tích Chọn Chuyển Đàn: {selectedLitter.litter_code}
                </h3>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                  Nái mẹ: <b>{selectedLitter.sow_ear_tag}</b> • Tổng số con: <b style={{ color: "#047857" }}>{total} con</b>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "12px", textAlign: "center" }}>
                <div style={{ background: "#f5f3ff", border: "1.5px solid #c4b5fd", padding: "8px 4px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#6d28d9", fontWeight: "800" }}>HẬU BỊ</div>
                  <b style={{ fontSize: "16px", color: "#5b21b6" }}>{giltSelected} con</b>
                </div>
                <div style={{ background: "#fefce8", border: "1.5px solid #fde68a", padding: "8px 4px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#b45309", fontWeight: "800" }}>NUÔI THỊT</div>
                  <b style={{ fontSize: "16px", color: "#b45309" }}>{meatSelected} con</b>
                </div>
                <div style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", padding: "8px 4px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#475569", fontWeight: "800" }}>CHƯA TÁCH</div>
                  <b style={{ fontSize: "16px", color: "#334155" }}>{unselected} con</b>
                </div>
              </div>

              <div style={{ overflowY: "auto", flex: 1, paddingRight: "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {Array.from({ length: total }).map((_, idx) => {
                  const pigNum = idx + 1;
                  const currentSel = pigletSelections[pigNum] || "NONE";

                  return (
                    <div
                      key={pigNum}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: currentSel === "GILT" ? "2px solid #7c3aed" : currentSel === "MEAT" ? "2px solid #d97706" : "1px solid #e2e8f0",
                        background: currentSel === "GILT" ? "#fbfbfe" : currentSel === "MEAT" ? "#fffdf5" : "#fff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b" }}>
                        🐷 Con #{pigNum}
                      </span>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setPigletSelections(prev => ({ ...prev, [pigNum]: prev[pigNum] === "GILT" ? "NONE" : "GILT" }))}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "11px",
                            fontWeight: "800",
                            cursor: "pointer",
                            background: currentSel === "GILT" ? "#7c3aed" : "#ede9fe",
                            color: currentSel === "GILT" ? "#fff" : "#6d28d9"
                          }}
                        >
                          🟣 Hậu bị
                        </button>

                        <button
                          type="button"
                          onClick={() => setPigletSelections(prev => ({ ...prev, [pigNum]: prev[pigNum] === "MEAT" ? "NONE" : "MEAT" }))}
                          style={{
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "11px",
                            fontWeight: "800",
                            cursor: "pointer",
                            background: currentSel === "MEAT" ? "#d97706" : "#fef3c7",
                            color: currentSel === "MEAT" ? "#fff" : "#b45309"
                          }}
                        >
                          🟠 Nuôi thịt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  disabled={isTransferring || (giltSelected === 0 && meatSelected === 0)}
                  onClick={handleConfirmTransferSelections}
                  style={{
                    padding: "11px",
                    borderRadius: "10px",
                    background: (giltSelected === 0 && meatSelected === 0) ? "#94a3b8" : "#059669",
                    color: "#fff",
                    border: "none",
                    fontWeight: "900",
                    fontSize: "13px",
                    cursor: (giltSelected === 0 && meatSelected === 0) ? "not-allowed" : "pointer"
                  }}
                >
                  {isTransferring ? "Đang xử lý..." : `✓ Xác Nhận Chuyển (${giltSelected} Hậu bị • ${meatSelected} Thịt)`}
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleSellLitter(selectedLitter)}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", fontWeight: "800", fontSize: "11px", cursor: "pointer" }}
                  >
                    💰 Xuất bán cả lô
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLitterActionModal(false); setSelectedLitter(null); }}
                    style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "none", fontWeight: "800", fontSize: "11px", cursor: "pointer" }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL HỒ SƠ TỔNG HỢP: SỬA THÔNG TIN + SINH SẢN + SỬA NGÀY PHỐI GIỐNG */}
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
                      <label style={{ fontSize: "12px", fontWeight: "800" }}>Giới tính (*):</label>
                      <select
                        value={formatVietnameseSex(activeProfilePig.sex)}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, sex: e.target.value })}
                        style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                      >
                        <option value="Đực">Đực</option>
                        <option value="Cái">Cái</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ background: "#fdf2f4", padding: "12px", borderRadius: "10px", border: "1px solid #fce7f3" }}>
                    <label style={{ fontSize: "12px", fontWeight: "900", color: "#db2777" }}>Trạng thái / Giai đoạn hiện tại (*):</label>
                    <select
                      value={activeProfilePig.stage}
                      onChange={(e) => setActiveProfilePig({ ...activeProfilePig, stage: e.target.value })}
                      style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1.5px solid #f472b6", marginTop: "6px", fontWeight: "900", fontSize: "14px" }}
                    >
                      <option value="Vỗ béo thịt">🥩 Vỗ béo thịt</option>
                      <option value="Hậu bị">🐖 Nái Hậu bị</option>
                      <option value="Chờ phối">⏳ Chờ phối</option>
                      <option value="Đang chửa">🤰 Đang chửa</option>
                      <option value="Nuôi con">🍼 Nuôi con</option>
                      <option value="Đực giống">🐗 Đực giống</option>
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
                      <label style={{ fontSize: "12px", fontWeight: "800" }}>Ngày sinh:</label>
                      <input
                        type="date"
                        value={activeProfilePig.birth_date || ""}
                        onChange={(e) => setActiveProfilePig({ ...activeProfilePig, birth_date: e.target.value })}
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
                    style={{ padding: "12px", borderRadius: "10px", background: "#059669", color: "#fff", border: "none", fontWeight: "900", fontSize: "14px", cursor: "pointer", marginTop: "4px" }}
                  >
                    {isSavingEdit ? "Đang lưu..." : "💾 Lưu Thay Đổi"}
                  </button>

                  {activeProfilePig.dam_ear_tag && (
                    <button
                      type="button"
                      onClick={() => handleRevertPigToLitter(activeProfilePig)}
                      style={{ padding: "10px", borderRadius: "10px", background: "#fef2f2", color: "#dc2626", border: "1.5px solid #fecaca", fontWeight: "800", fontSize: "12px", cursor: "pointer", marginTop: "4px" }}
                    >
                      ↺ Hoàn tác cá thể này về lại Lô con nái {activeProfilePig.dam_ear_tag}
                    </button>
                  )}
                </form>
              )}

              {/* TAB 2: SINH SẢN */}
              {profileTab === "REPRO" && (() => {
                const analysis = getSowReproAnalysis(activeProfilePig.ear_tag);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
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

                    {/* MỤC 1: LỊCH SỬ PHỐI GIỐNG */}
                    <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1" }}>
                      <b style={{ fontSize: "14px", color: "#1e1b4b" }}>🔬 Lịch sử các lần phối giống:</b>
                      
                      {editingInsemId && (
                        <form onSubmit={handleSaveInsemEdit} style={{ background: "#ede9fe", padding: "10px", borderRadius: "8px", border: "1.5px solid #c4b5fd", marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ fontSize: "12px", fontWeight: "900", color: "#5b21b6" }}>
                            ✎ Chỉnh sửa ngày phối nái {insemFormData.sow_ear_tag}
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800" }}>Ngày phối thực tế (*):</label>
                            <input
                              type="date"
                              required
                              value={insemFormData.mating_date}
                              onChange={e => setInsemFormData({ ...insemFormData, mating_date: e.target.value })}
                              style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800" }}>Đực phối giống:</label>
                            <select
                              value={insemFormData.boar_ear_tag}
                              onChange={e => setInsemFormData({ ...insemFormData, boar_ear_tag: e.target.value })}
                              style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                            >
                              {boarList.map(b => (
                                <option key={b.id} value={b.ear_tag}>{b.ear_tag} ({b.breed_id})</option>
                              ))}
                            </select>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "4px" }}>
                            <button type="button" onClick={() => setEditingInsemId(null)} style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "11px", cursor: "pointer" }}>Hủy</button>
                            <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#7c3aed", color: "#fff", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}>Lưu ngày phối</button>
                          </div>
                        </form>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                        {analysis.sowInsems.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}>Chưa có bản ghi phối giống nào.</div>
                        ) : (
                          analysis.sowInsems.map(ins => {
                            const daysDiff = safeDateDiff(ins.mating_date);
                            return (
                              <div key={ins.id} style={{ background: "#fff", padding: "8px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <div style={{ fontWeight: "800", color: "#1e1b4b" }}>
                                    Ngày phối: {formatDateVN(ins.mating_date)} • Đực: <span style={{ color: "#2563eb" }}>{ins.boar_ear_tag || "—"}</span>
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>
                                    Dự sinh: <b>{formatDateVN(ins.expected_farrow_date)}</b> (Hiện tại: Ngày {daysDiff}/114) • <i>{ins.status || "Đã phối"}</i>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    if (!requireAuth("sửa ngày phối giống")) return;
                                    setEditingInsemId(ins.id);
                                    setInsemFormData({
                                      sow_ear_tag: ins.sow_ear_tag,
                                      boar_ear_tag: ins.boar_ear_tag || "",
                                      mating_date: ins.mating_date || new Date().toISOString().split("T")[0]
                                    });
                                  }}
                                  style={{ padding: "5px 10px", borderRadius: "6px", background: "#ede9fe", color: "#6d28d9", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                                >
                                  ✎ Sửa ngày phối
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* MỤC 2: DANH SÁCH LỨA ĐẺ */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                      <b style={{ fontSize: "14px" }}>Danh sách các lứa đẻ:</b>
                      <button
                        onClick={() => {
                          if (!requireAuth("thêm lứa đẻ")) return;
                          setEditingLitterId(null);
                          setLitterFormData({
                            litter_code: `L${analysis.totalLitters + 1}`,
                            farrow_date: new Date().toISOString().split("T")[0],
                            weaning_date: safeAddDays(new Date().toISOString().split("T")[0], 28),
                            alive_born: 10,
                            boar_used: "",
                            status: "DA_CAI_SUA",
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
                      <form onSubmit={handleSaveLitter} style={{ background: "#f8fafc", padding: "12px", borderRadius: "10px", border: "1.5px solid #94a3b8", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ fontSize: "13px", fontWeight: "900", color: "#059669" }}>
                          {editingLitterId ? "✎ Chỉnh sửa Lứa đẻ / Ngày cai sữa" : "+ Thêm lứa đẻ mới"}
                        </div>
                        
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800" }}>Mã lứa (*):</label>
                            <input required placeholder="VD: L1..." value={litterFormData.litter_code} onChange={e => setLitterFormData({ ...litterFormData, litter_code: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800" }}>Đực phối giống:</label>
                            <input placeholder="VD: DY01..." value={litterFormData.boar_used} onChange={e => setLitterFormData({ ...litterFormData, boar_used: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }} />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800", color: "#ea580c" }}>Ngày đẻ (*):</label>
                            <input type="date" required value={litterFormData.farrow_date} onChange={e => setLitterFormData({ ...litterFormData, farrow_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800", color: "#0284c7" }}>Ngày cai sữa (*):</label>
                            <input type="date" required value={litterFormData.weaning_date} onChange={e => setLitterFormData({ ...litterFormData, weaning_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }} />
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800" }}>Số con sống:</label>
                            <input type="number" required min="1" max="30" value={litterFormData.alive_born} onChange={e => setLitterFormData({ ...litterFormData, alive_born: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: "800" }}>Trạng thái lứa:</label>
                            <select value={litterFormData.status} onChange={e => setLitterFormData({ ...litterFormData, status: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }}>
                              <option value="DANG_THEO_ME">🍼 Đang theo mẹ</option>
                              <option value="DA_CAI_SUA">✅ Đã cai sữa</option>
                              <option value="DA_XUAT_BAN">🏷️ Đã xuất bán</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: "11px", fontWeight: "800" }}>Ghi chú lứa:</label>
                          <input placeholder="Ghi chú thêm..." value={litterFormData.notes} onChange={e => setLitterFormData({ ...litterFormData, notes: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", boxSizing: "border-box" }} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                          <button type="button" onClick={() => setShowLitterForm(false)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px", cursor: "pointer" }}>Hủy</button>
                          <button type="submit" style={{ padding: "6px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}>Lưu lứa</button>
                        </div>
                      </form>
                    )}

                    {analysis.sowLitters.map((l, idx) => {
                      let boarUsed = "—";
                      const match = (l.notes || "").match(/\[Đực:\s*([^\]]+)\]/i);
                      if (match) boarUsed = match[1].trim();

                      return (
                        <div key={l.id} style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "800", fontSize: "13px" }}>
                            <span>Lứa {idx + 1}: {l.litter_code}</span>
                            <span style={{ color: "#059669" }}>{l.alive_born} con</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#475569", margin: "3px 0", lineHeight: "1.5" }}>
                            <div>• Ngày đẻ: <b>{formatDateVN(l.farrow_date)}</b></div>
                            <div>• Ngày cai sữa: <b>{formatDateVN(l.weaning_date)}</b> ({l.status === "DA_CAI_SUA" ? "Đã cai sữa" : l.status === "DANG_THEO_ME" ? "Đang theo mẹ" : "Đã xuất bán"})</div>
                            <div>• Phối đực: <b style={{ color: "#2563eb" }}>{boarUsed}</b></div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
                            <button
                              onClick={() => {
                                if (!requireAuth("chỉnh sửa lứa")) return;
                                setEditingLitterId(l.id);
                                let b = "";
                                const m = (l.notes || "").match(/\[Đực:\s*([^\]]+)\]/i);
                                if (m) b = m[1].trim();

                                setLitterFormData({
                                  litter_code: l.litter_code || `Lứa ${idx + 1}`,
                                  farrow_date: l.farrow_date || new Date().toISOString().split("T")[0],
                                  weaning_date: l.weaning_date || l.farrow_date || new Date().toISOString().split("T")[0],
                                  alive_born: Number(l.alive_born || 0),
                                  boar_used: b,
                                  status: l.status || "DA_CAI_SUA",
                                  notes: (l.notes || "").replace(/\[Đực:\s*[^\]]+\]/i, "").trim()
                                });
                                setShowLitterForm(true);
                              }}
                              style={{ padding: "4px 10px", borderRadius: "6px", background: "#ede9fe", color: "#6d28d9", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                            >
                              ✎ Sửa ngày / con
                            </button>
                            <button
                              onClick={() => handleDeleteLitter(l.id, l.litter_code || `Lứa ${idx + 1}`)}
                              style={{ padding: "4px 10px", borderRadius: "6px", background: "#fef2f2", color: "#ef4444", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                            >
                              ✕ Xóa
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
                const bCat = getBreedCategoryInfo(activeProfilePig.breed_id, activeProfilePig.sire_ear_tag, activeProfilePig.dam_ear_tag);

                return (
                  <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "12px" }}>
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

                    <div style={{ background: "#ede9fe", padding: "12px", borderRadius: "10px", textAlign: "center", border: "1.5px solid #a78bfa" }}>
                      <div style={{ fontSize: "11px", color: "#6d28d9", fontWeight: "800" }}>CÁ THỂ HIỆN TẠI</div>
                      <div style={{ fontSize: "19px", fontWeight: "900", color: "#4c1d95" }}>{activeProfilePig.ear_tag}</div>
                      <div style={{ fontSize: "13px", color: "#5b21b6", fontWeight: "800", marginTop: "2px" }}>
                        {activeProfilePig.breed_id} • <span style={{ color: bCat.badgeColor }}>({bCat.label})</span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                        🧬 Nguồn máu: <b>{bCat.blood}</b>
                      </div>
                    </div>

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
                          {childPigs.map(cp => {
                            const childCat = getBreedCategoryInfo(cp.breed_id, cp.sire_ear_tag, cp.dam_ear_tag);
                            return (
                              <div key={cp.id} style={{ background: "#fff", padding: "8px 10px", borderRadius: "8px", border: "1px solid #dcfce7", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <b style={{ fontSize: "14px" }}>{cp.ear_tag}</b> ({formatVietnameseSex(cp.sex)}) - <span style={{ color: "#047857", fontWeight: "800" }}>{cp.stage}</span>
                                  <div style={{ fontSize: "11px", color: childCat.badgeColor, fontWeight: "700" }}>{childCat.label}</div>
                                </div>
                                <span style={{ fontSize: "12px", color: "#64748b" }}>Ô: {cp.current_pen_code || "—"}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ fontSize: "12px", fontWeight: "900", color: "#15803d", marginTop: "10px", marginBottom: "6px" }}>
                        CÁC LỨA ĐẺ / LÔ CON ({childLitters.length} LỨA):
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {childLitters.map(cl => (
                          <div key={cl.id} style={{ background: "#fff", padding: "8px 10px", borderRadius: "8px", border: "1px solid #dcfce7", fontSize: "12px", display: "flex", justifyContent: "space-between" }}>
                            <span>Lứa {cl.litter_code} (Đẻ: {formatDateVN(cl.farrow_date)} - Cai: {formatDateVN(cl.weaning_date)})</span>
                            <b>{cl.alive_born} con ({cl.status === "DANG_THEO_ME" ? "Bú mẹ" : cl.status === "DA_CAI_SUA" ? "Đã cai sữa" : "Đã xuất bán"})</b>
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
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#5b21b6" }}>🔬 Xác Nhận Phối Giống</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!requireAuth("ghi nhận phối giống")) return;
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
              await logAction("INSEMINATION", matingSowTag, `Phối nái ${matingSowTag} với đực ${selectedBoarTag} ngày ${formatDateVN(matingDate)}. Dự sinh: ${formatDateVN(expFarrow)}`);
              alert(`✅ Đã ghi nhận phối giống cho nái ${matingSowTag}! Nái chuyển sang "Đang chửa".`);
              setShowMatingModal(false);
              await fetchData();
            }} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "800" }}>Nái phối (*):</label>
                <select required value={matingSowTag} onChange={e => setMatingSowTag(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", marginTop: "3px" }}>
                  <option value="">-- Chọn Nái --</option>
                  {sowList.map(s => <option key={s.id} value={s.ear_tag}>{s.ear_tag} ({formatVietnameseStage(s.stage)} - {s.breed_id})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "800" }}>Đực khai thác tinh (*):</label>
                <select required value={selectedBoarTag} onChange={e => setSelectedBoarTag(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", marginTop: "3px" }}>
                  <option value="">-- Chọn Đực --</option>
                  {boarList.map(b => <option key={b.id} value={b.ear_tag}>{b.ear_tag} ({b.breed_id})</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "800" }}>Ngày phối thực tế (*):</label>
                <input type="date" required value={matingDate} onChange={e => setMatingDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", marginTop: "3px", boxSizing: "border-box" }} />
              </div>

              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Ngày dự sinh (114 ngày): <b style={{ color: "#059669" }}>{formatDateVN(safeAddDays(matingDate, 114))}</b>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "7px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "7px 16px", borderRadius: "6px", background: "#7c3aed", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Xác nhận Phối</button>
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
              if (!requireAuth("thêm cá thể mới")) return;
              if (!newPig.ear_tag?.trim()) return;
              setIsAddingPig(true);
              try {
                const payload = {
                  ear_tag: newPig.ear_tag.trim().toUpperCase(),
                  breed_id: newPig.breed_id || config.breeds[0] || "Hạ Lang",
                  sex: "Cái",
                  stage: formatVietnameseStage(newPig.stage || "Hậu bị"),
                  current_pen_code: newPig.current_pen_code || "CA1",
                  status: "Bình thường",
                  birth_date: newPig.birth_date || null
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
                <option value="Vỗ béo thịt">Vỗ béo thịt</option>
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" disabled={isAddingPig} style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "800" }}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐĂNG NHẬP */}
      {showAuthModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "320px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900" }}>Đăng nhập</h3>
            {authError && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "6px" }}>{authError}</div>}
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input required placeholder="Tên đăng nhập..." value={authAccount} onChange={e => setAuthAccount(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <input type="password" required placeholder="Mật khẩu..." value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowAuthModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#5b21b6", color: "#fff", border: "none", fontWeight: "800" }}>Vào</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN CÔNG VIỆC */}
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
                onClick={() => handleDismissTask(selectedTask)}
                style={{ padding: "10px", borderRadius: "10px", background: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5", fontWeight: "800", fontSize: "13px", cursor: "pointer" }}
              >
                Bỏ Qua Công Việc Này
              </button>

              <button
                onClick={() => { setShowTaskModal(false); setSelectedTask(null); }}
                style={{ padding: "10px", borderRadius: "10px", background: "#f1f5f9", color: "#475569", border: "none", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
              >
                Đóng Lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BÁO ĐẺ */}
      {farrowingSow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "380px", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "900", color: "#047857" }}>
              🎉 Ghi Nhận Nái Đẻ: {farrowingSow.ear_tag}
            </h3>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
              Giống: <b>{farrowingSow.breed_id}</b> • Ô hiện tại: <b>{farrowingSow.current_pen_code}</b>
            </div>

            <form onSubmit={handleConfirmFarrowing} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "800" }}>Ngày đẻ thực tế (*):</label>
                <input
                  type="date"
                  required
                  value={farrowInput.farrow_date}
                  onChange={e => setFarrowInput({ ...farrowInput, farrow_date: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "800", color: "#059669" }}>Số con sống (*):</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="25"
                    value={farrowInput.alive_born}
                    onChange={e => setFarrowInput({ ...farrowInput, alive_born: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #10b981", fontSize: "14px", fontWeight: "900", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "800", color: "#ef4444" }}>Số con chết/lưu:</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={farrowInput.dead_born}
                    onChange={e => setFarrowInput({ ...farrowInput, dead_born: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", marginTop: "4px" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "800" }}>Ghi chú ca đẻ:</label>
                <input
                  placeholder="Đẻ mổ, đẻ nhanh, nái dữ..."
                  value={farrowInput.notes}
                  onChange={e => setFarrowInput({ ...farrowInput, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", marginTop: "4px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button
                  type="button"
                  onClick={() => setFarrowingSow(null)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{ padding: "8px 18px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontSize: "13px", fontWeight: "900", cursor: "pointer" }}
                >
                  ✓ Xác Nhận Đẻ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ẢNH HOẠT ĐỘNG */}
      {activityPhotoModal && activityPhotoModal.isOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 160, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "18px", width: "100%", maxWidth: "380px", padding: "20px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>
              📷 Chụp / Bổ Sung Ảnh
            </h3>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#059669", marginBottom: "4px" }}>
              {activityPhotoModal.activityTitle}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "14px" }}>
              Chọn hoặc chụp ảnh minh chứng để lưu vào đúng hoạt động này.
            </div>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  try {
                    const compressed = await compressImage(file);
                    setActivityPhotoModal(prev => prev ? { ...prev, previewImg: compressed } : null);
                  } catch (err) {
                    alert("Không thể đọc ảnh: " + err);
                  }
                }
              }}
            />

            {activityPhotoModal.previewImg ? (
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                <img src={activityPhotoModal.previewImg} alt="Preview" style={{ width: "100%", maxHeight: "200px", objectFit: "contain", borderRadius: "10px", border: "1px solid #cbd5e1" }} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ marginTop: "6px", fontSize: "12px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: "700" }}
                >
                  (Chụp lại / Chọn ảnh khác)
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: "24px", border: "2px dashed #94a3b8", borderRadius: "12px", textAlign: "center", cursor: "pointer", background: "#f8fafc", marginBottom: "14px" }}
              >
                <div style={{ fontSize: "28px", marginBottom: "4px" }}>📸</div>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#1e40af" }}>Chạm để Chụp ảnh hoặc Chọn từ Thư viện</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>(Ảnh tự nén nhẹ gắn liền vào hoạt động này)</div>
              </div>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setActivityPhotoModal(null)}
                style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}
              >
                Hủy / Bỏ qua
              </button>

              <button
                type="button"
                disabled={!activityPhotoModal.previewImg}
                onClick={async () => {
                  if (!requireAuth("lưu ảnh hoạt động")) return;
                  if (activityPhotoModal.previewImg) {
                    if (activityPhotoModal.existingLogId) {
                      await updateLogPhoto(activityPhotoModal.existingLogId, activityPhotoModal.previewImg);
                      alert("✅ Đã bổ sung ảnh thành công vào dòng nhật ký!");
                    } else {
                      await logAction(
                        activityPhotoModal.actionType,
                        activityPhotoModal.targetId,
                        activityPhotoModal.details,
                        activityPhotoModal.previewImg,
                        activityPhotoModal.taskId
                      );
                      alert("✅ Đã lưu ảnh thành công vào Nhật ký hoạt động!");
                    }
                    setActivityPhotoModal(null);
                    await fetchData();
                  }
                }}
                style={{
                  flex: 1.2, padding: "10px", borderRadius: "8px", border: "none",
                  background: activityPhotoModal.previewImg ? "#059669" : "#cbd5e1",
                  color: "#fff", fontSize: "13px", fontWeight: "900",
                  cursor: activityPhotoModal.previewImg ? "pointer" : "not-allowed"
                }}
              >
                Lưu Ảnh Hoạt Động
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PHÓNG TO ẢNH */}
      {enlargedImage && (
        <div onClick={() => setEnlargedImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 180, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ position: "relative", maxWidth: "100%", maxHeight: "100%" }}>
            <img src={enlargedImage} alt="Ảnh lớn" style={{ width: "100%", maxHeight: "85vh", objectFit: "contain", borderRadius: "10px" }} />
            <div style={{ textAlign: "center", color: "#fff", marginTop: "8px", fontSize: "13px" }}>Chạm bất kỳ đâu để đóng</div>
          </div>
        </div>
      )}

    </div>
  );
}
