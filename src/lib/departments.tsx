import React from "react";
import { Department } from "@prisma/client";
import { Code2, PenTool } from "lucide-react";

export interface DepartmentMeta {
  key: Department;
  label: string;
  shortLabel: string;
  badgeClass: string;
  activeTabClass: string;
  iconName: string;
}

export const DEPARTMENTS: Record<Department, DepartmentMeta> = {
  DEVELOPMENT: {
    key: "DEVELOPMENT",
    label: "დეველოპმენტი",
    shortLabel: "DEV",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200/90",
    activeTabClass: "bg-blue-600 text-white",
    iconName: "Code2",
  },
  CONTENT: {
    key: "CONTENT",
    label: "კონტენტი",
    shortLabel: "CONTENT",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200/90",
    activeTabClass: "bg-purple-600 text-white",
    iconName: "PenTool",
  },
};

export function getDepartmentLabel(dep?: Department | string | null): string {
  if (dep === "CONTENT") return "კონტენტი";
  return "დეველოპმენტი";
}

export function getDepartmentBadge(dep?: Department | string | null) {
  if (dep === "CONTENT") return DEPARTMENTS.CONTENT;
  return DEPARTMENTS.DEVELOPMENT;
}

interface DepartmentBadgeProps {
  department?: Department | string | null;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export function DepartmentBadge({
  department = "DEVELOPMENT",
  size = "xs",
  showIcon = true,
  className = "",
}: DepartmentBadgeProps) {
  const meta = getDepartmentBadge(department);
  const isContent = meta.key === "CONTENT";

  const sizeClasses =
    size === "xs"
      ? "text-[10px] px-1.5 py-0.5 gap-1 rounded-md"
      : size === "sm"
      ? "text-[11px] px-2 py-0.5 gap-1.5 rounded-lg"
      : "text-xs px-2.5 py-1 gap-1.5 rounded-xl font-bold";

  return (
    <span
      className={`inline-flex items-center font-bold border transition-colors select-none ${meta.badgeClass} ${sizeClasses} ${className}`}
      title={`გუნდი: ${meta.label}`}
    >
      {showIcon && (
        isContent ? (
          <PenTool size={size === "xs" ? 10 : 12} className="shrink-0" />
        ) : (
          <Code2 size={size === "xs" ? 10 : 12} className="shrink-0" />
        )
      )}
      <span>{meta.label}</span>
    </span>
  );
}
