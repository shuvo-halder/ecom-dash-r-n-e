import React from "react";
import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      visibleToasts={5}
      duration={4000}
      className="toaster group font-sans text-sm"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:p-4 group-[.toaster]:gap-3 group-[.toaster]:border",
          description: "group-[.toast]:text-muted-foreground text-xs leading-relaxed mt-0.5",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground text-xs font-medium px-3 py-1.5 rounded-md",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:text-foreground group-[.toast]:border-border group-[.toast]:hover:bg-muted group-[.toast]:transition-colors",
          error:
            "group-[.toaster]:!bg-destructive/10 group-[.toaster]:!border-destructive/30 group-[.toaster]:!text-destructive dark:group-[.toaster]:!text-destructive-foreground",
          success:
            "group-[.toaster]:!bg-emerald-500/10 group-[.toaster]:!border-emerald-500/30 group-[.toaster]:!text-emerald-700 dark:group-[.toaster]:!text-emerald-300",
          warning:
            "group-[.toaster]:!bg-amber-500/10 group-[.toaster]:!border-amber-500/30 group-[.toaster]:!text-amber-800 dark:group-[.toaster]:!text-amber-300",
          info:
            "group-[.toaster]:!bg-blue-500/10 group-[.toaster]:!border-blue-500/30 group-[.toaster]:!text-blue-800 dark:group-[.toaster]:!text-blue-300",
        },
      }}
      style={{
        zIndex: 99999,
      }}
    />
  );
}
