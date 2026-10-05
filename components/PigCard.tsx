"use client";

import React from "react";
import { Pig } from "../types/farm";

interface PigCardProps {
  pig: Pig;
  isLoggedIn: boolean;
  onEdit: (pig: Pig) => void;
}

export const PigCard: React.FC<PigCardProps> = ({ pig, isLoggedIn, onEdit }) => {
  return (
    <div
      onClick={() => {
        if (!isLoggedIn) {
          alert("Chế độ khách chỉ có quyền xem. Vui lòng đăng nhập để chỉnh sửa!");
          return;
        }
        onEdit(pig);
      }}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        padding: "14px 16px",
        border: "1px solid #f1e5f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        cursor: isLoggedIn ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "18px", fontWeight: "900", color: "#1e1b4b" }}>{pig.ear_tag}</span>
        {isLoggedIn ? (
          <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px", background: "#f3e8ff", color: "#6b21a8" }}>
            Sửa ✎
          </span>
        ) : (
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>Chỉ xem</span>
        )}
      </div>

      <div style={{ fontSize: "13px", color: "#475569" }}>
        Giống: <strong style={{ color: "#0f172a" }}>{pig.breed_id || "—"}</strong>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "2px" }}>
        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#f1f5f9", fontWeight: "600", color: "#334155" }}>
          Ô: {pig.current_pen_code || "Chưa xếp"}
        </span>
        <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "12px", background: "#ecfdf5", color: "#047857", fontWeight: "700" }}>
          {pig.stage || "Bình thường"}
        </span>
      </div>

      <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px", fontSize: "11px", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
        <span>Bố: <strong>{pig.sire_ear_tag || "—"}</strong></span>
        <span>Mẹ: <strong>{pig.dam_ear_tag || "—"}</strong></span>
      </div>
    </div>
  );
};
