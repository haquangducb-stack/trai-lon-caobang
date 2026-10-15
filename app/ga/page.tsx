"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

const getStandardWeightChicken = (breedType: string, dayAge: number): number => {
  const b = (breedType || "").toLowerCase();
  if (b.includes("h'mông") || b.includes("đen") || b.includes("bản địa") || b.includes("ta")) {
    if (dayAge <= 7) return 55;
    if (dayAge <= 14) return 100;
    if (dayAge <= 21) return 180;
    if (dayAge <= 30) return 310;
    if (dayAge <= 45) return 550;
    if (dayAge <= 60) return 850;
    if (dayAge <= 75) return 1150;
    if (dayAge <= 90) return 1450;
    if (dayAge <= 120) return 1800;
    return 2050;
  }
  if (dayAge <= 7) return 65;
  if (dayAge <= 14) return 135;
  if (dayAge <= 21) return 260;
  if (dayAge <= 30) return 460;
  if (dayAge <= 45) return 820;
  if (dayAge <= 60) return 1250;
  if (dayAge <= 75) return 1650;
  if (dayAge <= 90) return 2050;
  if (dayAge <= 105) return 2350;
  return 2550;
};

const formatDateVN = (dStr?: string) => {
  if (!dStr) return "—";
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const safeDateDiff = (dStr?: string) => {
  if (!dStr) return 0;
  const t = new Date(dStr).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((new Date().getTime() - t) / (1000 * 3600 * 24)));
};

