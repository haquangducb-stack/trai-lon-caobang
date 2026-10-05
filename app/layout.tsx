import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "App Trại Lợn Nà Roác",
  description: "Quản lý đàn lợn và lịch kỹ thuật tự động",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#fdf8fb" }}>
        {children}
      </body>
    </html>
  );
}
