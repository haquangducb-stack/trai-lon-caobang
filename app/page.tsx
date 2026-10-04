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

interface FarmTask {
  id: string;
  title: string;
  due_date: string;
  related_tag: string;
  is_completed: boolean;
}

interface FarmConfig {
  breeds: string[];
  stages: string[];
  pens: string[];
}

export default function FarmApp() {
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Phân hệ điều hướng
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Cấu hình danh mục Dropdown (lưu local + đồng bộ)
  const [config, setConfig] = useState<FarmConfig>({
    breeds: ["Hạ Lang", "Móng Cái", "Duroc", "Pietrain", "Landrace", "Yorkshire"],
    stages: ["Hậu bị", "Chờ phối", "Đang chửa", "Nuôi con", "Theo mẹ", "Cai sữa", "Vỗ béo thịt", "Đực giống"],
    pens: ["CA1", "CA2", "CA3", "CA4", "CA5", "CB1", "CB2", "CB3", "CB4", "CD1"]
  });

  // Modal Sửa cá thể
  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal Tạo việc mới
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", due_date: new Date().toISOString().split("T")[0], related_tag: "" });

  // Input thêm danh mục cài đặt
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
      const [pRes, tRes, penRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("pens").select("pen_code").order("pen_code", { ascending: true })
      ]);
      if (pRes.data) setPigs(pRes.data);
      if (tRes.data) setTasks(tRes.data);
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
    // Tải cấu hình cài đặt nếu có trong localStorage
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

  // Chuẩn hóa lọc
  const normalize = (text?: string) => {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").trim();
  };

  const isPiglet = (pig: Pig) => {
    const st = normalize(pig.stage);
    const tag = (pig.ear_tag || "").toUpperCase();
    return st.includes("theo me") || st.includes("lon con") || tag.includes("-C") || tag.includes("CON");
  };

  const isMeat = (pig: Pig) => {
    const st = normalize(pig.stage);
    return st.includes("thit") || st.includes("thuong pham");
  };

  const isSow = (pig: Pig) => {
    if (isPiglet(pig) || isMeat(pig)) return false;
    const sx = normalize(pig.sex);
    return sx === "cai" || sx === "c" || sx === "female" || sx === "f" || sx.includes("nai");
  };

  const isBoar = (pig: Pig) => {
    if (isPiglet(pig) || isMeat(pig)) return false;
    if (isSow(pig)) return false;
    const sx = normalize(pig.sex);
    return sx === "duc" || sx === "d" || sx === "male" || sx === "m" || sx.includes("giong");
  };

  const checkSowState = (pig: Pig): "CHUA" | "NUOICON" | "CHOPHOI" => {
    const st = normalize(pig.stage);
    if (st.includes("chua") || st.includes("phoi") || st.includes("mang thai")) return "CHUA";
    if (st.includes("nuoi con") || st.includes("de") || st.includes("tiet sua")) return "NUOICON";
    return "CHOPHOI";
  };

  // Danh sách cá thể
  const sowList = pigs.filter(isSow);
  const boarList = pigs.filter(isBoar);
  const pigletList = pigs.filter(isPiglet);
  const meatList = pigs.filter(isMeat);

  // Số lượng thống kê
  const totalCount = pigs.length;
  const sowCount = sowList.length;
  const sowChua = sowList.filter((p) => checkSowState(p) === "CHUA").length;
  const sowNuoiCon = sowList.filter((p) => checkSowState(p) === "NUOICON").length;
  const sowChoPhoi = sowList.filter((p) => checkSowState(p) === "CHOPHOI").length;
  const boarCount = boarList.length;
  const pigletCount = pigletList.length;
  const pigletTheoMe = pigletList.filter((p) => !normalize(p.stage).includes("cai sua")).length;
  const pigletCaiSua = pigletList.filter((p) => normalize(p.stage).includes("cai sua")).length;
  const meatCount = meatList.length;

  // HỆ THỐNG CẢNH BÁO TỰ ĐỘNG THÔNG MINH
  const alerts = useMemo(() => {
    const list: { type: "WARNING" | "INFO"; text: string; tag: string }[] = [];
    const today = new Date();

    // 1. Kiểm tra lợn con sắp / quá hạn cai sữa (>= 24 ngày tuổi)
    pigletList.forEach((pig) => {
      if (pig.birth_date && !normalize(pig.stage).includes("cai sua")) {
        const bDate = new Date(pig.birth_date);
        const ageInDays = Math.floor((today.getTime() - bDate.getTime()) / (1000 * 3600 * 24));
        if (ageInDays >= 28) {
          list.push({ type: "WARNING", text: `Lợn con ${pig.ear_tag} đã ${ageInDays} ngày tuổi (Quá hạn cai sữa!)`, tag: pig.ear_tag });
        } else if (ageInDays >= 24) {
          list.push({ type: "INFO", text: `Lợn con ${pig.ear_tag} được ${ageInDays} ngày tuổi (Chuẩn bị cai sữa)`, tag: pig.ear_tag });
        }
      }
    });

    return list;
  }, [pigletList]);

  // Cập nhật cá thể
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

  // Tạo công việc mới
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    const { error } = await supabase.from("farm_tasks").insert([
      {
        title: newTask.title.trim(),
        due_date: newTask.due_date,
        related_tag: newTask.related_tag.trim() || null,
      }
    ]);

    if (!error) {
      setShowAddTaskModal(false);
      setNewTask({ title: "", due_date: new Date().toISOString().split("T")[0], related_tag: "" });
      fetchData();
    }
  };

  const toggleTask = async (id: string, st: boolean) => {
    await supabase.from("farm_tasks").update({ is_completed: !st }).eq("id", id);
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
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#2d1633", maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      
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
          {currentMenu === "PIGLET" && "LỢN CON THEO MẸ"}
          {currentMenu === "MEAT" && "LỢN THỊT"}
          {currentMenu === "SEARCH" && "TRA CỨU"}
          {currentMenu === "SETTINGS" && "CÀI ĐẶT"}
        </h1>
      </header>

      {/* DRAWER MENU TRƯỢT */}
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
                { key: "PIGLET", label: "Lợn con", icon: "🍼" },
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
          
          {/* CẢNH BÁO KỸ THUẬT TỰ ĐỘNG (LỢN CON CAI SỮA, NÁI DỰ ĐẺ...) */}
          {alerts.length > 0 && (
            <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {alerts.map((al, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "10px",
                    backgroundColor: al.type === "WARNING" ? "#fef2f2" : "#fffbeb",
                    border: al.type === "WARNING" ? "1px solid #fecaca" : "1px solid #fef08a",
                    color: al.type === "WARNING" ? "#b91c1c" : "#854d0e",
                    fontSize: "13px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <span>{al.type === "WARNING" ? "⚠️" : "💡"}</span>
                  <span>{al.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Hộp Tổng Đàn */}
          <div style={{ backgroundColor: "#eae7ec", borderRadius: "14px", padding: "16px 18px", marginBottom: "12px" }}>
            <span style={{ fontSize: "20px", fontWeight: "900", color: "#1e1b4b" }}>
              TỔNG ĐÀN: {totalCount} con
            </span>
          </div>

          {/* 4 Thẻ Màu điều hướng */}
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

            <div onClick={() => { setCurrentMenu("PIGLET"); setSubFilter("ALL"); }} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{pigletCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Theo mẹ: <strong>{pigletTheoMe}</strong></div>
                <div>• Cai sữa: <strong>{pigletCaiSua}</strong></div>
              </div>
            </div>

            <div onClick={() => { setCurrentMenu("MEAT"); setSubFilter("ALL"); }} style={{ backgroundColor: "#f6f1f2", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Đang nuôi vỗ béo</div>
              </div>
            </div>
          </div>

          {/* DANH SÁCH VIỆC CẦN LÀM + NÚT THÊM VIỆC */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: 0 }}>
                CÔNG VIỆC CẦN LÀM ({tasks.filter(t => !t.is_completed).length})
              </h3>
              <button
                onClick={() => setShowAddTaskModal(true)}
                style={{ padding: "5px 10px", borderRadius: "8px", background: "#0f172a", color: "#fff", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
              >
                + Thêm Việc
              </button>
            </div>

            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px", color: "#94a3b8", fontSize: "13px" }}>Không có lịch việc tồn đọng.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id, task.is_completed)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", background: "#fff", padding: "10px 14px", borderRadius: "10px", border: "1px solid #f1e5f0" }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e1b4b", textDecoration: task.is_completed ? "line-through" : "none" }}>{task.title}</div>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
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

      {/* 4. LỢN CON */}
      {currentMenu === "PIGLET" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
            <button onClick={() => setSubFilter("ALL")} style={{ padding: "6px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "700", background: subFilter === "ALL" ? "#16a34a" : "#fff", color: subFilter === "ALL" ? "#fff" : "#334155" }}>
              Tất cả ({pigletCount})
            </button>
            <button onClick={() => setSubFilter("THEOME")} style={{ padding: "6px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "700", background: subFilter === "THEOME" ? "#16a34a" : "#fff", color: subFilter === "THEOME" ? "#fff" : "#334155" }}>
              Theo mẹ ({pigletTheoMe})
            </button>
            <button onClick={() => setSubFilter("CAISUA")} style={{ padding: "6px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "700", background: subFilter === "CAISUA" ? "#16a34a" : "#fff", color: subFilter === "CAISUA" ? "#fff" : "#334155" }}>
              Đã cai sữa ({pigletCaiSua})
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pigletList
              .filter((p) => {
                if (subFilter === "THEOME") return !normalize(p.stage).includes("cai sua");
                if (subFilter === "CAISUA") return normalize(p.stage).includes("cai sua");
                return true;
              })
              .map(renderPigCard)}
          </div>
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
              .filter((p) => {
                const q = searchQuery.toLowerCase();
                return p.ear_tag?.toLowerCase().includes(q) || p.breed_id?.toLowerCase().includes(q) || p.current_pen_code?.toLowerCase().includes(q);
              })
              .map(renderPigCard)}
          </div>
        </div>
      )}

      {/* 7. CÀI ĐẶT DANH MỤC DROPDOWN DÀNH CHO FORM SỬA */}
      {currentMenu === "SETTINGS" && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Cấu hình Giống */}
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Giống lợn</h4>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
              {config.breeds.map((b) => (
                <span key={b} style={{ padding: "4px 10px", borderRadius: "20px", background: "#f1f5f9", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  {b}
                  <span
                    onClick={() => saveConfig({ ...config, breeds: config.breeds.filter(item => item !== b) })}
                    style={{ cursor: "pointer", color: "#ef4444", fontWeight: "bold" }}
                  >✕</span>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                placeholder="Thêm giống mới..."
                value={newBreedInput}
                onChange={(e) => setNewBreedInput(e.target.value)}
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
              <button
                onClick={() => {
                  if (newBreedInput.trim() && !config.breeds.includes(newBreedInput.trim())) {
                    saveConfig({ ...config, breeds: [...config.breeds, newBreedInput.trim()] });
                    setNewBreedInput("");
                  }
                }}
                style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
              >+ Thêm</button>
            </div>
          </div>

          {/* Cấu hình Giai đoạn / Trạng thái */}
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Giai đoạn / Trạng thái</h4>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
              {config.stages.map((st) => (
                <span key={st} style={{ padding: "4px 10px", borderRadius: "20px", background: "#ecfdf5", color: "#047857", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  {st}
                  <span
                    onClick={() => saveConfig({ ...config, stages: config.stages.filter(item => item !== st) })}
                    style={{ cursor: "pointer", color: "#ef4444", fontWeight: "bold" }}
                  >✕</span>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                placeholder="Thêm trạng thái mới..."
                value={newStageInput}
                onChange={(e) => setNewStageInput(e.target.value)}
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
              <button
                onClick={() => {
                  if (newStageInput.trim() && !config.stages.includes(newStageInput.trim())) {
                    saveConfig({ ...config, stages: [...config.stages, newStageInput.trim()] });
                    setNewStageInput("");
                  }
                }}
                style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
              >+ Thêm</button>
            </div>
          </div>

          {/* Cấu hình Ô chuồng */}
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Ô Chuồng</h4>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
              {config.pens.map((pen) => (
                <span key={pen} style={{ padding: "4px 10px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                  {pen}
                  <span
                    onClick={() => saveConfig({ ...config, pens: config.pens.filter(item => item !== pen) })}
                    style={{ cursor: "pointer", color: "#ef4444", fontWeight: "bold" }}
                  >✕</span>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                placeholder="Thêm mã ô chuồng (VD: CA6)..."
                value={newPenInput}
                onChange={(e) => setNewPenInput(e.target.value)}
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              />
              <button
                onClick={() => {
                  if (newPenInput.trim() && !config.pens.includes(newPenInput.trim())) {
                    saveConfig({ ...config, pens: [...config.pens, newPenInput.trim().toUpperCase()] });
                    setNewPenInput("");
                  }
                }}
                style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}
              >+ Thêm</button>
            </div>
          </div>

        </div>
      )}

      {/* MODAL SỬA CÁ THỂ - TOÀN BỘ DROPDOWN TIỆN DỤNG */}
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
              
              {/* Số tai */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>SỐ TAI *</label>
                <input
                  required
                  value={editingPig.ear_tag}
                  onChange={(e) => setEditingPig({ ...editingPig, ear_tag: e.target.value })}
                  style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box", fontSize: "14px", fontWeight: "bold" }}
                />
              </div>

              {/* Giống & Giới tính */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIỐNG (DROPDOWN)</label>
                  <select
                    value={editingPig.breed_id || config.breeds[0]}
                    onChange={(e) => setEditingPig({ ...editingPig, breed_id: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    {config.breeds.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
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

              {/* Giai đoạn / Trạng thái */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIAI ĐOẠN / TRẠNG THÁI (DROPDOWN)</label>
                <select
                  value={editingPig.stage || config.stages[0]}
                  onChange={(e) => setEditingPig({ ...editingPig, stage: e.target.value })}
                  style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                >
                  {config.stages.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Chuồng / Ô */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHUỒNG / Ô (DROPDOWN)</label>
                <select
                  value={editingPig.current_pen_code || config.pens[0]}
                  onChange={(e) => setEditingPig({ ...editingPig, current_pen_code: e.target.value })}
                  style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                >
                  <option value="">-- Chưa xếp chuồng --</option>
                  {config.pens.map((pen) => (
                    <option key={pen} value={pen}>{pen}</option>
                  ))}
                </select>
              </div>

              {/* Phả hệ Bố & Mẹ chọn Dropdown */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN BỐ (DROPDOWN)</label>
                  <select
                    value={editingPig.sire_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, sire_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    <option value="">-- Chưa rõ bố --</option>
                    {boarList.map((b) => (
                      <option key={b.id} value={b.ear_tag}>{b.ear_tag}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN MẸ (DROPDOWN)</label>
                  <select
                    value={editingPig.dam_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, dam_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
                  >
                    <option value="">-- Chưa rõ mẹ --</option>
                    {sowList.map((s) => (
                      <option key={s.id} value={s.ear_tag}>{s.ear_tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GHI CHÚ THEO DÕI</label>
                <input
                  value={editingPig.notes || ""}
                  placeholder="Ghi chú tiêm phòng, bệnh tật..."
                  onChange={(e) => setEditingPig({ ...editingPig, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setEditingPig(null)}
                  style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                >Hủy</button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{ padding: "8px 18px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}
                >
                  {isSavingEdit ? "Đang lưu..." : "Lưu Thay Đổi"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM CÔNG VIỆC NHANH */}
      {showAddTaskModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "380px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800" }}>Thêm Việc Cần Làm</h3>
              <button onClick={() => setShowAddTaskModal(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>NỘI DUNG CÔNG VIỆC *</label>
                <input
                  required
                  placeholder="Ví dụ: Tiêm sắt, cai sữa, kiểm tra lốc..."
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>HẠN XỬ LÝ</label>
                <input
                  type="date"
                  required
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>LIÊN QUAN ĐẾN SỐ TAI (TÙY CHỌN)</label>
                <input
                  placeholder="HL01, HL02..."
                  value={newTask.related_tag}
                  onChange={(e) => setNewTask({ ...newTask, related_tag: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowAddTaskModal(false)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", background: "#0f172a", color: "#fff", border: "none", fontWeight: "700" }}>Tạo việc</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