export default function ChickenPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [batches, setBatches] = useState<PoultryBatch[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [eggs, setEggs] = useState<EggHarvest[]>([]);
  const [activeTab, setActiveTab] = useState<"BAN_DIA" | "THUONG_PHAM" | "QUY_TRINH">("BAN_DIA");

  // Bắt cử chỉ vuốt toàn màn hình (Cực nhạy)
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - endX;
    const diffY = touchStartY.current - endY;

    // Chỉ nhận diện vuốt ngang nếu khoảng vuốt ngang lớn hơn hẳn vuốt dọc (tránh nhầm khi cuộn trang)
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0) {
        // Vuốt sang trái -> Sang Trại Vịt
        router.push("/vit");
      } else {
        // Vuốt sang phải -> Về Trại Lợn
        router.push("/");
      }
    }
  };

  // Modal Thêm / Sửa Lô
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchFormData, setBatchFormData] = useState<Partial<PoultryBatch>>({
    batch_code: "",
    species: "CHICKEN",
    breed_type: "Gà Đen H'Mông Bản Địa",
    purpose: "GIONG",
    stage: "UM",
    hatch_date: new Date().toISOString().split("T")[0],
    initial_count: 50,
    current_count: 50,
    pen_location: "Ô úm giống",
    notes: ""
  });

  // Modal Báo cân
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [selectedBatchForWeigh, setSelectedBatchForWeigh] = useState<PoultryBatch | null>(null);
  const [weighInput, setWeighInput] = useState({
    weigh_date: new Date().toISOString().split("T")[0],
    sample_count: 10,
    avg_weight_gram: 500,
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
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
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

  const nativeBatches = batches.filter(b => b.purpose === "GIONG");
  const meatBatches = batches.filter(b => b.purpose === "THIT");

  const totalNativeCount = nativeBatches.reduce((s, b) => s + (b.current_count || 0), 0);
  const totalMeatCount = meatBatches.reduce((s, b) => s + (b.current_count || 0), 0);
  const totalEggs = eggs.reduce((s, e) => s + (e.egg_count || 0), 0);

  const handleOpenEditModal = (batch: PoultryBatch) => {
    setEditingBatchId(batch.id);
    setBatchFormData({
      batch_code: batch.batch_code,
      species: "CHICKEN",
      breed_type: batch.breed_type || "Gà Đen H'Mông Bản Địa",
      purpose: batch.purpose,
      stage: batch.stage,
      hatch_date: batch.hatch_date,
      initial_count: batch.initial_count,
      current_count: batch.current_count,
      pen_location: batch.pen_location,
      notes: batch.notes || ""
    });
    setShowBatchModal(true);
  };

  const handleOpenAddModal = (purpose: "GIONG" | "THIT") => {
    setEditingBatchId(null);
    const count = purpose === "GIONG" ? nativeBatches.length + 1 : meatBatches.length + 1;
    const code = purpose === "GIONG" ? `GD-${new Date().getFullYear().toString().slice(-2)}-${String(count).padStart(2, "0")}` : `GT-${new Date().getFullYear().toString().slice(-2)}-${String(count).padStart(2, "0")}`;
    setBatchFormData({
      batch_code: code,
      species: "CHICKEN",
      breed_type: purpose === "GIONG" ? "Gà Đen H'Mông Bản Địa" : "Ri lai 3/4",
      purpose,
      stage: "UM",
      hatch_date: new Date().toISOString().split("T")[0],
      initial_count: 50,
      current_count: 50,
      pen_location: purpose === "GIONG" ? "Ô úm giống" : "Khu nuôi thịt",
      notes: ""
    });
    setShowBatchModal(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFormData.batch_code?.trim()) return;

    try {
      const payload = {
        batch_code: batchFormData.batch_code.trim().toUpperCase(),
        species: "CHICKEN",
        breed_type: batchFormData.breed_type || "Gà Đen H'Mông Bản Địa",
        breed_name: batchFormData.breed_type || "Gà Đen H'Mông Bản Địa",
        purpose: batchFormData.purpose || "GIONG",
        stage: batchFormData.stage || "UM",
        hatch_date: batchFormData.hatch_date,
        initial_count: Number(batchFormData.initial_count || 0),
        current_count: Number(batchFormData.current_count || 0),
        pen_location: batchFormData.pen_location || "Chuồng 1",
        notes: batchFormData.notes || null
      };

      if (editingBatchId) {
        const { error } = await supabase.from("poultry_batches").update(payload).eq("id", editingBatchId);
        if (error) throw error;
        alert(`✅ Đã cập nhật thành công lô ${payload.batch_code}!`);
      } else {
        const { error } = await supabase.from("poultry_batches").insert([payload]);
        if (error) throw error;
        alert(`✅ Đã tạo mới thành công lô ${payload.batch_code}!`);
      }

      setShowBatchModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu lô: " + err.message);
    }
  };

  const handleSaveWeightLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForWeigh) return;

    try {
      const ageDays = safeDateDiff(selectedBatchForWeigh.hatch_date);
      const standardGram = getStandardWeightChicken(selectedBatchForWeigh.breed_type, ageDays);
      const actualGram = Number(weighInput.avg_weight_gram);
      const diff = actualGram - standardGram;
      const diffPct = ((diff / standardGram) * 100).toFixed(1);

      let evaluation = `Đạt chuẩn (${diffPct}%)`;
      if (diff > standardGram * 0.08) evaluation = `Vượt chuẩn (+${diffPct}%)`;
      else if (diff < -standardGram * 0.08) evaluation = `Hụt cân (${diffPct}%)`;

      await supabase.from("poultry_weight_logs").insert([{
        batch_id: selectedBatchForWeigh.id,
        weigh_date: weighInput.weigh_date,
        day_age: ageDays,
        sample_count: Number(weighInput.sample_count || 10),
        avg_weight_gram: actualGram,
        standard_weight_gram: standardGram,
        notes: `${evaluation}. ${weighInput.notes || ""}`.trim()
      }]);

      alert(`✅ Đã lưu kết quả cân lô ${selectedBatchForWeigh.batch_code}!\n- Thực tế: ${actualGram}g | Chuẩn: ${standardGram}g\n- Đánh giá: ${evaluation}`);
      setShowWeighModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  const handlePromoteStage = async (batch: PoultryBatch) => {
    let nextStage = "NUOI_CHUNG";
    let msg = `Chuyển lô ${batch.batch_code} lên "Nuôi chung tập trung"?`;
    if (batch.stage === "NUOI_CHUNG") {
      nextStage = "SINH_SAN";
      msg = `Tuyển chọn lô ${batch.batch_code} đưa vào "Ô Sinh Sản" để khai thác trứng giống?`;
    }
    if (!confirm(msg)) return;
    try {
      await supabase.from("poultry_batches").update({ stage: nextStage }).eq("id", batch.id);
      alert("✅ Đã cập nhật chuyển giai đoạn!");
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  const handleSellBatch = async (batch: PoultryBatch) => {
    if (!confirm(`Xác nhận XUẤT BÁN toàn bộ ${batch.current_count} con của lô ${batch.batch_code}?`)) return;
    try {
      await supabase.from("poultry_batches").update({
        current_count: 0,
        stage: "DA_XUAT",
        notes: `${batch.notes || ""} [Đã xuất bán ngày ${new Date().toLocaleDateString("vi-VN")}]`.trim()
      }).eq("id", batch.id);
      alert("✅ Đã ghi nhận xuất bán thành công!");
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  if (!mounted) return <div style={{ padding: "20px", textAlign: "center" }}>Đang tải phân hệ Gà...</div>;

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ backgroundColor: "#fafafa", minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto", paddingBottom: "75px" }}
    >
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
      <div style={{ background: "#0f172a", padding: "8px 12px", position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>Hệ Thống Trại Nà Roác</span>
          <span style={{ color: "#38bdf8", fontSize: "11px", fontWeight: "700" }}>⇄ Vuốt màn hình đổi loài</span>
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
                flex: 1, padding: "7px 0", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: "900", cursor: "pointer",
                background: item.id === "CHICKEN" ? "#38bdf8" : "transparent",
                color: item.id === "CHICKEN" ? "#0f172a" : "#cbd5e1"
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px" }}>
        {/* BANNER TỔNG ĐÀN GÀ */}
        <div style={{ background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)", borderRadius: "16px", padding: "18px 20px", color: "#fff", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", color: "#a1a1aa", fontWeight: "800", textTransform: "uppercase" }}>TỔNG ĐÀN GÀ TRANG TRẠI</div>
          <div style={{ fontSize: "28px", fontWeight: "900", margin: "4px 0" }}>
            {totalNativeCount + totalMeatCount} <span style={{ fontSize: "15px", color: "#d4d4d8" }}>con</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#e4e4e7" }}>
            <span>● Bản địa (Giống): <b>{totalNativeCount} con</b></span>
            <span>● Gà thịt thương phẩm: <b>{totalMeatCount} con</b></span>
          </div>
        </div>

        {/* THANH CHUYỂN TAB */}
        <div style={{ display: "flex", gap: "6px", background: "#e2e8f0", padding: "4px", borderRadius: "12px", marginBottom: "16px" }}>
          {[
            { id: "BAN_DIA", label: `👑 Bản Địa (${nativeBatches.length})` },
            { id: "THUONG_PHAM", label: `🍗 Gà Thịt (${meatBatches.length})` },
            { id: "QUY_TRINH", label: `🩺 Quy Trình` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                flex: 1, padding: "8px 0", borderRadius: "9px", border: "none", fontSize: "12px", fontWeight: "900", cursor: "pointer",
                background: activeTab === t.id ? "#0f172a" : "transparent",
                color: activeTab === t.id ? "#fff" : "#475569"
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB 1: GÀ BẢN ĐỊA */}
        {activeTab === "BAN_DIA" && (
          <div>
            <div style={{ background: "#fefce8", border: "1.5px solid #fef08a", borderRadius: "14px", padding: "14px 16px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b style={{ color: "#854d0e", fontSize: "13.5px" }}>🥚 THU TRỨNG & ẤP NỞ BẢN ĐỊA</b>
                  <div style={{ fontSize: "12px", color: "#713f12", marginTop: "2px" }}>
                    Tổng thu gần đây: <b>{totalEggs} quả</b>
                  </div>
                </div>
                <button
                  onClick={() => setShowEggModal(true)}
                  style={{ padding: "8px 12px", borderRadius: "8px", background: "#ca8a04", color: "#fff", border: "none", fontWeight: "900", fontSize: "12px", cursor: "pointer" }}
                >
                  + Nhặt trứng
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "900", color: "#18181b" }}>CÁC LÔ GÀ BẢN ĐỊA ({nativeBatches.length})</span>
              <button
                onClick={() => handleOpenAddModal("GIONG")}
                style={{ padding: "6px 12px", borderRadius: "8px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}
              >
                + Tạo Lô Giống Mới
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {nativeBatches.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", background: "#fff", borderRadius: "12px", color: "#64748b", fontSize: "13px", border: "1px solid #e2e8f0" }}>
                  Chưa có lô gà bản địa nào. Bấm <b>"+ Tạo Lô Giống Mới"</b> để bắt đầu theo dõi!
                </div>
              ) : (
                nativeBatches.map(b => {
                  const ageDays = safeDateDiff(b.hatch_date);
                  const standardGram = getStandardWeightChicken(b.breed_type, ageDays);
                  const latestWeigh = weightLogs.find(w => w.batch_id === b.id);
                  const isExported = b.stage === "DA_XUAT" || b.current_count === 0;

                  return (
                    <div key={b.id} style={{ background: "#fff", padding: "14px 16px", borderRadius: "14px", border: "1.5px solid #e2e8f0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <b style={{ fontSize: "16px", color: "#0f172a" }}>{b.batch_code}</b>
                          <span style={{ fontSize: "12px", color: "#6d28d9", fontWeight: "800", marginLeft: "6px" }}>({b.breed_type})</span>
                        </div>
                        <span style={{
                          fontSize: "11px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px",
                          background: b.stage === "UM" ? "#fef3c7" : b.stage === "NUOI_CHUNG" ? "#dbeafe" : b.stage === "SINH_SAN" ? "#dcfce7" : "#f1f5f9",
                          color: b.stage === "UM" ? "#b45309" : b.stage === "NUOI_CHUNG" ? "#1d4ed8" : b.stage === "SINH_SAN" ? "#15803d" : "#475569"
                        }}>
                          {b.stage === "UM" ? "🐣 Đang Úm" : b.stage === "NUOI_CHUNG" ? "🐓 Nuôi Tập Trung" : b.stage === "SINH_SAN" ? "👑 Ô Sinh Sản" : "Đã xuất bán"}
                        </span>
                      </div>

                      <div style={{ fontSize: "13px", color: "#334155", margin: "8px 0", lineHeight: "1.6" }}>
                        • Tuổi: <b>{ageDays} ngày</b> (Nở: {formatDateVN(b.hatch_date)})<br/>
                        • Đàn: <b style={{ color: "#047857" }}>{b.current_count} con</b> (Ban đầu: {b.initial_count})<br/>
                        • Ô chuồng: <b>{b.pen_location || "—"}</b>
                      </div>

                      <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", border: "1px solid #cbd5e1", marginBottom: "8px" }}>
                        Chuẩn giống ({ageDays} ngày): <b>{standardGram}g</b> | Thực tế: <b>{latestWeigh ? `${latestWeigh.avg_weight_gram}g (${latestWeigh.notes || ""})` : "Chưa cân"}</b>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => {
                            setSelectedBatchForWeigh(b);
                            setWeighInput({ weigh_date: new Date().toISOString().split("T")[0], sample_count: 10, avg_weight_gram: standardGram, notes: "" });
                            setShowWeighModal(true);
                          }}
                          style={{ flex: 1, padding: "7px", borderRadius: "8px", background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                        >
                          ⚖️ Cân mẫu
                        </button>

                        {b.stage !== "SINH_SAN" && !isExported && (
                          <button
                            onClick={() => handlePromoteStage(b)}
                            style={{ flex: 1.2, padding: "7px", borderRadius: "8px", background: "#0f172a", color: "#fff", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
                          >
                            {b.stage === "UM" ? "➔ Nuôi chung" : "➔ Lên Sinh sản"}
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(b)}
                          style={{ padding: "7px 12px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                        >
                          ✎ Sửa
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: GÀ THƯƠNG PHẨM */}
        {activeTab === "THUONG_PHAM" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "900", color: "#18181b" }}>CÁC LÔ GÀ THỊT ({meatBatches.length})</span>
              <button
                onClick={() => handleOpenAddModal("THIT")}
                style={{ padding: "6px 12px", borderRadius: "8px", background: "#0284c7", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}
              >
                + Nhập Lô Thịt Mới
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {meatBatches.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", background: "#fff", borderRadius: "12px", color: "#64748b", fontSize: "13px", border: "1px solid #e2e8f0" }}>
                  Chưa có lô gà thịt nào. Bấm <b>"+ Nhập Lô Thịt Mới"</b> để bắt đầu theo dõi tăng trọng!
                </div>
              ) : (
                meatBatches.map(b => {
                  const ageDays = safeDateDiff(b.hatch_date);
                  const targetDays = 95;
                  const daysLeft = Math.max(0, targetDays - ageDays);
                  const standardGram = getStandardWeightChicken(b.breed_type, ageDays);
                  const latestWeigh = weightLogs.find(w => w.batch_id === b.id);
                  const isExported = b.stage === "DA_XUAT" || b.current_count === 0;

                  return (
                    <div key={b.id} style={{ background: isExported ? "#f1f5f9" : "#fff", padding: "14px 16px", borderRadius: "14px", border: isExported ? "1px solid #cbd5e1" : "1.5px solid #bae6fd" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <b style={{ fontSize: "16px", color: "#0369a1" }}>{b.batch_code}</b>
                          <span style={{ fontSize: "12px", color: "#334155", fontWeight: "800", marginLeft: "6px" }}>({b.breed_type})</span>
                        </div>
                        <span style={{
                          fontSize: "11px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px",
                          background: isExported ? "#e2e8f0" : daysLeft === 0 ? "#dcfce7" : "#e0f2fe",
                          color: isExported ? "#475569" : daysLeft === 0 ? "#15803d" : "#0284c7"
                        }}>
                          {isExported ? "Đã xuất bán" : daysLeft === 0 ? "✅ Đã tới ngày xuất" : `⏳ Còn ${daysLeft} ngày xuất`}
                        </span>
                      </div>

                      <div style={{ fontSize: "13px", color: "#334155", margin: "8px 0", lineHeight: "1.6" }}>
                        • Tuổi đàn: <b>{ageDays} ngày</b> (Vào đàn: {formatDateVN(b.hatch_date)})<br/>
                        • Quy mô: <b style={{ color: "#0284c7" }}>{b.current_count} con</b> (Ban đầu: {b.initial_count})<br/>
                        • Ô chuồng: <b>{b.pen_location || "—"}</b>
                      </div>

                      <div style={{ background: "#f0f9ff", padding: "8px 10px", borderRadius: "8px", fontSize: "12px", border: "1px solid #bae6fd", marginBottom: "8px" }}>
                        Chuẩn tăng trọng: <b>{standardGram}g</b> | Cân gần nhất: <b>{latestWeigh ? `${latestWeigh.avg_weight_gram}g (${latestWeigh.notes || ""})` : "Chưa cân"}</b>
                      </div>

                      {!isExported && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => {
                              setSelectedBatchForWeigh(b);
                              setWeighInput({ weigh_date: new Date().toISOString().split("T")[0], sample_count: 10, avg_weight_gram: standardGram, notes: "" });
                              setShowWeighModal(true);
                            }}
                            style={{ flex: 1, padding: "7px", borderRadius: "8px", background: "#e0f2fe", color: "#0284c7", border: "1px solid #bae6fd", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                          >
                            ⚖️ Báo cân
                          </button>
                          <button
                            onClick={() => handleSellBatch(b)}
                            style={{ flex: 1, padding: "7px", borderRadius: "8px", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                          >
                            💰 Xuất bán
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(b)}
                            style={{ padding: "7px 12px", borderRadius: "8px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                          >
                            ✎ Sửa
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: QUY TRÌNH KỸ THUẬT */}
        {activeTab === "QUY_TRINH" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "13px", lineHeight: "1.8" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "900", color: "#b45309" }}>
                🐥 1. KỸ THUẬT ÚM GÀ CON (0 – 28 NGÀY TUỔI)
              </h3>
              • <b>Nhiệt độ úm:</b> Tuần 1: 32–34°C; Tuần 2: 29–31°C; Tuần 3: 26–28°C; Tuần 4: 24–26°C. Quan sát đàn: Gà tản đều là đủ nhiệt, tụ cụm dưới bóng sưởi là lạnh, há mỏ tản xa vách là quá nóng.<br/>
              • <b>Nước uống & Cám:</b> 2 giờ đầu khi đón gà về chỉ cho uống nước ấm pha <i>Gluco-C + B-complex + Men sống</i>. Sau 2 giờ mới rải cám hạt nhỏ tập ăn đều đặn nhiều bữa trong ngày.<br/>
              • <b>Độn chuồng:</b> Rải trấu dày 7–10cm, rắc men ủ vi sinh khử mùi định kỳ.
            </div>

            <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "13px", lineHeight: "1.8" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "900", color: "#1d4ed8" }}>
                💉 2. LỊCH VACCINE PHÒNG BỆNH CHUẨN
              </h3>
              • <b>1 – 3 ngày:</b> Tiêm Marek (nếu lò chưa tiêm), uống phòng thương hàn & E.coli.<br/>
              • <b>3 – 5 ngày:</b> Nhỏ mắt/mũi vaccine Newcastle (Lasota) + IB (Viêm phế quản).<br/>
              • <b>7 – 8 ngày:</b> Nhỏ mồm vaccine Gumboro lần 1.<br/>
              • <b>10 – 12 ngày:</b> Chủng đậu gà qua màng cánh.<br/>
              • <b>14 – 15 ngày:</b> Cho uống nhắc lại vaccine Gumboro lần 2.<br/>
              • <b>21 – 24 ngày:</b> Nhỏ nhắc lại Lasota hoặc tiêm vaccine Newcastle nhũ dầu.<br/>
              • <b>35 – 40 ngày:</b> Tiêm dưới da gáy cổ vaccine Cúm gia cầm (H5N1) lần 1.<br/>
              • <b>50 – 55 ngày:</b> Tiêm vaccine Tụ huyết trùng gia cầm.<br/>
              • <b>60 ngày:</b> Tẩy giun sán trước khi vỗ béo hoặc đưa vào hậu bị.
            </div>

            <div style={{ background: "#fff", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0", fontSize: "13px", lineHeight: "1.8" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: "900", color: "#047857" }}>
                🌾 3. CHĂM SÓC ĐÀN SINH SẢN & VỖ BÉO
              </h3>
              • <b>Đàn gà đen sinh sản:</b> Khống chế trọng lượng không cho gà mái quá béo. Bổ sung Canxi/Photpho (bột đá, vỏ sò) và Vitamin ADE 2 tuần trước khi gà vào đẻ.<br/>
              • <b>Thu gom trứng ấp:</b> Thu 2–3 lần/ngày, xếp đầu to hướng lên trên, bảo quản nơi thoáng mát 16–20°C, không quá 7 ngày phải đưa vào lò ấp.<br/>
              • <b>Vỗ béo gà thịt:</b> Trước xuất bán 20 ngày, tăng cường ngô hạt ủ men vi sinh và rau xanh để thịt săn chắc, thơm ngậy.
            </div>
          </div>
        )}
      </div>

      {/* MODAL THÊM / SỬA LÔ GÀ */}
      {showBatchModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "360px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#0f172a" }}>
              {editingBatchId ? "✎ Chỉnh Sửa Thông Tin Lô Gà" : "+ Nhập Lô Gà Mới"}
            </h3>
            <form onSubmit={handleSaveBatch} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Mã Lô (*):</label>
                <input required value={batchFormData.batch_code} onChange={e => setBatchFormData({ ...batchFormData, batch_code: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Phân hệ nuôi:</label>
                  <select
                    value={batchFormData.purpose}
                    onChange={e => {
                      const p = e.target.value as "GIONG" | "THIT";
                      setBatchFormData({
                        ...batchFormData,
                        purpose: p,
                        breed_type: p === "GIONG" ? "Gà Đen H'Mông Bản Địa" : "Ri lai 3/4"
                      });
                    }}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="GIONG">👑 Gà Bản Địa / Giống</option>
                    <option value="THIT">🍗 Gà Thịt Thương Phẩm</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Tên giống gà:</label>
                  <input
                    placeholder="VD: Gà Đen H'Mông, Ri lai..."
                    value={batchFormData.breed_type}
                    onChange={e => setBatchFormData({ ...batchFormData, breed_type: e.target.value })}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Ngày nở / vào đàn:</label>
                  <input type="date" required value={batchFormData.hatch_date} onChange={e => setBatchFormData({ ...batchFormData, hatch_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Giai đoạn:</label>
                  <select value={batchFormData.stage} onChange={e => setBatchFormData({ ...batchFormData, stage: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="UM">🐣 Đang Úm</option>
                    <option value="NUOI_CHUNG">🐓 Nuôi tập trung</option>
                    <option value="SINH_SAN">👑 Ô Sinh Sản</option>
                    <option value="DA_XUAT">🏷️ Đã xuất bán</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Số ban đầu:</label>
                  <input type="number" required min="1" value={batchFormData.initial_count} onChange={e => setBatchFormData({ ...batchFormData, initial_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#047857" }}>Số hiện tại:</label>
                  <input type="number" required min="0" value={batchFormData.current_count} onChange={e => setBatchFormData({ ...batchFormData, current_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1.5px solid #10b981", fontWeight: "800", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ô chuồng / Khu vực nuôi:</label>
                <input value={batchFormData.pen_location} onChange={e => setBatchFormData({ ...batchFormData, pen_location: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ghi chú thêm:</label>
                <input placeholder="Nguồn giống, tình trạng..." value={batchFormData.notes} onChange={e => setBatchFormData({ ...batchFormData, notes: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowBatchModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>
                  {editingBatchId ? "Cập Nhật" : "Lưu Lô"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BÁO CÂN */}
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
                <input type="date" required value={weighInput.weigh_date} onChange={e => setWeighInput({ ...weighInput, weigh_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Số con bắt cân:</label>
                  <input type="number" min="1" value={weighInput.sample_count} onChange={e => setWeighInput({ ...weighInput, sample_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#6d28d9" }}>Cân TB thực tế (g):</label>
                  <input type="number" required min="10" max="6000" value={weighInput.avg_weight_gram} onChange={e => setWeighInput({ ...weighInput, avg_weight_gram: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1.5px solid #8b5cf6", fontWeight: "800", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ background: "#f1f5f9", padding: "8px", borderRadius: "8px", fontSize: "12px", color: "#334155" }}>
                Chuẩn giống ở tuổi này: <b>{getStandardWeightChicken(selectedBatchForWeigh.breed_type, safeDateDiff(selectedBatchForWeigh.hatch_date))} gram</b>
              </div>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ghi chú tình trạng đàn:</label>
                <input placeholder="Lông mượt, ăn khỏe, đồng đều..." value={weighInput.notes} onChange={e => setWeighInput({ ...weighInput, notes: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowWeighModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#6d28d9", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Lưu Kết Quả</button>
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
            <form onSubmit={async (e) => {
              e.preventDefault();
              await supabase.from("egg_harvests").insert([{
                harvest_date: eggInput.harvest_date,
                egg_count: Number(eggInput.egg_count || 0),
                incubated_count: Number(eggInput.incubated_count || 0),
                notes: eggInput.notes || null,
                species: "CHICKEN"
              }]);
              alert(`✅ Đã lưu ${eggInput.egg_count} quả trứng!`);
              setShowEggModal(false);
              await fetchData();
            }} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#ca8a04", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Lưu Lại</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
