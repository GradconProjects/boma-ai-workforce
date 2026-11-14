/** Output formats. Sizes are the platforms' recommended pixel sizes (A4 at 150 dpi for print). */
export interface Format {
  id: string;
  title: string;
  subtitle: string;
  width: number;
  height: number;
  channel: "print" | "facebook" | "instagram" | "tiktok" | "linkedin" | "display" | "any";
}

export const FORMATS: Format[] = [
  {
    id: "flyer-a4",
    title: "Flyer / poster",
    subtitle: "A4 portrait · print",
    width: 1240,
    height: 1754,
    channel: "print",
  },
  {
    id: "social-square",
    title: "Social post",
    subtitle: "1:1 · Facebook, Instagram",
    width: 1080,
    height: 1080,
    channel: "any",
  },
  {
    id: "social-portrait",
    title: "Feed portrait",
    subtitle: "4:5 · Facebook, Instagram",
    width: 1080,
    height: 1350,
    channel: "facebook",
  },
  {
    id: "story",
    title: "Story / Reel / TikTok cover",
    subtitle: "9:16 vertical",
    width: 1080,
    height: 1920,
    channel: "tiktok",
  },
  {
    id: "ad-landscape",
    title: "Link ad",
    subtitle: "1.91:1 · Facebook, LinkedIn",
    width: 1200,
    height: 628,
    channel: "display",
  },
  {
    id: "banner-wide",
    title: "Web banner",
    subtitle: "16:9 · website, YouTube",
    width: 1920,
    height: 1080,
    channel: "any",
  },
];

export function getFormat(id: string): Format {
  const f = FORMATS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown format "${id}"`);
  return f;
}
