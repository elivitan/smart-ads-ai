
import { useLoaderData } from "react-router";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return {
    googleConnected: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
  };
};
export default function Settings() {
  const { googleConnected, customerId } = useLoaderData();
  return (
    <div
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        padding: "28px",
        maxWidth: "1040px",
        margin: "0 auto",
      }}
    >
      {" "}
      <style>{`         .set-h{font-size:24px;font-weight:700;color:#1a1a2e;margin-bottom:8px}         .set-sub{font-size:14px;color:#64748b;margin-bottom:28px}         .set-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:16px}         .set-card-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}         .set-card-h h3{font-size:16px;font-weight:600;color:#1a1a2e}         .set-badge{font-size:12px;font-weight:600;padding:4px 12px;border-radius:100px}         .set-badge-ok{background:#dcfce7;color:#16a34a}         .set-badge-no{background:#fef2f2;color:#dc2626}         .set-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #f1f5f9}         .set-row:last-child{border:none}         .set-label{font-size:13px;color:#64748b}         .set-val{font-size:13px;font-weight:500;color:#1a1a2e;font-family:'JetBrains Mono',monospace}         .set-ic{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-right:14px}         .set-row-l{display:flex;align-items:center}       `}</style>{" "}
      <h1 className="set-h">Settings</h1>{" "}
      <p className="set-sub">Manage your integrations and account settings.</p>{" "}
      {/* Google Ads Connection */}{" "}
      <div className="set-card">
        {" "}
        <div className="set-card-h">
          {" "}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {" "}
            <div className="set-ic" style={{ background: "#eff6ff" }}>
              {" "}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                {" "}
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />{" "}
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />{" "}
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />{" "}
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />{" "}
              </svg>{" "}
            </div>{" "}
            <h3>Google Ads</h3>{" "}
          </div>{" "}
          <span
            className={`set-badge ${googleConnected ? "set-badge-ok" : "set-badge-no"}`}
          >
            {" "}
            {googleConnected ? "Connected" : "Not Connected"}{" "}
          </span>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">Customer ID</span>{" "}
          <span className="set-val">{customerId || "Not set"}</span>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">API Access Level</span>{" "}
          <span className="set-val">
            Test Account (Pending Basic Access)
          </span>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">OAuth Status</span>{" "}
          <span
            className="set-val"
            style={{ color: googleConnected ? "#16a34a" : "#dc2626" }}
          >
            {" "}
            {googleConnected ? "Refresh Token Active" : "No Token"}{" "}
          </span>{" "}
        </div>{" "}
      </div>{" "}
      {/* AI Settings */}{" "}
      <div className="set-card">
        {" "}
        <div className="set-card-h">
          {" "}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {" "}
            <div className="set-ic" style={{ background: "#faf5ff" }}>
              {" "}
              <svg
                width="20"
                height="20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#8b5cf6"
                strokeWidth="1.5"
              >
                {" "}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                />{" "}
              </svg>{" "}
            </div>{" "}
            <h3>AI Engine</h3>{" "}
          </div>{" "}
          <span className="set-badge set-badge-ok">Active</span>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">Model</span>{" "}
          <span className="set-val">Claude Sonnet 4 (Anthropic)</span>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">Max Products per Scan</span>{" "}
          <span className="set-val">12</span>{" "}
        </div>{" "}
      </div>{" "}
      {/* App Info */}{" "}
      <div className="set-card">
        {" "}
        <div className="set-card-h">
          {" "}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {" "}
            <div className="set-ic" style={{ background: "#f0fdf4" }}>
              {" "}
              <svg
                width="20"
                height="20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#16a34a"
                strokeWidth="1.5"
              >
                {" "}
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />{" "}
              </svg>{" "}
            </div>{" "}
            <h3>App Info</h3>{" "}
          </div>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">App Version</span>{" "}
          <span className="set-val">1.0.0-beta</span>{" "}
        </div>{" "}
        <div className="set-row">
          {" "}
          <span className="set-label">Framework</span>{" "}
          <span className="set-val">Shopify Remix + React Router</span>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
