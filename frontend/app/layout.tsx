import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "DeepCanvas",
  description: "Deep Agents 可视化工作流搭建器"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
