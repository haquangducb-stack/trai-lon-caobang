"use client";

import React, { useState } from "react";
import { FarmConfig, AuditLog, UserProfile } from "../types/farm";
import { AdminUserManager } from "./AdminUserManager";
import { SupabaseClient } from "@supabase/supabase-js";

interface SettingsTabProps {
  isAdmin: boolean;
  isLoggedIn: boolean;
  currentUserId?: string;
  allProfiles: UserProfile[];
  supabase: SupabaseClient;
  auditLogs: AuditLog[];
  config: FarmConfig;
  onRefreshProfiles: () => void;
  onLog: (action: string, target: string, details: string) => void;
  onSaveConfig: (cfg: FarmConfig) => void;
  onOpenLogin: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  isAdmin, isLoggedIn, currentUserId, allProfiles, supabase,
  auditLogs, config, onRefreshProfiles, onLog, onSaveConfig, onOpenLogin
}) => {
  const [newBreedInput, setNewBreedInput] = useState("");
  const [newStageInput, setNewStageInput] = useState("");
  const [newPenInput, setNewPenInput] = useState("");

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
      {isAdmin ? (
        <AdminUserManager
          supabase={supabase}
          currentUserId={currentUserId}
          allProfiles={allProfiles}
          onRefresh={onRefreshProfiles}
          onLog={onLog}
        />
      ) : (
        <div style={{ background: "#fff", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1e5f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e1b4b" }}>Quản lý Nhân sự & Phân quyền</div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
              {isLoggedIn ? "Chỉ tài khoản Quản trị viên (Admin) mới có quyền truy cập." : "Vui lòng đăng nhập tài khoản Admin."}
            </div>
          </div>
          {!isLoggedIn && (
            <button onClick={onOpenLogin} style={{ padding: "6px 12px", borderRadius: "8px", background: "#5b21b6", color: "#fff", border: "none", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
              Đăng nhập
            </button>
          )}
        </div>
      )}

      {/* CẤU HÌNH DANH MỤC GIỐNG */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Giống lợn</h4>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {config.breeds.map((b) => (
            <span key={b} style={{ padding: "4px 10px", borderRadius: "20px", background: "#f1f5f9", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
              {b}
              {isLoggedIn && <span onClick={() => onSaveConfig({ ...config, breeds: config.breeds.filter(item => item !== b) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>}
            </span>
          ))}
        </div>
        {isLoggedIn && (
          <div style={{ display: "flex", gap: "8px" }}>
            <input placeholder="Thêm giống mới..." value={newBreedInput} onChange={(e) => setNewBreedInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
            <button onClick={() => { if (newBreedInput.trim() && !config.breeds.includes(newBreedInput.trim())) { onSaveConfig({ ...config, breeds: [...config.breeds, newBreedInput.trim()] }); setNewBreedInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
          </div>
        )}
      </div>

      {/* CẤU HÌNH GIAI ĐOẠN */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Giai đoạn / Trạng thái</h4>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {config.stages.map((st) => (
            <span key={st} style={{ padding: "4px 10px", borderRadius: "20px", background: "#ecfdf5", color: "#047857", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
              {st}
              {isLoggedIn && <span onClick={() => onSaveConfig({ ...config, stages: config.stages.filter(item => item !== st) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>}
            </span>
          ))}
        </div>
        {isLoggedIn && (
          <div style={{ display: "flex", gap: "8px" }}>
            <input placeholder="Thêm trạng thái..." value={newStageInput} onChange={(e) => setNewStageInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
            <button onClick={() => { if (newStageInput.trim() && !config.stages.includes(newStageInput.trim())) { onSaveConfig({ ...config, stages: [...config.stages, newStageInput.trim()] }); setNewStageInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
          </div>
        )}
      </div>

      {/* CẤU HÌNH Ô CHUỒNG */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800" }}>Danh mục Ô Chuồng</h4>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {config.pens.map((pen) => (
            <span key={pen} style={{ padding: "4px 10px", borderRadius: "20px", background: "#eff6ff", color: "#1d4ed8", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
              {pen}
              {isLoggedIn && <span onClick={() => onSaveConfig({ ...config, pens: config.pens.filter(item => item !== pen) })} style={{ cursor: "pointer", color: "#ef4444" }}>✕</span>}
            </span>
          ))}
        </div>
        {isLoggedIn && (
          <div style={{ display: "flex", gap: "8px" }}>
            <input placeholder="Mã ô chuồng..." value={newPenInput} onChange={(e) => setNewPenInput(e.target.value)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }} />
            <button onClick={() => { if (newPenInput.trim() && !config.pens.includes(newPenInput.trim())) { onSaveConfig({ ...config, pens: [...config.pens, newPenInput.trim().toUpperCase()] }); setNewPenInput(""); } }} style={{ padding: "8px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "700" }}>+ Thêm</button>
          </div>
        )}
      </div>

      {/* NHẬT KÝ THAO TÁC */}
      <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #f1e5f0" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: "15px", fontWeight: "800", color: "#1e1b4b" }}>📜 Nhật Ký Gần Đây</h4>
        {auditLogs.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>Chưa có lịch sử thao tác nào.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
            {auditLogs.map((log) => (
              <div key={log.id} style={{ fontSize: "11px", padding: "8px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "700" }}>
                  <span>{log.performed_by}</span>
                  <span>{new Date(log.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={{ color: "#334155", marginTop: "2px" }}>{log.details}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
