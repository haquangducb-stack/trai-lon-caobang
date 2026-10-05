"use client";

import React from "react";
import { FarrowingLitter, Pig } from "../types/farm";

interface PigletTabProps {
  activeLitters: FarrowingLitter[];
  totalPigletsCount: number;
  pigs: Pig[];
  isLoggedIn: boolean;
  onWean: (litter: FarrowingLitter) => void;
}

export const PigletTab: React.FC<PigletTabProps> = ({
  activeLitters,
  totalPigletsCount,
  pigs,
  isLoggedIn,
  onWean
}) => {
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: "14px", fontWeight: "800", color: "#16a34a", marginBottom: "12px" }}>
        ĐANG NUÔI: {activeLitters.length} LÔ ({totalPigletsCount} CON)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {activeLitters.map((lit) => {
          const sow = pigs.find((p) => p.ear_tag === lit.sow_ear_tag);
          const ageDays = Math.floor((new Date().getTime() - new Date(lit.farrow_date).getTime()) / (1000 * 3600 * 24));
          const isReadyWean = ageDays >= 24;
          return (
            <div key={lit.id} style={{ backgroundColor: "#fff", borderRadius: "14px", padding: "16px", border: isReadyWean ? "1px solid #fed7aa" : "1px solid #f1e5f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "17px", fontWeight: "900" }}>Lô nái {lit.sow_ear_tag} ({lit.litter_code})</span>
                <span style={{ padding: "3px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "800", backgroundColor: "#ecfdf5", color: "#047857" }}>{lit.alive_born} con</span>
              </div>
              <div style={{ margin: "8px 0", fontSize: "12px", color: isReadyWean ? "#ea580c" : "#64748b", fontWeight: "700" }}>
                Chuồng: {sow?.current_pen_code || "—"} | {ageDays} ngày tuổi {isReadyWean && "🔔 (Đến hạn cai sữa)"}
              </div>
              {isLoggedIn && (
                <button onClick={() => onWean(lit)} style={{ width: "100%", padding: "9px", borderRadius: "8px", border: "none", backgroundColor: isReadyWean ? "#ea580c" : "#0f172a", color: "#fff", fontSize: "13px", fontWeight: "800", cursor: "pointer" }}>
                  ✓ Xác nhận Cai sữa đàn này
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
