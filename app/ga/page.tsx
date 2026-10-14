"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// COMPONENT ĐIỀU HƯỚNG VUỐT LOÀI (NHÚNG TRỰC TIẾP TRÁNH LỖI IMPORT)
function FarmSpeciesNav() {
  const router = useRouter();
  const pathname = usePathname();

  let currentSpecies: "PIG" | "CHICKEN" | "DUCK" = "CHICKEN";
  if (pathname.startsWith("/vit")) currentSpecies = "DUCK";
  else if (pathname === "/") currentSpecies = "PIG";

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 75;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        if (currentSpecies === "PIG") router.push("/ga");
        else if (currentSpecies === "CHICKEN") router.push("/vit");
      } else {
        if (currentSpecies === "DUCK") router.push("/ga");
        else if (currentSpecies === "CHICKEN") router.push("/");
      }
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        background: "#0f172a",
        padding: "8px 12px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid #1e293b",
        maxWidth: "480px",
        margin: "0 auto"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>
          Hệ Thống Trại Nà Roác
        </span>
        <span style={{ color: "#38bdf8", fontSize: "11px", fontWeight: "700" }}>
          (Vuốt đổi loài ⇄)
        </span>
      </div>

      <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.06)", padding: "3px", borderRadius: "10px" }}>
        {[
          { id: "PIG", label: "🐖 Trại Lợn", path: "/" },
          { id: "CHICKEN", label: "🐓 Trại Gà", path: "/ga" },
          { id: "DUCK", label: "🦆 Trại Vịt", path: "/vit" }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: "8px",
              border: "none",
              fontSize: "12px",
              fontWeight: "900",
              cursor: "pointer",
              background: currentSpecies === item.id ? "#38bdf8" : "transparent",
              color: currentSpecies === item.id ? "#0f172a" : "#cbd5e1",
              transition: "all 0.15s ease"
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface PoultryBatch {
  id: string;
  batch_code: string;
  species: string;
  breed_type: string;
  purpose: "THIT" | "GIONG";
  stage: string;
  hatch_date: string;
  initial_count: number;
  current_count: number;
  pen_location?: string;
  notes?: string;
}

interface WeightLog {
  id: string;
  batch_id: string;
  weigh_date: string;
  day_age: number;
  sample_count: number;
  avg_weight_gram: number;
  standard_weight_gram: number;
  notes?: string;
}

interface EggHarvest {
  id: string;
  harvest_date: string;
  egg_count: number;
  incubated_count: number;
  notes?: string;
}

// BẢNG TIÊU CHUẨN CÂN NẶNG THEO GIỐNG VÀ NGÀY TUỔI (GRAM)
const getStandardWeight = (breedType: string, dayAge: number): number => {
  const b = breedType.toLowerCase();

  // 1. Nhóm Gà Ri lai, Mía lai, Hồ lai (Thương phẩm thả vườn)
  if (b.includes("ri") || b.includes("mía") || b.includes("mia") || b.includes("hồ") || b.includes("ho")) {
    if (dayAge <= 7) return 65;
    if (dayAge <= 14) return 130;
    if (dayAge <= 21) return 240;
    if (dayAge <= 30) return 420;
    if (dayAge <= 45) return 750;
    if (dayAge <= 60) return 1150;
    if (dayAge <= 75) return 1500;
    if (dayAge <= 90) return 1850;
    return 2100;
  }

  // 2. Nhóm Gà bản địa / Gà giống
  if (b.includes("bản địa") || b.includes("gà ta") || b.includes("gà đen") || b.includes("h'mông")) {
    if (dayAge <= 7) return 55;
    if (dayAge <= 14) return 100;
    if (dayAge <= 21) return 180;
    if (dayAge <= 30) return 300;
    if (dayAge <= 45) return 520;
    if (dayAge <= 60) return 800;
    if (dayAge <= 75) return 1100;
    if (dayAge <= 90) return 1400;
    if (dayAge <= 120) return 1750;
    return 1950;
  }

  return Math.round(dayAge * 20);
};

const formatDateVN = (dStr?: string) => {
  if (!dStr) return "—";
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const safeDateDiff = (dStr?: string) => {
  if (!dStr) return 0;
  const t = new Date(dStr).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((new Date().getTime() - t) / (1000 * 3600 * 24)));
};

export default function ChickenPage() {
  const [mounted, setMounted] = useState(false);
  const [batches, setBatches] = useState<PoultryBatch[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [eggs, setEggs] = useState<EggHarvest[]>([]);
  const [filterPurpose, setFilterPurpose] = useState<"ALL" | "GIONG" | "THIT">("ALL");

  // Modal tạo Lô mới
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<PoultryBatch>>({
    batch_code: "",
    species: "CHICKEN",
    breed_type: "Ri lai 3/4",
    purpose: "THIT",
    stage: "UM",
    hatch_date: new Date().toISOString().split("T")[0],
    initial_count: 50,
    pen_location: "Khu nuôi thịt 1",
    notes: ""
  });

  // Modal Báo cân mẫu
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [selectedBatchForWeigh, setSelectedBatchForWeigh] = useState<PoultryBatch | null>(null);
  const [weighInput, setWeighInput] = useState({
    weigh_date: new Date().toISOString().split("T")[0],
    sample_count: 10,
    avg_weight_gram: 450,
    notes: ""
  });

  // Modal Thu gom trứng
  const [showEggModal, setShowEggModal] = useState(false);
  const [eggInput, setEggInput] = useState({
    harvest_date: new Date().toISOString().split("T")[0],
    egg_count: 15,
    incubated_count: 12,
    notes: ""
  });

  const supabase = useMemo(() => {
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl.trim(), rawKey.trim());
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [batchRes, weighRes, eggRes] = await Promise.all([
        supabase.from("poultry_batches").select("*").eq("species", "CHICKEN").order("hatch_date", { ascending: false }),
        supabase.from("poultry_weight_logs").select("*").order("weigh_date", { ascending: false }),
        supabase.from("egg_harvests").select("*").order("harvest_date", { ascending: false }).limit(30)
      ]);
      if (batchRes?.data) setBatches(batchRes.data);
      if (weighRes?.data) setWeightLogs(weighRes.data);
      if (eggRes?.data) setEggs(eggRes.data);
    } catch (e) {}
  }, [supabase]);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [fetchData]);

  const totalChickens = batches.reduce((sum, b) => sum + (b.current_count || 0), 0);
  const breedCount = batches.filter(b => b.purpose === "GIONG").reduce((sum, b) => sum + (b.current_count || 0), 0);
  const meatCount = batches.filter(b => b.purpose === "THIT").reduce((sum, b) => sum + (b.current_count || 0), 0);
  const totalEggs = eggs.reduce((sum, e) => sum + (e.egg_count || 0), 0);

  // Tạo Lô Gà mới
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.batch_code?.trim()) return;

    try {
      const { error } = await supabase.from("poultry_batches").insert([{
        batch_code: newBatch.batch_code.trim().toUpperCase(),
        species: "CHICKEN",
        breed_type: newBatch.breed_type || "Ri lai 3/4",
        purpose: newBatch.purpose || "THIT",
        stage: newBatch.stage || "UM",
        hatch_date: newBatch.hatch_date,
        initial_count: Number(newBatch.initial_count || 0),
        current_count: Number(newBatch.initial_count || 0),
        pen_location: newBatch.pen_location || "Chuồng nuôi 1",
        notes: newBatch.notes || null
      }]);

      if (error) throw error;
      alert(`✅ Đã tạo thành công lô ${newBatch.batch_code}!`);
      setShowAddBatchModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi tạo lô: " + err.message);
    }
  };

  // Lưu biên bản Báo Cân Mẫu
  const handleSaveWeightLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForWeigh) return;

    try {
      const ageDays = safeDateDiff(selectedBatchForWeigh.hatch_date);
      const standardGram = getStandardWeight(selectedBatchForWeigh.breed_type, ageDays);
      const actualGram = Number(weighInput.avg_weight_gram);

      const diff = actualGram - standardGram;
      const diffPct = ((diff / standardGram) * 100).toFixed(1);

      let evaluation = `Đạt chuẩn (${diffPct}%)`;
      if (diff > standardGram * 0.08) evaluation = `Vượt chuẩn (+${diffPct}%)`;
      else if (diff < -standardGram * 0.08) evaluation = `Hụt cân (${diffPct}%)`;

      const { error } = await supabase.from("poultry_weight_logs").insert([{
        batch_id: selectedBatchForWeigh.id,
        weigh_date: weighInput.weigh_date,
        day_age: ageDays,
        sample_count: Number(weighInput.sample_count || 10),
        avg_weight_gram: actualGram,
        standard_weight_gram: standardGram,
        notes: `${evaluation}. ${weighInput.notes || ""}`.trim()
      }]);

      if (error) throw error;

      alert(`✅ Đã lưu kết quả cân lô ${selectedBatchForWeigh.batch_code}!\n- Thực tế: ${actualGram}g | Chuẩn: ${standardGram}g (${diff >= 0 ? "+" : ""}${diff}g)\n- Đánh giá: ${evaluation}`);
      setShowWeighModal(false);
      setSelectedBatchForWeigh(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu biểu cân: " + err.message);
    }
  };

  // Ghi nhận trứng
  const handleSaveEggs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from("egg_harvests").insert([{
        harvest_date: eggInput.harvest_date,
        egg_count: Number(eggInput.egg_count || 0),
        incubated_count: Number(eggInput.incubated_count || 0),
        notes: eggInput.notes || null
      }]);

      if (error) throw error;
      alert(`✅ Đã ghi nhận ${eggInput.egg_count} quả trứng (Đưa ấp: ${eggInput.incubated_count} quả)!`);
      setShowEggModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  // Chuyển giai đoạn đàn Gà giống
  const handlePromoteStage = async (batch: PoultryBatch) => {
    let nextStage = "NUOI_CHUNG";
    let confirmMsg = `Chuyển lô ${batch.batch_code} lên "Nuôi chung tập trung"?`;

    if (batch.stage === "NUOI_CHUNG") {
      nextStage = "SINH_SAN";
      confirmMsg = `Tuyển chọn lô ${batch.batch_code} vào "Ô Sinh Sản" để khai thác trứng giống?`;
    }

    if (!confirm(confirmMsg)) return;

    try {
      await supabase.from("poultry_batches").update({ stage: nextStage }).eq("id", batch.id);
      alert("✅ Đã cập nhật chuyển giai đoạn!");
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  const filteredBatches = batches.filter(b => {
    if (filterPurpose === "ALL") return true;
    return b.purpose === filterPurpose;
  });

  if (!mounted) {
    return (
      <div style={{ backgroundColor: "#fafafa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Đang tải phân hệ Gà...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#fafafa", minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto", paddingBottom: "75px" }}>
      <FarmSpeciesNav />

      <div style={{ padding: "16px" }}>
        {/* TỔNG QUAN PHÂN HỆ GÀ */}
        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: "16px", padding: "18px 20px", color: "#fff", marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>TỔNG ĐÀN GÀ TRANG TRẠI</div>
          <div style={{ fontSize: "28px", fontWeight: "900", margin: "4px 0" }}>
            {totalChickens} <span style={{ fontSize: "15px", color: "#cbd5e1" }}>con</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#e2e8f0", marginTop: "4px" }}>
            <span>● Đàn sinh sản/giống: <b>{breedCount} con</b></span>
            <span>● Gà thịt thương phẩm: <b>{meatCount} con</b></span>
          </div>
        </div>

        {/* THU GOM TRỨNG GÀ GIỐNG */}
        <div style={{ background: "#fefce8", border: "1.5px solid #fef08a", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <b style={{ color: "#854d0e", fontSize: "14px" }}>🥚 THU TRỨNG & LÒ ẤP GÀ GIỐNG</b>
              <div style={{ fontSize: "12px", color: "#713f12", marginTop: "2px" }}>
                Tổng thu gần đây: <b>{totalEggs} quả</b>
              </div>
            </div>
            <button
              onClick={() => setShowEggModal(true)}
              style={{ padding: "8px 12px", borderRadius: "8px", background: "#ca8a04", color: "#fff", border: "none", fontWeight: "900", fontSize: "12px", cursor: "pointer" }}
            >
              + Ghi nhận trứng
            </button>
          </div>
        </div>

        {/* BỘ LỌC NHÓM GÀ */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
          {[
            { id: "ALL", label: `Tất cả (${batches.length})` },
            { id: "GIONG", label: `Gà giống (${batches.filter(b => b.purpose === "GIONG").length})` },
            { id: "THIT", label: `Gà thịt (${batches.filter(b => b.purpose === "THIT").length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterPurpose(tab.id as any)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: "12px", border: "none", fontSize: "12px", fontWeight: "800", cursor: "pointer",
                background: filterPurpose === tab.id ? "#0f172a" : "#e2e8f0",
                color: filterPurpose === tab.id ? "#fff" : "#475569"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TIÊU ĐỀ & NÚT TẠO LÔ MỚI */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontSize: "14px", fontWeight: "900", color: "#1e293b" }}>
            DANH SÁCH CÁC LÔ NUÔI ({filteredBatches.length})
          </span>
          <button
            onClick={() => {
              setNewBatch({
                batch_code: `GA-${new Date().getFullYear().toString().slice(-2)}-${String(batches.length + 1).padStart(2, "0")}`,
                species: "CHICKEN",
                breed_type: "Ri lai 3/4",
                purpose: "THIT",
                stage: "UM",
                hatch_date: new Date().toISOString().split("T")[0],
                initial_count: 50,
                pen_location: "Khu nuôi thịt 1",
                notes: ""
              });
              setShowAddBatchModal(true);
            }}
            style={{ padding: "6px 12px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}
          >
            + Nhập Lô Mới
          </button>
        </div>

        {/* DANH SÁCH LÔ GÀ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredBatches.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", background: "#fff", borderRadius: "12px", color: "#64748b", fontSize: "13px", border: "1px solid #e2e8f0" }}>
              Chưa có lô gà nào trong mục này. Bấm <b>"+ Nhập Lô Mới"</b> để tạo lô úm!
            </div>
          ) : (
            filteredBatches.map(b => {
              const ageDays = safeDateDiff(b.hatch_date);
              const standardGram = getStandardWeight(b.breed_type, ageDays);

              const latestWeigh = weightLogs.find(w => w.batch_id === b.id);
              const hasWeighed = !!latestWeigh;

              let weightBadgeColor = "#64748b";
              let weightDiffText = "";
              if (latestWeigh) {
                const diff = Number(latestWeigh.avg_weight_gram) - Number(latestWeigh.standard_weight_gram);
                if (diff >= 0) {
                  weightBadgeColor = "#059669";
                  weightDiffText = `+${diff}g`;
                } else {
                  weightBadgeColor = diff < -150 ? "#dc2626" : "#d97706";
                  weightDiffText = `${diff}g`;
                }
              }

              return (
                <div key={b.id} style={{ background: "#fff", padding: "14px 16px", borderRadius: "14px", border: "1.5px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <b style={{ fontSize: "16px", color: "#0f172a" }}>{b.batch_code}</b>
                      <span style={{ fontSize: "12px", marginLeft: "6px", color: "#475569", fontWeight: "700" }}>({b.breed_type})</span>
                    </div>

                    <span style={{
                      fontSize: "11px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px",
                      background: b.purpose === "GIONG" ? "#f5f3ff" : "#ecfdf5",
                      color: b.purpose === "GIONG" ? "#6d28d9" : "#047857",
                      border: `1px solid ${b.purpose === "GIONG" ? "#ddd6fe" : "#a7f3d0"}`
                    }}>
                      {b.purpose === "GIONG" ? "👑 Gà giống" : "🍗 Gà thịt"}
                    </span>
                  </div>

                  <div style={{ fontSize: "13px", color: "#334155", margin: "8px 0", lineHeight: "1.6" }}>
                    • Tuổi đàn: <b>{ageDays} ngày tuổi</b> (Nở: {formatDateVN(b.hatch_date)})<br/>
                    • Quy mô: <b style={{ color: "#0f172a" }}>{b.current_count} con</b> (Ban đầu: {b.initial_count})<br/>
                    • Ô nhốt: <b>{b.pen_location || "—"}</b>
                  </div>

                  {/* KHỐI BIỂU CÂN NẶNG ĐỐI CHIẾU TIÊU CHUẨN */}
                  <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #cbd5e1", marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                      <span>⚖️ Chuẩn {ageDays} ngày: <b style={{ color: "#2563eb" }}>{standardGram}g</b></span>
                      {hasWeighed ? (
                        <span>
                          Thực tế: <b style={{ color: weightBadgeColor }}>{latestWeigh.avg_weight_gram}g</b> ({weightDiffText})
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Chưa báo cân</span>
                      )}
                    </div>

                    {hasWeighed && latestWeigh.notes && (
                      <div style={{ fontSize: "11px", color: "#475569", marginTop: "3px" }}>
                        Đánh giá: <b>{latestWeigh.notes}</b> (Ngày cân: {formatDateVN(latestWeigh.weigh_date)})
                      </div>
                    )}
                  </div>

                  {/* CÁC NÚT THAO TÁC */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => {
                        setSelectedBatchForWeigh(b);
                        setWeighInput({
                          weigh_date: new Date().toISOString().split("T")[0],
                          sample_count: 10,
                          avg_weight_gram: standardGram,
                          notes: ""
                        });
                        setShowWeighModal(true);
                      }}
                      style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#ede9fe", color: "#6d28d9", border: "1px solid #ddd6fe", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                    >
                      ⚖️ Báo cân mẫu
                    </button>

                    {b.purpose === "GIONG" && b.stage !== "SINH_SAN" && (
                      <button
                        onClick={() => handlePromoteStage(b)}
                        style={{ flex: 1.2, padding: "8px", borderRadius: "8px", background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                      >
                        {b.stage === "UM" ? "➔ Nuôi chung" : "➔ Ô Sinh sản"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* QUY TRÌNH THÚ Y GÀ */}
        <div style={{ marginTop: "20px", background: "#f1f5f9", padding: "14px", borderRadius: "12px", fontSize: "12px", lineHeight: "1.7", color: "#334155" }}>
          <b style={{ color: "#0f172a", fontSize: "13px" }}>🩺 QUY TRÌNH VACCINE GÀ THẢ VƯỜN & GÀ GIỐNG:</b><br/>
          • <b>1 - 3 ngày tuổi:</b> Úm ấm (32-34°C), uống Gluco-C + B-complex.<br/>
          • <b>3 - 5 ngày:</b> Nhỏ mắt/mũi vaccine Newcastle (Lasota) + IB (viêm phế quản).<br/>
          • <b>7 ngày:</b> Nhỏ mồm vaccine Gumboro lần 1.<br/>
          • <b>14 ngày:</b> Uống nhắc lại Gumboro lần 2.<br/>
          • <b>21 ngày:</b> Nhỏ nhắc lại Lasota lần 2.<br/>
          • <b>40 - 45 ngày:</b> Tiêm dưới da Cúm gia cầm (H5N1) & Tụ huyết trùng.<br/>
          • <b>60 ngày:</b> Tẩy giun sán trước khi vỗ béo hoặc đưa vào hậu bị.
        </div>
      </div>

      {/* MODAL BÁO CÂN MẪU */}
      {showWeighModal && selectedBatchForWeigh && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "900", color: "#6d28d9" }}>
              ⚖️ Báo Cân Lô: {selectedBatchForWeigh.batch_code}
            </h3>
            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
              Giống: <b>{selectedBatchForWeigh.breed_type}</b> • Tuổi: <b>{safeDateDiff(selectedBatchForWeigh.hatch_date)} ngày</b>
            </div>

            <form onSubmit={handleSaveWeightLog} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ngày cân:</label>
                <input
                  type="date"
                  required
                  value={weighInput.weigh_date}
                  onChange={e => setWeighInput({ ...weighInput, weigh_date: e.target.value })}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Số con cân mẫu:</label>
                  <input
                    type="number"
                    min="1"
                    value={weighInput.sample_count}
                    onChange={e => setWeighInput({ ...weighInput, sample_count: Number(e.target.value) })}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#6d28d9" }}>Cân TB thực tế (g):</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="5000"
                    value={weighInput.avg_weight_gram}
                    onChange={e => setWeighInput({ ...weighInput, avg_weight_gram: Number(e.target.value) })}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1.5px solid #8b5cf6", fontWeight: "800", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ background: "#f1f5f9", padding: "8px", borderRadius: "8px", fontSize: "12px", color: "#334155" }}>
                Chuẩn giống ở tuổi này: <b>{getStandardWeight(selectedBatchForWeigh.breed_type, safeDateDiff(selectedBatchForWeigh.hatch_date))} gram</b>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ghi chú / Tình trạng đàn:</label>
                <input
                  placeholder="Gà ăn khỏe, đồng đều..."
                  value={weighInput.notes}
                  onChange={e => setWeighInput({ ...weighInput, notes: e.target.value })}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowWeighModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#6d28d9", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Lưu Kết Quả</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TẠO LÔ GÀ MỚI */}
      {showAddBatchModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>+ Nhập Lô Gà Mới</h3>
            <form onSubmit={handleCreateBatch} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Mã Lô (*):</label>
                <input required value={newBatch.batch_code} onChange={e => setNewBatch({ ...newBatch, batch_code: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Mục đích:</label>
                  <select
                    value={newBatch.purpose}
                    onChange={e => {
                      const p = e.target.value as "THIT" | "GIONG";
                      setNewBatch({
                        ...newBatch,
                        purpose: p,
                        breed_type: p === "GIONG" ? "Gà bản địa" : "Ri lai 3/4"
                      });
                    }}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="THIT">Nuôi thịt</option>
                    <option value="GIONG">Gây giống</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Giống gà:</label>
                  <select value={newBatch.breed_type} onChange={e => setNewBatch({ ...newBatch, breed_type: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Ri lai 1/2">Ri lai 1/2</option>
                    <option value="Ri lai 3/4">Ri lai 3/4</option>
                    <option value="Mía lai">Mía lai</option>
                    <option value="Hồ lai">Hồ lai</option>
                    <option value="Gà bản địa">Gà bản địa</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Ngày nở/nhập:</label>
                  <input type="date" required value={newBatch.hatch_date} onChange={e => setNewBatch({ ...newBatch, hatch_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Số con nhập:</label>
                  <input type="number" required min="1" value={newBatch.initial_count} onChange={e => setNewBatch({ ...newBatch, initial_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Vị trí ô nuôi:</label>
                <input value={newBatch.pen_location} onChange={e => setNewBatch({ ...newBatch, pen_location: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowAddBatchModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Tạo Lô</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THU GOM TRỨNG */}
      {showEggModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "320px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#854d0e" }}>🥚 Ghi Nhận Thu Gom Trứng</h3>
            <form onSubmit={handleSaveEggs} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ngày thu:</label>
                <input type="date" required value={eggInput.harvest_date} onChange={e => setEggInput({ ...eggInput, harvest_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Tổng số trứng:</label>
                  <input type="number" required min="1" value={eggInput.egg_count} onChange={e => setEggInput({ ...eggInput, egg_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Vào lò ấp:</label>
                  <input type="number" min="0" value={eggInput.incubated_count} onChange={e => setEggInput({ ...eggInput, incubated_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowEggModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#ca8a04", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
