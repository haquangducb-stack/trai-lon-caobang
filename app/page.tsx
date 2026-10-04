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
  notes?: string;
}

interface FarmTask {
  id: string;
  title: string;
  due_date: string;
  related_tag: string;
  is_completed: boolean;
}

export default function FarmApp() {
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Menu phân hệ
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "SOW" | "BOAR" | "PIGLET" | "MEAT" | "SEARCH" | "SETTINGS">("OVERVIEW");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Sửa cá thể
  const [editingPig, setEditingPig] = useState<Pig | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal Phối giống & Thêm mới
  const [showMatingModal, setShowMatingModal] = useState(false);
  const [selectedSow, setSelectedSow] = useState("");
  const [selectedBoar, setSelectedBoar] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);

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
      const [pRes, tRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true })
      ]);
      if (pRes.data) setPigs(pRes.data);
      if (tRes.data) setTasks(tRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  // Chuẩn hóa xóa dấu tiếng Việt phục vụ lọc logic
  const normalize = (text?: string) => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .trim();
  };

  // 1. Lợn con
  const isPiglet = (pig: Pig) => {
    const st = normalize(pig.stage);
    const tag = (pig.ear_tag || "").toUpperCase();
    return st.includes("theo me") || st.includes("lon con") || tag.includes("-C") || tag.includes("CON");
  };

  // 2. Lợn thịt
  const isMeat = (pig: Pig) => {
    const st = normalize(pig.stage);
    return st.includes("thit") || st.includes("thuong pham");
  };

  // 3. Lợn Nái
  const isSow = (pig: Pig) => {
    if (isPiglet(pig) || isMeat(pig)) return false;
    const sx = normalize(pig.sex);
    return sx === "cai" || sx === "c" || sx === "female" || sx === "f" || sx.includes("nai");
  };

  // 4. Đực giống
  const isBoar = (pig: Pig) => {
    if (isPiglet(pig) || isMeat(pig)) return false;
    if (isSow(pig)) return false;
    const sx = normalize(pig.sex);
    return sx === "duc" || sx === "d" || sx === "male" || sx === "m" || sx.includes("giong");
  };

  // Trạng thái nái
  const checkSowState = (pig: Pig): "CHUA" | "NUOICON" | "CHOPHOI" => {
    const st = normalize(pig.stage);
    if (st.includes("chua") || st.includes("phoi") || st.includes("mang thai")) {
      return "CHUA";
    }
    if (st.includes("nuoi con") || st.includes("de") || st.includes("tiet sua")) {
      return "NUOICON";
    }
    return "CHOPHOI";
  };

  // Danh sách
  const sowList = pigs.filter(isSow);
  const boarList = pigs.filter(isBoar);
  const pigletList = pigs.filter(isPiglet);
  const meatList = pigs.filter(isMeat);

  // Số liệu
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

  // Cập nhật cá thể
  const handleUpdatePig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPig) return;

    setIsSavingEdit(true);
    const { error } = await supabase
      .from("pigs")
      .update({
        ear_tag: editingPig.ear_tag.trim(),
        breed_id: editingPig.breed_id.trim(),
        sex: editingPig.sex,
        stage: editingPig.stage,
        current_pen_code: editingPig.current_pen_code?.trim() || null,
        sire_ear_tag: editingPig.sire_ear_tag?.trim() || null,
        dam_ear_tag: editingPig.dam_ear_tag?.trim() || null,
        notes: editingPig.notes?.trim() || null,
      })
      .eq("id", editingPig.id);

    if (error) {
      alert("Lỗi cập nhật: " + error.message);
    } else {
      setEditingPig(null);
      fetchData();
    }
    setIsSavingEdit(false);
  };

  // Phối giống
  const handleSaveMating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSow || !selectedBoar) return;

    const d = new Date(matingDate);
    d.setDate(d.getDate() + 114);
    const expectedFarrow = d.toISOString().split("T")[0];

    const { error } = await supabase.from("inseminations").insert([
      {
        sow_ear_tag: selectedSow,
        boar_ear_tag: selectedBoar,
        mating_date: matingDate,
        expected_farrow_date: expectedFarrow,
        technician_name: "DỰ",
        status: "Đã đậu thai"
      }
    ]);

    if (!error) {
      await supabase.from("pigs").update({ stage: "Đang chửa" }).eq("ear_tag", selectedSow);

      const task21 = new Date(matingDate);
      task21.setDate(task21.getDate() + 21);
      await supabase.from("farm_tasks").insert([
        {
          title: `Kiểm tra lốc (thử thai 21 ngày) - Nái ${selectedSow}`,
          due_date: task21.toISOString().split("T")[0],
          related_tag: selectedSow
        }
      ]);

      alert(`Đã ghi nhận phối nái ${selectedSow}! Đổi sang 'Đang chửa'.`);
      setShowMatingModal(false);
      setSelectedSow("");
      setSelectedBoar("");
      fetchData();
    }
  };

  const toggleTask = async (id: string, st: boolean) => {
    await supabase.from("farm_tasks").update({ is_completed: !st }).eq("id", id);
    fetchData();
  };

  // Render thẻ cá thể (Đã gỡ bỏ toàn bộ cân nặng)
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
                { key: "PIGLET", label: "Lợn con", icon: "🍼" },
                { key: "MEAT", label: "Lợn thịt", icon: "🥩" },
                { key: "SEARCH", label: "Tra cứu cá thể", icon: "🔍" },
                { key: "SETTINGS", label: "Cài đặt & Trại", icon: "⚙️" },
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

      {/* 1. TỔNG QUAN */}
      {currentMenu === "OVERVIEW" && (
        <div style={{ padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "19px", fontWeight: "900", color: "#1e1b4b", margin: 0 }}>TỔNG QUAN TRẠI</h2>
            <button
              onClick={() => setShowMatingModal(true)}
              style={{ padding: "6px 12px", borderRadius: "8px", background: "#2563eb", color: "#fff", border: "none", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
            >
              + Ghi nhận Phối
            </button>
          </div>

          <div style={{ backgroundColor: "#eae7ec", borderRadius: "14px", padding: "16px 18px", marginBottom: "12px" }}>
            <span style={{ fontSize: "20px", fontWeight: "900", color: "#1e1b4b" }}>
              TỔNG ĐÀN: {totalCount} con
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
            <div
              onClick={() => { setCurrentMenu("SOW"); setSubFilter("ALL"); }}
              style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}
            >
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Chửa: <strong>{sowChua}</strong></div>
                <div>• Nuôi con: <strong>{sowNuoiCon}</strong></div>
                <div>• Chờ phối: <strong>{sowChoPhoi}</strong></div>
              </div>
            </div>

            <div
              onClick={() => { setCurrentMenu("BOAR"); setSubFilter("ALL"); }}
              style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "14px", cursor: "pointer" }}
            >
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Đang khai thác tinh</div>
              </div>
            </div>

            <div
              onClick={() => { setCurrentMenu("PIGLET"); setSubFilter("ALL"); }}
              style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}
            >
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{pigletCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Theo mẹ: <strong>{pigletTheoMe}</strong></div>
                <div>• Cai sữa: <strong>{pigletCaiSua}</strong></div>
              </div>
            </div>

            <div
              onClick={() => { setCurrentMenu("MEAT"); setSubFilter("ALL"); }}
              style={{ backgroundColor: "#f6f1f2", borderRadius: "16px", padding: "14px", cursor: "pointer" }}
            >
              <div style={{ fontSize: "12px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatCount} con</div>
              <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
                <div>• Đang nuôi vỗ béo</div>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 12px 0" }}>
              CÔNG VIỆC CẦN LÀM ({tasks.filter(t => !t.is_completed).length})
            </h3>
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
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>Hạn: <strong>{task.due_date}</strong></div>
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
            {sowList
              .filter((p) => {
                if (subFilter === "ALL") return true;
                return checkSowState(p) === subFilter;
              })
              .map(renderPigCard)}
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
            <button
              onClick={() => setSubFilter("ALL")}
              style={{ padding: "6px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "700", background: subFilter === "ALL" ? "#16a34a" : "#fff", color: subFilter === "ALL" ? "#fff" : "#334155" }}
            >
              Tất cả ({pigletCount})
            </button>
            <button
              onClick={() => setSubFilter("THEOME")}
              style={{ padding: "6px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "700", background: subFilter === "THEOME" ? "#16a34a" : "#fff", color: subFilter === "THEOME" ? "#fff" : "#334155" }}
            >
              Theo mẹ ({pigletTheoMe})
            </button>
            <button
              onClick={() => setSubFilter("CAISUA")}
              style={{ padding: "6px 12px", borderRadius: "16px", border: "none", fontSize: "12px", fontWeight: "700", background: subFilter === "CAISUA" ? "#16a34a" : "#fff", color: subFilter === "CAISUA" ? "#fff" : "#334155" }}
            >
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
              <div style={{ textAlign: "center", padding: "20px", background: "#fff", borderRadius: "12px", color: "#94a3b8" }}>Chưa có lợn thịt trong đàn.</div>
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
                return (
                  p.ear_tag?.toLowerCase().includes(q) ||
                  p.breed_id?.toLowerCase().includes(q) ||
                  p.current_pen_code?.toLowerCase().includes(q)
                );
              })
              .map(renderPigCard)}
          </div>
        </div>
      )}

      {/* 7. CÀI ĐẶT */}
      {currentMenu === "SETTINGS" && (
        <div style={{ padding: "16px" }}>
          <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: "800" }}>Trại Nà Roác - Cao Bằng</h3>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: "1.6" }}>
              Tự động hóa theo dõi chu kỳ: Đang chửa (114 ngày), Thử lốc (21 ngày).
            </p>
            <div style={{ marginTop: "14px" }}>
              <button
                onClick={fetchData}
                style={{ padding: "8px 16px", borderRadius: "8px", background: "#0f172a", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}
              >
                Đồng bộ lại dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SỬA CÁ THỂ (ĐÃ LƯỢC BỎ CÂN NẶNG) */}
      {editingPig && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "420px", maxHeight: "90vh", overflowY: "auto", padding: "20px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                Sửa cá thể: {editingPig.ear_tag}
              </h3>
              <button onClick={() => setEditingPig(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleUpdatePig} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>SỐ TAI</label>
                <input
                  required
                  value={editingPig.ear_tag}
                  onChange={(e) => setEditingPig({ ...editingPig, ear_tag: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>GIỐNG</label>
                  <input
                    value={editingPig.breed_id || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, breed_id: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>GIỚI TÍNH</label>
                  <select
                    value={editingPig.sex || "Cái"}
                    onChange={(e) => setEditingPig({ ...editingPig, sex: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  >
                    <option value="Cái">Lợn Cái</option>
                    <option value="Đực">Lợn Đực</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>GIAI ĐOẠN / TRẠNG THÁI</label>
                  <input
                    value={editingPig.stage || ""}
                    placeholder="Đang chửa, Nuôi con..."
                    onChange={(e) => setEditingPig({ ...editingPig, stage: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>CHUỒNG / Ô</label>
                  <input
                    value={editingPig.current_pen_code || ""}
                    placeholder="CA1, CB2..."
                    onChange={(e) => setEditingPig({ ...editingPig, current_pen_code: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>SỐ TAI BỐ</label>
                  <input
                    value={editingPig.sire_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, sire_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>SỐ TAI MẸ</label>
                  <input
                    value={editingPig.dam_ear_tag || ""}
                    onChange={(e) => setEditingPig({ ...editingPig, dam_ear_tag: e.target.value })}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>GHI CHÚ</label>
                <input
                  value={editingPig.notes || ""}
                  onChange={(e) => setEditingPig({ ...editingPig, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setEditingPig(null)}
                  style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{ padding: "8px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700", cursor: "pointer" }}
                >
                  {isSavingEdit ? "Đang lưu..." : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PHỐI GIỐNG */}
      {showMatingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800" }}>Ghi nhận Phối Giống</h3>
              <button onClick={() => setShowMatingModal(false)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleSaveMating} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>CHỌN LỢN NÁI</label>
                <select required value={selectedSow} onChange={(e) => setSelectedSow(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn nái --</option>
                  {sowList.map(s => <option key={s.id} value={s.ear_tag}>{s.ear_tag} ({s.stage || "Hậu bị"})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>CHỌN ĐỰC GIỐNG</label>
                <select required value={selectedBoar} onChange={(e) => setSelectedBoar(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn đực giống --</option>
                  {boarList.map(b => <option key={b.id} value={b.ear_tag}>{b.ear_tag}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "3px" }}>NGÀY PHỐI</label>
                <input type="date" required value={matingDate} onChange={(e) => setMatingDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
                <button type="submit" style={{ padding: "8px 16px", borderRadius: "6px", background: "#2563eb", color: "#fff", border: "none", fontWeight: "700" }}>Xác nhận Phối</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
