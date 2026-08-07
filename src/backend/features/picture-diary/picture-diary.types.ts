/** Which image slot of a diary entry to serve. */
export type DiaryImageKind = "drawing" | "photo";

export interface DiaryEntry {
  id: string;
  userId: string;
  /** YYYY-MM-DD in the child's local day */
  dateKey: string;
  createdAt: string;
  text?: string;
  hasDrawing: boolean;
  hasPhoto: boolean;
  drawingContentType?: string;
  photoContentType?: string;
}

/** Client-safe view — image bytes come from the diary image route. */
export interface DiaryEntryView {
  id: string;
  dateKey: string;
  createdAt: string;
  text?: string;
  drawingUrl?: string;
  photoUrl?: string;
}

export interface PictureDiaryResponse {
  title: string;
  companionNote: string;
  entries: DiaryEntryView[];
  /** True once the child already saved a page today. */
  savedToday: boolean;
}
