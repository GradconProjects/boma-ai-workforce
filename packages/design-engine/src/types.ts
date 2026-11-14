import { z } from "zod";

/**
 * Design document model. Coordinates are in design pixels (the export size), so what you see
 * scaled in the editor is exactly what is exported.
 */

export const TEXT_ROLES = [
  "eyebrow",
  "headline",
  "subhead",
  "body",
  "cta",
  "footer",
  "free",
] as const;
export type TextRole = (typeof TEXT_ROLES)[number];

const base = {
  id: z.string(),
  name: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotation: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
};

export const textLayerSchema = z.object({
  ...base,
  type: z.literal("text"),
  role: z.enum(TEXT_ROLES).default("free"),
  text: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(900),
  italic: z.boolean().default(false),
  color: z.string(),
  align: z.enum(["left", "center", "right"]),
  lineHeight: z.number().positive(),
  letterSpacing: z.number().default(0),
  uppercase: z.boolean().default(false),
  /** Pill/button background behind the text (e.g. CTA). */
  background: z.string().nullable().default(null),
  padding: z.number().min(0).default(0),
  radius: z.number().min(0).default(0),
});

export const imageLayerSchema = z.object({
  ...base,
  type: z.literal("image"),
  src: z.string(),
  fit: z.enum(["cover", "contain"]).default("cover"),
  radius: z.number().min(0).default(0),
});

export const shapeLayerSchema = z.object({
  ...base,
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse"]),
  fill: z.string(),
  /** Optional second colour: fills become a linear gradient from `fill` to `fill2`. */
  fill2: z.string().nullable().default(null),
  gradientAngle: z.number().default(180),
  radius: z.number().min(0).default(0),
  stroke: z.string().nullable().default(null),
  strokeWidth: z.number().min(0).default(0),
});

export const layerSchema = z.discriminatedUnion("type", [
  textLayerSchema,
  imageLayerSchema,
  shapeLayerSchema,
]);

export const designSchema = z.object({
  version: z.literal(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  background: z.object({
    color: z.string(),
    imageUrl: z.string().nullable().default(null),
    /** Darkening/tinting overlay over the background image for text legibility. */
    overlay: z.string().nullable().default(null),
    overlayOpacity: z.number().min(0).max(1).default(0),
  }),
  layers: z.array(layerSchema),
});

export type TextLayer = z.infer<typeof textLayerSchema>;
export type ImageLayer = z.infer<typeof imageLayerSchema>;
export type ShapeLayer = z.infer<typeof shapeLayerSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Design = z.infer<typeof designSchema>;

export interface Brand {
  id: string;
  name: string;
  tagline: string;
  industry: string;
  audience: string;
  tone: string;
  primary: string;
  secondary: string;
  accent: string;
  logoText: string;
  website: string;
  features: string[];
  headingFont: string;
  bodyFont: string;
}

/** Copy written for a design (by the owner or the Chief). Maps onto text layers by role. */
export interface Copy {
  eyebrow?: string;
  headline?: string;
  subhead?: string;
  body?: string;
  cta?: string;
  footer?: string;
}
