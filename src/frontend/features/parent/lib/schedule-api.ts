import { fetchJson } from "@/frontend/shared/api/fetch-json";

/** Parent schedule row shape used by ParentSchedulePanel. */
export type ParentScheduleItem = {
  id: string;
  type: string;
  title: string;
  time?: string;
  explanation?: string;
  done?: boolean;
  skipped?: boolean;
  dateKey: string;
  templateId?: string;
  colorTag?: string;
  repeatLabel?: string;
  reminderEnabled?: boolean;
  reminderMinutes?: number | null;
};

export type ListParentScheduleResponse = {
  linked: boolean;
  childUserId?: string | null;
  dateKey: string;
  items: ParentScheduleItem[];
};

export type CreateParentScheduleBody = {
  type: "exam" | "treatment";
  title: string;
  time?: string;
  note?: string;
  dateKey?: string;
  templateId?: string;
  colorTag?: string;
  repeatRule?: string;
  repeatWeekdays?: number[];
  repeatCount?: number;
  reminderMinutes?: number | null;
  reminderEnabled?: boolean;
};

export type CreateParentScheduleResponse = {
  item: ParentScheduleItem;
  items: ParentScheduleItem[];
  count: number;
};

export type UpdateParentScheduleBody = {
  type?: "exam" | "treatment";
  title?: string;
  time?: string | null;
  note?: string;
  colorTag?: string;
  reminderMinutes?: number | null;
  reminderEnabled?: boolean;
  dateKey?: string;
  done?: boolean;
  skipped?: boolean;
  action?: "duplicate" | "repeat-tomorrow";
};

export type UpdateParentScheduleResponse = {
  item: ParentScheduleItem;
};

export type DeleteParentScheduleResponse = {
  ok: true;
};

export function listParentSchedule(dateKey?: string) {
  const url = dateKey
    ? `/api/parent/schedule?date=${encodeURIComponent(dateKey)}`
    : "/api/parent/schedule";
  return fetchJson<ListParentScheduleResponse>(
    url,
    undefined,
    "일정을 불러오지 못했어요."
  );
}

export function createParentSchedule(body: CreateParentScheduleBody) {
  return fetchJson<CreateParentScheduleResponse>(
    "/api/parent/schedule",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "저장하지 못했어요."
  );
}

export function updateParentSchedule(
  id: string,
  body: UpdateParentScheduleBody
) {
  return fetchJson<UpdateParentScheduleResponse>(
    `/api/parent/schedule/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "수정하지 못했어요."
  );
}

export function deleteParentSchedule(id: string) {
  return fetchJson<DeleteParentScheduleResponse>(
    `/api/parent/schedule/${id}`,
    { method: "DELETE" },
    "삭제하지 못했어요."
  );
}
