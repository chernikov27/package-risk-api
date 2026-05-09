import "./globals.css";

export const metadata = {
  title: "AgentSpec",
  description: "Turn any API into an agent-ready x402 service."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
