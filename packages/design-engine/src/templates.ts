import type { Format } from "./formats";
import { fitText, newId } from "./ops";
import type { Brand, Copy, Design, Layer, ShapeLayer, TextLayer } from "./types";

/**
 * Templates build a full, editable design for any format from a brand + copy. Layout is
 * proportional, so one template works for A4, square, portrait, story and landscape.
 */

export type TemplateId = "editorial" | "bold" | "split";

export const TEMPLATES: {
  id: TemplateId;
  title: string;
  description: string;
  needsImage: boolean;
}[] = [
  {
    id: "editorial",
    title: "Editorial",
    description: "Full-bleed photo, soft gradient, confident headline",
    needsImage: true,
  },
  {
    id: "bold",
    title: "Bold",
    description: "Solid brand colour, oversized type, geometric accents",
    needsImage: false,
  },
  {
    id: "split",
    title: "Split",
    description: "Photo and colour block side by side (or stacked)",
    needsImage: true,
  },
];

const defaultCopy = (brand: Brand): Required<Copy> => ({
  eyebrow: brand.industry.toUpperCase(),
  headline: brand.tagline.replace(/\.$/, ""),
  subhead: brand.features.slice(0, 3).join(" · "),
  body: `${brand.name} helps ${brand.audience.toLowerCase()}.`,
  cta: "Learn more",
  footer: brand.website || brand.name,
});

function text(
  p: Partial<TextLayer> &
    Pick<TextLayer, "role" | "text" | "x" | "y" | "w" | "h" | "fontSize" | "fontFamily" | "color">,
): TextLayer {
  return {
    id: newId(),
    name: p.role === "free" ? "Text" : p.role[0]!.toUpperCase() + p.role.slice(1),
    type: "text",
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fontWeight: 400,
    italic: false,
    align: "left",
    lineHeight: 1.15,
    letterSpacing: 0,
    uppercase: false,
    background: null,
    padding: 0,
    radius: 0,
    ...p,
  };
}

function shape(
  p: Partial<ShapeLayer> & Pick<ShapeLayer, "x" | "y" | "w" | "h" | "fill">,
): ShapeLayer {
  return {
    id: newId(),
    name: "Shape",
    type: "shape",
    shape: "rect",
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fill2: null,
    gradientAngle: 180,
    radius: 0,
    stroke: null,
    strokeWidth: 0,
    ...p,
  };
}

