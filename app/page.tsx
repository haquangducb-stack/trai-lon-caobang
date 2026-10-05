"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

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

interface FarmConfig {
  breeds: string[];
  stages: string[];
  pens: string[];
}

export default function FarmApp() {
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [inseminations, setInseminations] = useState<Insemination[]>([]);
  const [litters, setLitters] = useState<FarrowingLitter[]>([]);
  const [dbTasks, setDbTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Phân hệ điều hướng
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Cấu hình Dropdown
  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire"],
    stages: ["Hậu bị", "Chờ phối", "Đang chửa", "Nuôi con", "Cai sữa", "Vỗ béo thịt", "Đực giống"],
    pens: ["CA1", "CA2", "CA3", "CA4", "CA5", "CB1", "CB2", "CB3", "CB4", "CD1"]
  });

  // Modal Sửa cá thể
  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Input cấu hình cài đặt
  const [newBreedInput, setNewBreedInput] = useState("");
  const [newStageInput, setNewStageInput] = useState("");
  const [newPenInput, setNewPenInput] = useState("");

  const supabase = useMemo(() => {
    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl, rawKey.trim());
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, tRes, farRes, insemRes, penRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("farrowings").select("*").order("farrow_date", { ascending: false }),
        supabase.from("inseminations").select("*").order("mating_date", { ascending: false }),
        supabase.from("pens").select("pen_code").order("pen_code", { ascending: true })
      ]);
      if (pRes.data) setPigs(pRes.data);
      if (tRes.data) setDbTasks(tRes.data);
      if (farRes.data) setLitters(farRes.data);
      if (insemRes.data) setInseminations(insemRes.data);
      if (penRes.data && penRes.data.length > 0) {
        const penCodes = Array.from(new Set([...config.pens, ...penRes.data.map((p: any) => p.pen_code)]));
        setConfig(prev => ({ ...prev, pens: penCodes }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    const savedCfg = localStorage.getItem("farm_config");
    if (savedCfg) {
      try { setConfig(JSON.parse(savedCfg)); } catch (e) {}
    }
    fetchData();
  }, [supabase]);

  const saveConfig = (newCfg: FarmConfig) => {
    setConfig(newCfg);
    localStorage.setItem("farm_config", JSON.stringify(newCfg));
  };

  const normalize = (text?: string) => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
  };

  const isIndividualPiglet = (pig: Pig) => {
    const st = normalize(pig.stage);
    const tag = (pig.ear_tag || "").toUpperCase();
    return tag.includes("-C") || tag.includes("CON") || st.includes("theo me");
  };

  const isMeat = (pig: Pig) => {
    if (isIndividualPiglet(pig)) return false;
    const st = normalize(pig.stage);
    return st.includes("thit") || st.includes("thuong pham");
  };

  const isSow = (pig: Pig) => {
    if (isIndividualPiglet(pig) || isMeat(pig)) return false;
    const sx = normalize(pig.sex);
    return sx === "cai" || sx === "c" || sx === "female" || sx === "f" || sx.includes("nai");
  };

  const isBoar = (pig: Pig) => {
    if (isIndividualPiglet(pig) || isMeat(pig) || isSow(pig)) return false;
    const sx = normalize(pig.sex);
    return sx === "duc" || sx === "d" || sx === "male" || sx === "m" || sx.includes("giong");
  };

  const checkSowState = (pig: Pig): "CHUA" | "NUOICON" | "CHOPHOI" => {
    const st = normalize(pig.stage);
    if (st.includes("chua") || st.includes("phoi") || st.includes("mang thai")) return "CHUA";
    if (st.includes("nuoi con") || st.includes("de") || st.includes("tiet sua")) return "NUOICON";
    return "CHOPHOI";
  };

  const sowList = pigs.filter(isSow);
  const boarList = pigs.filter(isBoar);
  const meatList = pigs.filter(isMeat);

  // QUẢN LÝ LỢN CON THEO LÔ
  const activeLitters = litters.filter((lit) => {
    const noteStr = (lit.notes || "").toLowerCase();
    const stStr = (lit.status || "").toLowerCase();
    return !noteStr.includes("da cai") && !stStr.includes("da cai");
  });

  const totalPigletsCount = activeLitters.reduce((sum, lit) => sum + (lit.alive_born || 0), 0);

  // Thống kê tổng quan
  const sowCount = sowList.length;
  const sowChua = sowList.filter((p) => checkSowState(p) === "CHUA").length;
  const sowNuoiCon = sowList.filter((p) => checkSowState(p) === "NUOICON").length;
  const sowChoPhoi = sowList.filter((p) => checkSowState(p) === "CHOPHOI").length;
  const boarCount = boarList.length;
  const meatCount = meatList.length;
  const totalCount = sowCount + boarCount + meatCount + totalPigletsCount;

  // ENGINE CHUYÊN GIA THÚ Y - CÓ CƠ CHẾ CHỐNG TRÙNG LẶP (DEDUPLICATION)
  const fullTasks = useMemo(() => {
    const taskMap = new Map<string, FarmTask>();
    const today = new Date();

    const addDays = (dStr: string, days: number) => {
      const d = new Date(dStr);
      d.setDate(d.getDate() + days);
      return d.toISOString().split("T")[0];
    };

    const diffDays = (dStr: string) => {
      const d = new Date(dStr);
      return Math.floor((today.getTime() - d.getTime()) / (1000 * 3600 * 24));
    };

    // 1. QUY TRÌNH NÁI PHỐI & MANG THAI (Lọc chỉ lấy 1 bản ghi phối giống mới nhất cho từng nái)
    const latestInsemBySow = new Map<string, Insemination>();
    inseminations.forEach(ins => {
      if (!ins.sow_ear_tag) return;
      const current = latestInsemBySow.get(ins.sow_ear_tag);
      if (!current || new Date(ins.mating_date) > new Date(current.mating_date)) {
        latestInsemBySow.set(ins.sow_ear_tag, ins);
      }
    });

    latestInsemBySow.forEach((ins) => {
      if (!ins.mating_date) return;
      const daysAfterMating = diffDays(ins.mating_date);

      // A. Kiểm tra lốc chu kỳ 1 (Ngày 18 - 22)
      if (daysAfterMating >= 16 && daysAfterMating <= 25) {
        const key = `loc1-${ins.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[SINH SẢN] Kiểm tra lốc chu kỳ 1 (21 ngày) nái ${ins.sow_ear_tag}`,
          due_date: addDays(ins.mating_date, 21),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }

      // B. Khám thai / Siêu âm (Ngày 38 - 42)
      if (daysAfterMating >= 35 && daysAfterMating <= 45) {
        const key = `thai2-${ins.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[SINH SẢN] Khám thai lần 2 (40 ngày) nái ${ins.sow_ear_tag}`,
          due_date: addDays(ins.mating_date, 40),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }

      // C. Nái chửa ngày 85: Tiêm phòng E.Coli ngừa tiêu chảy phân trắng
      if (daysAfterMating >= 80 && daysAfterMating <= 90) {
        const key = `ecoli-${ins.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[VACCINE] Tiêm E.Coli phòng tiêu chảy phân trắng cho nái ${ins.sow_ear_tag}`,
          due_date: addDays(ins.mating_date, 85),
          related_tag: ins.sow_ear_tag,
          category: "VET",
          is_completed: false,
          is_auto: true
        });
      }

      // D. Nái ngày 107: Chuyển lên chuồng đẻ & giảm cám
      if (daysAfterMating >= 104 && daysAfterMating <= 112) {
        const key = `chuongde-${ins.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[CHUẨN BỊ ĐẺ] Chuyển nái ${ins.sow_ear_tag} lên chuồng đẻ & sát trùng vú`,
          due_date: addDays(ins.mating_date, 107),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }

      // E. Dự đẻ (Ngày 114)
      if (daysAfterMating >= 110 && daysAfterMating <= 118) {
        const key = `dude-${ins.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `⚠️ [TRỰC ĐẺ] Nái ${ins.sow_ear_tag} dự kiến đẻ (Hạn 114 ngày)`,
          due_date: ins.expected_farrow_date || addDays(ins.mating_date, 114),
          related_tag: ins.sow_ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }
    });

    // 2. QUY TRÌNH THÚ Y & VACCINE LỢN CON THEO LÔ
    activeLitters.forEach((lit) => {
      if (!lit.farrow_date) return;
      const ageDays = diffDays(lit.farrow_date);

      if (ageDays >= 1 && ageDays <= 6) {
        const key = `fe1-${lit.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[THÚ Y] Tiêm Sắt lần 1 & Nhỏ Cầu Trùng cho đàn con nái ${lit.sow_ear_tag}`,
          due_date: addDays(lit.farrow_date, 3),
          related_tag: lit.sow_ear_tag,
          category: "VET",
          is_completed: false,
          is_auto: true
        });
      }

      if (ageDays >= 7 && ageDays <= 13) {
        const key = `suyen1-${lit.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[VACCINE] Tiêm Sắt lần 2 & Suyễn mũi 1 cho đàn con nái ${lit.sow_ear_tag}`,
          due_date: addDays(lit.farrow_date, 10),
          related_tag: lit.sow_ear_tag,
          category: "VET",
          is_completed: false,
          is_auto: true
        });
      }

      if (ageDays >= 12 && ageDays <= 18) {
        const key = `prrs-${lit.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[VACCINE] Tiêm Tai Xanh (PRRS) đàn con nái ${lit.sow_ear_tag}`,
          due_date: addDays(lit.farrow_date, 14),
          related_tag: lit.sow_ear_tag,
          category: "VET",
          is_completed: false,
          is_auto: true
        });
      }

      if (ageDays >= 19 && ageDays <= 25) {
        const key = `csf-${lit.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[VACCINE] Tiêm Dịch Tả lợn mũi 1 cho đàn con nái ${lit.sow_ear_tag}`,
          due_date: addDays(lit.farrow_date, 21),
          related_tag: lit.sow_ear_tag,
          category: "VET",
          is_completed: false,
          is_auto: true
        });
      }

      if (ageDays >= 24) {
        const isOverdue = ageDays >= 28;
        const key = `wean-${lit.sow_ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `${isOverdue ? "⚠️ QUÁ HẠN: " : "🔔 "}Cai sữa đàn con nái ${lit.sow_ear_tag} (${lit.alive_born} con, ${ageDays} ngày tuổi)`,
          due_date: lit.weaning_date || addDays(lit.farrow_date, 28),
          related_tag: lit.sow_ear_tag,
          category: "WEAN",
          is_completed: false,
          is_auto: true
        });
      }
    });

    // 3. QUY TRÌNH HẬU BỊ & NÁI CHỜ PHỐI
    sowList.forEach((sow) => {
      const st = normalize(sow.stage);
      if (st.includes("hau bi") || st.includes("cho phoi")) {
        const key = `heat-${sow.ear_tag}`;
        taskMap.set(key, {
          id: key,
          title: `[THEO DÕI ĐỘNG DỤC] Ép đực dò nái kiểm tra chịu đực: ${sow.ear_tag} (Ô: ${sow.current_pen_code || "—"})`,
          due_date: today.toISOString().split("T")[0],
          related_tag: sow.ear_tag,
          category: "REPRO",
          is_completed: false,
          is_auto: true
        });
      }
    });

    // Nạp các việc thủ công từ DB mà chưa bị trùng
    dbTasks.forEach((dt) => {
      if (!taskMap.has(dt.title)) {
        taskMap.set(dt.title, dt);
      }
    });

    return Array.from(taskMap.values());
  }, [inseminations, activeLitters, sowList, dbTasks]);

  const filteredTasks = fullTasks.filter((t) => {
    if (taskCategoryFilter === "ALL") return true;
    return t.category === taskCategoryFilter;
  });

  const handleUpdatePig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPig) return;

    setIsSavingEdit(true);
    const { error } = await supabase
      .from("pigs")
      .update({
        ear_tag: editingPig.ear_tag.trim(),
        breed_id: editingPig.breed_id,
        sex: editingPig.sex,
        stage: editingPig.stage,
        current_pen_code: editingPig.current_pen_code,
        sire_ear_tag: editingPig.sire_ear_tag || null,
        dam_ear_tag: editingPig.dam_ear_tag || null,
        notes: editingPig.notes?.trim() || null,
      })
      .eq("id", editingPig.id);

    if (error) {
      alert("Lỗi: " + error.message);
    } else {
      setEditingPig(null);
      fetchData();
    }
    setIsSavingEdit(false);
  };

  const handleWeanLitter = async (litter: FarrowingLitter) => {
    if (!confirm(`Xác nhận cai sữa cho đàn con nái ${litter.sow_ear_tag}? Nái sẽ chuyển sang 'Chờ phối' để ép giống lại.`)) return;

    await supabase.from("pigs").update({ stage: "Chờ phối" }).eq("ear_tag", litter.sow_ear_tag);
    await supabase.from("farrowings").update({ notes: "Đã cai sữa", weaning_date: new Date().toISOString().split("T")[0] }).eq("id", litter.id);

    alert(`Đã hoàn tất cai sữa đàn con nái ${litter.sow_ear_tag}!`);
    fetchData();
  };

  const toggleTask = async (task: FarmTask) => {
    if (task.is_auto) {
      if (task.category === "WEAN") {
        alert("Để hoàn thành việc này, hãy vào phân hệ LỢN CON và bấm 'Xác nhận cai sữa'!");
        return;
      }
      await supabase.from("farm_tasks").insert([
        {
          title: task.title,
          due_date: task.due_date,
          related_tag: task.related_tag,
          is_completed: true
        }
      ]);
      fetchData();
      return;
    }
    await supabase.from("farm_tasks").update({ is_completed: !task.is_completed }).eq("id", task.id);
    fetchData();
  };

  const renderPigCard = (pig: Pig) => (
    <div
      key={pig.id}
      onClick={() => setEditingPig({ ...pig })}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        padding: "14px 16px",
        border: "1px solid #f1e5f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "18px", fontWeight: "900", color: "#1e1b4b" }}>{pig.ear_tag}</span>
        <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px", background: "#f3e8ff", color: "#6b21a8" }}>
          Sửa ✎
        </span>
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

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#2d1633", maxWidth: "480px", margin: "0 auto", position: "relative", boxSizing: "border-box" }}>
      
      {/* KHỐI NỘI DUNG CHÍNH (CÓ PADDING BOTTOM 50PX ĐỂ KHÔNG BỊ FOOTER CHE KHUẤT KHI VUỐT HẾT TRANG) */}
      <div style={{ paddingBottom: "50px" }}>
        {/* HEADER */}
        <header style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", fontSize: "22px", lineHeight: "1" }}
          >
            ☰
          </button>
          <h1 style={{ fontSize: "18px", fontWeight: "900", margin: 0, letterSpacing: "0.5px", color: "#1e1b4b" }}>
            {currentMenu === "OVERVIEW" && "TỔNG QUAN"}
            {currentMenu === "SOW" && "QUẢN LÝ NÁI"}
            {currentMenu === "BOAR" && "QUẢN LÝ ĐỰC"}
            {currentMenu === "PIGLET" && "LỢN CON THEO LÔ"}
            {currentMenu === "MEAT" && "LỢN THỊT"}
            {currentMenu === "SEARCH" && "TRA CỨU"}
            {currentMenu === "SETTINGS" && "CÀI ĐẶT"}
          </h1>
        </header>

        {/* DRAWER MENU */}
        {isSidebarOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
            <div onClick={() => setIsSidebarOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }} />
            <div style={{ width: "280px", backgroundColor: "#ffffff", height: "100%", zIndex: 101, display: "flex", flexDirection: "column", padding: "20px 14px", boxShadow: "4px 0 16px rgba(0,0,0,0.1)" }}>
              <div style={{ padding: "12px 14px 20px 14px", borderBottom: "1px solid #f1f5f9" }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900", color: "#5b21b6", letterSpacing: "1px" }}>
                  APPTRAILON
                </h2>
              </div>
              <nav style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "16px" }}>
                {[
                  { key: "OVERVIEW", label: "Tổng quan", icon: "📊" },
                  { key: "SOW", label: "Quản lý nái", icon: "🐖" },
                  { key: "BOAR", label: "Quản lý đực", icon: "🐗" },
                  { key: "PIGLET", label: "Lợn con (Theo lô)", icon: "🍼" },
                  { key: "MEAT", label: "Lợn thịt", icon: "🥩" },
                  { key: "SEARCH", label: "Tra cứu cá thể", icon: "🔍" },
                  { key: "SETTINGS", label: "Cài đặt danh mục", icon: "⚙️" },
                ].map((item) => {
                  const isActive = currentMenu === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setCurrentMenu(item.key as any);
                        setSubFilter("ALL");
                        setIsSidebarOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: "none",
                        backgroundColor: isActive ? "#ede9fe" : "transparent",
                        color: isActive ? "#5b21b6" : "#334155",
                        fontWeight: isActive ? "800" : "600",
                        fontSize: "15px",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* 1. MÀN HÌNH TỔNG QUAN */}
        {currentMenu === "OVERVIEW" && (
          <div style={{ padding: "16px" }}>
            
            {/* Hộp Tổng Đàn */}
            <div style={{ backgroundColor: "#eae7ec", borderRadius: "14px", padding: "16px 18px", marginBottom: "12px" }}>
              <span style={{ fontSize: "20px", fontWeight: "900", color: "#1e1b4b" }}>
                TỔNG ĐÀN: {totalCount} con
              </span>
            </div>

            {/* 4 Thẻ Màu */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
              <div onClick={() => { setCurrentMenu("SOW"); setSubFilter("ALL"); }} style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowCount} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Chửa: <strong>{sowChua}</strong></div>
                  <div>• Nuôi con: <strong>{sowNuoiCon}</strong></div>
                  <div>• Chờ phối: <strong>{sowChoPhoi}</strong></div>
                </div>
              </div>

              <div onClick={() => { setCurrentMenu("BOAR"); setSubFilter("ALL"); }} style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarCount} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Đang khai thác tinh</div>
                </div>
              </div>

              <div onClick={() => { setCurrentMenu("PIGLET"); }} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{totalPigletsCount} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Theo {activeLitters.length} lô mẹ</div>
                  <div>• Đang bú sữa</div>
                </div>
              </div>

              <div onClick={() => { setCurrentMenu("MEAT"); }} style={{ backgroundColor: "#f6f1f2", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatCount} con</div>
                <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                  <div>• Đang vỗ béo</div>
                </div>
              </div>
            </div>

            {/* DANH SÁCH VIỆC CẦN LÀM & LỊCH THÚ Y TỰ ĐỘNG (ĐÃ KHỬ TRÙNG LẶP 100%) */}
            <div>
              <div style={{ marginBottom: "8px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: 0 }}>
                  LỊCH KỸ THUẬT & VIỆC CẦN LÀM ({filteredTasks.filter(t => !t.is_completed).length})
                </h3>
              </div>

              {/* Bộ lọc loại công việc */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto", paddingBottom: "4px" }}>
                {[
                  { id: "ALL", label: "Tất cả" },
                  { id: "REPRO", label: "Sinh sản & Động dục" },
                  { id: "VET", label: "Vaccine & Thú y" },
                  { id: "WEAN", label: "Cai sữa" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTaskCategoryFilter(tab.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "16px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#e2e8f0",
                      color: taskCategoryFilter === tab.id ? "#fff" : "#475569"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px", color: "#94a3b8", fontSize: "13px" }}>Không có lịch việc trong mục này.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                        background: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "#fef2f2" : "#fff",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "1px solid #fecaca" : "1px solid #f1e5f0"
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "#b91c1c" : "#1e1b4b", textDecoration: task.is_completed ? "line-through" : "none" }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          Hạn: <strong>{task.due_date}</strong> {task.related_tag && `(Tai: ${task.related_tag})`}
                        </div>
                      </div>
                      <div style={{ fontSize: "20px" }}>{task.is_completed ? "🟢" : "⚪"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. QUẢN LÝ NÁI */}
        {currentMenu === "SOW" && (
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "14px", overflowX: "auto", paddingBottom: "4px" }}>
              {[
                { id: "ALL", label: `Tất cả (${sowCount})` },
                { id: "CHUA", label: `Đang chửa (${sowChua})` },
                { id: "NUOICON", label: `Nuôi con (${sowNuoiCon})` },
                { id: "CHOPHOI", label: `Chờ phối (${sowChoPhoi})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSubFilter(tab.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "20px",
                    border: "none",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    backgroundColor: subFilter === tab.id ? "#db2777" : "#fff",
                    color: subFilter === tab.id ? "#fff" : "#475569",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  {tab.label}
                </button>
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
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#2563eb", marginBottom: "12px" }}>
              ĐÀN ĐỰC GIỐNG ({boarCount} CON)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {boarList.map(renderPigCard)}
            </div>
          </div>
        )}

        {/* 4. QUẢN LÝ LỢN CON THEO LÔ */}
        {currentMenu === "PIGLET" && (
          <div style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "800", color: "#16a34a" }}>
                ĐANG NUÔI: {activeLitters.length} LÔ ({totalPigletsCount} CON)
              </span>
            </div>

            {activeLitters.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", background: "#fff", borderRadius: "12px", color: "#94a3b8" }}>
                Hiện tại không có lô lợn con nào theo mẹ.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {activeLitters.map((lit) => {
                  const sow = pigs.find((p) => p.ear_tag === lit.sow_ear_tag);
                  const today = new Date();
                  const fDate = new Date(lit.farrow_date);
                  const ageDays = Math.floor((today.getTime() - fDate.getTime()) / (1000 * 3600 * 24));
                  const isReadyWean = ageDays >= 24;

                  return (
                    <div
                      key={lit.id}
                      style={{
                        backgroundColor: "#fff",
                        borderRadius: "14px",
                        padding: "16px",
                        border: isReadyWean ? "1px solid #fed7aa" : "1px solid #f1e5f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>
                            Lô nái {lit.sow_ear_tag}
                          </span>
                          <span style={{ marginLeft: "8px", fontSize: "12px", color: "#64748b" }}>
                            ({lit.litter_code})
                          </span>
                        </div>
                        <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#047857" }}>
                          {lit.alive_born} con sống
                        </span>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "10px 0" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#f1f5f9", fontWeight: "600" }}>
                          Chuồng mẹ: {sow?.current_pen_code || "Chưa rõ"}
                        </span>
                        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: isReadyWean ? "#fff7ed" : "#f1f5f9", color: isReadyWean ? "#ea580c" : "#334155", fontWeight: "700" }}>
                          {ageDays} ngày tuổi {isReadyWean && "🔔 (Sắp/Quá hạn cai sữa)"}
                        </span>
                      </div>

                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
                        Ngày đẻ: <strong>{lit.farrow_date}</strong> | Hạn cai sữa: <strong>{lit.weaning_date}</strong>
                      </div>

                      <button
                        onClick={() => handleWeanLitter(lit)}
                        style={{
                          width: "100%",
                          padding: "9px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: isReadyWean ? "#ea580c" : "#0f172a",
                          color: "#fff",
                          fontSize: "13px",
                          fontWeight: "800",
                          cursor: "pointer"
                        }}
                      >
                        ✓ Xác nhận Cai sữa đàn này
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 5. LỢN THỊT */}
        {currentMenu === "MEAT" && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#854d0e", marginBottom: "12px" }}>
              ĐÀN LỢN THỊT ({meatCount} CON)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {meatList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", background: "#fff", borderRadius: "12px", color: "#94a3b8" }}>Chưa có lợn thịt.</div>
              ) : (
                meatList.map(renderPigCard)
              )}
            </div>
          </div>
        )}

        {/* 6. TRA CỨU */}
        {currentMenu === "SEARCH" && (
          <div style={{ padding: "16px" }}>
            <input
              type="text"
              placeholder="Gõ số tai, chuồng, giống..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box", marginBottom: "14px" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pigs
                .filter(p => !isIndividualPiglet(p))
                .filter((p) => {
                  const q = searchQuery.toLowerCase();
                  return p.ear_tag?.toLowerCase().includes(q) || p.breed_id?.toLowerCase().includes(q) || p.current_pen_code?.toLowerCase().includes(q);
                })
                .map(renderPigCard)}
            </div>
          </div>
        )}

        {/* 7. CÀI ĐẶT DANH MỤC */}
        {currentMenu === "SETTINGS" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Giống lợn</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {config.breeds.map((b) => (
                  <span key={b} style={{ padding: "4px 10px", borderRadius: "20px", background: "#f1f5f9", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {b}
                    <span onClick={() => saveConfig({ ...config, breeds: config.breeds.filter(item => item !== b) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input placeholder="Thêm giống mới..." value={newBreedInput} onChange={(e) => setNewBreedInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                <button onClick={() => { if (newBreedInput.trim() && !config.breeds.includes(newBreedInput.trim())) { saveConfig({ ...config, breeds: [...config.breeds, newBreedInput.trim()] }); setNewBreedInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
              </div>
            </div>

            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Giai đoạn / Trạng thái</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {config.stages.map((st) => (
                  <span key={st} style={{ padding: "4px 10px", borderRadius: "20px", background: "#ecfdf5", color: "#047857", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {st}
                    <span onClick={() => saveConfig({ ...config, stages: config.stages.filter(item => item !== st) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input placeholder="Thêm trạng thái..." value={newStageInput} onChange={(e) => setNewStageInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                <button onClick={() => { if (newStageInput.trim() && !config.stages.includes(newStageInput.trim())) { saveConfig({ ...config, stages: [...config.stages, newStageInput.trim()] }); setNewStageInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
              </div>
            </div>

            <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Ô Chuồng</h4>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                {config.pens.map((pen) => (
                  <span key={pen} style={{ padding: "4px 10px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                    {pen}
                    <span onClick={() => saveConfig({ ...config, pens: config.pens.filter(item => item !== pen) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input placeholder="Mã ô chuồng..." value={newPenInput} onChange={(e) => setNewPenInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
                <button onClick={() => { if (newPenInput.trim() && !config.pens.includes(newPenInput.trim())) { saveConfig({ ...config, pens: [...config.pens, newPenInput.trim().toUpperCase()] }); setNewPenInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* THANH FOOTER CỐ ĐỊNH Ở ĐÁY - NẰM HOÀN TOÀN BÊN TRÁI, NÉ HUY HIỆU NETLIFY */}
      <footer
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "36px",
          backgroundColor: "rgba(253, 248, 251, 0.95)",
          backdropFilter: "blur(6px)",
          borderTop: "1px solid #f1e5f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: "16px",
          zIndex: 40,
          maxWidth: "480px",
          margin: "0 auto",
          boxSizing: "border-box",
          pointerEvents: "none"
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: "800",
            color: "#64748b",
            letterSpacing: "0.3px",
            whiteSpace: "nowrap"
          }}
        >
          AppWeb: Trại Lợn Nà Roác
        </span>
      </footer>

      {/* MODAL SỬA CÁ THỂ VỚI DROPDOWN TOÀN DIỆN */}
      {editingPig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                Sửa thông tin: {editingPig.ear_tag}
              </h3>
              <button onClick={() => setEditingPig(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleUpdatePig} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>SỐ TAI *</label>
                <input
                  required
                  value={editingPig.ear_tag}
                  onChange={(e) => setEditingPig({ ...editingPig, ear_tag: e.target.value })}
                  style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "14px", fontWeight: "bold" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIỐNG (DROPDOWN)</label>
                  <select
                    value={editingPig.breed_id || config.breeds[0]}
                    onChange={(e) => setEditingPig({ ...editingPig, breed_id: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    {config.breeds.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIỚI TÍNH</label>
                  <select
                    value={editingPig.sex || "Cái"}
                    onChange={(e) => setEditingPig({ ...editingPig, sex: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    <option value="Cái">Lợn Cái</option>
                    <option value="Đực">Lợn Đực</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIAI ĐOẠN / TRẠNG THÁI</label>
                <select
                  value={editingPig.stage || config.stages[0]}
                  onChange={(e) => setEditingPig({ ...editingPig, stage: e.target.value })}
                  style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                >
                  {config.stages.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHUỒNG / Ô</label>
                <select
                  value={editingPig.current_pen_code || config.pens[0]}
                  onChange={(e) => setEditingPig({ ...editingPig, current_pen_code: e.target.value })}
                  style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                >
                  <option value="">-- Chưa xếp chuồng --</option>
                  {config.pens.map((pen) => <option key={pen} value={pen}>{pen}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN BỐ</label>
                  <select
                    value={editingPig.sire_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, sire_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    <option value="">-- Chưa rõ bố --</option>
                    {boarList.map((b) => <option key={b.id} value={b.ear_tag}>{b.ear_tag}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN MẸ</label>
                  <select
                    value={editingPig.dam_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, dam_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    <option value="">-- Chưa rõ mẹ --</option>
                    {sowList.map((s) => <option key={s.id} value={s.ear_tag}>{s.ear_tag}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GHI CHÚ</label>
                <input
                  value={editingPig.notes || ""}
                  placeholder="Ghi chú tiêm phòng, bệnh tật..."
                  onChange={(e) => setEditingPig({ ...editingPig, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" onClick={() => setEditingPig(null)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={isSavingEdit} style={{ padding: "8px 18px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}>
                  {isSavingEdit ? "Đang lưu..." : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
