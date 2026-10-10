import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";

const supabase = createClient(supabaseUrl, supabaseKey);

const TELEGRAM_BOT_TOKEN = "8290400353:AAGE3Ra6Fz7BuJiIAEwMp6OQanZXbWwUzWQ";
const TELEGRAM_CHAT_IDS = ["-5523221456"];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const isForce = url.searchParams.get("force") === "true"; // Chỉ gửi ép buộc nếu có ?force=true để test

    // Lấy ngày hiện tại theo giờ Việt Nam (UTC+7)
    const nowVN = new Date(new Date().getTime() + 7 * 3600 * 1000);
    const todayStr = nowVN.toISOString().split("T")[0];
    const dd = String(nowVN.getUTCDate()).padStart(2, "0");
    const mm = String(nowVN.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = nowVN.getUTCFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    // ==========================================
    // KHÓA CHẶN SPAM: KIỂM TRA ĐÃ GỬI HÔM NAY CHƯA
    // ==========================================
    if (!isForce) {
      const { data: sentLog } = await supabase
        .from("audit_logs")
        .select("id")
        .eq("action_type", "TELEGRAM_DAILY_SENT")
        .eq("target_id", todayStr)
        .limit(1);

      if (sentLog && sentLog.length > 0) {
        return NextResponse.json({
          success: true,
          message: `Hôm nay (${formattedDate}) đã gửi thông báo rồi. Bỏ qua để tránh spam!`,
          skipped: true,
        });
      }
    }

    // 1. Quét dữ liệu nái ngày 18 - 21 và sắp đẻ (105 - 114)
    const { data: inseminations } = await supabase
      .from("inseminations")
      .select("*");

    const recheckList: string[] = [];
    const farrowSoonList: string[] = [];

    if (Array.isArray(inseminations)) {
      inseminations.forEach((ins: any) => {
        if (!ins?.mating_date) return;
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

    // 2. Quét công việc CẦN LÀM hôm nay (chưa hoàn thành)
    const { data: pendingTasks } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("due_date", todayStr)
      .eq("is_completed", false);

    const pendingItems = (Array.isArray(pendingTasks) ? pendingTasks : []).map(
      (t: any, idx: number) => `${idx + 1}. ${t.title}`
    );

    // 3. Quét CÔNG VIỆC ĐÃ LÀM XONG (Khử trùng lặp)
    const { data: doneTasks } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("is_completed", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    const completedItems: string[] = [];
    const seenTitles = new Set<string>();

    if (Array.isArray(doneTasks)) {
      doneTasks.forEach((t: any) => {
        const cleanTitle = (t.title || "").trim();
        if (!cleanTitle || seenTitles.has(cleanTitle)) return;
        seenTitles.add(cleanTitle);

        let operator = "Hà Quang Dự";
        if (Array.isArray(logs)) {
          const matchLog = logs.find(
            (l: any) =>
              (l.details && l.details.includes(cleanTitle)) ||
              (t.related_tag && l.target_id === t.related_tag)
          );
          if (matchLog && matchLog.performed_by) {
            operator = matchLog.performed_by;
          }
        }

        completedItems.push(`• ${cleanTitle} _(Người làm: ${operator})_`);
      });
    }

    // 4. Soạn thảo nội dung
    let text = `📋 *BÁO CÁO CÔNG VIỆC TRẠI LỢN NÀ ROÁC*\n📅 Ngày: *${formattedDate}*\n\n`;

    if (recheckList.length > 0) {
      text += `⚠️ *CẢNH BÁO THEO DÕI PHỐI LỐC (NGÀY 18-21):*\n${recheckList.join("\n")}\n\n`;
    } else {
      text += `✅ *Kiểm tra lốc chu kỳ 1:* Không có nái nào đến ngày 18-21.\n\n`;
    }

    if (farrowSoonList.length > 0) {
      text += `🍼 *NÁI SẮP ĐẺ (TRÊN 105 NGÀY):*\n${farrowSoonList.join("\n")}\n\n`;
    }

    text += `🔔 *NHỮNG VIỆC CẦN LÀM HÔM NAY:*\n`;
    if (pendingItems.length > 0) {
      text += `${pendingItems.join("\n")}\n\n`;
    } else {
      text += `✨ _Không có công việc nào tồn đọng trong ngày._\n\n`;
    }

    text += `✅ *CÔNG VIỆC ĐÃ HOÀN THÀNH:*\n`;
    if (completedItems.length > 0) {
      text += `${completedItems.join("\n")}\n`;
    } else {
      text += `⏳ _Chưa ghi nhận công việc hoàn thành nào._\n`;
    }

    text += `\n_Hệ thống tự động cập nhật từ Trại Lợn Nà Roác._`;

    // 5. Gửi tin nhắn qua Telegram
    for (const chatId of TELEGRAM_CHAT_IDS) {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: "Markdown",
          }),
        }
      );
    }

    // ==========================================
    // GHI NHẬN ĐÃ GỬI VÀO CƠ SỞ DỮ LIỆU ĐỂ KHÓA LẠI
    // ==========================================
    await supabase.from("audit_logs").insert([
      {
        action_type: "TELEGRAM_DAILY_SENT",
        target_id: todayStr,
        performed_by: "Hệ thống tự động",
        details: `Đã gửi báo cáo Telegram ngày ${formattedDate}`,
      },
    ]);

    return NextResponse.json({
      success: true,
      message: `Đã gửi báo cáo ngày ${formattedDate} thành công! Khóa chặn đã được kích hoạt.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
