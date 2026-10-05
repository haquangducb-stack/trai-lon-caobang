"use client";

import React, { useState } from "react";
import { UserProfile } from "../types/farm";
import { SupabaseClient } from "@supabase/supabase-js";

interface AdminUserManagerProps {
  supabase: SupabaseClient;
  currentUserId?: string;
  allProfiles: UserProfile[];
  onRefresh: () => void;
  onLog: (action: string, target: string, details: string) => void;
}

export const AdminUserManager: React.FC<AdminUserManagerProps> = ({
  supabase,
  currentUserId,
  allProfiles,
  onRefresh,
  onLog
}) => {
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newRole, setNewRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [msg, setMsg] = useState("");

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    if (newPassword.length < 6) {
      setMsg("Mật khẩu phải từ 6 ký tự trở lên!");
      return;
    }

    const { data, error } = await supabase.rpc("admin_create_user", {
      new_email: newEmail.trim().toLowerCase(),
      new_password: newPassword.trim(),
      new_full_name: newFullName.trim() || newEmail.split("@")[0],
      new_role: newRole
    });

    if (error) {
      setMsg("Lỗi: " + error.message);
    } else if (data && !data.success) {
      setMsg("Lỗi: " + data.message);
    } else {
      await onLog("CREATE_USER", newEmail, `Admin tạo tài khoản mới quyền ${newRole}`);
      alert("Đã tạo tài khoản nhân viên mới thành công!");
      setShowAddUser(false);
      setNewEmail("");
      setNewPassword("");
      setNewFullName("");
      onRefresh();
    }
  };

  const handleToggleRole = async (target: UserProfile) => {
    const nextRole = target.role === "ADMIN" ? "STAFF" : "ADMIN";
    if (!confirm(`Xác nhận đổi vai trò của ${target.email} thành ${nextRole}?`)) return;

    await supabase.from("user_profiles").update({ role: nextRole }).eq("id", target.id);
    await onLog("UPDATE_ROLE", target.email, `Đổi vai trò thành ${nextRole}`);
    onRefresh();
  };

  const handleToggleBan = async (target: UserProfile) => {
    if (target.id === currentUserId) {
      alert("Không thể tự khóa tài khoản của chính mình!");
      return;
    }
    const nextStatus = !target.is_active;
    const actionName = nextStatus ? "Mở khóa" : "Khóa (Ban)";
    if (!confirm(`Xác nhận ${actionName} tài khoản ${target.email}?`)) return;

    await supabase.from("user_profiles").update({ is_active: nextStatus }).eq("id", target.id);
    await onLog("BAN_USER", target.email, `${actionName} tài khoản`);
    onRefresh();
  };

  return (
    <div style={{ background: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #fed7aa" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "900", color: "#c2410c" }}>
          👑 Quản Lý Nhân Sự & Tài Khoản
        </h4>
        <button
          onClick={() => setShowAddUser(!showAddUser)}
          style={{ padding: "5px 10px", borderRadius: "8px", background: "#ea580c", color: "#fff", border: "none", fontSize: "11px", fontWeight: "800", cursor: "pointer" }}
        >
          {showAddUser ? "Đóng Form" : "+ Thêm Nhân Viên"}
        </button>
      </div>

      {showAddUser && (
        <form onSubmit={handleCreateUser} style={{ background: "#fff7ed", padding: "12px", borderRadius: "10px", marginBottom: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "12px", fontWeight: "800", color: "#9a3412" }}>CẤP TÀI KHOẢN MỚI TRỰC TIẾP</div>
          {msg && <div style={{ fontSize: "11px", color: "#ef4444" }}>{msg}</div>}
          <input
            type="email"
            required
            placeholder="Email nhân viên (VD: kithuat@gmail.com)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }}
          />
          <input
            type="text"
            placeholder="Họ và tên nhân viên (tùy chọn)"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }}
          />
          <input
            type="password"
            required
            placeholder="Mật khẩu ban đầu (từ 6 ký tự)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "12px", fontWeight: "700" }}>Vai trò:</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              style={{ padding: "6px", borderRadius: "6px", border: "1px solid #fdba74", fontSize: "12px" }}
            >
              <option value="STAFF">Kỹ thuật viên (Staff)</option>
              <option value="ADMIN">Quản trị viên (Admin)</option>
            </select>
            <button type="submit" style={{ marginLeft: "auto", padding: "7px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "800", fontSize: "12px", cursor: "pointer" }}>
              Tạo Ngay
            </button>
          </div>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {allProfiles.map((p) => (
          <div key={p.id} style={{ padding: "10px", borderRadius: "8px", background: p.is_active ? "#f8fafc" : "#fef2f2", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>
                {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                {!p.is_active && <span style={{ marginLeft: "6px", color: "#ef4444", fontSize: "11px" }}>[BỊ KHÓA]</span>}
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                Quyền: <strong style={{ color: p.role === "ADMIN" ? "#b45309" : "#0369a1" }}>{p.role}</strong>
              </div>
            </div>

            {p.id !== currentUserId && (
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => handleToggleRole(p)}
                  style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                >
                  {p.role === "ADMIN" ? "Hạ Staff" : "Lên Admin"}
                </button>
                <button
                  onClick={() => handleToggleBan(p)}
                  style={{ padding: "4px 8px", borderRadius: "6px", border: "none", background: p.is_active ? "#ef4444" : "#10b981", color: "#fff", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                >
                  {p.is_active ? "Khóa" : "Mở"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
