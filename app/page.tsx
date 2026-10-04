"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Plus, AlertTriangle, RefreshCw } from "lucide-react";

// Tự kết nối trực tiếp, không phụ thuộc file ngoài
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Pig {
  id: string;
  ear_tag: string;
  breed_id: string;
  sex: "MALE" | "FEMALE";
  stage: string;
  status: string;
  current_pen_code: string;
  current_weight_kg: number;
  sire_ear_tag?: string;
  dam_ear_tag?: string;
}

export default function FarmApp() {
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSex, setFilterSex] = useState<string>("ALL");
  
  const [showMatingModal, setShowMatingModal] = useState(false);
  const [selectedSow, setSelectedSow] = useState("");
  const [selectedBoar, setSelectedBoar] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);
  const [inbreedingAlert, setInbreedingAlert] = useState<string | null>(null);
  const [savingMating, setSavingMating] = useState(false);

  const fetchPigs = async () => {
    setLoading(true);
    if (!supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("pigs")
      .select("*")
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPigs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPigs();
  }, []);

  useEffect(() => {
    if (!selectedSow || !selectedBoar) {
      setInbreedingAlert(null);
      return;
    }

    const sow = pigs.find((p) => p.ear_tag === selectedSow);
    const boar = pigs.find((p) => p.ear_tag === selectedBoar);

    if (sow && boar) {
      if (sow.sire_ear_tag && sow.sire_ear_tag === boar.ear_tag) {
        setInbreedingAlert("CẢNH BÁO NGUY HIỂM: Đực là BỐ của Nái!");
        return;
      }
      if (
        (sow.sire_ear_tag && boar.sire_ear_tag && sow.sire_ear_tag === boar.sire_ear_tag) ||
        (sow.dam_ear_tag && boar.dam_ear_tag && sow.dam_ear_tag === boar.dam_ear_tag)
      ) {
        setInbreedingAlert("CẢNH BÁO CẬN HUYẾT: Đực và Nái có cùng Bố hoặc cùng Mẹ!");
        return;
      }
      setInbreedingAlert(null);
    }
  }, [selectedSow, selectedBoar, pigs]);

  const handleSaveMating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSow || !selectedBoar) return;

    setSavingMating(true);
    const d = new Date(matingDate);
    d.setDate(d.getDate() + 114);
    const expectedFarrow = d.toISOString().split("T")[0];

    const { error: insemError } = await supabase.from("inseminations").insert([
      {
        sow_ear_tag: selectedSow,
        boar_ear_tag: selectedBoar,
        mating_date: matingDate,
        expected_farrow_date: expectedFarrow,
        inbreeding_warning: !!inbreedingAlert,
        technician_name: "Kỹ thuật viên Trại",
      },
    ]);

    if (!insemError) {
      await supabase
        .from("pigs")
        .update({ stage: "DA_PHOI" })
        .eq("ear_tag", selectedSow);

      const taskDate = new Date(matingDate);
      taskDate.setDate(taskDate.getDate() + 21);
      await supabase.from("farm_tasks").insert([
        {
          title: `Kiểm tra động dục lại (Lốc) - Nái ${selectedSow}`,
          due_date: taskDate.toISOString().split("T")[0],
          priority: "HIGH",
          related_tag: selectedSow,
        },
      ]);

      alert("Ghi nhận phối thành công! Đã tự động sinh lịch kiểm tra thai sau 21 ngày.");
      setShowMatingModal(false);
      setSelectedSow("");
      setSelectedBoar("");
      fetchPigs();
    } else {
      alert("Lỗi khi lưu: " + insemError.message);
    }
    setSavingMating(false);
  };

  const totalPigs = pigs.length;
  const totalSows = pigs.filter((p) => p.sex === "FEMALE").length;
  const totalBoars = pigs.filter((p) => p.sex === "MALE").length;
  const pregnantSows = pigs.filter((p) => p.stage === "CHUA" || p.stage === "DA_PHOI").length;

  const filteredPigs = pigs.filter((pig) => {
    const matchSearch = pig.ear_tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        pig.current_pen_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSex = filterSex === "ALL" || pig.sex === filterSex;
    return matchSearch && matchSex;
  });

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "15px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0, color: "#1e293b" }}>
            Trại Sản Xuất Nông Nghiệp Nà Roác
          </h1>
          <p style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Trung tâm Khuyến nông & Giống nông lâm nghiệp Cao Bằng
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={fetchPigs}
            style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={16} /> Làm mới
          </button>
          <button
            onClick={() => setShowMatingModal(true)}
            style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} /> Ghi nhận Phối
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", margin: "20px 0" }}>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Tổng đàn</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a", marginTop: "6px" }}>{totalPigs} cá thể</div>
        </div>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Tổng nái</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#059669", marginTop: "6px" }}>{totalSows} con</div>
        </div>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Nái chửa / Đã phối</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#2563eb", marginTop: "6px" }}>{pregnantSows} con</div>
        </div>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Đực giống</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d97706", marginTop: "6px" }}>{totalBoars} con</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "12px" }}>
          <input
            type="text"
            placeholder="Tìm theo số tai, chuồng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", width: "260px" }}
          />
          <select
            value={filterSex}
            onChange={(e) => setFilterSex(e.target.value)}
            style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
          >
            <option value="ALL">Tất cả giới tính</option>
            <option value="FEMALE">Lợn Cái</option>
            <option value="MALE">Lợn Đực</option>
          </select>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 16px" }}>Số tai</th>
              <th style={{ padding: "12px 16px" }}>Giống</th>
              <th style={{ padding: "12px 16px" }}>Giới tính</th>
              <th style={{ padding: "12px 16px" }}>Giai đoạn</th>
              <th style={{ padding: "12px 16px" }}>Chuồng</th>
              <th style={{ padding: "12px 16px" }}>Cân nặng (kg)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>Đang tải dữ liệu từ trại...</td></tr>
            ) : filteredPigs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>Chưa có cá thể nào hoặc chưa kết nối Supabase Key.</td></tr>
            ) : (
              filteredPigs.map((pig) => (
                <tr key={pig.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{pig.ear_tag}</td>
                  <td style={{ padding: "12px 16px" }}>{pig.breed_id}</td>
                  <td style={{ padding: "12px 16px" }}>{pig.sex === "FEMALE" ? "Cái" : "Đực"}</td>
                  <td style={{ padding: "12px 16px" }}>{pig.stage}</td>
                  <td style={{ padding: "12px 16px" }}>{pig.current_pen_code || "-"}</td>
                  <td style={{ padding: "12px 16px" }}>{pig.current_weight_kg || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showMatingModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", width: "100%", maxWidth: "420px" }}>
            <h3 style={{ margin: "0 0 8px 0" }}>Ghi nhận Phối Giống</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>Tự tính ngày dự sinh 114 ngày và cảnh báo trùng huyết</p>

            <form onSubmit={handleSaveMating} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>CHỌN LỢN NÁI</label>
                <select required value={selectedSow} onChange={(e) => setSelectedSow(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn nái --</option>
                  {pigs.filter((p) => p.sex === "FEMALE").map((sow) => (
                    <option key={sow.id} value={sow.ear_tag}>{sow.ear_tag} (Ô: {sow.current_pen_code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>CHỌN ĐỰC GIỐNG</label>
                <select required value={selectedBoar} onChange={(e) => setSelectedBoar(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn đực --</option>
                  {pigs.filter((p) => p.sex === "MALE").map((boar) => (
                    <option key={boar.id} value={boar.ear_tag}>{boar.ear_tag}</option>
                  ))}
                </select>
              </div>

              {inbreedingAlert && (
                <div style={{ padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#b91c1c", fontSize: "12px", display: "flex", gap: "8px" }}>
                  <AlertTriangle size={18} />
                  <span>{inbreedingAlert}</span>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>NGÀY PHỐI</label>
                <input type="date" required value={matingDate} onChange={(e) => setMatingDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={savingMating} style={{ padding: "8px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>
                  {savingMating ? "Đang lưu..." : "Xác nhận Phối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
