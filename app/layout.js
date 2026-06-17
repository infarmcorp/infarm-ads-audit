export const metadata = {
  title: "Infarm Ads Audit",
  description: "Dashboard Audit Iklan Infarm",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, background: "#fff" }}>{children}</body>
    </html>
  );
}
