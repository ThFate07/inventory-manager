import "./globals.css";

export const metadata = {
  title: "Deen Enterprise",
  description: "Browse products and build your cart here",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}