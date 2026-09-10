import { describe, expect, it } from "vitest";
import {
  CharacterAssetEngine,
  createBuiltinAsset,
} from "../packages/character-assets/src/index.js";

describe("CharacterAssetEngine", () => {
  it("creates a valid hair asset", () => {
    const asset = createBuiltinAsset({
      name: "Short Brown Hair",

      slot: "hair",

      kind: "sprite",

      representations: ["2d"],

      contentHash:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",

      metadata: {
        tags: ["hair", "short", "brown"],
        style: "cartoon",
        colors: ["#24170F"],
      },
    });

    expect(asset.name).toBe(
      "Short Brown Hair",
    );

    expect(asset.slot).toBe(
      "hair",
    );

    expect(asset.enabled).toBe(true);
  });

  it("fingerprint is deterministic", () => {
    const engine =
      new CharacterAssetEngine();

    const asset = createBuiltinAsset({
      name: "Blue Shirt",

      slot: "top",

      kind: "sprite",

      representations: ["2d"],

      contentHash:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",

      metadata: {
        tags: ["shirt", "blue"],
        colors: ["#3A6EA5"],
      },
    });

    const first =
      engine.fingerprint(asset);

    const second =
      engine.fingerprint(
        structuredClone(asset),
      );

    expect(first).toBe(second);
  });

  it("supports representation checks", () => {
    const engine =
      new CharacterAssetEngine();

    const asset = createBuiltinAsset({
      name: "3D Hair",

      slot: "hair",

      kind: "mesh",

      representations: ["3d"],

      contentHash:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    });

    expect(
      engine.supportsRepresentation(
        asset,
        "3d",
      ),
    ).toBe(true);

    expect(
      engine.supportsRepresentation(
        asset,
        "2d",
      ),
    ).toBe(false);
  });

  it("creates immutable variants", () => {
    const engine =
      new CharacterAssetEngine();

    const asset = createBuiltinAsset({
      name: "Original Hair",

      slot: "hair",

      kind: "sprite",

      representations: ["2d"],

      contentHash:
        "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    });

    const variant =
      engine.createVariant(
        asset,
        "Long Hair",
        {
          tags: [
            "hair",
            "long",
          ],
        },
      );

    expect(variant.id).not.toBe(
      asset.id,
    );

    expect(
      variant.metadata.variantOf,
    ).toBe(asset.id);

    expect(
      asset.name,
    ).toBe("Original Hair");
  });
});