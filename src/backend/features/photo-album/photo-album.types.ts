export interface PhotoAlbumItem {
  id: string;
  userId: string;
  contentType: string;
  createdAt: string;
  questId?: string;
  caption?: string;
}

export interface PhotoAlbumListItem {
  id: string;
  url: string;
  createdAt: string;
  questId?: string;
  caption?: string;
}
