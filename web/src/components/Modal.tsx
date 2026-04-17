import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, children, actions }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="card-accent relative z-10 w-full max-w-md p-6 animate-fade-in">
        <h3 className="text-[17px] font-semibold mb-1">{title}</h3>
        {subtitle && <p className="text-xs text-muted mb-4">{subtitle}</p>}
        <div className="space-y-3">{children}</div>
        {actions && <div className="mt-4 flex justify-end gap-2 flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
