"use client";

import React from "react";
import { formatGeorgianDate } from "@/lib/dateUtils";
import { AuditEventItem } from "@/components/TaskDetailsDrawer";

interface TaskActivitySectionProps {
  auditEvents: AuditEventItem[];
}

export function TaskActivitySection({ auditEvents }: TaskActivitySectionProps) {
  const formatAuditAction = (
    action: string,
    entityType?: string,
    reason?: string | null
  ): string => {
    switch (action) {
      case "TASK_CREATED":
        return "ტასკი შეიქმნა";
      case "TASK_UPDATED":
        if (entityType === "COMMENT") return "კომენტარი შეიცვალა / წაიშალა";
        if (entityType === "DAILY_UPDATE") return "დღიური ჩანაწერი შეიცვალა / წაიშალა";
        if (entityType === "ATTACHMENT") return "გარე ბმული შეიცვალა";
        return reason ? reason : "ტასკი განახლდა";
      case "COMMENT_ADDED":
        return "ახალი კომენტარი დაემატა";
      case "ATTACHMENT_ADDED":
        return "ფაილი / გარე ბმული დაემატა";
      case "ATTACHMENT_REMOVED":
        return "ფაილი / გარე ბმული წაიშალა";
      case "DAILY_UPDATE_ADDED":
        return "დღიური სამუშაო ჩანაწერი დაემატა";
      case "STAGE_CREATED":
        return "სამუშაო ეტაპი შეიქმნა";
      case "STAGE_DELETED":
        return "სამუშაო ეტაპი წაიშალა";
      case "STAGE_COMPLETED":
        return "ეტაპი დასრულდა და გადაეცა შემდეგ შემსრულებელს";
      case "STAGE_REORDERED":
        return "ეტაპების რიგითობა შეიცვალა";
      case "SUBTASK_CREATED":
        return "ახალი საბტასკი დაემატა";
      case "SUBTASK_COMPLETED":
        return "საბტასკი შესრულდა";
      case "SUBTASK_REOPENED":
        return "საბტასკი ხელახლა გაიხსნა";
      case "SUBTASK_DELETED":
        return "საბტასკი წაიშალა";
      case "COMMENT_DELETED":
        return "კომენტარი წაიშალა";
      case "DEADLINE_CHANGED":
        return "დედლაინი შეიცვალა ადმინისტრატორის მიერ";
      case "STATUS_CHANGED":
        return "სტატუსი განახლდა";
      case "WORK_PAUSED":
        return "სამუშაო შეჩერდა";
      case "WORK_RESUMED":
        return "სამუშაო განახლდა";
      default:
        return action;
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <h3 className="text-xs font-black text-stone-800 uppercase tracking-wider">
        ისტორია & აუდიტის ლოგი
      </h3>

      {auditEvents && auditEvents.length > 0 ? (
        <div className="relative border-l-2 border-stone-200 ml-3 pl-4 space-y-4 text-xs">
          {auditEvents.map((event) => (
            <div key={event.id} className="relative">
              {/* Node Circle */}
              <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-orange-600 border-2 border-white shadow-2xs" />

              <div className="bg-stone-50/80 border border-stone-200/80 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-stone-900">{event.actor.name}</span>
                  <span className="text-stone-400">
                    {formatGeorgianDate(event.createdAt)}
                  </span>
                </div>

                <div className="font-semibold text-stone-800">
                  {formatAuditAction(event.action, event.entityType, event.reason)}
                </div>

                {event.reason && (
                  <div className="text-[11px] text-stone-600 bg-white/80 p-1.5 rounded-lg border border-stone-100 italic">
                    მიზეზი: {event.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center text-xs text-stone-400 italic">
          ისტორია ჯერჯერობით ცარიელია.
        </div>
      )}
    </div>
  );
}
