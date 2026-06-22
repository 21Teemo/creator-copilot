"use client";

import React, { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/useProjectStore";

interface StudioShellProps {
  children: React.ReactNode;
}

export default function StudioShell({ children }: StudioShellProps) {
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      data-format={mounted ? contentFormat : "long"}
      className="h-screen flex flex-col bg-studio-bg text-studio-text-primary p-6 transition-colors duration-300 select-none overflow-hidden"
    >
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto gap-4 min-h-0">
        {children}
      </div>
    </div>
  );
}
