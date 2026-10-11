// 1. Quét song song cả 3 bảng: inseminations, pigs và farrowings
    const [{ data: inseminations }, { data: pigs }, { data: farrowings }] = await Promise.all([
      supabase.from("inseminations").select("*"),
      supabase.from("pigs").select("ear_tag, stage, current_pen_code"),
      supabase.from("farrowings").select("sow_ear_tag, status, notes")
    ]);

    // Hàm chuẩn hóa chuỗi số tai (bỏ gạch nối, dấu cách, đưa về chữ thường)
    const normalizeTag = (tag: any) => String(tag || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Tập hợp các số tai nái ĐÃ ĐẺ (dựa vào bảng farrowings)
    const farrowedTags = new Set<string>();
    if (Array.isArray(farrowings)) {
      farrowings.forEach((f: any) => {
        if (f?.sow_ear_tag) {
          farrowedTags.add(normalizeTag(f.sow_ear_tag));
        }
      });
    }

    // Bản đồ nái từ bảng pigs
    const pigMap = new Map<string, any>();
    if (Array.isArray(pigs)) {
      pigs.forEach((p: any) => {
        if (p?.ear_tag) {
          pigMap.set(normalizeTag(p.ear_tag), p);
        }
      });
    }

    const recheckList: string[] = [];
    const farrowSoonList: string[] = [];

    if (Array.isArray(inseminations)) {
      inseminations.forEach((ins: any) => {
        if (!ins?.mating_date || !ins?.sow_ear_tag) return;
        
        const normSowTag = normalizeTag(ins.sow_ear_tag);
        const pigInfo = pigMap.get(normSowTag);

        // Kiểm tra xem nái đã đẻ chưa qua 3 yếu tố:
        // 1. Đã có trong bảng farrowings
        const hasFarrowed = farrowedTags.has(normSowTag);
        
        // 2. Stage trong bảng pigs không còn là chửa (đang nuôi con, chờ phối...)
        const rawStage = String(pigInfo?.stage || "").toLowerCase();
        const isNotPregnant = rawStage.includes("nuôi") || rawStage.includes("nuoi") || 
                              rawStage.includes("chờ") || rawStage.includes("cho") || 
                              rawStage.includes("cai");

        // 3. Status đợt phối ghi nhận đã đẻ
        const insStatus = String(ins?.status || "").toLowerCase();
        const isMatingDone = insStatus.includes("đẻ") || insStatus.includes("de");

        // NẾU NÁI ĐÃ ĐẺ HOẶC ĐANG NUÔI CON -> BỎ QUA NGAY LẬP TỨC
        if (hasFarrowed || isNotPregnant || isMatingDone) {
          return;
        }

        const mDate = new Date(ins.mating_date).getTime();
        const diffDays = Math.floor((nowVN.getTime() - mDate) / (1000 * 3600 * 24));

        if (diffDays >= 18 && diffDays <= 21) {
          recheckList.push(`• Nái *${ins.sow_ear_tag}*: Ngày ${diffDays}/114 (Đực: ${ins.boar_ear_tag || "—"}) - Kiểm tra phản xạ đứng im!`);
        }

        if (diffDays >= 105 && diffDays <= 114) {
          farrowSoonList.push(`• Nái *${ins.sow_ear_tag}*: Ngày ${diffDays}/114 - Chuẩn bị chuồng đẻ & trực đẻ!`);
        }
      });
    }
