import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig";

const supabase = createClient(supabaseUrl, supabaseKey);

const TELEGRAM_BOT_TOKEN = "8290400353:AAGE3Ra6Fz7BuJiIAEwMp6OQanZXbWwUzWQ";
const TELEGRAM_CHAT_IDS = ["-5523221456"];

export async function GET() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;

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
        const diffDays = Math.floor((today.getTime() - mDate) / (1000 * 3600 * 24));

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

    // 3. Quét CÔNG VIỆC ĐÃ LÀM XONG - KHỚP 100% VỚI DANH SÁCH TRÊN WEB
    // Lấy tất cả task is_completed = true giống hệt màn hình Tổng quan
    const { data: doneTasks } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("is_completed", true)
      .order("created_at", { ascending: false })
      .limit(15);

    // Lấy nhật ký audit_logs gần đây để map đúng tên người làm
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    const completedItems: string[] = [];
    const seenTitles = new Set<string>(); // Khử trùng lặp tuyệt đối

    if (Array.isArray(doneTasks)) {
      doneTasks.forEach((t: any) => {
        const cleanTitle = (t.title || "").trim();
        if (!cleanTitle || seenTitles.has(cleanTitle)) return;
        seenTitles.add(cleanTitle);

        // Tìm người làm từ nhật ký log (nếu có, mặc định là Hà Quang Dự)
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

    // 4. Soạn tin nhắn gửi Telegram
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

    text += `✅ *CÔNG VIỆC ĐÃ HOÀN THÀNH (${completedItems.length}):*\n`;
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

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ sạch sẽ danh sách việc đã làm!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
