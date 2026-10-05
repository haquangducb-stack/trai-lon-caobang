"use client";

import React from "react";
import { Pig, FarmConfig } from "../types/farm";

interface EditPigModalProps {
  pig: Pig;
  config: FarmConfig;
  boarList: Pig[];
  sowList: Pig[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  onChange: (updated: Pig) => void;
}

export const EditPigModal: React.FC<EditPigModalProps> = ({
  pig,
  config,
  boarList,
  sowList,
  isSaving,
  onClose,
  onSave,
  onChange
}) => {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "400px", padding: "20px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "17px", fontWeight: "800" }}>Sửa cá thể: {pig.ear_tag}</h3>
        <form onSubmit={onSave} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "700" }}>Số tai:</label>
            <input required value={pig.ear_tag} onChange={(e) => onChange({ ...pig, ear_tag: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "700" }}>Giống:</label>
              <select value={pig.breed_id || config.breeds[0]} onChange={(e) => onChange({ ...pig, breed_id: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                {config.breeds.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "700" }}>Giới tính:</label>
              <select value={pig.sex || "Cái"} onChange={(e) => onChange({ ...pig, sex: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                <option value="Cái">Cái</option>
                <option value="Đực">Đực</option>
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "700" }}>Trạng thái:</label>
              <select value={pig.stage || config.stages[0]} onChange={(e) => onChange({ ...pig, stage: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                {config.stages.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "700" }}>Chuồng:</label>
              <select value={pig.current_pen_code || config.pens[0]} onChange={(e) => onChange({ ...pig, current_pen_code: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                {config.pens.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: "700" }}>Ghi chú:</label>
            <input value={pig.notes || ""} onChange={(e) => onChange({ ...pig, notes: e.target.value })} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}>Hủy</button>
            <button type="submit" disabled={isSaving} style={{ padding: "6px 14px", borderRadius: "6px", background: "#059669", color: "#fff", border: "none", fontWeight: "700" }}>
              {isSaving ? "Lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
