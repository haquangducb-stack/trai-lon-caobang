{/* MODAL XEM CHI TIẾT & CHỌN HÀNG LOẠT LỢN CON */}
      {viewingLitter && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 125, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "440px", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: "18px" }}>
            
            {/* TIÊU ĐỀ & ĐÓNG */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px", marginBottom: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#1e1b4b" }}>
                  Lô nái {viewingLitter.sow_ear_tag} ({viewingLitter.alive_born} con)
                </h3>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Mã lô: {viewingLitter.litter_code} • Ngày đẻ: {formatDateVN(viewingLitter.farrow_date)}</span>
              </div>
              <button onClick={() => { setViewingLitter(null); setSelectedPigletTags([]); }} style={{ border: "none", background: "#f1f5f9", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontWeight: "900" }}>✕</button>
            </div>

            {/* THANH THAO TÁC CHỌN TẤT CẢ & XUẤT HÀNG LOẠT */}
            {user && (
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "800", color: "#1e293b", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedPigletTags.length > 0 && selectedPigletTags.length === Number(viewingLitter.alive_born || 0)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allTags = Array.from({ length: Number(viewingLitter.alive_born || 0) }).map(
                            (_, idx) => `${viewingLitter.sow_ear_tag}-C${String(idx + 1).padStart(2, "0")}`
                          );
                          setSelectedPigletTags(allTags);
                        } else {
                          setSelectedPigletTags([]);
                        }
                      }}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <span>Chọn tất cả ({viewingLitter.alive_born} con)</span>
                  </label>

                  <span style={{ fontSize: "11px", fontWeight: "800", color: selectedPigletTags.length > 0 ? "#2563eb" : "#64748b" }}>
                    Đã chọn: {selectedPigletTags.length} con
                  </span>
                </div>

                {/* CÁC NÚT BẤM HÀNG LOẠT */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleBulkAction("Xuất bán")}
                    disabled={selectedPigletTags.length === 0}
                    style={{
                      flex: 1.2, padding: "8px 6px", borderRadius: "8px", border: "none",
                      background: selectedPigletTags.length > 0 ? "#0284c7" : "#cbd5e1",
                      color: "#fff", fontSize: "11px", fontWeight: "800",
                      cursor: selectedPigletTags.length > 0 ? "pointer" : "not-allowed"
                    }}
                  >
                    🏷️ Xuất bán ({selectedPigletTags.length})
                  </button>

                  <button
                    onClick={() => handleBulkAction("Vỗ béo thịt")}
                    disabled={selectedPigletTags.length === 0}
                    style={{
                      flex: 1, padding: "8px 6px", borderRadius: "8px", border: "none",
                      background: selectedPigletTags.length > 0 ? "#854d0e" : "#cbd5e1",
                      color: "#fff", fontSize: "11px", fontWeight: "800",
                      cursor: selectedPigletTags.length > 0 ? "pointer" : "not-allowed"
                    }}
                  >
                    🥩 Nuôi thịt
                  </button>

                  <button
                    onClick={() => handleBulkAction("Hậu bị")}
                    disabled={selectedPigletTags.length === 0}
                    style={{
                      flex: 1, padding: "8px 6px", borderRadius: "8px", border: "none",
                      background: selectedPigletTags.length > 0 ? "#db2777" : "#cbd5e1",
                      color: "#fff", fontSize: "11px", fontWeight: "800",
                      cursor: selectedPigletTags.length > 0 ? "pointer" : "not-allowed"
                    }}
                  >
                    🐖 Hậu bị
                  </button>
                </div>
              </div>
            )}

            {/* DANH SÁCH CON CÓ CHECKBOX TỪNG CON */}
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px" }}>
              {Array.from({ length: Number(viewingLitter.alive_born || 0) }).map((_, idx) => {
                const pigletTag = `${viewingLitter.sow_ear_tag}-C${String(idx + 1).padStart(2, "0")}`;
                const isChecked = selectedPigletTags.includes(pigletTag);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!user) return;
                      setSelectedPigletTags(prev =>
                        prev.includes(pigletTag) ? prev.filter(t => t !== pigletTag) : [...prev, pigletTag]
                      );
                    }}
                    style={{
                      background: isChecked ? "#eff6ff" : "#f8fafc",
                      borderRadius: "8px", padding: "8px 10px",
                      border: isChecked ? "1.5px solid #3b82f6" : "1px solid #e2e8f0",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      cursor: user ? "pointer" : "default"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {user && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Đã xử lý ở onClick cấp div
                          style={{ width: "16px", height: "16px", cursor: "pointer" }}
                        />
                      )}
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: "900", color: isChecked ? "#1d4ed8" : "#0f172a" }}>
                          {pigletTag}
                        </div>
                        <div style={{ fontSize: "10px", color: "#64748b" }}>Mẹ: <strong>{viewingLitter.sow_ear_tag}</strong></div>
                      </div>
                    </div>

                    <span style={{ fontSize: "11px", fontWeight: "700", color: isChecked ? "#2563eb" : "#94a3b8" }}>
                      {isChecked ? "✓ Đã chọn" : "Bấm để chọn"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "10px", textAlign: "right" }}>
              <button onClick={() => { setViewingLitter(null); setSelectedPigletTags([]); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
