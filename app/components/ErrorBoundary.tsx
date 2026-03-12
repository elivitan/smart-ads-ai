import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";

// ══════════════════════════════════════════════
// ErrorBoundary.tsx — Toast system + Error boundaries
// ══════════════════════════════════════════════

// ── Toast Types ──

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  duration: number;
}

interface ToastContextValue {
  addToast: (message: string, type?: Toast["type"], duration?: number) => string;
  removeToast: (id: string) => void;
  success: (msg: string, dur?: number) => string;
  error: (msg: string, dur?: number) => string;
  warning: (msg: string, dur?: number) => string;
  info: (msg: string, dur?: number) => string;
}

// ── Toast Context ──

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: Toast["type"] = "info", duration: number = 5000): string => {
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
    (msg: string, dur?: number) => addToast(msg, "success", dur),
    [addToast],
  );
  const error = useCallback(
    (msg: string, dur?: number) => addToast(msg, "error", dur || 8000),
    [addToast],
  );
  const warning = useCallback(
    (msg: string, dur?: number) => addToast(msg, "warning", dur || 6000),
    [addToast],
  );
  const info = useCallback(
    (msg: string, dur?: number) => addToast(msg, "info", dur),
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

// ── Toast Container ──

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps): React.JSX.Element | null {
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
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Individual Toast ──

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

interface ToastColors {
  bg: string;
  border: string;
  icon: string;
  text: string;
}

function ToastItem({ toast, onDismiss }: ToastItemProps): React.JSX.Element {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const colors: Record<Toast["type"], ToastColors> = {
    success: { bg: "rgba(34,197,94,.15)", border: "rgba(34,197,94,.4)", icon: "✅", text: "#22c55e" },
    error: { bg: "rgba(239,68,68,.15)", border: "rgba(239,68,68,.4)", icon: "❌", text: "#ef4444" },
    warning: { bg: "rgba(245,158,11,.15)", border: "rgba(245,158,11,.4)", icon: "⚠️", text: "#f59e0b" },
    info: { bg: "rgba(99,102,241,.15)", border: "rgba(99,102,241,.4)", icon: "ℹ️", text: "#6366f1" },
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
      <span style={{ color: "rgba(255,255,255,.3)", fontSize: 16, marginLeft: 4 }}>×</span>
    </div>
  );
}

// ── Error Boundary (Class Component) ──

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error | null, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });
    console.error("[SmartAds] Error Boundary caught:", error, errorInfo);
  }

  render(): React.ReactNode {
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
          <div style={{ fontSize: 36, marginBottom: 12 }}>💥</div>
          <h3 style={{ color: "#ef4444", margin: "0 0 8px", fontSize: 16 }}>
            Something went wrong
          </h3>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: "0 0 16px" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          {this.props.fallback ? (
            this.props.fallback(this.state.error, () =>
              this.setState({ hasError: false, error: null, errorInfo: null }),
            )
          ) : (
            <button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
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
              style={{ marginTop: 16, textAlign: "left", fontSize: 11, color: "rgba(255,255,255,.3)" }}
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

// ── Wizard Error Boundary ──

interface WizardErrorBoundaryProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export function WizardErrorBoundary({ children, onClose }: WizardErrorBoundaryProps): React.JSX.Element {
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
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
          <h3 style={{ color: "#ef4444", fontSize: 16, margin: "0 0 8px" }}>
            Campaign Wizard Error
          </h3>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: 13, margin: "0 0 20px" }}>
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
