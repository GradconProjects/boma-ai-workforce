import { describe, expect, it } from "vitest";
import { FORMATS, getFormat } from "./formats";
import {
  addLayer,
  alignLayer,
  applyBrand,
  applyCopy,
  duplicateLayer,
  extractCopy,
  History,
  removeLayer,
  reorderLayer,
  snap,
  updateLayer,
} from "./ops";
import { buildDesign, TEMPLATES } from "./templates";
import { wrapText } from "./text";
import { designSchema, type Brand } from "./types";

const brand: Brand = {
  id: "ongroundpm",
  name: "OnGroundPM",
  tagline: "Your property, looked after on the ground.",
  industry: "Property management",
  audience: "Melbourne landlords and investors",
  tone: "Calm, practical",
  primary: "#12312B",
  secondary: "#2E5E4E",
  accent: "#E9B872",
  logoText: "OG",
  website: "ongroundpm.com.au",
  features: ["In-person inspections", "Same-day photo reports", "Local tradie network"],
  headingFont: "Manrope",
  bodyFont: "DM Sans",
};

describe("design engine", () => {
  it("every template builds a valid design for every format, inside the canvas", () => {
    for (const t of TEMPLATES) {
      for (const f of FORMATS) {
        const d = buildDesign({ template: t.id, format: f, brand, imageUrl: "/templates/x.jpg" });
        expect(() => designSchema.parse(d), `${t.id}/${f.id}`).not.toThrow();
        expect(d.width).toBe(f.width);
        for (const l of d.layers.filter((x) => x.type === "text")) {
          expect(l.x, `${t.id}/${f.id}/${l.name}`).toBeGreaterThanOrEqual(0);
          expect(l.y + l.h, `${t.id}/${f.id}/${l.name}`).toBeLessThanOrEqual(f.height + 1);
          expect(l.x + l.w, `${t.id}/${f.id}/${l.name}`).toBeLessThanOrEqual(f.width + 1);
        }
      }
    }
  });

  it("copy maps onto text layers by role and can be read back", () => {
    const d = buildDesign({ template: "editorial", format: getFormat("social-square"), brand });
    const withCopy = applyCopy(d, {
      headline: "Away from Melbourne?",
      cta: "Book an inspection",
      body: "",
    });
    expect(extractCopy(withCopy)).toMatchObject({
      headline: "Away from Melbourne?",
      cta: "Book an inspection",
    });
    expect(extractCopy(withCopy).subhead).toBe(extractCopy(d).subhead); // untouched roles stay
  });

  it("edits are immutable and undoable", () => {
    const d = buildDesign({ template: "bold", format: getFormat("story"), brand });
    const h = new History(d);
    const head = d.layers.find((l) => l.type === "text" && l.role === "headline")!;
    h.push(updateLayer(h.present, head.id, { x: 10 }));
    const { design, newId } = duplicateLayer(h.present, head.id);
    h.push(design);
    expect(h.present.layers).toHaveLength(d.layers.length + 1);
    h.push(removeLayer(h.present, newId));
    h.undo();
    expect(h.present.layers.some((l) => l.id === newId)).toBe(true);
    h.undo();
    h.undo();
    expect(h.present).toBe(d);
    expect(h.canUndo).toBe(false);
    h.redo();
    expect(h.present.layers.find((l) => l.id === head.id)!.x).toBe(10);
  });

  it("reorders, aligns and snaps", () => {
    let d = buildDesign({ template: "split", format: getFormat("social-square"), brand });
    const first = d.layers[0]!.id;
    d = reorderLayer(d, first, "front");
    expect(d.layers.at(-1)!.id).toBe(first);
    d = alignLayer(d, first, "hcenter");
    const l = d.layers.at(-1)!;
    expect(l.x).toBe(Math.round((d.width - l.w) / 2));
    expect(snap(533, 20, 1080).value).toBe(530); // snaps to centre
    expect(snap(400, 20, 1080).guide).toBeNull();
    d = addLayer(d, { ...l, id: "extra" });
    expect(d.layers.at(-1)!.id).toBe("extra");
  });

  it("re-brands colours and fonts", () => {
    const d = buildDesign({ template: "bold", format: getFormat("social-square"), brand });
    const other: Brand = {
      ...brand,
      primary: "#412637",
      secondary: "#785249",
      accent: "#E6A56D",
      headingFont: "Fraunces",
    };
    const r = applyBrand(d, brand, other);
    expect(r.background.color).toBe("#412637");
    const head = r.layers.find((l) => l.type === "text" && l.role === "headline");
    expect(head && head.type === "text" && head.fontFamily).toBe("Fraunces");
  });

  it("wraps text to the box width, breaking very long words", () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapText("one two three four", 100, measure)).toEqual(["one two", "three four"]);
    expect(wrapText("a\n\nb", 100, measure)).toEqual(["a", "", "b"]);
    expect(wrapText("abcdefghijklmnop", 50, measure).every((l) => l.length <= 5)).toBe(true);
  });
});
