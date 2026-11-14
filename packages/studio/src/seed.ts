import type { Brand } from "@boma/design-engine";

/**
 * Starter brand kits. Concrete Estimating Platform and Cynthus Collections come from the
 * Creative Studio v1 prototype; OnGroundPM matches the pilot workspace. Feature lists are
 * reference content: confirm them before publishing (they are not in any claim register).
 */
export const STARTER_BRANDS: (Brand & { workspace: string | null; image: string })[] = [
  {
    id: "ongroundpm",
    workspace: "ongroundpm",
    name: "OnGroundPM",
    tagline: "Your property, looked after on the ground.",
    industry: "Property management",
    audience: "Melbourne landlords and property investors",
    tone: "Calm, practical, trustworthy",
    primary: "#10241F",
    secondary: "#2F5D50",
    accent: "#E9B872",
    logoText: "OG",
    website: "",
    features: ["In-person property inspections", "Photo reports", "Local tradie coordination"],
    headingFont: "Manrope",
    bodyFont: "DM Sans",
    image: "/templates/property.webp",
  },
  {
    id: "concrete-estimating",
    workspace: null,
    name: "Concrete Estimating Platform",
    tagline: "From drawings to submitted tender, in one place.",
    industry: "Construction technology",
    audience: "Australian concrete contractors, estimators and subcontractors",
    tone: "Confident, practical, precise",
    primary: "#0E1C2F",
    secondary: "#233C52",
    accent: "#E8A160",
    logoText: "CE",
    website: "",
    features: [
      "Takeoff tools",
      "Specialist calculators",
      "Product catalogue",
      "AI-assisted document review with human approval",
    ],
    headingFont: "Manrope",
    bodyFont: "DM Sans",
    image: "/templates/construction.webp",
  },
  {
    id: "cynthus-collections",
    workspace: null,
    name: "Cynthus Collections",
    tagline: "Flavours worth gathering for.",
    industry: "Food & catering",
    audience: "Families and event organisers in Melbourne",
    tone: "Warm, inviting, vibrant",
    primary: "#3A2131",
    secondary: "#785249",
    accent: "#E6A56D",
    logoText: "CC",
    website: "",
    features: ["African-inspired cuisine", "Bulk meal orders", "Event catering"],
    headingFont: "Fraunces",
    bodyFont: "DM Sans",
    image: "/templates/food.webp",
  },
];

/**
 * Placeholder backgrounds shipped with the app (generated with OpenArt, Nano Banana 2.1).
 * The owner's own images are uploaded through the editor's image library and replace these.
 */
export const STOCK_IMAGES = [
  { src: "/templates/property.webp", label: "Melbourne terrace, golden hour" },
  { src: "/templates/construction.webp", label: "Architectural concrete, blue hour" },
  { src: "/templates/food.webp", label: "African feast, overhead" },
  { src: "/templates/abstract-story.webp", label: "Glass ribbons, navy & amber" },
];
