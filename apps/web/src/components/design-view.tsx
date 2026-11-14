import type { CSSProperties } from "react";
import type { Design, Layer, ShapeLayer, TextLayer } from "@boma/design-engine";

/**
 * DOM renderer for a design. Layers are placed in design pixels inside a stage that is scaled
 * with a CSS transform, so thumbnails, the editor and the canvas exporter share one layout.
 */

export function layerBox(l: Layer): CSSProperties {
  return {
    position: "absolute",
    left: l.x,
    top: l.y,
    width: l.w,
    height: l.h,
    transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
    opacity: l.opacity,
    display: l.hidden ? "none" : undefined,
  };
}

export function textStyle(l: TextLayer): CSSProperties {
  return {
    fontFamily: `"${l.fontFamily}", system-ui, sans-serif`,
    fontSize: l.fontSize,
    fontWeight: l.fontWeight,
    fontStyle: l.italic ? "italic" : "normal",
    color: l.color,
    textAlign: l.align,
    lineHeight: l.lineHeight,
    letterSpacing: `${l.letterSpacing}em`,
    textTransform: l.uppercase ? "uppercase" : "none",
    background: l.background ?? undefined,
    borderRadius: l.radius,
    padding: l.padding,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    wordBreak: "break-word",
    display: l.background ? "flex" : "block",
    alignItems: l.background ? "center" : undefined,
    justifyContent: l.background
      ? l.align === "center"
        ? "center"
        : l.align === "right"
          ? "flex-end"
          : "flex-start"
      : undefined,
  };
}

export function shapeStyle(l: ShapeLayer): CSSProperties {
  return {
    background: l.fill2 ? `linear-gradient(${l.gradientAngle}deg, ${l.fill}, ${l.fill2})` : l.fill,
    borderRadius: l.shape === "ellipse" ? "50%" : l.radius,
    border: l.stroke && l.strokeWidth ? `${l.strokeWidth}px solid ${l.stroke}` : undefined,
    boxSizing: "border-box",
  };
}

export function LayerContent({ layer }: { layer: Layer }) {
  if (layer.type === "text") {
    return <div style={{ ...textStyle(layer), width: "100%", height: "100%" }}>{layer.text}</div>;
  }
  if (layer.type === "shape")
    return <div style={{ ...shapeStyle(layer), width: "100%", height: "100%" }} />;
  return (
    <img
      src={layer.src}
      alt=""
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        objectFit: layer.fit,
        borderRadius: layer.radius,
        display: "block",
      }}
    />
  );
}

export function Backdrop({ design }: { design: Design }) {
  const b = design.background;
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: b.color }} />
      {b.imageUrl && (
        <img
          src={b.imageUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
      {b.overlay && b.overlayOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: b.overlay,
            opacity: b.overlayOpacity,
          }}
        />
      )}
    </>
  );
}

/** Static, scaled preview of a design (thumbnails, campaign cards). */
export function DesignView({
  design,
  width,
  className,
}: {
  design: Design;
  width: number;
  className?: string;
}) {
  const scale = width / design.width;
  return (
    <div
      className={className}
      style={{ width, height: design.height * scale, position: "relative", overflow: "hidden" }}
    >
      <div
        style={{
          width: design.width,
          height: design.height,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          position: "absolute",
        }}
      >
        <Backdrop design={design} />
        {design.layers.map((l) => (
          <div key={l.id} style={layerBox(l)}>
            <LayerContent layer={l} />
          </div>
        ))}
      </div>
    </div>
  );
}
