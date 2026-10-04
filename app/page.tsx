"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { Plus, AlertTriangle, RefreshCw } from "lucide-react";

interface Pig {
  id: string;
  ear_tag: string;
  breed_id: string;
  sex: string;
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
  const [debugMsg, setDebugMsg] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSex, setFilterSex] = useState<string>("ALL");

  const [showMatingModal, setShowMatingModal] = useState(false);
  const [selectedSow, setSelectedSow] = useState("");
  const [selectedBoar, setSelectedBoar] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);
  const [inbreedingAlert, setInbreedingAlert] = useState<string | null>(null);
  const [savingMating, setSavingMating] = useState(false);

  // Tự động làm sạch URL: cắt sạch /rest/v1, /rest, / nếu vô tình dính vào
  const supabase = useMemo(() => {
    let rawUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://eqlegigaftimjdmyuofg.supabase.co";
    
    // Chuẩn hóa xóa sạch khoảng trắng và đuôi thừa
    rawUrl = rawUrl.trim();
    rawUrl = rawUrl.replace(/\/rest(\/v1)?\/?$/, "");
    rawUrl = rawUrl.replace(/\/+$/, "");

    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";

    return createClient(rawUrl, rawKey.trim());
  }, []);

  const isFemale = (sex: string) => {
    if (!sex) return false;
    const s = sex.toLowerCase();
    return s.includes("cái") || s.includes("cai") || s.includes("female") || s === "f";
  };

  const isMale = (sex: string) => {
    if (!sex) return false;
    const s = sex.toLowerCase();
    return s.includes("đực") || s.includes("duc") || s.includes("male") || s === "m";
  };

  const fetchPigs = async () => {
    setLoading(true);
    setDebugMsg("");

    try {
      const { data, error } = await supabase
        .from("pigs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setDebugMsg("LỖI TỪ SUPABASE: " + error.message);
      } else if (data) {
        if (data.length === 0) {
          setDebugMsg("ĐÃ KẾT NỐI SUPABASE THÀNH CÔNG, NHƯNG BẢNG 'pigs' ĐANG CÓ 0 CON.");
        }
        setPigs(data);
      }
    } catch (err: any) {
      setDebugMsg("LỖI KẾT NỐI: " + (err.message || String(err)));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPigs();
  }, [supabase]);

  useEffect(() => {
    if (!selectedSow || !selectedBoar) {
      setInbreedingAlert(null);
      return;
    }

    const sow = pigs.find((p) => p.ear_tag === selectedSow);
    const boar = pigs.find((p) => p.ear_tag === selectedBoar);

    if (sow && boar) {
      if (sow.sire_ear_tag && sow.sire_ear_tag === boar.ear_tag) {
        setInbreedingAlert("CẢNH BÁO NGUY HIỂM: Đực giống chính là BỐ của Nái!");
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
        .update({ stage: "Đã phối" })
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

      alert(`Ghi nhận phối thành công! Dự sinh: ${expectedFarrow}. Đã tạo lịch kiểm tra thai sau 21 ngày.`);
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
  const totalSows = pigs.filter((p) => isFemale(p.sex)).length;
  const totalBoars = pigs.filter((p) => isMale(p.sex)).length;

  const filteredPigs = pigs.filter((pig) => {
    const matchSearch =
      pig.ear_tag?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pig.breed_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pig.current_pen_code?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchSex = true;
    if (filterSex === "FEMALE") matchSex = isFemale(pig.sex);
    if (filterSex === "MALE") matchSex = isMale(pig.sex);

    return matchSearch && matchSex;
  });

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0, color: "#0f172a" }}>
            Trại Sản Xuất Nông Nghiệp Nà Roác
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
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
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#0f172a", marginTop: "6px" }}>{totalPigs} con</div>
        </div>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Lợn Nái / Hậu bị</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#059669", marginTop: "6px" }}>{totalSows} con</div>
        </div>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase" }}>Đực giống</div>
          <div style={{ fontSize: "24px", fontWeight: "bold", color: "#d97706", marginTop: "6px" }}>{totalBoars} con</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Tìm theo số tai, giống, chuồng..."
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

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px" }}>Số tai</th>
                <th style={{ padding: "12px 16px" }}>Giống</th>
                <th style={{ padding: "12px 16px" }}>Giới tính</th>
                <th style={{ padding: "12px 16px" }}>Giai đoạn</th>
                <th style={{ padding: "12px 16px" }}>Chuồng / Ô</th>
                <th style={{ padding: "12px 16px" }}>Khối lượng (kg)</th>
                <th style={{ padding: "12px 16px" }}>Số tai Bố</th>
                <th style={{ padding: "12px 16px" }}>Số tai Mẹ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>Đang tải dữ liệu từ trại...</td></tr>
              ) : filteredPigs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: debugMsg.includes("LỖI") ? "#b91c1c" : "#059669", fontWeight: "bold" }}>
                    {debugMsg || "Không có cá thể nào phù hợp với bộ lọc."}
                  </td>
                </tr>
              ) : (
                filteredPigs.map((pig) => (
                  <tr key={pig.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: "bold", color: "#0f172a" }}>{pig.ear_tag}</td>
                    <td style={{ padding: "12px 16px" }}>{pig.breed_id || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>{pig.sex || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>{pig.stage || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>{pig.current_pen_code || "-"}</td>
                    <td style={{ padding: "12px 16px" }}>{pig.current_weight_kg ? `${pig.current_weight_kg} kg` : "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{pig.sire_ear_tag || "-"}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{pig.dam_ear_tag || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showMatingModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 50 }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "10px", width: "100%", maxWidth: "440px" }}>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>Ghi nhận Phối Giống</h3>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>Tự tính ngày đẻ (+114 ngày) và kiểm tra cận huyết</p>

            <form onSubmit={handleSaveMating} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>CHỌN LỢN NÁI</label>
                <select required value={selectedSow} onChange={(e) => setSelectedSow(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn nái phối --</option>
                  {pigs.filter((p) => isFemale(p.sex)).map((sow) => (
                    <option key={sow.id} value={sow.ear_tag}>
                      {sow.ear_tag} ({sow.breed_id || "Giống"} - Ô: {sow.current_pen_code || "Chưa có"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>CHỌN ĐỰC GIỐNG</label>
                <select required value={selectedBoar} onChange={(e) => setSelectedBoar(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn đực giống --</option>
                  {pigs.filter((p) => isMale(p.sex)).map((boar) => (
                    <option key={boar.id} value={boar.ear_tag}>
                      {boar.ear_tag} ({boar.breed_id || "Đực"})
                    </option>
                  ))}
                </select>
              </div>

              {inbreedingAlert && (
                <div style={{ padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#b91c1c", fontSize: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <AlertTriangle size={18} />
                  <span>{inbreedingAlert}</span>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>NGÀY PHỐI GIỐNG</label>
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