export function buildDesign(opts: {
  template: TemplateId;
  format: Format;
  brand: Brand;
  copy?: Copy;
  imageUrl?: string | null;
}): Design {
  const { format, brand } = opts;
  const c = { ...defaultCopy(brand), ...stripEmpty(opts.copy ?? {}) };
  const W = format.width;
  const H = format.height;
  const u = Math.min(W, H) / 100; // 1 unit = 1% of the short side
  const landscape = W / H > 1.3;
  const pad = Math.round(7 * u);
  const layers: Layer[] = [];
  let background: Design["background"];

  const headlineSize = Math.round((landscape ? 9 : 11) * u);
  const ctaH = Math.round(8 * u);
  const ctaW = Math.round(Math.max(28 * u, c.cta.length * 2.4 * u + 10 * u));

  if (opts.template === "editorial") {
    background = {
      color: brand.primary,
      imageUrl: opts.imageUrl ?? null,
      overlay: null,
      overlayOpacity: 0,
    };
    layers.push(
      shape({
        name: "Gradient",
        x: 0,
        y: landscape ? 0 : H * 0.35,
        w: landscape ? W * 0.62 : W,
        h: landscape ? H : H * 0.65,
        fill: hexA(brand.primary, 0),
        fill2: brand.primary,
        gradientAngle: landscape ? 270 : 180,
        locked: false,
      }),
    );
    const colW = landscape ? W * 0.5 : W - pad * 2;
    const bottom = H - pad;
    const footerY = bottom - Math.round(3 * u);
    const ctaY = footerY - Math.round(5 * u) - ctaH;
    const subY = ctaY - Math.round(4 * u) - Math.round(9 * u);
    const headH = Math.round(headlineSize * 1.1 * 3);
    const headY = subY - Math.round(2 * u) - headH;
    const eyeY = headY - Math.round(6 * u);
    layers.push(
      text({
        role: "eyebrow",
        text: c.eyebrow,
        x: pad,
        y: eyeY,
        w: colW,
        h: Math.round(4 * u),
        fontSize: Math.round(2.6 * u),
        fontWeight: 700,
        letterSpacing: 0.18,
        uppercase: true,
        fontFamily: brand.bodyFont,
        color: brand.accent,
      }),
      text({
        role: "headline",
        text: c.headline,
        x: pad,
        y: headY,
        w: colW,
        h: headH,
        fontSize: headlineSize,
        fontWeight: 800,
        lineHeight: 1.04,
        letterSpacing: -0.02,
        fontFamily: brand.headingFont,
        color: "#ffffff",
      }),
      text({
        role: "subhead",
        text: c.subhead,
        x: pad,
        y: subY,
        w: colW,
        h: Math.round(9 * u),
        fontSize: Math.round(3.4 * u),
        lineHeight: 1.35,
        fontFamily: brand.bodyFont,
        color: "#E8ECF4",
      }),
      text({
        role: "cta",
        text: c.cta,
        x: pad,
        y: ctaY,
        w: ctaW,
        h: ctaH,
        fontSize: Math.round(3.1 * u),
        fontWeight: 700,
        align: "center",
        fontFamily: brand.headingFont,
        color: brand.primary,
        background: brand.accent,
        radius: ctaH / 2,
        padding: Math.round(2 * u),
        lineHeight: 1.0,
      }),
      text({
        role: "footer",
        text: c.footer,
        x: pad,
        y: footerY,
        w: colW,
        h: Math.round(3.5 * u),
        fontSize: Math.round(2.3 * u),
        fontFamily: brand.bodyFont,
        color: "#C9D1DF",
        letterSpacing: 0.04,
      }),
    );
  } else if (opts.template === "bold") {
    background = { color: brand.primary, imageUrl: null, overlay: null, overlayOpacity: 0 };
    layers.push(
      shape({
        name: "Accent circle",
        shape: "ellipse",
        x: W - 46 * u,
        y: -18 * u,
        w: 70 * u,
        h: 70 * u,
        fill: brand.accent,
        opacity: 0.9,
      }),
      shape({
        name: "Ring",
        shape: "ellipse",
        x: W - 60 * u,
        y: -6 * u,
        w: 70 * u,
        h: 70 * u,
        fill: hexA(brand.secondary, 0),
        stroke: brand.secondary,
        strokeWidth: Math.round(1.2 * u),
      }),
      shape({
        name: "Bar",
        x: pad,
        y: H - pad - Math.round(1.2 * u),
        w: Math.round(18 * u),
        h: Math.round(1.2 * u),
        fill: brand.accent,
      }),
    );
    const colW = landscape ? W * 0.6 : W - pad * 2;
    const big = Math.round((landscape ? 10 : 13.5) * u);
    const headY = landscape ? pad + Math.round(8 * u) : H * 0.3;
    const headH = Math.round(big * 1.0 * 3);
    layers.push(
      text({
        role: "eyebrow",
        text: c.eyebrow,
        x: pad,
        y: pad,
        w: colW,
        h: Math.round(4 * u),
        fontSize: Math.round(2.6 * u),
        fontWeight: 700,
        letterSpacing: 0.2,
        uppercase: true,
        fontFamily: brand.bodyFont,
        color: brand.accent,
      }),
      text({
        role: "headline",
        text: c.headline,
        x: pad,
        y: headY,
        w: colW,
        h: headH,
        fontSize: big,
        fontWeight: 900,
        lineHeight: 0.98,
        letterSpacing: -0.035,
        fontFamily: brand.headingFont,
        color: "#ffffff",
      }),
      text({
        role: "subhead",
        text: c.subhead,
        x: pad,
        y: headY + headH + Math.round(3 * u),
        w: colW * 0.9,
        h: Math.round(10 * u),
        fontSize: Math.round(3.4 * u),
        lineHeight: 1.35,
        fontFamily: brand.bodyFont,
        color: "#DDE3EE",
      }),
      text({
        role: "cta",
        text: c.cta,
        x: pad,
        y: H - pad - Math.round(6 * u) - ctaH,
        w: ctaW,
        h: ctaH,
        fontSize: Math.round(3.1 * u),
        fontWeight: 700,
        align: "center",
        fontFamily: brand.headingFont,
        color: brand.primary,
        background: "#ffffff",
        radius: Math.round(1.2 * u),
        lineHeight: 1.0,
      }),
      text({
        role: "footer",
        text: c.footer,
        x: W - pad - colW * 0.5,
        y: H - pad - Math.round(3.5 * u),
        w: colW * 0.5,
        h: Math.round(3.5 * u),
        fontSize: Math.round(2.3 * u),
        align: "right",
        fontFamily: brand.bodyFont,
        color: "#C9D1DF",
      }),
    );
  } else {
    // split
    background = { color: brand.primary, imageUrl: null, overlay: null, overlayOpacity: 0 };
    // Side by side unless the canvas is clearly portrait; stacked text gets the space left over.
    const sideBySide = W / H > 0.85;
    const imgH = Math.round(H * 0.46);
    const imgBox = sideBySide
      ? { x: W * 0.5, y: 0, w: W * 0.5, h: H }
      : { x: 0, y: 0, w: W, h: imgH };
    if (opts.imageUrl)
      layers.push({
        id: newId(),
        name: "Photo",
        type: "image",
        src: opts.imageUrl,
        fit: "cover",
        radius: 0,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        ...imgBox,
      });
    else
      layers.push(
        shape({
          name: "Photo placeholder",
          ...imgBox,
          fill: brand.secondary,
          fill2: brand.accent,
          gradientAngle: 135,
        }),
      );
    const area = sideBySide
      ? { x: pad, y: pad, w: W * 0.5 - pad * 2 }
      : { x: pad, y: imgH + pad, w: W - pad * 2 };
    const reservedBottom = pad + ctaH + Math.round(10 * u);
    const available = H - area.y - reservedBottom - Math.round(10 * u);
    const headH = Math.round(available * 0.62);
    const hs = Math.round(Math.min((landscape ? 7.5 : 9) * u, headH / (1.05 * 3), area.w / 9));
    layers.push(
      shape({
        name: "Accent bar",
        x: area.x,
        y: area.y,
        w: Math.round(10 * u),
        h: Math.round(1 * u),
        fill: brand.accent,
      }),
      text({
        role: "headline",
        text: c.headline,
        x: area.x,
        y: area.y + Math.round(4 * u),
        w: area.w,
        h: headH,
        fontSize: hs,
        fontWeight: 800,
        lineHeight: 1.05,
        letterSpacing: -0.02,
        fontFamily: brand.headingFont,
        color: "#ffffff",
      }),
      text({
        role: "subhead",
        text: c.subhead,
        x: area.x,
        y: area.y + Math.round(6 * u) + headH,
        w: area.w,
        h: Math.max(Math.round(available * 0.3), Math.round(4 * u)),
        fontSize: Math.round(3.2 * u),
        lineHeight: 1.4,
        fontFamily: brand.bodyFont,
        color: "#DDE3EE",
      }),
      text({
        role: "cta",
        text: c.cta,
        x: area.x,
        y: H - pad - ctaH - Math.round(4 * u),
        w: ctaW,
        h: ctaH,
        fontSize: Math.round(3 * u),
        fontWeight: 700,
        align: "center",
        fontFamily: brand.headingFont,
        color: brand.primary,
        background: brand.accent,
        radius: ctaH / 2,
        lineHeight: 1.0,
      }),
      text({
        role: "footer",
        text: c.footer,
        x: area.x,
        y: H - pad - Math.round(3 * u),
        w: area.w,
        h: Math.round(3.5 * u),
        fontSize: Math.round(2.2 * u),
        fontFamily: brand.bodyFont,
        color: "#C9D1DF",
      }),
    );
  }

  return {
    version: 1,
    width: W,
    height: H,
    background,
    layers: layers
      .map((l) => ({
        ...l,
        x: Math.round(l.x),
        y: Math.round(l.y),
        w: Math.round(l.w),
        h: Math.round(l.h),
      }))
      .map((l) => (l.type === "text" ? fitText(l) : l)),
  };
}

function stripEmpty(c: Copy): Copy {
  return Object.fromEntries(
    Object.entries(c).filter(([, v]) => typeof v === "string" && v.trim()),
  ) as Copy;
}

/** "#RRGGBB" + alpha → "#RRGGBBAA". */
export function hexA(hex: string, alpha: number): string {
  const h = hex.replace("#", "").slice(0, 6);
  return `#${h}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
