import type { ReactNode } from "react";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: "var(--paper)" }}
    >
      {children}
    </div>
  );
}
