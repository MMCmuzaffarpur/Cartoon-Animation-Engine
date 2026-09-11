import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/* -------------------------------------------------------------------------- */
/* Public Types                                                               */
/* -------------------------------------------------------------------------- */

export interface SvgRenderOptions {
  width: number;
  height: number;
  transparent?: boolean;
  backgroundColor?: string;
  includeMetadata?: boolean;
}

export interface Render2DResult {
  svg: string;
  width: number;
  height: number;
  renderer: "svg";
  version: "1.0.0";
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Transform {
  position?: Partial<Vec3>;
  rotation?: Partial<Vec3>;
  scale?: Partial<Vec3>;
}

interface RenderEntity {
  id?: string;
  type?: string;
  name?: string;
  transform?: Transform;
  components?: Record<string, unknown>;
  evaluation?: {
    motion?: Record<string, number>;
    facial?: Record<string, number>;
    viseme?: {
      viseme?: string;
      weight?: number;
    } | null;
  };
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const RENDERER_VERSION = "1.0.0" as const;

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_BACKGROUND = "#87CEEB";

const DEFAULT_SKIN = "#F1C7A8";
const DEFAULT_HAIR = "#24170F";
const DEFAULT_TOP = "#3A6EA5";

const MAX_DIMENSION = 16_384;

/* -------------------------------------------------------------------------- */
/* Safe Helpers                                                               */
/* -------------------------------------------------------------------------- */

function finiteNumber(
  value: unknown,
  fallback: number,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function positiveNumber(
  value: unknown,
  fallback: number,
): number {
  const n = finiteNumber(value, fallback);
  return n > 0 ? n : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

function asString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function color(
  value: unknown,
  fallback: string,
): string {
  const candidate =
    asString(value, fallback).trim();

  /*
   * SVG color values are restricted to common CSS
   * color syntaxes so project data cannot inject
   * arbitrary SVG markup.
   */
  if (
    /^#[0-9a-fA-F]{3,8}$/.test(candidate) ||
    /^rgba?\([^)]*\)$/.test(candidate) ||
    /^hsla?\([^)]*\)$/.test(candidate) ||
    /^[a-zA-Z]+$/.test(candidate)
  ) {
    return candidate;
  }

  return fallback;
}

function escapeXml(
  value: unknown,
): string {
  return asString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function point(
  value: unknown,
  fallback: Vec3,
): Vec3 {
  const v =
    value &&
    typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  return {
    x: finiteNumber(v.x, fallback.x),
    y: finiteNumber(v.y, fallback.y),
    z: finiteNumber(v.z, fallback.z),
  };
}

function scale(
  value: unknown,
): Vec3 {
  const v =
    value &&
    typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  return {
    x: positiveNumber(v.x, 1),
    y: positiveNumber(v.y, 1),
    z: positiveNumber(v.z, 1),
  };
}

function rotation(
  value: unknown,
): Vec3 {
  const v =
    value &&
    typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  return {
    x: finiteNumber(v.x, 0),
    y: finiteNumber(v.y, 0),
    z: finiteNumber(v.z, 0),
  };
}

function transformOf(
  entity: RenderEntity,
): {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
} {
  return {
    position: point(
      entity.transform?.position,
      { x: 0, y: 0, z: 0 },
    ),
    rotation: rotation(
      entity.transform?.rotation,
    ),
    scale: scale(
      entity.transform?.scale,
    ),
  };
}

function componentsOf(
  entity: RenderEntity,
): Record<string, unknown> {
  return entity.components ?? {};
}

/* -------------------------------------------------------------------------- */
/* Camera                                                                     */
/* -------------------------------------------------------------------------- */

function cameraScale(
  state: any,
): number {
  const zoom =
    finiteNumber(
      state?.camera?.zoom,
      1,
    );

  return clamp(
    zoom,
    0.01,
    100,
  );
}

function cameraOffset(
  state: any,
): {
  x: number;
  y: number;
} {
  const camera =
    state?.camera ?? {};

  const position =
    point(
      camera.position,
      { x: 0, y: 0, z: 10 },
    );

  return {
    x: position.x,
    y: position.y,
  };
}

function worldToScreen(
  position: Vec3,
  state: any,
  width: number,
  height: number,
): {
  x: number;
  y: number;
} {
  const zoom =
    cameraScale(state);

  const camera =
    cameraOffset(state);

  return {
    x:
      width / 2 +
      (position.x - camera.x) *
        zoom,

    y:
      height / 2 +
      (position.y - camera.y) *
        zoom,
  };
}

/* -------------------------------------------------------------------------- */
/* Entity Ordering                                                            */
/* -------------------------------------------------------------------------- */

function renderOrder(
  entity: RenderEntity,
  originalIndex: number,
): number {
  const components =
    componentsOf(entity);

  const layer =
    finiteNumber(
      components.renderOrder,
      finiteNumber(
        components.layerOrder,
        0,
      ),
    );

  const z =
    finiteNumber(
      entity.transform?.position?.z,
      0,
    );

  /*
   * The original index is the final deterministic
   * tie-breaker. The caller passes the original
   * position instead of using Array#indexOf(), which
   * is incorrect when the same object reference occurs
   * more than once.
   */
  return (
    layer * 1_000_000 +
    z * 1_000 +
    originalIndex
  );
}

/* -------------------------------------------------------------------------- */
/* SVG Renderer                                                               */
/* -------------------------------------------------------------------------- */

export class SvgRenderer {
  readonly version =
    RENDERER_VERSION;

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  validateOptions(
    options: SvgRenderOptions,
  ): SvgRenderOptions {
    if (
      !options ||
      typeof options !== "object"
    ) {
      throw new Error(
        "SVG render options are required.",
      );
    }

    const width =
      Math.floor(
        positiveNumber(
          options.width,
          DEFAULT_WIDTH,
        ),
      );

    const height =
      Math.floor(
        positiveNumber(
          options.height,
          DEFAULT_HEIGHT,
        ),
      );

    if (
      width <= 0 ||
      height <= 0
    ) {
      throw new Error(
        "SVG render width and height must be positive.",
      );
    }

    if (
      width > MAX_DIMENSION ||
      height > MAX_DIMENSION
    ) {
      throw new Error(
        "SVG render dimensions must not exceed 16384 pixels.",
      );
    }

    return {
      width,
      height,

      transparent:
        options.transparent ??
        false,

      backgroundColor:
        color(
          options.backgroundColor,
          DEFAULT_BACKGROUND,
        ),

      includeMetadata:
        options.includeMetadata ??
        true,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Main Render                                                              */
  /* ------------------------------------------------------------------------ */

  render(
    state: any,
    options: SvgRenderOptions,
  ): string {
    if (
      state === null ||
      state === undefined ||
      typeof state !== "object" ||
      Array.isArray(state)
    ) {
      throw new Error(
        "SVG render state must be an object.",
      );
    }

    const normalized =
      this.validateOptions(
        options,
      );

    const width =
      normalized.width;

    const height =
      normalized.height;

    const sourceEntities =
      Array.isArray(state.entities)
        ? state.entities
        : [];

    /*
     * Decorate/sort/undecorate rather than calling
     * indexOf() inside the comparator. This guarantees
     * stable deterministic ordering even for duplicate
     * object references.
     */
    interface IndexedRenderEntity {
      entity: RenderEntity;
      index: number;
    }

    const indexedEntities: IndexedRenderEntity[] =
      sourceEntities.map(
        (
          entity: unknown,
          index: number,
        ): IndexedRenderEntity => ({
          entity:
            entity &&
            typeof entity === "object"
              ? entity as RenderEntity
              : {
                  id:
                    `entity-${index}`,
                },

          index,
        }),
      );

    indexedEntities.sort(
      (
        a: IndexedRenderEntity,
        b: IndexedRenderEntity,
      ) =>
        renderOrder(
          a.entity,
          a.index,
        ) -
        renderOrder(
          b.entity,
          b.index,
        ),
    );

    const entities: RenderEntity[] =
      indexedEntities.map(
        (
          item: IndexedRenderEntity,
        ): RenderEntity =>
          item.entity,
      );

    const parts: string[] = [];

    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${width}" ` +
      `height="${height}" ` +
      `viewBox="0 0 ${width} ${height}" ` +
      `version="1.1">`,
    );

    if (
      normalized.includeMetadata
    ) {
      parts.push(
        `<metadata>` +
        `Cartoon Animation Engine ` +
        `2D SVG Renderer ${RENDERER_VERSION}` +
        `</metadata>`,
      );
    }

    if (
      !normalized.transparent
    ) {
      const background =
        color(
          state?.background?.color,
          normalized.backgroundColor ??
            DEFAULT_BACKGROUND,
        );

      parts.push(
        `<rect ` +
        `x="0" y="0" ` +
        `width="${width}" ` +
        `height="${height}" ` +
        `fill="${escapeXml(background)}"/>`,
      );
    }

    parts.push(
      `<g id="scene-root">`,
    );

    for (
      const entity of entities
    ) {
      parts.push(
        this.renderEntity(
          entity,
          state,
          width,
          height,
        ),
      );
    }

    parts.push("</g>");
    parts.push("</svg>");

    return parts.join("");
  }

  /* ------------------------------------------------------------------------ */
  /* Structured Render                                                        */
  /* ------------------------------------------------------------------------ */

  renderResult(
    state: any,
    options: SvgRenderOptions,
  ): Render2DResult {
    const normalized =
      this.validateOptions(
        options,
      );

    return {
      svg:
        this.render(
          state,
          normalized,
        ),

      width:
        normalized.width,

      height:
        normalized.height,

      renderer:
        "svg",

      version:
        RENDERER_VERSION,
    };
  }

  /* ------------------------------------------------------------------------ */
  /* Entity Renderer                                                          */
  /* ------------------------------------------------------------------------ */

  private renderEntity(
    entity: RenderEntity,
    state: any,
    width: number,
    height: number,
  ): string {
    const transform =
      transformOf(entity);

    const components =
      componentsOf(entity);

    const screen =
      worldToScreen(
        transform.position,
        state,
        width,
        height,
      );

    const sx =
      transform.scale.x;

    const sy =
      transform.scale.y;

    const rz =
      transform.rotation.z;

    const opacity =
      clamp(
        finiteNumber(
          components.opacity,
          1,
        ),
        0,
        1,
      );

    const id =
      escapeXml(
        asString(
          entity.id,
          `entity-${Math.round(screen.x)}-${Math.round(screen.y)}`,
        ),
      );

    const transformString =
      `translate(${screen.x} ${screen.y}) ` +
      `rotate(${rz}) ` +
      `scale(${sx} ${sy})`;

    const commonStart =
      `<g id="${id}" ` +
      `transform="${transformString}" ` +
      `opacity="${opacity}">`;

    const type =
      asString(
        entity.type,
        "unknown",
      ).toLowerCase();

    let body = "";

    switch (type) {
      case "character":
        body =
          this.renderCharacter(
            entity,
          );
        break;

      case "prop":
        body =
          this.renderProp(
            entity,
          );
        break;

      case "text":
        body =
          this.renderText(
            entity,
          );
        break;

      case "sprite":
        body =
          this.renderSprite(
            entity,
          );
        break;

      case "shape":
        body =
          this.renderShape(
            entity,
          );
        break;

      case "scene":
        body =
          this.renderSceneEntity(
            entity,
            width,
            height,
          );
        break;

      default:
        body =
          this.renderFallback(
            entity,
          );
        break;
    }

    return (
      commonStart +
      body +
      "</g>"
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Character                                                                */
  /* ------------------------------------------------------------------------ */

  private renderCharacter(
    entity: RenderEntity,
  ): string {
    const components =
      componentsOf(entity);

    const evaluation =
      entity.evaluation ?? {};

    const facial =
      evaluation.facial ?? {};

    const skin =
      color(
        components.skin,
        DEFAULT_SKIN,
      );

    const hair =
      color(
        components.hairColor ??
          components.hair,
        DEFAULT_HAIR,
      );

    const top =
      color(
        components.topColor ??
          components.outfitColor,
        DEFAULT_TOP,
      );

    const eyeColor =
      color(
        components.eyeColor,
        "#222222",
      );

    const smile =
      clamp(
        finiteNumber(
          facial.smile,
          0,
        ),
        -1,
        1,
      );

    const mouthOpen =
      clamp(
        finiteNumber(
          facial.mouthOpen,
          0,
        ),
        0,
        1,
      );

    const browRaise =
      finiteNumber(
        facial.browRaise,
        0,
      );

    const eyeSquint =
      clamp(
        finiteNumber(
          facial.eyeSquint,
          0,
        ),
        -1,
        1,
      );

    const blink =
      clamp(
        finiteNumber(
          facial.blink,
          0,
        ),
        0,
        1,
      );

    const squintScale =
      clamp(
        1 -
          Math.max(
            0,
            eyeSquint,
          ) *
            0.55,
        0.35,
        1,
      );

    /*
     * Apply squint before the final minimum-height clamp.
     * This guarantees that a fully blinked eye cannot
     * become smaller than the canonical 1.5px closed-eye
     * threshold.
     */
    /*
     * squintScale is already included in eyeHeight.
     * Do not multiply it again during SVG emission,
     * otherwise blink + squint would be applied twice.
     */
    const eyeHeight =
      Math.max(
        1.5,
        6 * (1 - blink) * squintScale,
      );

    const eyeY =
      -25 -
      browRaise * 5;

    const mouthWidth =
      18 +
      Math.abs(smile) * 5;

    const mouthHeight =
      Math.max(
        2,
        4 +
          mouthOpen * 14,
      );

    return [
      `<ellipse ` +
        `cx="0" cy="90" ` +
        `rx="42" ry="12" ` +
        `fill="#000000" ` +
        `opacity="0.15"/>`,

      `<rect ` +
        `x="-30" y="20" ` +
        `width="60" height="70" ` +
        `rx="18" ` +
        `fill="${escapeXml(top)}"/>`,

      `<circle ` +
        `cx="0" cy="-25" ` +
        `r="48" ` +
        `fill="${escapeXml(skin)}"/>`,

      `<path ` +
        `d="M-45-28 Q0-75 45-28 ` +
        `L38-58 Q0-88-38-58Z" ` +
        `fill="${escapeXml(hair)}"/>`,

      `<ellipse ` +
        `cx="-17" ` +
        `cy="${eyeY}" ` +
        `rx="6" ` +
        `ry="${eyeHeight}" ` +
        `fill="${escapeXml(eyeColor)}"/>`,

      `<ellipse ` +
        `cx="17" ` +
        `cy="${eyeY}" ` +
        `rx="6" ` +
        `ry="${eyeHeight}" ` +
        `fill="${escapeXml(eyeColor)}"/>`,

      `<path ` +
        `d="M-7-8 Q0-3 7-8" ` +
        `fill="none" ` +
        `stroke="#9B6B55" ` +
        `stroke-width="2" ` +
        `stroke-linecap="round"/>`,

      `<ellipse ` +
        `cx="0" cy="5" ` +
        `rx="${mouthWidth}" ` +
        `ry="${mouthHeight}" ` +
        `fill="#5A2630"/>`,

      `<path ` +
        `d="M${-(mouthWidth - 3)} 5 ` +
        `Q0 ${5 - smile * 9} ` +
        `${mouthWidth - 3} 5" ` +
        `fill="none" ` +
        `stroke="#2F1118" ` +
        `stroke-width="2" ` +
        `stroke-linecap="round"/>`,
    ].join("");
  }

  /* ------------------------------------------------------------------------ */
  /* Prop                                                                     */
  /* ------------------------------------------------------------------------ */

  private renderProp(
    entity: RenderEntity,
  ): string {
    const c =
      componentsOf(entity);

    const width =
      positiveNumber(
        c.width,
        100,
      );

    const height =
      positiveNumber(
        c.height,
        60,
      );

    const fill =
      color(
        c.color,
        "#9B6B43",
      );

    const radius =
      positiveNumber(
        c.radius,
        6,
      );

    const label =
      escapeXml(
        entity.name ??
          c.label ??
          "",
      );

    const showLabel =
      label.length > 0;

    return [
      `<rect ` +
        `x="${-width / 2}" ` +
        `y="${-height / 2}" ` +
        `width="${width}" ` +
        `height="${height}" ` +
        `rx="${radius}" ` +
        `fill="${escapeXml(fill)}"/>`,

      showLabel
        ? `<text ` +
          `x="0" y="5" ` +
          `text-anchor="middle" ` +
          `font-family="sans-serif" ` +
          `font-size="16" ` +
          `fill="#FFFFFF">` +
          label +
          `</text>`
        : "",
    ].join("");
  }

  /* ------------------------------------------------------------------------ */
  /* Text                                                                     */
  /* ------------------------------------------------------------------------ */

  private renderText(
    entity: RenderEntity,
  ): string {
    const c =
      componentsOf(entity);

    const text =
      escapeXml(
        c.text ??
          entity.name ??
          "",
      );

    const fontSize =
      positiveNumber(
        c.fontSize,
        24,
      );

    const fill =
      color(
        c.color,
        "#222222",
      );

    const anchorValue =
      asString(
        c.anchor,
      );

    const anchor =
      ["start", "middle", "end"].includes(
        anchorValue,
      )
        ? anchorValue
        : "middle";

    const weight =
      asString(
        c.fontWeight,
        "normal",
      );

    return (
      `<text ` +
      `x="0" y="0" ` +
      `text-anchor="${anchor}" ` +
      `font-family="sans-serif" ` +
      `font-size="${fontSize}" ` +
      `font-weight="${escapeXml(weight)}" ` +
      `fill="${escapeXml(fill)}">` +
      text +
      `</text>`
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Sprite                                                                   */
  /* ------------------------------------------------------------------------ */

  private renderSprite(
    entity: RenderEntity,
  ): string {
    const c =
      componentsOf(entity);

    const width =
      positiveNumber(
        c.width,
        100,
      );

    const height =
      positiveNumber(
        c.height,
        100,
      );

    const href =
      asString(
        c.href ??
          c.src,
      ).trim();

    if (
      href.length === 0
    ) {
      return this.renderPlaceholder(
        width,
        height,
      );
    }

    /*
     * The renderer only serializes an already validated
     * asset reference. It does not execute, fetch, or
     * interpret the URL.
     *
     * Restricting the scheme here prevents project data
     * from introducing javascript: or other executable
     * SVG references.
     */
    if (
      !isSafeImageReference(href)
    ) {
      return this.renderPlaceholder(
        width,
        height,
      );
    }

    return (
      `<image ` +
      `x="${-width / 2}" ` +
      `y="${-height / 2}" ` +
      `width="${width}" ` +
      `height="${height}" ` +
      `preserveAspectRatio="xMidYMid meet" ` +
      `href="${escapeXml(href)}"/>`
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Generic Shape                                                            */
  /* ------------------------------------------------------------------------ */

  private renderShape(
    entity: RenderEntity,
  ): string {
    const c =
      componentsOf(entity);

    const shape =
      asString(
        c.shape,
        "rectangle",
      ).toLowerCase();

    const fill =
      color(
        c.fill ??
          c.color,
        "#808080",
      );

    const stroke =
      color(
        c.stroke,
        "none",
      );

    const strokeWidth =
      positiveNumber(
        c.strokeWidth,
        1,
      );

    if (
      shape === "circle"
    ) {
      const radius =
        positiveNumber(
          c.radius,
          40,
        );

      return (
        `<circle ` +
        `cx="0" cy="0" ` +
        `r="${radius}" ` +
        `fill="${escapeXml(fill)}" ` +
        `stroke="${escapeXml(stroke)}" ` +
        `stroke-width="${strokeWidth}"/>`
      );
    }

    if (
      shape === "ellipse"
    ) {
      const rx =
        positiveNumber(
          c.rx,
          50,
        );

      const ry =
        positiveNumber(
          c.ry,
          30,
        );

      return (
        `<ellipse ` +
        `cx="0" cy="0" ` +
        `rx="${rx}" ` +
        `ry="${ry}" ` +
        `fill="${escapeXml(fill)}" ` +
        `stroke="${escapeXml(stroke)}" ` +
        `stroke-width="${strokeWidth}"/>`
      );
    }

    const width =
      positiveNumber(
        c.width,
        100,
      );

    const height =
      positiveNumber(
        c.height,
        100,
      );

    const radius =
      Math.max(
        0,
        finiteNumber(
          c.radius,
          0,
        ),
      );

    return (
      `<rect ` +
      `x="${-width / 2}" ` +
      `y="${-height / 2}" ` +
      `width="${width}" ` +
      `height="${height}" ` +
      `rx="${radius}" ` +
      `fill="${escapeXml(fill)}" ` +
      `stroke="${escapeXml(stroke)}" ` +
      `stroke-width="${strokeWidth}"/>`
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Scene Entity                                                             */
  /* ------------------------------------------------------------------------ */

  private renderSceneEntity(
    entity: RenderEntity,
    width: number,
    height: number,
  ): string {
    const c =
      componentsOf(entity);

    const fill =
      color(
        c.color ??
          c.backgroundColor,
        DEFAULT_BACKGROUND,
      );

    return (
      `<rect ` +
      `x="${-width / 2}" ` +
      `y="${-height / 2}" ` +
      `width="${width}" ` +
      `height="${height}" ` +
      `fill="${escapeXml(fill)}"/>`
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Fallback                                                                 */
  /* ------------------------------------------------------------------------ */

  private renderFallback(
    entity: RenderEntity,
  ): string {
    const c =
      componentsOf(entity);

    const width =
      positiveNumber(
        c.width,
        80,
      );

    const height =
      positiveNumber(
        c.height,
        80,
      );

    return this.renderPlaceholder(
      width,
      height,
    );
  }

  private renderPlaceholder(
    width: number,
    height: number,
  ): string {
    return [
      `<rect ` +
        `x="${-width / 2}" ` +
        `y="${-height / 2}" ` +
        `width="${width}" ` +
        `height="${height}" ` +
        `fill="#CCCCCC" ` +
        `stroke="#666666" ` +
        `stroke-width="2"/>`,

      `<line ` +
        `x1="${-width / 2}" ` +
        `y1="${-height / 2}" ` +
        `x2="${width / 2}" ` +
        `y2="${height / 2}" ` +
        `stroke="#666666" ` +
        `stroke-width="2"/>`,

      `<line ` +
        `x1="${width / 2}" ` +
        `y1="${-height / 2}" ` +
        `x2="${-width / 2}" ` +
        `y2="${height / 2}" ` +
        `stroke="#666666" ` +
        `stroke-width="2"/>`,
    ].join("");
  }

  /* ------------------------------------------------------------------------ */
  /* File Output                                                              */
  /* ------------------------------------------------------------------------ */

  async writeFrame(
    state: any,
    options: SvgRenderOptions,
    directory: string,
    name: string,
  ): Promise<string> {
    if (
      typeof directory !== "string" ||
      directory.trim().length === 0
    ) {
      throw new Error(
        "SVG frame output directory must not be empty.",
      );
    }

    if (
      typeof name !== "string" ||
      name.trim().length === 0
    ) {
      throw new Error(
        "SVG frame filename must not be empty.",
      );
    }

    /*
     * Only a simple filename is accepted. This prevents
     * traversal outside the caller-provided directory.
     */
    if (
      name !== name.trim() ||
      name === "." ||
      name === ".." ||
      name.includes("/") ||
      name.includes("\\") ||
      name.includes("..")
    ) {
      throw new Error(
        "SVG frame name must be a simple filename.",
      );
    }

    const svg =
      this.render(
        state,
        options,
      );

    const path =
      join(
        directory,
        name,
      );

    await mkdir(
      dirname(path),
      {
        recursive: true,
      },
    );

    await writeFile(
      path,
      svg,
      "utf8",
    );

    return path;
  }
}

/* -------------------------------------------------------------------------- */
/* Asset Reference Safety                                                     */
/* -------------------------------------------------------------------------- */

function isSafeImageReference(
  value: string,
): boolean {
  const lower =
    value.trim().toLowerCase();

  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return false;
  }

  if (
    lower.startsWith("data:")
  ) {
    return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(
      value,
    );
  }

  if (
    lower.startsWith("https://") ||
    lower.startsWith("http://")
  ) {
    return true;
  }

  /*
   * Relative/local asset references are allowed.
   * The asset pipeline remains responsible for resolving
   * and validating their actual filesystem location.
   */
  return (
    !lower.includes("://") &&
    !lower.startsWith("//")
  );
}

/* -------------------------------------------------------------------------- */
/* Factory                                                                    */
/* -------------------------------------------------------------------------- */

export function createSvgRenderer(): SvgRenderer {
  return new SvgRenderer();
}
