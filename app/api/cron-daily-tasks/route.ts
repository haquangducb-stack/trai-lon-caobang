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

    // 1. Quét dữ liệu nái ngày 18 - 21 và sắp đẻ
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

    // 2. Quét công việc CẦN LÀM hôm nay (chưa xong)
    const { data: pendingTasks } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("due_date", todayStr)
      .eq("is_completed", false);

    const pendingItems = (Array.isArray(pendingTasks) ? pendingTasks : []).map(
      (t: any, idx: number) => `${idx + 1}. ${t.title}`
    );

    // 3. Quét công việc ĐÃ LÀM (Lấy cả từ farm_tasks lẫn audit_logs)
    const completedItems: string[] = [];

    // 3.1. Quét từ bảng farm_tasks (các việc đã tick hoàn thành: vaccine, thú y, cai sữa...)
    const { data: doneTasks } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("is_completed", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (Array.isArray(doneTasks)) {
      doneTasks.forEach((t: any) => {
        completedItems.push(`• ${t.title} [Hoàn tất]`);
      });
    }

    // 3.2. Quét thêm từ nhật ký thao tác audit_logs (lấy 5 hành động gần nhất kèm người làm)
    const { data: recentLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    if (Array.isArray(recentLogs)) {
      recentLogs.forEach((log: any) => {
        const who = log.performed_by || "Hà Quang Dự";
        const detail = log.details;
        // Tránh trùng lặp nội dung nếu đã có
        if (!completedItems.some(item => item.includes(detail))) {
          completedItems.push(`• ${detail} _(${who})_`);
        }
      });
    }

    // 4. Soạn thảo tin nhắn Telegram
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

    text += `✅ *CÔNG VIỆC / KỸ THUẬT ĐÃ HOÀN THÀNH:*\n`;
    if (completedItems.length > 0) {
      text += `${completedItems.slice(0, 8).join("\n")}\n`;
    } else {
      text += `⏳ _Chưa ghi nhận thao tác kỹ thuật nào gần đây._\n`;
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
      message: `Đã gửi báo cáo chi tiết thành công!`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
