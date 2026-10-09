import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eqlegigaftimjdmyuofg.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxbGVnaWdhZnRpbWpkbXl1b2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNzQyODAsImV4cCI6MjEwNjY1MDI4MH0.mlF6wNkZMt6Rtv6bXr0bcYSkdpjiiQxPsoNW-PgA1ig"
);

// Thông tin kết nối Telegram
const TELEGRAM_BOT_TOKEN = "8290400353:AAGE3Ra6Fz7BuJiIAEwMp6OQanZXbWwUzWQ";
const TELEGRAM_CHAT_ID = "8864970730";

export async function GET() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    // 1. Quét dữ liệu phối giống để tìm nái ở ngày 18 - 21 và sắp đẻ (105 - 114)
    const { data: inseminations } = await supabase
      .from("inseminations")
      .select("*");

    const recheckList: string[] = [];
    const farrowSoonList: string[] = [];

    (inseminations || []).forEach((ins) => {
      if (!ins.mating_date) return;
      const mDate = new Date(ins.mating_date).getTime();
      const diffDays = Math.floor((today.getTime() - mDate) / (1000 * 3600 * 24));

      // Lốc chu kỳ 1 (ngày 18 - 21)
      if (diffDays >= 18 && diffDays <= 21) {
        recheckList.push(`• Nái *${ins.sow_ear_tag}*: Ngày ${diffDays}/114 (Đực: ${ins.boar_ear_tag || "—"}) - Kiểm tra phản xạ đứng im!`);
      }

      // Sắp đẻ (ngày 105 - 114)
      if (diffDays >= 105 && diffDays <= 114) {
        farrowSoonList.push(`• Nái *${ins.sow_ear_tag}*: Ngày ${diffDays}/114 - Chuẩn bị chuồng đẻ & trực đẻ!`);
      }
    });

    // 2. Quét công việc cần làm hôm nay
    const { data: tasks } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("due_date", todayStr)
      .eq("is_completed", false);

    const taskItems = (tasks || []).map((t, idx) => `${idx + 1}. ${t.title}`);

    // 3. Soạn nội dung thông báo
    let text = `📋 *LỊCH CÔNG VIỆC TRẠI LỢN NÀ ROÁC*\n📅 Ngày: *${formattedDate}*\n\n`;

    if (recheckList.length > 0) {
      text += `⚠️ *CẢNH BÁO THEO DÕI PHỐI LỐC (NGÀY 18-21):*\n${recheckList.join("\n")}\n\n`;
    } else {
      text += `✅ *Lốc chu kỳ 1:* Không có nái nào đến ngày 18-21.\n\n`;
    }

    if (farrowSoonList.length > 0) {
      text += `🍼 *NÁI SẮP ĐẺ (TRÊN 105 NGÀY):*\n${farrowSoonList.join("\n")}\n\n`;
    }

    if (taskItems.length > 0) {
      text += `🔔 *CÔNG VIỆC KỸ THUẬT HÔM NAY:*\n${taskItems.join("\n")}\n`;
    } else {
      text += `✨ *Hôm nay không có lịch kỹ thuật tồn đọng.*`;
    }

    text += `\n\n_Chúc anh Dự một ngày làm việc thuận lợi!_`;

    // 4. Gửi tin nhắn qua Telegram API
    const teleRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: text,
          parse_mode: "Markdown",
        }),
      }
    );

    const teleData = await teleRes.json();

    if (!teleData.ok) {
      return NextResponse.json({ success: false, error: teleData.description }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Đã gửi thông báo Telegram thành công!" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
