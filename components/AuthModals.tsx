"use client";

import React from "react";

interface AuthModalProps {
  show: boolean;
  email: string;
  setEmail: (val: string) => void;
  pass: string;
  setPass: (val: string) => void;
  errorMsg: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const LoginModal: React.FC<AuthModalProps> = ({
  show, email, setEmail, pass, setPass, errorMsg, onClose, onSubmit
}) => {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800" }}>Đăng nhập</h3>
        {errorMsg && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "8px" }}>{errorMsg}</div>}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input type="email" required placeholder="Email..." value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          <input type="password" required placeholder="Mật khẩu..." value={pass} onChange={(e) => setPass(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
            <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#5b21b6", color: "#fff", border: "none", fontWeight: "700" }}>Vào</button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ChangePwdModalProps {
  show: boolean;
  newPass: string;
  setNewPass: (val: string) => void;
  msg: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ChangePasswordModal: React.FC<ChangePwdModalProps> = ({
  show, newPass, setNewPass, msg, onClose, onSubmit
}) => {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 130, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "340px", padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800" }}>Đổi Mật Khẩu</h3>
        {msg && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "8px" }}>{msg}</div>}
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input type="password" required placeholder="Mật khẩu mới (>= 6 ký tự)..." value={newPass} onChange={(e) => setNewPass(e.target.value)} style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
            <button type="submit" style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700" }}>Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
};
