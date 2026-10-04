"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Plus,
  AlertTriangle,
  RefreshCw,
  Search,
  Calendar,
  Layers,
  HeartHandshake,
  Baby,
  Home,
  CheckCircle2,
  Clock,
  X
} from "lucide-react";

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

interface Pen {
  pen_code: string;
  area_zone: string;
  pen_function: string;
  capacity: number;
  current_status: string;
}

interface Farrowing {
  id: string;
  litter_code: string;
  sow_ear_tag: string;
  farrow_date: string;
  total_born: number;
  alive_born: number;
  avg_birth_weight: number;
  weaning_date: string;
  notes: string;
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
  const [pens, setPens] = useState<Pen[]>([]);
  const [farrowings, setFarrowings] = useState<Farrowing[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"HERD" | "FARROW" | "PENS" | "TASKS">("HERD");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSex, setFilterSex] = useState<string>("ALL");

  // Modals
  const [showMatingModal, setShowMatingModal] = useState(false);
  const [showFarrowModal, setShowFarrowModal] = useState(false);
  const [showAddPigModal, setShowAddPigModal] = useState(false);

  // Form State: Phối giống
  const [selectedSow, setSelectedSow] = useState("");
  const [selectedBoar, setSelectedBoar] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);
  const [inbreedingAlert, setInbreedingAlert] = useState<string | null>(null);
  const [savingMating, setSavingMating] = useState(false);

  // Form State: Xác nhận Đẻ (Auto sinh lợn con & chuyển trạng thái)
  const [farrowSow, setFarrowSow] = useState("");
  const [farrowDate, setFarrowDate] = useState(new Date().toISOString().split("T")[0]);
  const [totalBorn, setTotalBorn] = useState<number>(10);
  const [aliveBorn, setAliveBorn] = useState<number>(10);
  const [avgWeight, setAvgWeight] = useState<string>("0.5");
  const [farrowNotes, setFarrowNotes] = useState("Heo con khỏe mạnh, đồng đều");
  const [savingFarrow, setSavingFarrow] = useState(false);

  // Form State: Thêm lợn lẻ
  const [newPig, setNewPig] = useState({
    ear_tag: "",
    breed_id: "Hạ Lang",
    sex: "Cái",
    stage: "Hậu bị",
    current_pen_code: "CB2",
    current_weight_kg: "",
    sire_ear_tag: "",
    dam_ear_tag: "",
  });
  const [savingPig, setSavingPig] = useState(false);

  const supabase = useMemo(() => {
    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");
    const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";
    return createClient(rawUrl, rawKey.trim());
  }, []);

  const isFemale = (sexStr: string) => {
    if (!sexStr) return false;
    const s = sexStr.trim().toLowerCase();
    return s.includes("cái") || s.includes("cai") || s.includes("nái") || s === "female" || s === "f" || s === "c";
  };

  const isMale = (sexStr: string) => {
    if (!sexStr) return false;
    if (isFemale(sexStr)) return false;
    const s = sexStr.trim().toLowerCase();
    return s.includes("đực") || s.includes("duc") || s === "male" || s === "m" || s === "d" || s.includes("boar");
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, penRes, farRes, taskRes] = await Promise.all([
        supabase.from("pigs").select("*").order("created_at", { ascending: false }),
        supabase.from("pens").select("*").order("pen_code", { ascending: true }),
        supabase.from("farrowings").select("*").order("farrow_date", { ascending: false }),
        supabase.from("farm_tasks").select("*").order("due_date", { ascending: true })
      ]);

      if (pRes.data) setPigs(pRes.data);
      if (penRes.data) setPens(penRes.data);
      if (farRes.data) setFarrowings(farRes.data);
      if (taskRes.data) setTasks(taskRes.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  // Kiểm tra cận huyết
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

  // 1. LOGIC TỰ ĐỘNG KHI XÁC NHẬN ĐẺ
  const handleSaveFarrowing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farrowSow) return;

    setSavingFarrow(true);
    try {
      const sowObj = pigs.find((p) => p.ear_tag === farrowSow);
      
      // Tìm đực phối gần nhất trong inseminations
      const { data: lastInsem } = await supabase
        .from("inseminations")
        .select("boar_ear_tag")
        .eq("sow_ear_tag", farrowSow)
        .order("created_at", { ascending: false })
        .limit(1);

      const sireTag = lastInsem && lastInsem.length > 0 ? lastInsem[0].boar_ear_tag : (sowObj?.sire_ear_tag || "");

      // Ngày cai sữa dự kiến: +28 ngày
      const d = new Date(farrowDate);
      d.setDate(d.getDate() + 28);
      const weaningDate = d.toISOString().split("T")[0];

      const litterCode = `LD-${new Date().getFullYear()}-${String(farrowings.length + 1).padStart(3, "0")}`;

      // A. Thêm vào bảng farrowings
      await supabase.from("farrowings").insert([
        {
          litter_code: litterCode,
          sow_ear_tag: farrowSow,
          farrow_date: farrowDate,
          total_born: Number(totalBorn),
          alive_born: Number(aliveBorn),
          avg_birth_weight: parseFloat(avgWeight) || 0.5,
          weaning_date: weaningDate,
          notes: farrowNotes
        }
      ]);

      // B. Tự động chuyển trạng thái nái sang "Nuôi con"
      await supabase
        .from("pigs")
        .update({ stage: "Nuôi con" })
        .eq("ear_tag", farrowSow);

      // C. TỰ ĐỘNG THÊM TỪNG LỢN CON VÀO BẢNG PIGS (TỔNG ĐÀN)
      const piglets = [];
      const count = Number(aliveBorn);
      for (let i = 1; i <= count; i++) {
        piglets.push({
          ear_tag: `${farrowSow}-C${String(i).padStart(2, "0")}`,
          breed_id: sowObj?.breed_id ? `Con của ${sowObj.breed_id}` : "Lợn con theo mẹ",
          sex: i % 2 === 0 ? "Cái" : "Đực", // Tạm chia đều hoặc cập nhật sau
          stage: "Theo mẹ",
          status: "ACTIVE",
          current_pen_code: sowObj?.current_pen_code || "",
          current_weight_kg: parseFloat(avgWeight) || 0.5,
          birth_date: farrowDate,
          sire_ear_tag: sireTag,
          dam_ear_tag: farrowSow,
          notes: `Lứa đẻ mã ${litterCode}`
        });
      }

      if (piglets.length > 0) {
        await supabase.from("pigs").insert(piglets);
      }

      // D. Tự động tạo nhắc việc thú y cho lứa đẻ
      const dFe = new Date(farrowDate);
      dFe.setDate(dFe.getDate() + 3); // Tiêm sắt ngày 3
      await supabase.from("farm_tasks").insert([
        {
          title: `Tiêm sắt lần 1 & bấm tai cho đàn con nái ${farrowSow}`,
          due_date: dFe.toISOString().split("T")[0],
          related_tag: farrowSow,
        },
        {
          title: `Cai sữa và tách mẹ đàn con nái ${farrowSow}`,
          due_date: weaningDate,
          related_tag: farrowSow,
        }
      ]);

      alert(`✅ Đã ghi nhận đẻ lứa ${litterCode}!\n- Nái ${farrowSow} chuyển sang 'Nuôi con'\n- Đã tự động thêm ${count} lợn con vào Tổng đàn\n- Đã đặt lịch tiêm sắt và cai sữa.`);
      setShowFarrowModal(false);
      fetchData();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
    setSavingFarrow(false);
  };

  // 2. GHI NHẬN PHỐI GIỐNG
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
        technician_name: "DỰ",
        status: "Đã đậu thai"
      },
    ]);

    if (!insemError) {
      await supabase.from("pigs").update({ stage: "Đang chửa" }).eq("ear_tag", selectedSow);

      const task21 = new Date(matingDate);
      task21.setDate(task21.getDate() + 21);
      await supabase.from("farm_tasks").insert([
        {
          title: `Kiểm tra động dục lại (Lốc) - Nái ${selectedSow}`,
          due_date: task21.toISOString().split("T")[0],
          related_tag: selectedSow,
        },
        {
          title: `Chuyển nái ${selectedSow} lên chuồng đẻ & trực đẻ`,
          due_date: expectedFarrow,
          related_tag: selectedSow,
        }
      ]);

      alert(`✅ Phối giống thành công!\n- Nái ${selectedSow} tự đổi sang 'Đang chửa'\n- Dự đẻ: ${expectedFarrow}`);
      setShowMatingModal(false);
      setSelectedSow("");
      setSelectedBoar("");
      fetchData();
    } else {
      alert("Lỗi: " + insemError.message);
    }
    setSavingMating(false);
  };

  // 3. THÊM LỢN LẺ
  const handleAddPig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPig.ear_tag.trim()) return;

    setSavingPig(true);
    const { error } = await supabase.from("pigs").insert([{
      ear_tag: newPig.ear_tag.trim(),
      breed_id: newPig.breed_id.trim(),
      sex: newPig.sex,
      stage: newPig.stage,
      current_pen_code: newPig.current_pen_code.trim(),
      current_weight_kg: newPig.current_weight_kg ? parseFloat(newPig.current_weight_kg) : null,
      sire_ear_tag: newPig.sire_ear_tag.trim() || null,
      dam_ear_tag: newPig.dam_ear_tag.trim() || null,
      status: "ACTIVE"
    }]);

    if (!error) {
      alert("Đã thêm cá thể thành công!");
      setShowAddPigModal(false);
      fetchData();
    } else {
      alert("Lỗi: " + error.message);
    }
    setSavingPig(false);
  };

  const toggleTask = async (id: string, st: boolean) => {
    await supabase.from("farm_tasks").update({ is_completed: !st }).eq("id", id);
    fetchData();
  };

  // Thống kê
  const totalPigs = pigs.length;
  const totalSows = pigs.filter((p) => isFemale(p.sex)).length;
  const totalBoars = pigs.filter((p) => isMale(p.sex)).length;
  const totalPiglets = pigs.filter((p) => (p.stage || "").includes("Theo mẹ")).length;
  const pendingTasks = tasks.filter((t) => !t.is_completed).length;

  const filteredPigs = pigs.filter((p) => {
    const s = searchTerm.toLowerCase();
    const match = p.ear_tag?.toLowerCase().includes(s) || p.breed_id?.toLowerCase().includes(s) || p.current_pen_code?.toLowerCase().includes(s);
    let matchSex = true;
    if (filterSex === "FEMALE") matchSex = isFemale(p.sex);
    if (filterSex === "MALE") matchSex = isMale(p.sex);
    return match && matchSex;
  });

  return (
    <div style={{ maxWidth: "1150px", margin: "0 auto", padding: "16px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      
      {/* Header */}
      <header style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "16px 20px", border: "1px solid #e2e8f0", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "800", margin: 0, color: "#0f172a" }}>
            Trại Sản Xuất Nông Nghiệp Nà Roác 🐖
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
            Hệ thống Quản lý Kỹ thuật & Theo dõi Chu kỳ Chăn nuôi Liên hoàn
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={fetchData} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600" }}>
            <RefreshCw size={15} /> Làm mới
          </button>
          <button onClick={() => setShowAddPigModal(true)} style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700" }}>
            <Plus size={16} /> Thêm Lợn
          </button>
          <button onClick={() => setShowMatingModal(true)} style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
            <HeartHandshake size={16} /> Phối Giống
          </button>
          <button onClick={() => setShowFarrowModal(true)} style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", boxShadow: "0 2px 4px rgba(5,150,105,0.2)" }}>
            <Baby size={16} /> Ghi nhận Đẻ
          </button>
        </div>
      </header>

      {/* Thống kê Tổng quan tự động */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "16px" }}>
        <div style={{ background: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>TỔNG ĐÀN</div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>{totalPigs} con</div>
        </div>
        <div style={{ background: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", color: "#059669", fontWeight: "700" }}>LỢN NÁI / HẬU BỊ</div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#059669" }}>{totalSows} con</div>
        </div>
        <div style={{ background: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", color: "#d97706", fontWeight: "700" }}>ĐỰC GIỐNG</div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#d97706" }}>{totalBoars} con</div>
        </div>
        <div style={{ background: "#fff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "11px", color: "#db2777", fontWeight: "700" }}>CON THEO MẸ</div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#db2777" }}>{totalPiglets} con</div>
        </div>
        <div onClick={() => setActiveTab("TASKS")} style={{ background: pendingTasks > 0 ? "#fff7ed" : "#fff", padding: "12px", borderRadius: "10px", border: pendingTasks > 0 ? "1px solid #fdba74" : "1px solid #e2e8f0", cursor: "pointer" }}>
          <div style={{ fontSize: "11px", color: pendingTasks > 0 ? "#ea580c" : "#64748b", fontWeight: "700" }}>VIỆC CẦN LÀM</div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: pendingTasks > 0 ? "#ea580c" : "#0f172a" }}>{pendingTasks} việc</div>
        </div>
      </div>

      {/* 4 TAB LIÊN HOÀN */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("HERD")} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", background: activeTab === "HERD" ? "#0f172a" : "#e2e8f0", color: activeTab === "HERD" ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
          <Layers size={15} /> Danh Sách Đàn ({pigs.length})
        </button>
        <button onClick={() => setActiveTab("FARROW")} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", background: activeTab === "FARROW" ? "#0f172a" : "#e2e8f0", color: activeTab === "FARROW" ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
          <Baby size={15} /> Lứa Đẻ Hiện Tại ({farrowings.length})
        </button>
        <button onClick={() => setActiveTab("PENS")} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", background: activeTab === "PENS" ? "#0f172a" : "#e2e8f0", color: activeTab === "PENS" ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
          <Home size={15} /> Danh Mục Chuồng ({pens.length})
        </button>
        <button onClick={() => setActiveTab("TASKS")} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "13px", background: activeTab === "TASKS" ? "#0f172a" : "#e2e8f0", color: activeTab === "TASKS" ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
          <Calendar size={15} /> Nhắc Việc ({pendingTasks})
        </button>
      </div>

      {/* NỘI DUNG TAB 1: DANH SÁCH ĐÀN */}
      {activeTab === "HERD" && (
        <div>
          <div style={{ backgroundColor: "#fff", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
              <input type="text" placeholder="Tìm số tai, giống, chuồng..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }} />
            </div>
            <select value={filterSex} onChange={(e) => setFilterSex(e.target.value)} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}>
              <option value="ALL">Tất cả giới tính</option>
              <option value="FEMALE">Lợn Cái</option>
              <option value="MALE">Lợn Đực</option>
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
            {filteredPigs.map((pig) => {
              const female = isFemale(pig.sex);
              return (
                <div key={pig.id} style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{pig.ear_tag}</span>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{pig.breed_id || "Chưa rõ giống"}</div>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: female ? "#fce7f3" : "#e0f2fe", color: female ? "#be185d" : "#0369a1" }}>
                      {female ? "♀ Cái" : "♂ Đực"}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "8px 0" }}>
                    <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "11px", background: "#f1f5f9", fontWeight: "600" }}>Ô: {pig.current_pen_code || "—"}</span>
                    <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "11px", background: "#ecfdf5", color: "#047857", fontWeight: "600" }}>{pig.stage || "—"}</span>
                    {pig.current_weight_kg && <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "11px", background: "#fffbeb", color: "#b45309", fontWeight: "600" }}>{pig.current_weight_kg} kg</span>}
                  </div>

                  <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", fontSize: "11px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                    <span>Bố: <strong>{pig.sire_ear_tag || "—"}</strong></span>
                    <span>Mẹ: <strong>{pig.dam_ear_tag || "—"}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 2: LỨA ĐẺ HIỆN TẠI (TƯƠNG ĐƯƠNG SHEET LUA_DE_HIEN_TAI) */}
      {activeTab === "FARROW" && (
        <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "16px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>Nhật ký Theo dõi Lứa Đẻ & Nuôi Con</h2>
            <button onClick={() => setShowFarrowModal(true)} style={{ padding: "6px 12px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}>
              + Thêm Lứa Đẻ Mới
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                  <th style={{ padding: "10px" }}>Mã lứa đẻ</th>
                  <th style={{ padding: "10px" }}>Nái đẻ</th>
                  <th style={{ padding: "10px" }}>Ngày đẻ</th>
                  <th style={{ padding: "10px" }}>Tổng sơ sinh</th>
                  <th style={{ padding: "10px" }}>Số sống</th>
                  <th style={{ padding: "10px" }}>TL sơ sinh TB</th>
                  <th style={{ padding: "10px" }}>Dự kiến cai sữa</th>
                  <th style={{ padding: "10px" }}>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {farrowings.map((f) => (
                  <tr key={f.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: "700", color: "#059669" }}>{f.litter_code}</td>
                    <td style={{ padding: "10px", fontWeight: "700" }}>{f.sow_ear_tag}</td>
                    <td style={{ padding: "10px" }}>{f.farrow_date}</td>
                    <td style={{ padding: "10px" }}>{f.total_born} con</td>
                    <td style={{ padding: "10px", fontWeight: "700", color: "#0284c7" }}>{f.alive_born} con</td>
                    <td style={{ padding: "10px" }}>{f.avg_birth_weight} kg</td>
                    <td style={{ padding: "10px", color: "#ea580c", fontWeight: "600" }}>{f.weaning_date}</td>
                    <td style={{ padding: "10px", color: "#64748b" }}>{f.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 3: DANH MỤC CHUỒNG (TƯƠNG ĐƯƠNG SHEET DANH_MUC_CHUONG) */}
      {activeTab === "PENS" && (
        <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "16px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 14px 0" }}>Sơ đồ Ô chuồng & Hiện trạng Trại Nà Roác</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
            {pens.map((pen) => {
              // Tìm những con lợn đang thực tế ở ô này
              const pigsInPen = pigs.filter((p) => p.current_pen_code === pen.pen_code);
              return (
                <div key={pen.pen_code} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", background: pigsInPen.length > 0 ? "#f8fafc" : "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>Ô: {pen.pen_code}</span>
                    <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 6px", borderRadius: "4px", background: "#e2e8f0" }}>{pen.area_zone}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", margin: "4px 0" }}>{pen.pen_function} (Sức chứa: {pen.capacity})</div>
                  <div style={{ marginTop: "8px", borderTop: "1px dashed #cbd5e1", paddingTop: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#334155" }}>
                      Đang nuôi ({pigsInPen.length} con):
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "4px" }}>
                      {pigsInPen.length > 0 ? (
                        pigsInPen.map((p) => (
                          <span key={p.id} style={{ fontSize: "11px", padding: "2px 6px", background: "#dbeafe", color: "#1d4ed8", borderRadius: "4px", fontWeight: "700" }}>
                            {p.ear_tag}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>{pen.current_status || "Ô trống"}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NỘI DUNG TAB 4: LỊCH CÔNG VIỆC TỰ ĐỘNG */}
      {activeTab === "TASKS" && (
        <div style={{ backgroundColor: "#fff", borderRadius: "10px", padding: "16px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 12px 0" }}>Lịch công việc kỹ thuật phát sinh tự động</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {tasks.map((task) => (
              <div key={task.id} onClick={() => toggleTask(task.id, task.is_completed)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", background: task.is_completed ? "#f8fafc" : "#fff", opacity: task.is_completed ? 0.6 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {task.is_completed ? <CheckCircle2 size={16} color="#059669" /> : <Clock size={16} color="#ea580c" />}
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", textDecoration: task.is_completed ? "line-through" : "none" }}>{task.title}</div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Hạn xử lý: <strong>{task.due_date}</strong></div>
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 6px", borderRadius: "4px", background: task.is_completed ? "#e2e8f0" : "#fee2e2", color: task.is_completed ? "#64748b" : "#b91c1c" }}>
                  {task.is_completed ? "Xong" : "Cần làm"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL GHI NHẬN ĐẺ - TỰ ĐỘNG SINH ĐÀN CON */}
      {showFarrowModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 70 }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#059669" }}>Ghi nhận Nái Đẻ & Auto Thêm Đàn Con</h3>
              <X size={20} style={{ cursor: "pointer" }} onClick={() => setShowFarrowModal(false)} />
            </div>

            <form onSubmit={handleSaveFarrowing} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN LỢN NÁI ĐẺ *</label>
                <select required value={farrowSow} onChange={(e) => setFarrowSow(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn nái vừa đẻ --</option>
                  {pigs.filter((p) => isFemale(p.sex)).map((sow) => (
                    <option key={sow.id} value={sow.ear_tag}>
                      {sow.ear_tag} ({sow.breed_id} - Ô: {sow.current_pen_code || "Chưa rõ"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>NGÀY ĐẺ THỰC TẾ</label>
                <input type="date" required value={farrowDate} onChange={(e) => setFarrowDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>TỔNG SƠ SINH (CON)</label>
                  <input type="number" required value={totalBorn} onChange={(e) => setTotalBorn(Number(e.target.value))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>SỐ CON SỐNG (CON) *</label>
                  <input type="number" required value={aliveBorn} onChange={(e) => setAliveBorn(Number(e.target.value))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>TRỌNG LƯỢNG SƠ SINH BÌNH QUÂN (KG)</label>
                <input type="number" step="0.1" value={avgWeight} onChange={(e) => setAvgWeight(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GHI CHÚ THEO DÕI</label>
                <input value={farrowNotes} onChange={(e) => setFarrowNotes(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ padding: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", fontSize: "11px", color: "#166534" }}>
                💡 <strong>Tự động:</strong> Hệ thống sẽ sinh ngay <strong>{aliveBorn} số tai lợn con</strong> vào Tổng đàn, đổi trạng thái Nái sang 'Nuôi con', và tính lịch cai sữa sau 28 ngày!
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowFarrowModal(false)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={savingFarrow} style={{ padding: "8px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", cursor: "pointer", fontWeight: "700" }}>
                  {savingFarrow ? "Đang xử lý..." : "Xác nhận & Tự thêm đàn con"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PHỐI GIỐNG */}
      {showMatingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 70 }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800" }}>Ghi nhận Phối Giống</h3>
              <X size={20} style={{ cursor: "pointer" }} onClick={() => setShowMatingModal(false)} />
            </div>

            <form onSubmit={handleSaveMating} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN LỢN NÁI</label>
                <select required value={selectedSow} onChange={(e) => setSelectedSow(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn nái phối --</option>
                  {pigs.filter((p) => isFemale(p.sex)).map((sow) => (
                    <option key={sow.id} value={sow.ear_tag}>{sow.ear_tag} ({sow.breed_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>CHỌN ĐỰC GIỐNG</label>
                <select required value={selectedBoar} onChange={(e) => setSelectedBoar(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn đực giống --</option>
                  {pigs.filter((p) => isMale(p.sex)).map((boar) => (
                    <option key={boar.id} value={boar.ear_tag}>{boar.ear_tag} ({boar.breed_id})</option>
                  ))}
                </select>
              </div>

              {inbreedingAlert && (
                <div style={{ padding: "8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#b91c1c", fontSize: "11px", display: "flex", gap: "6px", alignItems: "center" }}>
                  <AlertTriangle size={16} /> <span>{inbreedingAlert}</span>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>NGÀY PHỐI GIỐNG</label>
                <input type="date" required value={matingDate} onChange={(e) => setMatingDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={savingMating} style={{ padding: "8px 16px", borderRadius: "6px", background: "#2563eb", color: "#fff", border: "none", cursor: "pointer", fontWeight: "700" }}>
                  {savingMating ? "Đang lưu..." : "Xác nhận Phối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM LỢN LẺ */}
      {showAddPigModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 70 }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800" }}>Thêm Lợn Mới Vào Đàn</h3>
              <X size={20} style={{ cursor: "pointer" }} onClick={() => setShowAddPigModal(false)} />
            </div>

            <form onSubmit={handleAddPig} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>SỐ TAI *</label>
                <input required placeholder="Ví dụ: HL-10..." value={newPig.ear_tag} onChange={(e) => setNewPig({ ...newPig, ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIỐNG</label>
                  <input value={newPig.breed_id} onChange={(e) => setNewPig({ ...newPig, breed_id: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIỚI TÍNH</label>
                  <select value={newPig.sex} onChange={(e) => setNewPig({ ...newPig, sex: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Cái">Lợn Cái</option>
                    <option value="Đực">Lợn Đực</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>GIAI ĐOẠN</label>
                  <input value={newPig.stage} onChange={(e) => setNewPig({ ...newPig, stage: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>Ô CHUỒNG</label>
                  <input value={newPig.current_pen_code} onChange={(e) => setNewPig({ ...newPig, current_pen_code: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={savingPig} style={{ padding: "8px 16px", borderRadius: "6px", background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", fontWeight: "700" }}>
                  {savingPig ? "Đang lưu..." : "Lưu vào đàn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
