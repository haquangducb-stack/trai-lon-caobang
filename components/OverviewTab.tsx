"use client";

import React from "react";
import { FarmTask } from "../types/farm";

interface OverviewTabProps {
  totalCount: number;
  sowCount: number;
  sowChua: number;
  sowNuoiCon: number;
  sowChoPhoi: number;
  boarCount: number;
  totalPigletsCount: number;
  activeLittersCount: number;
  meatCount: number;
  filteredTasks: FarmTask[];
  taskCategoryFilter: string;
  setTaskCategoryFilter: (filter: string) => void;
  onNavigate: (tab: any, sub?: string) => void;
  onToggleTask: (task: FarmTask) => void;
  isLoggedIn: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  totalCount, sowCount, sowChua, sowNuoiCon, sowChoPhoi,
  boarCount, totalPigletsCount, activeLittersCount, meatCount,
  filteredTasks, taskCategoryFilter, setTaskCategoryFilter,
  onNavigate, onToggleTask, isLoggedIn
}) => {
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ backgroundColor: "#eae7ec", borderRadius: "14px", padding: "16px 18px", marginBottom: "12px" }}>
        <span style={{ fontSize: "20px", fontWeight: "900", color: "#1e1b4b" }}>TỔNG ĐÀN: {totalCount} con</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "22px" }}>
        <div onClick={() => onNavigate("SOW", "ALL")} style={{ backgroundColor: "#fdf2f4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#db2777" }}>NÁI</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#e11d48", margin: "2px 0" }}>{sowCount} con</div>
          <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
            <div>• Chửa: <strong>{sowChua}</strong></div>
            <div>• Nuôi con: <strong>{sowNuoiCon}</strong></div>
            <div>• Chờ phối: <strong>{sowChoPhoi}</strong></div>
          </div>
        </div>

        <div onClick={() => onNavigate("BOAR", "ALL")} style={{ backgroundColor: "#f0f5ff", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#2563eb" }}>ĐỰC GIỐNG</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb", margin: "2px 0" }}>{boarCount} con</div>
          <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
            <div>• Đang khai thác tinh</div>
          </div>
        </div>

        <div onClick={() => onNavigate("PIGLET")} style={{ backgroundColor: "#f0fdf4", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a" }}>LỢN CON</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#16a34a", margin: "2px 0" }}>{totalPigletsCount} con</div>
          <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
            <div>• Theo {activeLittersCount} lô mẹ</div>
            <div>• Đang bú sữa</div>
          </div>
        </div>

        <div onClick={() => onNavigate("MEAT")} style={{ backgroundColor: "#f6f1f2", borderRadius: "16px", padding: "14px", cursor: "pointer" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#854d0e" }}>LỢN THỊT</div>
          <div style={{ fontSize: "24px", fontWeight: "900", color: "#854d0e", margin: "2px 0" }}>{meatCount} con</div>
          <div style={{ fontSize: "11px", color: "#475569", lineHeight: "1.6" }}>
            <div>• Đang vỗ béo</div>
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: "16px", fontWeight: "900", color: "#1e1b4b", margin: "0 0 8px 0" }}>
          LỊCH KỸ THUẬT & VIỆC CẦN LÀM ({filteredTasks.filter(t => !t.is_completed).length})
        </h3>
        <div style={{ display: "flex", gap: "6px", marginBottom: "12px", overflowX: "auto" }}>
          {[{ id: "ALL", label: "Tất cả" }, { id: "REPRO", label: "Sinh sản" }, { id: "VET", label: "Thú y" }, { id: "WEAN", label: "Cai sữa" }].map((tab) => (
            <button key={tab.id} onClick={() => setTaskCategoryFilter(tab.id)} style={{ padding: "6px 10px", borderRadius: "16px", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer", backgroundColor: taskCategoryFilter === tab.id ? "#5b21b6" : "#e2e8f0", color: taskCategoryFilter === tab.id ? "#fff" : "#475569" }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredTasks.map((task) => (
            <div key={task.id} onClick={() => onToggleTask(task)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: isLoggedIn ? "pointer" : "not-allowed", background: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "#fef2f2" : "#fff", padding: "10px 14px", borderRadius: "10px", border: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "1px solid #fecaca" : "1px solid #f1e5f0" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: task.title.includes("QUÁ HẠN") || task.title.includes("TRỰC ĐẺ") ? "#b91c1c" : "#1e1b4b", textDecoration: task.is_completed ? "line-through" : "none" }}>{task.title}</div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Hạn: <strong>{task.due_date}</strong> {task.related_tag && `(Tai: ${task.related_tag})`}</div>
              </div>
              <div style={{ fontSize: "20px" }}>{task.is_completed ? "🟢" : "⚪"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
