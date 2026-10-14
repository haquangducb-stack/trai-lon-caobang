"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import FarmSpeciesNav from "@/components/FarmSpeciesNav";

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

// BIỂU CÂN NẶNG CHUẨN CHO VỊT THEO NGÀY TUỔI (GRAM)
const getDuckStandardWeight = (breedType: string, dayAge: number): number => {
  const b = breedType.toLowerCase();

  // 1. Vịt Super (Siêu nạc, siêu thịt) - Tăng trọng rất nhanh
  if (b.includes("super") || b.includes("siêu")) {
    if (dayAge <= 7) return 180;
    if (dayAge <= 14) return 500;
    if (dayAge <= 21) return 1100;
    if (dayAge <= 28) return 1700;
    if (dayAge <= 35) return 2300;
    if (dayAge <= 42) return 2850;
    if (dayAge <= 50) return 3350;
    return 3600;
  }

  // 2. Vịt Bầu (Giống địa phương / Bầu Bến) - Khung xương chắc, thời gian nuôi dài hơn
  if (b.includes("bầu") || b.includes("bau") || b.includes("cỏ") || b.includes("co")) {
    if (dayAge <= 7) return 130;
    if (dayAge <= 14) return 320;
    if (dayAge <= 21) return 650;
    if (dayAge <= 30) return 1050;
    if (dayAge <= 45) return 1600;
    if (dayAge <= 60) return 2050;
    if (dayAge <= 75) return 2400;
    return 2600;
  }

  return Math.round(dayAge * 35);
};

