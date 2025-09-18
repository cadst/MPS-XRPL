export type Item = {
    rank: number;
    id: number;
    title: string;
    artist: string;
    cover: string;
    amount?: number; 
  };

  export type Page<T> = { items: T[]; nextCursor: number | null };