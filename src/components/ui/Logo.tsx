"use client";

import React from "react";
import Image from "next/image";

interface LogoProps {
  size?: number;
  className?: string;
  variant?: "mark" | "app";
  priority?: boolean;
}

export function Logo({
  size = 32,
  className = "",
  variant = "mark",
  priority = false,
}: LogoProps) {
  const src = variant === "app" ? "/logo-app.png" : "/logo.png";

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt="Team Workspace Logo"
        width={size}
        height={size}
        priority={priority}
        className="w-full h-full object-contain select-none"
        unoptimized
      />
    </div>
  );
}

