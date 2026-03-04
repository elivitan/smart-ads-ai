
import { useLoaderData } from "react-router";

export const loader = async ({ request }) => {
  const { authenticate } = await import("../shopify.server");
  await authenticate.admin(request);
  return { campaigns: [] };
};
export default function Campaigns() {
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
      <style>{`         .camp-h{font-size:24px;font-weight:700;color:#1a1a2e;margin-bottom:8px}         .camp-sub{font-size:14px;color:#64748b;margin-bottom:28px}         .camp-empty{background:#fff;border:2px dashed #e2e8f0;border-radius:16px;padding:60px 32px;text-align:center}         .camp-empty-ic{width:64px;height:64px;background:linear-gradient(135deg,#ede9fe,#e0e7ff);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px}         .camp-empty h3{font-size:18px;font-weight:600;color:#1a1a2e;margin-bottom:8px}         .camp-empty p{font-size:14px;color:#64748b;max-width:400px;margin:0 auto 20px}         .camp-btn{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;padding:12px 24px;border:none;border-radius:10px;cursor:pointer;font-family:inherit;transition:all .2s}         .camp-btn:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(99,102,241,.3)}       `}</style>{" "}
      <h1 className="camp-h">Campaigns</h1>{" "}
      <p className="camp-sub">
        Manage your Google Ads campaigns created by Smart Ads AI.
      </p>{" "}
      <div className="camp-empty">
        {" "}
        <div className="camp-empty-ic">
          {" "}
          <svg
            width="28"
            height="28"
            fill="none"
            viewBox="0 0 24 24"
            stroke="#6366f1"
            strokeWidth="1.5"
          >
            {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3v18h18M7 16l4-4 4 4 6-6"
            />{" "}
          </svg>{" "}
        </div>{" "}
        <h3>No campaigns yet</h3>{" "}
        <p>
          Once you create campaigns from the Dashboard, they'll appear here with
          performance metrics.
        </p>{" "}
        <a href="/app" className="camp-btn">
          {" "}
          <svg
            width="16"
            height="16"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />{" "}
          </svg>{" "}
          Go to Dashboard{" "}
        </a>{" "}
      </div>{" "}
    </div>
  );
}
