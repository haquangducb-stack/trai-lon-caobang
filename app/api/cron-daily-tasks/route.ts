// 1. Quét song song bảng inseminations VÀ bảng pigs
    const [{ data: inseminations }, { data: pigs }] = await Promise.all([
      supabase.from("inseminations").select("*"),
      supabase.from("pigs").select("ear_tag, stage, current_pen_code")
    ]);

    // Chuẩn hóa số tai (bỏ dấu cách, gạch nối, đưa về chữ thường)
    const normalizeTag = (tag: any) => String(tag || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Lưu trạng thái hiện tại của từng cá thể nái
    const pigStageMap = new Map<string, string>();
    if (Array.isArray(pigs)) {
      pigs.forEach((p: any) => {
        if (p?.ear_tag) {
          pigStageMap.set(normalizeTag(p.ear_tag), String(p.stage || "").toLowerCase());
        }
      });
    }

    const recheckList: string[] = [];
    const farrowSoonList: string[] = [];

    if (Array.isArray(inseminations)) {
      inseminations.forEach((ins: any) => {
        if (!ins?.mating_date || !ins?.sow_ear_tag) return;
        
        const normSowTag = normalizeTag(ins.sow_ear_tag);
        const stage = pigStageMap.get(normSowTag) || "";

        // CHỈ LẤY NÁI HIỆN TẠI ĐANG CHỬA
        // Nếu nái đã chuyển sang Nuôi con (đã đẻ) hoặc Chờ phối -> Loại bỏ ngay
        const isCurrentlyPregnant = stage.includes("chửa") || stage.includes("chua");
        if (!isCurrentlyPregnant) {
          return;
        }

        const mDate = new Date(ins.mating_date).getTime();
        const diffDays = Math.floor((nowVN.getTime() - mDate) / (1000 * 3600 * 24));

        if (diffDays >= 18 && diffDays <= 21) {
          recheckList.push(`• Nái *${ins.sow_ear_tag}*: Ngày ${diffDays}/114 (Đực: ${ins.boar_ear_tag || "—"}) - Kiểm tra phản xạ đứng im!`);
        }

        // Đang chửa và từ 105 đến 114 ngày -> Báo trực đẻ
        if (diffDays >= 105 && diffDays <= 114) {
          farrowSoonList.push(`• Nái *${ins.sow_ear_tag}*: Ngày ${diffDays}/114 - Chuẩn bị chuồng đẻ & trực đẻ!`);
        }
      });
    }
