import "./globals.css";

export const metadata = {
  title: "Cash Cycle · Garden Prayer",
  description: "Biweekly deployment desk for personal treasury decisions.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
