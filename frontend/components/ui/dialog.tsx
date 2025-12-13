import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      {/* Dialog Content */}
      <div className="relative z-50 w-full max-w-2xl mx-4">
        {children}
      </div>
    </div>
  );
}

function DialogContent({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function DialogHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mb-6", className)} {...props}>
      {children}
    </div>
  );
}

function DialogTitle({ className, children, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("text-2xl font-bold text-slate-900", className)} {...props}>
      {children}
    </h2>
  );
}

function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
    >
      <X className="w-5 h-5" />
    </button>
  );
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose };


