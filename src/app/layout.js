import "./globals.css";

export const metadata = {
  title: "DepScout",
  description: "Install decisions for coding agents."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
