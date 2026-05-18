import "./globals.css";

export const metadata = {
  title: "Crockery Inventory Manager",
  description: "Inventory dashboard for a crockery business.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}