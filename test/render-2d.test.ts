import { describe, expect, it } from "vitest";

import {
  SvgRenderer,
  createSvgRenderer,
} from "../packages/render-2d/src/index.js";

function baseState() {
  return {
    projectId: "project-001",
    revisionId: "revision-001",
    tick: 0,
    camera: {
      position: { x: 0, y: 0, z: 10 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
    },
    entities: [],
  };
}

describe("render-2d / SvgRenderer", () => {
  it("creates a renderer through the factory", () => {
    const renderer = createSvgRenderer();

    expect(renderer).toBeInstanceOf(SvgRenderer);
    expect(renderer.version).toBe("1.0.0");
  });

  it("normalizes valid options", () => {
    const renderer = new SvgRenderer();

    expect(
      renderer.validateOptions({
        width: 1920,
        height: 1080,
        transparent: true,
        backgroundColor: "#123456",
        includeMetadata: false,
      }),
    ).toEqual({
      width: 1920,
      height: 1080,
      transparent: true,
      backgroundColor: "#123456",
      includeMetadata: false,
    });
  });

  it("uses defaults for invalid numeric dimensions", () => {
    const renderer = new SvgRenderer();

    expect(
      renderer.validateOptions({
        width: Number.NaN,
        height: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      width: 1280,
      height: 720,
      transparent: false,
      backgroundColor: "#87CEEB",
      includeMetadata: true,
    });
  });

  it("rejects missing render options", () => {
    const renderer = new SvgRenderer();

    expect(() =>
      renderer.validateOptions(
        undefined as never,
      ),
    ).toThrow(
      "SVG render options are required.",
    );
  });

  it("rejects dimensions above the core maximum", () => {
    const renderer = new SvgRenderer();

    expect(() =>
      renderer.validateOptions({
        width: 16_385,
        height: 720,
      }),
    ).toThrow(
      "SVG render dimensions must not exceed 16384 pixels.",
    );
  });

  it("renders a minimal SVG document", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      baseState(),
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      '<svg xmlns="http://www.w3.org/2000/svg"',
    );
    expect(svg).toContain(
      'width="640"',
    );
    expect(svg).toContain(
      'height="360"',
    );
    expect(svg).toContain(
      'viewBox="0 0 640 360"',
    );
    expect(svg).toContain(
      '<g id="scene-root">',
    );
    expect(svg).toContain(
      "</g></svg>",
    );
  });

  it("includes metadata by default", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      baseState(),
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      "<metadata>Cartoon Animation Engine 2D SVG Renderer 1.0.0</metadata>",
    );
  });

  it("can disable metadata", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      baseState(),
      {
        width: 640,
        height: 360,
        includeMetadata: false,
      },
    );

    expect(svg).not.toContain(
      "<metadata>",
    );
  });

  it("renders an opaque background", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        background: {
          color: "#112233",
        },
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'fill="#112233"',
    );
    expect(svg).toContain(
      'width="640" height="360"',
    );
  });

  it("omits the background rectangle when transparent", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        background: {
          color: "#112233",
        },
      },
      {
        width: 640,
        height: 360,
        transparent: true,
      },
    );

    expect(svg).not.toContain(
      '<rect x="0" y="0" width="640" height="360"',
    );
  });

  it("rejects null render state", () => {
    const renderer = new SvgRenderer();

    expect(() =>
      renderer.render(
        null,
        {
          width: 640,
          height: 360,
        },
      ),
    ).toThrow(
      "SVG render state must be an object.",
    );
  });

  it("rejects array render state", () => {
    const renderer = new SvgRenderer();

    expect(() =>
      renderer.render(
        [],
        {
          width: 640,
          height: 360,
        },
      ),
    ).toThrow(
      "SVG render state must be an object.",
    );
  });

  it("renders a character", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "character-001",
            type: "character",
            components: {
              skin: "#AA7744",
              hairColor: "#111111",
              topColor: "#336699",
              eyeColor: "#00AAFF",
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'id="character-001"',
    );
    expect(svg).toContain(
      'fill="#AA7744"',
    );
    expect(svg).toContain(
      'fill="#111111"',
    );
    expect(svg).toContain(
      'fill="#336699"',
    );
    expect(svg).toContain(
      'fill="#00AAFF"',
    );
  });

  it("applies facial evaluation to a character", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "character-001",
            type: "character",
            evaluation: {
              facial: {
                smile: 1,
                mouthOpen: 1,
                browRaise: 1,
                eyeSquint: 1,
                blink: 1,
              },
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'ry="1.5"',
    );
    expect(svg).toContain(
      'cy="-30"',
    );
    expect(svg).toContain(
      'ry="18"',
    );
  });

  it("renders props with labels", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "chair-001",
            type: "prop",
            name: "Chair",
            components: {
              width: 120,
              height: 80,
              color: "#654321",
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'id="chair-001"',
    );
    expect(svg).toContain(
      'fill="#654321"',
    );
    expect(svg).toContain(
      ">Chair</text>",
    );
  });

  it("renders text entities with safe text", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "text-001",
            type: "text",
            components: {
              text: '<script>alert("x")</script>',
              fontSize: 32,
              color: "#123456",
              anchor: "middle",
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(svg).not.toContain(
      "<script>",
    );
  });

  it("renders circle, ellipse and rectangle shapes", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "circle-001",
            type: "shape",
            components: {
              shape: "circle",
              radius: 20,
            },
          },
          {
            id: "ellipse-001",
            type: "shape",
            components: {
              shape: "ellipse",
              rx: 30,
              ry: 15,
            },
          },
          {
            id: "rect-001",
            type: "shape",
            components: {
              shape: "rectangle",
              width: 100,
              height: 50,
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      '<circle cx="0" cy="0" r="20"',
    );
    expect(svg).toContain(
      '<ellipse cx="0" cy="0" rx="30" ry="15"',
    );
    expect(svg).toContain(
      'width="100" height="50"',
    );
  });

  it("renders a scene entity", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "scene-001",
            type: "scene",
            components: {
              backgroundColor: "#445566",
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'id="scene-001"',
    );
    expect(svg).toContain(
      'fill="#445566"',
    );
  });

  it("renders a fallback for unknown entity types", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "unknown-001",
            type: "unknown-type",
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'id="unknown-001"',
    );
    expect(svg).toContain(
      'stroke="#666666"',
    );
  });

  it("applies transforms and camera zoom", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        camera: {
          position: { x: 10, y: 20, z: 10 },
          target: { x: 0, y: 0, z: 0 },
          zoom: 2,
        },
        entities: [
          {
            id: "shape-001",
            type: "shape",
            transform: {
              position: { x: 20, y: 30, z: 0 },
              rotation: { z: 45 },
              scale: { x: 2, y: 3, z: 1 },
            },
            components: {
              shape: "circle",
              radius: 10,
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'translate(340 200)',
    );
    expect(svg).toContain(
      'rotate(45)',
    );
    expect(svg).toContain(
      'scale(2 3)',
    );
  });

  it("clamps opacity", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "shape-001",
            type: "shape",
            components: {
              opacity: 10,
            },
          },
          {
            id: "shape-002",
            type: "shape",
            components: {
              opacity: -10,
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'id="shape-001" transform="translate(320 180) rotate(0) scale(1 1)" opacity="1"',
    );
    expect(svg).toContain(
      'id="shape-002" transform="translate(320 180) rotate(0) scale(1 1)" opacity="0"',
    );
  });

  it("renders sprites with safe references", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "sprite-001",
            type: "sprite",
            components: {
              src: "assets/hero.png",
              width: 128,
              height: 128,
            },
          },
          {
            id: "sprite-002",
            type: "sprite",
            components: {
              src: "javascript:alert(1)",
              width: 128,
              height: 128,
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'href="assets/hero.png"',
    );
    expect(svg).not.toContain(
      'href="javascript:alert(1)"',
    );
  });

  it("allows safe HTTPS image references", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "sprite-001",
            type: "sprite",
            components: {
              src: "https://example.com/image.png",
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'href="https://example.com/image.png"',
    );
  });

  it("allows image data URLs for supported image formats", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "sprite-001",
            type: "sprite",
            components: {
              src: "data:image/png;base64,AAAA",
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(svg).toContain(
      'href="data:image/png;base64,AAAA"',
    );
  });

  it("rejects unsafe file and script image references", () => {
    const renderer = new SvgRenderer();

    for (const src of [
      "javascript:alert(1)",
      "vbscript:msgbox(1)",
      "file:///C:/secret.png",
      "//evil.example/image.png",
    ]) {
      const svg = renderer.render(
        {
          ...baseState(),
          entities: [
            {
              id: "sprite-001",
              type: "sprite",
              components: {
                src,
              },
            },
          ],
        },
        {
          width: 640,
          height: 360,
        },
      );

      expect(svg).not.toContain(
        `href="${src}"`,
      );
    }
  });

  it("uses deterministic entity ordering", () => {
    const renderer = new SvgRenderer();

    const state = {
      ...baseState(),
      entities: [
        {
          id: "back",
          type: "shape",
          components: {
            renderOrder: 0,
          },
        },
        {
          id: "front",
          type: "shape",
          components: {
            renderOrder: 10,
          },
        },
      ],
    };

    const first =
      renderer.render(
        state,
        {
          width: 640,
          height: 360,
        },
      );

    const second =
      renderer.render(
        {
          ...state,
          entities: [...state.entities].reverse(),
        },
        {
          width: 640,
          height: 360,
        },
      );

    expect(first).toContain(
      'id="back"',
    );
    expect(first).toContain(
      'id="front"',
    );

    expect(
      first.indexOf('id="back"'),
    ).toBeLessThan(
      first.indexOf('id="front"'),
    );

    expect(
      second.indexOf('id="back"'),
    ).toBeLessThan(
      second.indexOf('id="front"'),
    );
  });

  it("uses z as a deterministic secondary render order", () => {
    const renderer = new SvgRenderer();

    const svg = renderer.render(
      {
        ...baseState(),
        entities: [
          {
            id: "front",
            type: "shape",
            transform: {
              position: { x: 0, y: 0, z: 10 },
            },
          },
          {
            id: "back",
            type: "shape",
            transform: {
              position: { x: 0, y: 0, z: 1 },
            },
          },
        ],
      },
      {
        width: 640,
        height: 360,
      },
    );

    expect(
      svg.indexOf('id="back"'),
    ).toBeLessThan(
      svg.indexOf('id="front"'),
    );
  });

  it("returns a structured render result", () => {
    const renderer = new SvgRenderer();

    const result =
      renderer.renderResult(
        baseState(),
        {
          width: 640,
          height: 360,
        },
      );

    expect(result.width).toBe(640);
    expect(result.height).toBe(360);
    expect(result.renderer).toBe("svg");
    expect(result.version).toBe("1.0.0");
    expect(result.svg).toContain("<svg");
  });

  it("produces identical SVG for identical state and options", () => {
    const renderer = new SvgRenderer();

    const state = {
      ...baseState(),
      entities: [
        {
          id: "shape-001",
          type: "shape",
          transform: {
            position: { x: 10, y: 20, z: 0 },
          },
          components: {
            shape: "circle",
            radius: 20,
            color: "#123456",
          },
        },
      ],
    };

    const options = {
      width: 640,
      height: 360,
    };

    expect(
      renderer.render(state, options),
    ).toBe(
      renderer.render(state, options),
    );
  });
});