// ĐỊNH MỨC THỨC ĂN (GRAM CÁM / CON / NGÀY) THEO TUỔI
const getDuckDailyFeedGram = (breedType: string, dayAge: number): number => {
  const isSuper = breedType.toLowerCase().includes("super");
  if (dayAge <= 7) return isSuper ? 35 : 25;
  if (dayAge <= 14) return isSuper ? 85 : 60;
  if (dayAge <= 21) return isSuper ? 140 : 100;
  if (dayAge <= 35) return isSuper ? 210 : 150;
  if (dayAge <= 50) return isSuper ? 260 : 180;
  return isSuper ? 270 : 190;
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

export default function DuckPage() {
  const [mounted, setMounted] = useState(false);
  const [batches, setBatches] = useState<PoultryBatch[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);

  // Modal Nhập Lô Vịt
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<PoultryBatch>>({
    batch_code: "",
    species: "DUCK",
    breed_type: "Vịt Bầu",
    purpose: "THIT",
    stage: "THIT",
    hatch_date: new Date().toISOString().split("T")[0],
    initial_count: 50,
    pen_location: "Khu nuôi bờ ao",
    notes: ""
  });

  // Modal Báo cân mẫu
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [selectedBatchForWeigh, setSelectedBatchForWeigh] = useState<PoultryBatch | null>(null);
  const [weighInput, setWeighInput] = useState({
    weigh_date: new Date().toISOString().split("T")[0],
    sample_count: 10,
    avg_weight_gram: 1000,
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
      const [batchRes, weighRes] = await Promise.all([
        supabase.from("poultry_batches").select("*").eq("species", "DUCK").order("hatch_date", { ascending: false }),
        supabase.from("poultry_weight_logs").select("*").order("weigh_date", { ascending: false })
      ]);
      if (batchRes?.data) setBatches(batchRes.data);
      if (weighRes?.data) setWeightLogs(weighRes.data);
    } catch (e) {}
  }, [supabase]);

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [fetchData]);

  const totalDucks = batches.reduce((sum, b) => sum + (b.current_count || 0), 0);

  // Tính tổng lượng cám toàn đàn vịt hôm nay
  const totalDailyFeedAllBatchesKg = batches.reduce((acc, b) => {
    const age = safeDateDiff(b.hatch_date);
    const feedG = getDuckDailyFeedGram(b.breed_type, age);
    return acc + (feedG * (b.current_count || 0)) / 1000;
  }, 0).toFixed(1);

  // Nhập lô vịt mới
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatch.batch_code?.trim()) return;

    try {
      const { error } = await supabase.from("poultry_batches").insert([{
        batch_code: newBatch.batch_code.trim().toUpperCase(),
        species: "DUCK",
        breed_type: newBatch.breed_type || "Vịt Bầu",
        purpose: "THIT",
        stage: "THIT",
        hatch_date: newBatch.hatch_date,
        initial_count: Number(newBatch.initial_count || 0),
        current_count: Number(newBatch.initial_count || 0),
        pen_location: newBatch.pen_location || "Khu nuôi bờ ao",
        notes: newBatch.notes || null
      }]);

      if (error) throw error;
      alert(`✅ Đã nhập thành công lô vịt ${newBatch.batch_code}!`);
      setShowAddBatchModal(false);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi nhập lô vịt: " + err.message);
    }
  };

  // Lưu biên bản báo cân mẫu vịt
  const handleSaveWeightLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForWeigh) return;

    try {
      const ageDays = safeDateDiff(selectedBatchForWeigh.hatch_date);
      const standardGram = getDuckStandardWeight(selectedBatchForWeigh.breed_type, ageDays);
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

      alert(`✅ Đã lưu kết quả cân lô vịt ${selectedBatchForWeigh.batch_code}!\n- Thực tế: ${actualGram}g | Chuẩn: ${standardGram}g (${diff >= 0 ? "+" : ""}${diff}g)\n- Đánh giá: ${evaluation}`);
      setShowWeighModal(false);
      setSelectedBatchForWeigh(null);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi lưu biểu cân: " + err.message);
    }
  };

  // Đánh dấu xuất bán toàn bộ lô
  const handleMarkExported = async (batch: PoultryBatch) => {
    if (!confirm(`Xác nhận XUẤT BÁN toàn bộ lô vịt ${batch.batch_code} (${batch.current_count} con)?`)) return;

    try {
      const { error } = await supabase.from("poultry_batches").update({
        current_count: 0,
        stage: "DA_XUAT",
        notes: `${batch.notes || ""} [Đã xuất bán ngày ${new Date().toLocaleDateString('vi-VN')}]`.trim()
      }).eq("id", batch.id);

      if (error) throw error;
      alert(`✅ Đã ghi nhận xuất bán thành công lô vịt ${batch.batch_code}!`);
      await fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  if (!mounted) {
    return (
      <div style={{ backgroundColor: "#f0fdfa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Đang tải phân hệ Vịt...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f0fdfa", minHeight: "100vh", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto", paddingBottom: "75px" }}>
      {/* THANH ĐIỀU HƯỚNG DÙNG CHUNG (VUỐT ĐỔI LOÀI) */}
      <FarmSpeciesNav />

      <div style={{ padding: "16px" }}>
        {/* TỔNG QUAN PHÂN HỆ VỊT */}
        <div style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", borderRadius: "16px", padding: "18px 20px", color: "#fff", marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", color: "#99f6e4", fontWeight: "800", textTransform: "uppercase" }}>QUẢN LÝ ĐÀN VỊT THƯƠNG PHẨM</div>
          <div style={{ fontSize: "28px", fontWeight: "900", margin: "4px 0" }}>
            {totalDucks} <span style={{ fontSize: "15px", color: "#ccfbf1" }}>con</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#e6fffa", marginTop: "4px" }}>
            <span>● Số lô đang nuôi: <b>{batches.filter(b => b.current_count > 0).length} lô</b></span>
            <span>● Cám xuất kho hôm nay: <b>~{totalDailyFeedAllBatchesKg} kg</b></span>
          </div>
        </div>

        {/* TIÊU ĐỀ & NÚT NHẬP LÔ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontSize: "14px", fontWeight: "900", color: "#134e4a" }}>
            DANH SÁCH LÔ VỊT THỊT ({batches.length})
          </span>
          <button
            onClick={() => {
              setNewBatch({
                batch_code: `VT-${new Date().getFullYear().toString().slice(-2)}-${String(batches.length + 1).padStart(2, "0")}`,
                species: "DUCK",
                breed_type: "Vịt Bầu",
                purpose: "THIT",
                stage: "THIT",
                hatch_date: new Date().toISOString().split("T")[0],
                initial_count: 50,
                pen_location: "Khu nuôi bờ ao",
                notes: ""
              });
              setShowAddBatchModal(true);
            }}
            style={{ padding: "6px 12px", borderRadius: "8px", background: "#0d9488", color: "#fff", border: "none", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}
          >
            + Nhập Lô Mới
          </button>
        </div>

        {/* DANH SÁCH LÔ VỊT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {batches.length === 0 ? (
            <div style={{ padding: "16px", textAlign: "center", background: "#fff", borderRadius: "12px", color: "#64748b", fontSize: "13px", border: "1px solid #99f6e4" }}>
              Chưa có lô vịt nào. Bấm <b>"+ Nhập Lô Mới"</b> để bắt đầu theo dõi!
            </div>
          ) : (
            batches.map(b => {
              const ageDays = safeDateDiff(b.hatch_date);
              const isSuper = b.breed_type.toLowerCase().includes("super");
              const targetDays = isSuper ? 50 : 70;
              const daysLeft = Math.max(0, targetDays - ageDays);
              const isExported = b.stage === "DA_XUAT" || b.current_count === 0;

              const standardGram = getDuckStandardWeight(b.breed_type, ageDays);
              const feedPerDuckGram = getDuckDailyFeedGram(b.breed_type, ageDays);
              const totalFeedBatchKg = ((feedPerDuckGram * b.current_count) / 1000).toFixed(1);

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
                  weightBadgeColor = diff < -200 ? "#dc2626" : "#d97706";
                  weightDiffText = `${diff}g`;
                }
              }

              return (
                <div key={b.id} style={{ background: isExported ? "#f1f5f9" : "#fff", padding: "14px 16px", borderRadius: "14px", border: isExported ? "1px solid #cbd5e1" : "1.5px solid #99f6e4", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <b style={{ fontSize: "16px", color: "#0f766e" }}>{b.batch_code}</b>
                      <span style={{ fontSize: "12px", marginLeft: "6px", color: "#334155", fontWeight: "700" }}>({b.breed_type})</span>
                    </div>

                    <span style={{
                      fontSize: "11px", fontWeight: "800", padding: "3px 8px", borderRadius: "6px",
                      background: isExported ? "#e2e8f0" : daysLeft === 0 ? "#dcfce7" : "#ccfbf1",
                      color: isExported ? "#475569" : daysLeft === 0 ? "#15803d" : "#0f766e"
                    }}>
                      {isExported ? "Đã xuất bán" : daysLeft === 0 ? "✅ Đã tới ngày xuất" : `⏳ Còn ${daysLeft} ngày xuất`}
                    </span>
                  </div>

                  <div style={{ fontSize: "13px", color: "#334155", margin: "8px 0", lineHeight: "1.6" }}>
                    • Tuổi đàn: <b>{ageDays} ngày tuổi</b> (Nhập: {formatDateVN(b.hatch_date)})<br/>
                    • Quy mô: <b style={{ color: isExported ? "#64748b" : "#0d9488" }}>{b.current_count} con</b> (Ban đầu: {b.initial_count})<br/>
                    {!isExported && (
                      <>
                        • Định mức cám hôm nay: <b style={{ color: "#b45309" }}>~{totalFeedBatchKg} kg/ngày</b> ({feedPerDuckGram}g/con)<br/>
                      </>
                    )}
                    • Vị trí nuôi: <b>{b.pen_location || "—"}</b>
                  </div>

                  {/* KHỐI BIỂU CÂN ĐỐI CHIẾU TIÊU CHUẨN */}
                  {!isExported && (
                    <div style={{ background: "#f0fdfa", padding: "10px 12px", borderRadius: "10px", border: "1px solid #99f6e4", marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                        <span>⚖️ Chuẩn {ageDays} ngày: <b style={{ color: "#0d9488" }}>{standardGram}g</b></span>
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
                          Đánh giá: <b>{latestWeigh.notes}</b> (Cân ngày: {formatDateVN(latestWeigh.weigh_date)})
                        </div>
                      )}
                    </div>
                  )}

                  {/* KHỐI VACCINE THEO MỐC NGÀY TUỔI */}
                  {!isExported && (
                    <div style={{ background: "#f8fafc", padding: "8px 10px", borderRadius: "8px", fontSize: "11px", color: "#334155", marginBottom: "8px", border: "1px solid #e2e8f0" }}>
                      <b>Lịch vaccine:</b>{" "}
                      {ageDays <= 3 ? "Tiêm Viêm gan siêu vi trùng (1-3 ngày)" :
                       ageDays <= 15 ? "Tiêm Dịch tả vịt lần 1 (14-15 ngày)" :
                       ageDays <= 25 ? "Tiêm Cúm gia cầm H5N1 (21-25 ngày)" :
                       "Duy trì vỗ béo tăng trọng đến xuất chuồng"}
                    </div>
                  )}

                  {/* NÚT BÁO CÂN & XUẤT BÁN */}
                  {!isExported && (
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
                        style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#ccfbf1", color: "#0f766e", border: "1px solid #99f6e4", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                      >
                        ⚖️ Báo cân mẫu
                      </button>

                      <button
                        onClick={() => handleMarkExported(b)}
                        style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", fontSize: "12px", fontWeight: "800", cursor: "pointer" }}
                      >
                        💰 Xuất bán lô này
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* QUY TRÌNH THÚ Y & THỨC ĂN VỊT */}
        <div style={{ marginTop: "20px", background: "#f0fdf4", padding: "14px", borderRadius: "12px", fontSize: "12px", lineHeight: "1.7", color: "#166534" }}>
          <b style={{ color: "#14532d", fontSize: "13px" }}>🦆 QUY TRÌNH VACCINE & CHĂM SÓC VỊT THỊT:</b><br/>
          • <b>1 - 3 ngày tuổi:</b> Tiêm vaccine phòng Viêm gan siêu vi trùng vịt.<br/>
          • <b>14 - 15 ngày:</b> Tiêm vaccine Dịch tả vịt lần 1.<br/>
          • <b>21 - 25 ngày:</b> Tiêm vaccine Cúm gia cầm (H5N1 / H5N6).<br/>
          • <b>35 ngày:</b> Nhắc lại Dịch tả vịt (nếu nuôi vịt Bầu kéo dài trên 60 ngày).<br/>
          • <b>Giai đoạn vỗ béo:</b> Cung cấp đầy đủ nước sạch, kết hợp cám viên đậm đặc với ngô ủ men, rau bèo sẵn có tại địa phương để giảm chi phí thức ăn.
        </div>
      </div>

      {/* MODAL BÁO CÂN MẪU */}
      {showWeighModal && selectedBatchForWeigh && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "900", color: "#0f766e" }}>
              ⚖️ Báo Cân Lô Vịt: {selectedBatchForWeigh.batch_code}
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
                  <label style={{ fontSize: "11px", fontWeight: "800", color: "#0f766e" }}>Cân TB thực tế (g):</label>
                  <input
                    type="number"
                    required
                    min="10"
                    max="6000"
                    value={weighInput.avg_weight_gram}
                    onChange={e => setWeighInput({ ...weighInput, avg_weight_gram: Number(e.target.value) })}
                    style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1.5px solid #0d9488", fontWeight: "800", boxSizing: "border-box" }}
                  />
                </div>
              </div>

              <div style={{ background: "#f0fdfa", padding: "8px", borderRadius: "8px", fontSize: "12px", color: "#0f766e" }}>
                Chuẩn giống ở tuổi này: <b>{getDuckStandardWeight(selectedBatchForWeigh.breed_type, safeDateDiff(selectedBatchForWeigh.hatch_date))} gram</b>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Ghi chú tình trạng vịt:</label>
                <input
                  placeholder="Lông mượt, ăn mạnh, bơi tốt..."
                  value={weighInput.notes}
                  onChange={e => setWeighInput({ ...weighInput, notes: e.target.value })}
                  style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowWeighModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#0d9488", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Lưu Kết Quả</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NHẬP LÔ VỊT MỚI */}
      {showAddBatchModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "18px" }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: "16px", fontWeight: "900", color: "#0f766e" }}>+ Nhập Lô Vịt Thịt Mới</h3>
            <form onSubmit={handleCreateBatch} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Mã Lô (*):</label>
                <input required value={newBatch.batch_code} onChange={e => setNewBatch({ ...newBatch, batch_code: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Giống vịt:</label>
                <select value={newBatch.breed_type} onChange={e => setNewBatch({ ...newBatch, breed_type: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}>
                  <option value="Vịt Bầu">Vịt Bầu (Địa phương / Bầu Bến)</option>
                  <option value="Vịt Super">Vịt Super (Siêu nạc / Siêu thịt)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Ngày nhập đàn:</label>
                  <input type="date" required value={newBatch.hatch_date} onChange={e => setNewBatch({ ...newBatch, hatch_date: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: "800" }}>Số con nhập:</label>
                  <input type="number" required min="1" value={newBatch.initial_count} onChange={e => setNewBatch({ ...newBatch, initial_count: Number(e.target.value) })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: "800" }}>Khu vực / Ô chuồng:</label>
                <input value={newBatch.pen_location} onChange={e => setNewBatch({ ...newBatch, pen_location: e.target.value })} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>
                <button type="button" onClick={() => setShowAddBatchModal(false)} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#0d9488", color: "#fff", border: "none", fontWeight: "800", cursor: "pointer" }}>Nhập Đàn</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
