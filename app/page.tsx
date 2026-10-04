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
  notes?: string;
}

interface FarmTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  related_tag: string;
  is_completed: boolean;
}

export default function FarmApp() {
  const [pigs, setPigs] = useState<Pig[]>([]);
  const [tasks, setTasks] = useState<FarmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"HERD" | "TASKS">("HERD");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSex, setFilterSex] = useState<string>("ALL");
  const [filterStage, setFilterStage] = useState<string>("ALL");

  // Modals
  const [showMatingModal, setShowMatingModal] = useState(false);
  const [showAddPigModal, setShowAddPigModal] = useState(false);

  // Mating Form
  const [selectedSow, setSelectedSow] = useState("");
  const [selectedBoar, setSelectedBoar] = useState("");
  const [matingDate, setMatingDate] = useState(new Date().toISOString().split("T")[0]);
  const [inbreedingAlert, setInbreedingAlert] = useState<string | null>(null);
  const [savingMating, setSavingMating] = useState(false);

  // New Pig Form
  const [newPig, setNewPig] = useState({
    ear_tag: "",
    breed_id: "Hạ Lang",
    sex: "Cái",
    stage: "Hậu bị",
    current_pen_code: "",
    current_weight_kg: "",
    sire_ear_tag: "",
    dam_ear_tag: "",
  });
  const [savingPig, setSavingPig] = useState(false);

  // Kết nối Supabase và tự dọn sạch URL nếu thừa đuôi
  const supabase = useMemo(() => {
    let rawUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://eqlegigaftimjdmyuofg.supabase.co";
    rawUrl = rawUrl.trim().replace(/\/rest(\/v1)?\/?$/, "").replace(/\/+$/, "");

    const rawKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";

    return createClient(rawUrl, rawKey.trim());
  }, []);

  // Nhận diện chuẩn xác tuyệt đối: Phân loại nhị phân không trùng lặp
  const isFemale = (sexStr: string) => {
    if (!sexStr) return false;
    const s = sexStr.trim().toLowerCase();
    // Chấp nhận: cái, nái, female, f, c (viết tắt Cái)
    return s.includes("cái") || s.includes("cai") || s.includes("nái") || s === "female" || s === "f" || s === "c";
  };

  const isMale = (sexStr: string) => {
    if (!sexStr) return false;
    // Không phải cái thì xét đực: đực, duc, male, m, d (viết tắt Đực)
    if (isFemale(sexStr)) return false; // Tuyệt đối loại trừ nếu đã là cái!
    const s = sexStr.trim().toLowerCase();
    return s.includes("đực") || s.includes("duc") || s === "male" || s === "m" || s === "d" || s.includes("boar");
  };

  const isFemale = (sex: string) => getCleanSex(sex) === "FEMALE";
  const isMale = (sex: string) => getCleanSex(sex) === "MALE";

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: pigData } = await supabase
        .from("pigs")
        .select("*")
        .order("created_at", { ascending: false });
      if (pigData) setPigs(pigData);

      const { data: taskData } = await supabase
        .from("farm_tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (taskData) setTasks(taskData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  // Kiểm tra trùng huyết / cận huyết khi chọn bố mẹ
  useEffect(() => {
    if (!selectedSow || !selectedBoar) {
      setInbreedingAlert(null);
      return;
    }

    const sow = pigs.find((p) => p.ear_tag === selectedSow);
    const boar = pigs.find((p) => p.ear_tag === selectedBoar);

    if (sow && boar) {
      if (sow.sire_ear_tag && sow.sire_ear_tag === boar.ear_tag) {
        setInbreedingAlert("CẢNH BÁO NGUY HIỂM: Đực giống chính là BỐ của con Nái này!");
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

  // Ghi nhận phối giống
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

      // Tự sinh nhắc việc kiểm tra lốc sau 21 ngày
      const task21 = new Date(matingDate);
      task21.setDate(task21.getDate() + 21);
      await supabase.from("farm_tasks").insert([
        {
          title: `Kiểm tra động dục lại (Lốc) - Nái ${selectedSow}`,
          due_date: task21.toISOString().split("T")[0],
          priority: "HIGH",
          related_tag: selectedSow,
        },
        {
          title: `Chuẩn bị ổ đẻ & đỡ đẻ - Nái ${selectedSow}`,
          due_date: expectedFarrow,
          priority: "HIGH",
          related_tag: selectedSow,
        }
      ]);

      alert(`Phối giống thành công!\n- Ngày dự đẻ: ${expectedFarrow}\n- Đã tạo lịch kiểm tra thai sau 21 ngày.`);
      setShowMatingModal(false);
      setSelectedSow("");
      setSelectedBoar("");
      fetchData();
    } else {
      alert("Lỗi khi lưu: " + insemError.message);
    }
    setSavingMating(false);
  };

  // Thêm cá thể mới trực tiếp
  const handleAddPig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPig.ear_tag.trim()) {
      alert("Vui lòng nhập số tai!");
      return;
    }

    setSavingPig(true);
    const { error } = await supabase.from("pigs").insert([
      {
        ear_tag: newPig.ear_tag.trim(),
        breed_id: newPig.breed_id.trim(),
        sex: newPig.sex,
        stage: newPig.stage,
        current_pen_code: newPig.current_pen_code.trim(),
        current_weight_kg: newPig.current_weight_kg ? parseFloat(newPig.current_weight_kg) : null,
        sire_ear_tag: newPig.sire_ear_tag.trim() || null,
        dam_ear_tag: newPig.dam_ear_tag.trim() || null,
        status: "ACTIVE",
      },
    ]);

    if (error) {
      alert("Lỗi: " + error.message);
    } else {
      alert(`Đã thêm thành công cá thể ${newPig.ear_tag}!`);
      setShowAddPigModal(false);
      setNewPig({
        ear_tag: "",
        breed_id: "Hạ Lang",
        sex: "Cái",
        stage: "Hậu bị",
        current_pen_code: "",
        current_weight_kg: "",
        sire_ear_tag: "",
        dam_ear_tag: "",
      });
      fetchData();
    }
    setSavingPig(false);
  };

  // Hoàn thành công việc
  const toggleTaskComplete = async (taskId: string, currentStatus: boolean) => {
    await supabase.from("farm_tasks").update({ is_completed: !currentStatus }).eq("id", taskId);
    fetchData();
  };

  // Thống kê chuẩn xác
  const totalPigs = pigs.length;
  const totalSows = pigs.filter((p) => isFemale(p.sex)).length;
  const totalBoars = pigs.filter((p) => isMale(p.sex)).length;
  const totalPregnant = pigs.filter((p) => {
    const st = (p.stage || "").toLowerCase();
    return st.includes("chửa") || st.includes("phối");
  }).length;
  const pendingTasks = tasks.filter((t) => !t.is_completed).length;

  // Lọc cá thể
  const filteredPigs = pigs.filter((pig) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      pig.ear_tag?.toLowerCase().includes(s) ||
      pig.breed_id?.toLowerCase().includes(s) ||
      pig.current_pen_code?.toLowerCase().includes(s);

    let matchSex = true;
    if (filterSex === "FEMALE") matchSex = isFemale(pig.sex);
    if (filterSex === "MALE") matchSex = isMale(pig.sex);

    let matchStage = true;
    if (filterStage !== "ALL") {
      matchStage = (pig.stage || "").toLowerCase().includes(filterStage.toLowerCase());
    }

    return matchSearch && matchSex && matchStage;
  });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      
      {/* Thanh đầu trang */}
      <header style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>🐖</span>
            <h1 style={{ fontSize: "20px", fontWeight: "800", margin: 0, color: "#0f172a" }}>
              Trại Sản Xuất Nông Nghiệp Nà Roác
            </h1>
          </div>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "13px" }}>
            Trung tâm Khuyến nông & Giống nông lâm nghiệp Cao Bằng
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={fetchData}
            style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600" }}
          >
            <RefreshCw size={15} /> Làm mới
          </button>
          <button
            onClick={() => setShowAddPigModal(true)}
            style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#f1f5f9", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700", color: "#334155" }}
          >
            <Plus size={16} /> Thêm Lợn
          </button>
          <button
            onClick={() => setShowMatingModal(true)}
            style={{ padding: "8px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", boxShadow: "0 2px 4px rgba(5,150,105,0.2)" }}
          >
            <HeartHandshake size={16} /> Phối Giống
          </button>
        </div>
      </header>

      {/* Thẻ Thống kê Tổng quan */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>TỔNG ĐÀN</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>{totalPigs} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#94a3b8" }}>con</span></div>
        </div>
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#059669", fontWeight: "600" }}>LỢN NÁI / HẬU BỊ</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#059669", marginTop: "4px" }}>{totalSows} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#94a3b8" }}>con</span></div>
        </div>
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#2563eb", fontWeight: "600" }}>NÁI CHỬA / PHỐI</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#2563eb", marginTop: "4px" }}>{totalPregnant} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#94a3b8" }}>con</span></div>
        </div>
        <div style={{ background: "#ffffff", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#d97706", fontWeight: "600" }}>ĐỰC GIỐNG</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#d97706", marginTop: "4px" }}>{totalBoars} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#94a3b8" }}>con</span></div>
        </div>
        <div 
          onClick={() => setActiveTab("TASKS")}
          style={{ background: pendingTasks > 0 ? "#fff7ed" : "#ffffff", padding: "14px", borderRadius: "10px", border: pendingTasks > 0 ? "1px solid #fed7aa" : "1px solid #e2e8f0", cursor: "pointer" }}
        >
          <div style={{ fontSize: "12px", color: pendingTasks > 0 ? "#ea580c" : "#64748b", fontWeight: "700" }}>LỊCH CẦN LÀM</div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: pendingTasks > 0 ? "#ea580c" : "#0f172a", marginTop: "4px" }}>{pendingTasks} <span style={{ fontSize: "13px", fontWeight: "normal", color: "#94a3b8" }}>việc</span></div>
        </div>
      </div>

      {/* Tabs Chuyển đổi */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          onClick={() => setActiveTab("HERD")}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "14px", background: activeTab === "HERD" ? "#0f172a" : "#e2e8f0", color: activeTab === "HERD" ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Layers size={16} /> Danh sách đàn ({filteredPigs.length})
        </button>
        <button
          onClick={() => setActiveTab("TASKS")}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontWeight: "700", fontSize: "14px", background: activeTab === "TASKS" ? "#0f172a" : "#e2e8f0", color: activeTab === "TASKS" ? "#fff" : "#475569", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <Calendar size={16} /> Lịch khám thai & Đẻ ({pendingTasks})
        </button>
      </div>

      {/* NỘI DUNG TAB 1: DANH SÁCH ĐÀN */}
      {activeTab === "HERD" && (
        <div>
          {/* Bộ lọc tiện ích */}
          <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <Search size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Tìm số tai, giống, chuồng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={filterSex}
              onChange={(e) => setFilterSex(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "#fff" }}
            >
              <option value="ALL">Tất cả giới tính</option>
              <option value="FEMALE">Lợn Cái</option>
              <option value="MALE">Lợn Đực</option>
            </select>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "#fff" }}
            >
              <option value="ALL">Tất cả giai đoạn</option>
              <option value="Hậu bị">Hậu bị</option>
              <option value="chửa">Đang chửa</option>
              <option value="phối">Đã phối</option>
              <option value="Đực giống">Đực giống</option>
            </select>
          </div>

          {/* Danh sách cá thể: Dạng Grid Card trên điện thoại & máy tính */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>Đang tải dữ liệu từ đàn...</div>
          ) : filteredPigs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", backgroundColor: "#fff", borderRadius: "10px", border: "1px dashed #cbd5e1" }}>
              Không tìm thấy cá thể nào phù hợp.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {filteredPigs.map((pig) => {
                const female = isFemale(pig.sex);
                return (
                  <div key={pig.id} style={{ backgroundColor: "#ffffff", borderRadius: "10px", padding: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", position: "relative" }}>
                    
                    {/* Hàng 1: Số tai và Giới tính */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <span style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
                          {pig.ear_tag}
                        </span>
                        <div style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>
                          {pig.breed_id || "Chưa rõ giống"}
                        </div>
                      </div>

                      <span style={{
                        padding: "3px 8px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: "700",
                        backgroundColor: female ? "#fce7f3" : "#e0f2fe",
                        color: female ? "#be185d" : "#0369a1"
                      }}>
                        {female ? "♀ LỢN CÁI" : "♂ LỢN ĐỰC"} ({pig.sex})
                      </span>
                    </div>

                    {/* Hàng 2: Trạng thái & Chuồng */}
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "8px 0" }}>
                      <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", backgroundColor: "#f1f5f9", color: "#334155" }}>
                        Chuồng: {pig.current_pen_code || "Chưa xếp"}
                      </span>
                      {pig.stage && (
                        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", backgroundColor: "#ecfdf5", color: "#047857" }}>
                          {pig.stage}
                        </span>
                      )}
                      {pig.current_weight_kg && (
                        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "600", backgroundColor: "#fffbeb", color: "#b45309" }}>
                          {pig.current_weight_kg} kg
                        </span>
                      )}
                    </div>

                    {/* Hàng 3: Phả hệ Bố Mẹ */}
                    <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "8px", marginTop: "8px", fontSize: "12px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                      <span>Bố: <strong style={{ color: "#334155" }}>{pig.sire_ear_tag || "—"}</strong></span>
                      <span>Mẹ: <strong style={{ color: "#334155" }}>{pig.dam_ear_tag || "—"}</strong></span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* NỘI DUNG TAB 2: LỊCH CÔNG VIỆC TỰ ĐỘNG */}
      {activeTab === "TASKS" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "10px", padding: "16px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "0 0 12px 0" }}>
            Lịch nhắc kỹ thuật (Thử lốc sau 21 ngày & Đỡ đẻ 114 ngày)
          </h2>
          {tasks.length === 0 ? (
            <p style={{ color: "#94a3b8", textAlign: "center", padding: "20px" }}>Chưa có công việc nào. Khi bạn ghi nhận phối giống, hệ thống sẽ tự động tạo lịch nhắc ở đây!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleTaskComplete(task.id, task.is_completed)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: task.is_completed ? "#f8fafc" : "#ffffff",
                    cursor: "pointer",
                    opacity: task.is_completed ? 0.6 : 1
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {task.is_completed ? (
                      <CheckCircle2 size={18} color="#059669" />
                    ) : (
                      <Clock size={18} color="#ea580c" />
                    )}
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", textDecoration: task.is_completed ? "line-through" : "none" }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Hạn xử lý: <strong style={{ color: "#0f172a" }}>{task.due_date}</strong> {task.related_tag && `(Số tai: ${task.related_tag})`}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px", backgroundColor: task.is_completed ? "#e2e8f0" : "#fee2e2", color: task.is_completed ? "#64748b" : "#b91c1c" }}>
                    {task.is_completed ? "ĐÃ XONG" : "CẦN LÀM"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: GHI NHẬN PHỐI GIỐNG */}
      {showMatingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 60 }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "420px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Ghi nhận Phối Giống</h3>
              <X size={20} style={{ cursor: "pointer" }} onClick={() => setShowMatingModal(false)} />
            </div>

            <form onSubmit={handleSaveMating} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>CHỌN LỢN NÁI</label>
                <select required value={selectedSow} onChange={(e) => setSelectedSow(e.target.value)} style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn lợn nái --</option>
                  {pigs.filter((p) => isFemale(p.sex)).map((sow) => (
                    <option key={sow.id} value={sow.ear_tag}>
                      {sow.ear_tag} ({sow.breed_id || "Nái"} - Ô: {sow.current_pen_code || "Chưa rõ"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>CHỌN ĐỰC GIỐNG</label>
                <select required value={selectedBoar} onChange={(e) => setSelectedBoar(e.target.value)} style={{ width: "100%", padding: "9px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">-- Chọn đực giống --</option>
                  {pigs.filter((p) => isMale(p.sex)).map((boar) => (
                    <option key={boar.id} value={boar.ear_tag}>
                      {boar.ear_tag} ({boar.breed_id || "Đực"})
                    </option>
                  ))}
                </select>
              </div>

              {inbreedingAlert && (
                <div style={{ padding: "10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#b91c1c", fontSize: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <AlertTriangle size={18} />
                  <span>{inbreedingAlert}</span>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>NGÀY PHỐI GIỐNG</label>
                <input type="date" required value={matingDate} onChange={(e) => setMatingDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button type="button" onClick={() => setShowMatingModal(false)} style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={savingMating} style={{ padding: "8px 16px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", cursor: "pointer", fontWeight: "700" }}>
                  {savingMating ? "Đang lưu..." : "Xác nhận Phối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: THÊM CÁ THỂ MỚI TRỰC TIẾP */}
      {showAddPigModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 60 }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", width: "100%", maxWidth: "440px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Thêm Lợn Mới Vào Đàn</h3>
              <X size={20} style={{ cursor: "pointer" }} onClick={() => setShowAddPigModal(false)} />
            </div>

            <form onSubmit={handleAddPig} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>SỐ TAI *</label>
                <input required placeholder="Ví dụ: HL-15, MC-09..." value={newPig.ear_tag} onChange={(e) => setNewPig({ ...newPig, ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>GIỐNG LỢN</label>
                  <input placeholder="Hạ Lang, Móng Cái..." value={newPig.breed_id} onChange={(e) => setNewPig({ ...newPig, breed_id: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>GIỚI TÍNH</label>
                  <select value={newPig.sex} onChange={(e) => setNewPig({ ...newPig, sex: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="Cái">Lợn Cái</option>
                    <option value="Đực">Lợn Đực</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>GIAI ĐOẠN</label>
                  <input placeholder="Hậu bị, Đang chửa..." value={newPig.stage} onChange={(e) => setNewPig({ ...newPig, stage: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>CHUỒNG / Ô</label>
                  <input placeholder="Ô A1, Chuồng đực..." value={newPig.current_pen_code} onChange={(e) => setNewPig({ ...newPig, current_pen_code: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>CÂN NẶNG (KG)</label>
                <input type="number" step="0.5" placeholder="Ví dụ: 85" value={newPig.current_weight_kg} onChange={(e) => setNewPig({ ...newPig, current_weight_kg: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>SỐ TAI BỐ (NẾU CÓ)</label>
                  <input placeholder="Số tai đực bố" value={newPig.sire_ear_tag} onChange={(e) => setNewPig({ ...newPig, sire_ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>SỐ TAI MẸ (NẾU CÓ)</label>
                  <input placeholder="Số tai nái mẹ" value={newPig.dam_ear_tag} onChange={(e) => setNewPig({ ...newPig, dam_ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button type="button" onClick={() => setShowAddPigModal(false)} style={{ padding: "8px 14px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff", cursor: "pointer" }}>Hủy</button>
                <button type="submit" disabled={savingPig} style={{ padding: "8px 16px", borderRadius: "6px", background: "#0f172a", color: "#fff", border: "none", cursor: "pointer", fontWeight: "700" }}>
                  {savingPig ? "Đang lưu..." : "Lưu vào Đàn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
