import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quản lý Trại lợn Cao Bằng",
  description: "Trại sản xuất nông nghiệp Nà Roác",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
