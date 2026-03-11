import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";

// ג”€ג”€ Toast Context ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = "info", duration = 5000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast],
  );

  const success = useCallback(
    (msg, dur) => addToast(msg, "success", dur),
    [addToast],
  );
  const error = useCallback(
    (msg, dur) => addToast(msg, "error", dur || 8000),
    [addToast],
  );
  const warning = useCallback(
    (msg, dur) => addToast(msg, "warning", dur || 6000),
    [addToast],
  );
  const info = useCallback(
    (msg, dur) => addToast(msg, "info", dur),
    [addToast],
  );

  return (
    <ToastContext.Provider
      value={{ addToast, removeToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ג”€ג”€ Toast Container ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        maxWidth: 400,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ג”€ג”€ Individual Toast ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
function Toast({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const colors = {
    success: {
      bg: "rgba(34,197,94,.15)",
      border: "rgba(34,197,94,.4)",
      icon: "ג…",
      text: "#22c55e",
    },
    error: {
      bg: "rgba(239,68,68,.15)",
      border: "rgba(239,68,68,.4)",
      icon: "ג",
      text: "#ef4444",
    },
    warning: {
      bg: "rgba(245,158,11,.15)",
      border: "rgba(245,158,11,.4)",
      icon: "ג ן¸",
      text: "#f59e0b",
    },
    info: {
      bg: "rgba(99,102,241,.15)",
      border: "rgba(99,102,241,.4)",
      icon: "ג„¹ן¸",
      text: "#6366f1",
    },
  };

  const c = colors[toast.type] || colors.info;

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        backdropFilter: "blur(12px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(100px)",
        transition: "all 0.3s ease-out",
        pointerEvents: "auto",
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,.2)",
      }}
      onClick={() => onDismiss(toast.id)}
    >
      <span style={{ fontSize: 18 }}>{c.icon}</span>
      <span
        style={{
          color: c.text,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.4,
          flex: 1,
        }}
      >
        {toast.message}
      </span>
      <span
        style={{ color: "rgba(255,255,255,.3)", fontSize: 16, marginLeft: 4 }}
      >
        ֳ—
      </span>
    </div>
  );
}

// ג”€ג”€ Error Boundary ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("[SmartAds] Error Boundary caught:", error, errorInfo);

    // Future: Send to Sentry/monitoring
    // if (window.Sentry) window.Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: "rgba(239,68,68,.08)",
            border: "1px solid rgba(239,68,68,.3)",
            borderRadius: 12,
            padding: 24,
            margin: 16,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>נ˜µ</div>
          <h3 style={{ color: "#ef4444", margin: "0 0 8px", fontSize: 16 }}>
            Something went wrong
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,.5)",
              fontSize: 13,
              margin: "0 0 16px",
            }}
          >
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          {this.props.fallback ? (
            this.props.fallback(this.state.error, () =>
              this.setState({ hasError: false, error: null }),
            )
          ) : (
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: "rgba(239,68,68,.2)",
                border: "1px solid rgba(239,68,68,.4)",
                borderRadius: 8,
                padding: "8px 20px",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Try Again
            </button>
          )}
          {process.env.NODE_ENV === "development" && this.state.errorInfo && (
            <details
              style={{
                marginTop: 16,
                textAlign: "left",
                fontSize: 11,
                color: "rgba(255,255,255,.3)",
              }}
            >
              <summary>Stack trace</summary>
              <pre style={{ overflow: "auto", maxHeight: 200, padding: 8 }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ג”€ג”€ Wizard Error Boundary (specific fallback) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
export function WizardErrorBoundary({ children, onClose }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div
          style={{
            background: "rgba(239,68,68,.08)",
            border: "1px solid rgba(239,68,68,.3)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>נ”§</div>
          <h3 style={{ color: "#ef4444", fontSize: 16, margin: "0 0 8px" }}>
            Campaign Wizard Error
          </h3>
          <p
            style={{
              color: "rgba(255,255,255,.5)",
              fontSize: 13,
              margin: "0 0 20px",
            }}
          >
            {error?.message || "The wizard encountered an issue"}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                background: "rgba(99,102,241,.2)",
                border: "1px solid rgba(99,102,241,.4)",
                borderRadius: 8,
                padding: "8px 20px",
                color: "#6366f1",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Retry Wizard
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: "rgba(255,255,255,.05)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 8,
                  padding: "8px 20px",
                  color: "rgba(255,255,255,.5)",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
