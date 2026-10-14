"use client";

import React, { useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function FarmSpeciesNav() {
  const router = useRouter();
  const pathname = usePathname();

  let currentSpecies: "PIG" | "CHICKEN" | "DUCK" = "PIG";
  if (pathname.startsWith("/ga")) currentSpecies = "CHICKEN";
  else if (pathname.startsWith("/vit")) currentSpecies = "DUCK";

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 75;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        if (currentSpecies === "PIG") router.push("/ga");
        else if (currentSpecies === "CHICKEN") router.push("/vit");
      } else {
        if (currentSpecies === "DUCK") router.push("/ga");
        else if (currentSpecies === "CHICKEN") router.push("/");
      }
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        background: "#0f172a",
        padding: "8px 12px",
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid #1e293b",
        maxWidth: "480px",
        margin: "0 auto"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span style={{ color: "#94a3b8", fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>
          Hệ Thống Trại Nà Roác
        </span>
        <span style={{ color: "#38bdf8", fontSize: "11px", fontWeight: "700" }}>
          (Vuốt đổi loài ⇄)
        </span>
      </div>

      <div style={{ display: "flex", gap: "6px", background: "rgba(255,255,255,0.06)", padding: "3px", borderRadius: "10px" }}>
        {[
          { id: "PIG", label: "🐖 Trại Lợn", path: "/" },
          { id: "CHICKEN", label: "🐓 Trại Gà", path: "/ga" },
          { id: "DUCK", label: "🦆 Trại Vịt", path: "/vit" }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => router.push(item.path)}
            style={{
              flex: 1,
              padding: "7px 0",
              borderRadius: "8px",
              border: "none",
              fontSize: "12px",
              fontWeight: "900",
              cursor: "pointer",
              background: currentSpecies === item.id ? "#38bdf8" : "transparent",
              color: currentSpecies === item.id ? "#0f172a" : "#cbd5e1",
              transition: "all 0.15s ease"
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
