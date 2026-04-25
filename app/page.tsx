import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background decorative orbs */}
      <div className="orb orb-gold" />
      <div className="orb orb-green" />

      {/* Background grid */}
      <div
        className="bg-grid"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          opacity: 0.3,
        }}
      />

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "32px 24px 60px",
        }}
      >
        <Dashboard />
      </div>
    </main>
  );
}
