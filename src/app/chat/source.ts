export type Source = {
  tool: "search_gmail" | "search_drive";
  title: string;
  slug: string;
  score: number;
  url?: string;
};
