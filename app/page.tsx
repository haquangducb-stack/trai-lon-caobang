"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  current_weight_kg: number;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentMenu, setCurrentMenu] = useState<"OVERVIEW" | "HERD" | "SEARCH">("OVERVIEW");
  const [searchQuery, setSearchQuery] = useState("");

  const supabase = useMemo(() => {
    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl, rawKey.trim());
  }, []);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const isFemale = (s?: string) => {
    if (!s) return false;
    const str = s.toLowerCase();
    return str.includes("cái") || str.includes("cai") || str.includes("nái") || str === "f" || str === "female";
  };

  const isMale = (s?: string) => {
    if (!s) return false;
    if (isFemale(s)) return false;
    const str = s.toLowerCase();
    return str.includes("đực") || str.includes("duc") || str === "m" || str === "male" || str.includes("boar");
  };

  const totalCount = pigs.length;

  // 1. NÁI
  const sowList = pigs.filter((p) => isFemale(p.sex) && !(p.stage || "").toLowerCase().includes("theo mẹ"));
  const sowCount = sowList.length;
  const sowChua = sowList.filter((p) => (p.stage || "").toLowerCase().includes("chửa") || (p.stage || "").toLowerCase().includes("phối")).length;
  const sowNuoiCon = sowList.filter((p) => (p.stage || "").toLowerCase().includes("nuôi con") || (p.stage || "").toLowerCase().includes("đẻ")).length;
  const sowChoPhoi = sowList.filter((p) => {
    const st = (p.stage || "").toLowerCase();
    return !st.includes("chửa") && !st.includes("phối") && !st.includes("nuôi con") && !st.includes("đẻ");
  }).length;

  // 2. ĐỰC GIỐNG
  const boarList = pigs.filter((p) => isMale(p.sex) && !(p.stage || "").toLowerCase().includes("theo mẹ"));
  const boarCount = boarList.length;

  // 3. LỢN CON
  const pigletList = pigs.filter((p) => {
    const st = (p.stage || "").toLowerCase();
    return st.includes("theo mẹ") || (p.ear_tag && p.ear_tag.includes("-C"));
  });
  const pigletCount = pigletList.length;
  const pigletTheoMe = pigletList.filter((p) => (p.stage || "").toLowerCase().includes("theo mẹ") || !p.stage).length;
  const pigletCaiSua = pigletList.filter((p) => (p.stage || "").toLowerCase().includes("cai sữa")).length;

  // 4. LỢN THỊT
  const meatList = pigs.filter((p) => (p.stage || "").toLowerCase().includes("thịt"));
  const meatCount = meatList.length;

  const toggleTask = async (id: string, st: boolean) => {
    await supabase.from("farm_tasks").update({ is_completed: !st }).eq("id", id);
    fetchData();
  };

  return (
    <div style={{ backgroundColor: "#fdf8fb", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#2d1633", maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      
      {/* THANH HEADER CÓ MENU 3 GẠCH */}
      <header style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "16px", borderBottom: "1px solid #f1e5f0", backgroundColor: "#fff" }}>
        <button
          onClick={() => setIsSidebarOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", fontSize: "22px", lineHeight: "1" }}
        >
          ☰
        </button>
        <h1 style={{ fontSize: "19px", fontWeight: "900", margin: 0, letterSpacing: "0.5px", color: "#1e1b4b" }}>
          {currentMenu === "OVERVIEW" && "TỔNG QUAN"}
          {currentMenu === "HERD" && "TỔNG ĐÀN"}
          {currentMenu === "SEARCH" && "TRA CỨU"}
        </h1>
      </header>

      {/* DRAWER MENU TRƯỢT TỪ BÊN TRÁI (APPTRAILON) */}
      {isSidebarOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)" }}
          />
          <div style={{ width: "280px", backgroundColor: "#ffffff", height: "100%", zIndex: 101, display: "flex", flexDirection: "column", padding: "20px 14px", boxShadow: "4px 0 16px rgba(0,0,0,0.1)" }}>
            
            <div style={{ padding: "12px 14px 20px 14px", borderBottom: "1px solid #f1f5f9" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900", color: "#5b21b6", letterSpacing: "1px" }}>
                APPTRAILON
              </h2>
            </div>

            <nav style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "16px" }}>
              {[
                { key: "OVERVIEW", label: "Tổng quan", icon: "ℹ️" },
                { key: "HERD", label: "Tổng đàn", icon: "📋" },
                { key: "SEARCH", label: "Tra cứu", icon: "🔍" },
                { key: "SOW", label: "Quản lý nái", icon: "🐷" },
                { key: "BOAR", label: "Quản lý đực", icon: "🐗" },
                { key: "VET", label: "Thú y", icon: "💉" },
                { key: "REPORT", label: "Báo cáo", icon: "📊" },
                { key: "SETTING", label: "Cài đặt", icon: "⚙️" },
              ].map((item) => {
                const isActive = currentMenu === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      if (item.key === "OVERVIEW" || item.key === "HERD" || item.key === "SEARCH") {
                        setCurrentMenu(item.key as any);
                      }
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

      {/* MÀN HÌNH TỔNG QUAN (GIỐNG ẢNH MẪU 100%) */}
      {currentMenu === "OVERVIEW" && (
        <div style={{ padding: "20px 16px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 16px 0" }}>
            TỔNG QUAN TRẠI
          </h2>

          {/* KHỐI XÁM: TỔNG ĐÀN */}
          <div style={{ backgroundColor: "#eae7ec", borderRadius: "14px", padding: "18px 20px", marginBottom: "14px" }}>
            <span style={{ fontSize: "21px", fontWeight: "900", color: "#1e1b4b" }}>
              TỔNG ĐÀN: {totalCount} con
            </span>
          </div>

          {/* LƯỚI 4 THẺ MÀU */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "26px" }}>
            
            {/* THẺ HỒNG: NÁI */}
            <div style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#e11d48", lineHeight: "1.2" }}>
                {sowCount} con
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "8px", lineHeight: "1.6" }}>
                <div>• Chửa: {sowChua}</div>
                <div>• Nuôi con: {sowNuoiCon}</div>
                <div>• Chờ phối: {sowChoPhoi}</div>
              </div>
            </div>

            {/* THẺ XANH DƯƠNG: ĐỰC GIỐNG */}
            <div style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#2563eb", lineHeight: "1.2" }}>
                {boarCount} con
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "8px", lineHeight: "1.6" }}>
                <div>• Đang khai thác</div>
              </div>
            </div>

            {/* THẺ XANH LÁ: LỢN CON */}
            <div style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#16a34a", lineHeight: "1.2" }}>
                {pigletCount} con
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "8px", lineHeight: "1.6" }}>
                <div>• Theo mẹ: {pigletTheoMe}</div>
                <div>• Cai sữa: {pigletCaiSua}</div>
              </div>
            </div>

            {/* THẺ XÁM NÂU: LỢN THỊT */}
            <div style={{ backgroundColor: "#f6f1f2", borderRadius: "16px", padding: "16px" }}>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
              <div style={{ fontSize: "26px", fontWeight: "900", color: "#854d0e", lineHeight: "1.2" }}>
                {meatCount} con
              </div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "8px", lineHeight: "1.6" }}>
                <div>• Đang nuôi</div>
              </div>
            </div>

          </div>

          {/* PHẦN CÔNG VIỆC CẦN LÀM */}
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 16px 0" }}>
              CÔNG VIỆC CẦN LÀM
            </h3>

            {tasks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#94a3b8", fontSize: "13px" }}>
                Không có việc gấp cần làm.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id, task.is_completed)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      padding: "4px 0"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e1b4b" }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                        Hạn: {task.due_date}
                      </div>
                    </div>

                    <div style={{ fontSize: "22px", lineHeight: 1 }}>
                      {task.is_completed ? "🟢" : "⚪"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MÀN HÌNH TỔNG ĐÀN */}
      {currentMenu === "HERD" && (
        <div style={{ padding: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: "800", marginBottom: "12px", color: "#64748b" }}>
            DANH SÁCH TỔNG ĐÀN ({pigs.length} CON)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pigs.map((pig) => (
              <div key={pig.id} style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "14px", border: "1px solid #f1e5f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "17px", fontWeight: "900", color: "#1e1b4b" }}>{pig.ear_tag}</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", background: isFemale(pig.sex) ? "#fce7f3" : "#e0f2fe", color: isFemale(pig.sex) ? "#be185d" : "#0369a1" }}>
                    {isFemale(pig.sex) ? "Cái" : "Đực"}
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "6px" }}>
                  Giống: <strong>{pig.breed_id || "—"}</strong> | Giai đoạn: <strong style={{ color: "#059669" }}>{pig.stage || "—"}</strong>
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  Ô chuồng: {pig.current_pen_code || "—"} | Khối lượng: {pig.current_weight_kg ? `${pig.current_weight_kg}kg` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MÀN HÌNH TRA CỨU */}
      {currentMenu === "SEARCH" && (
        <div style={{ padding: "16px" }}>
          <input
            type="text"
            placeholder="Gõ số tai để tìm nhanh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "15px", boxSizing: "border-box", marginBottom: "14px" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {pigs.filter((p) => p.ear_tag?.toLowerCase().includes(searchQuery.toLowerCase())).map((pig) => (
              <div key={pig.id} style={{ backgroundColor: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                <strong>{pig.ear_tag}</strong> - {pig.breed_id} ({pig.stage})
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
