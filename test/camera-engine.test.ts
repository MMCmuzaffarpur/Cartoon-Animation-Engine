import { describe, expect, it } from "vitest";

import {
  CameraEngine,
  DEFAULT_CAMERA_FOV,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
  DEFAULT_CAMERA_ZOOM,
} from "../packages/camera-engine/src/index.js";

describe("CameraEngine", () => {
  /* ------------------------------------------------------------------------ */
  /* Creation                                                                 */
  /* ------------------------------------------------------------------------ */

  it("creates an orthographic camera with deterministic defaults", () => {
    const engine = new CameraEngine();

    const camera = engine.create(
      "Main Camera",
      "orthographic",
    );

    expect(camera.id).toBeTruthy();
    expect(camera.name).toBe("Main Camera");
    expect(camera.type).toBe("orthographic");

    expect(camera.position).toEqual(
      DEFAULT_CAMERA_POSITION,
    );

    expect(camera.target).toEqual(
      DEFAULT_CAMERA_TARGET,
    );

    expect(camera.zoom).toBe(
      DEFAULT_CAMERA_ZOOM,
    );

    expect(camera.fov).toBe(
      DEFAULT_CAMERA_FOV,
    );
  });

  it("creates a perspective camera", () => {
    const engine = new CameraEngine();

    const camera = engine.create(
      "Perspective Camera",
      "perspective",
    );

    expect(camera.type).toBe(
      "perspective",
    );
  });

  it("rejects an empty camera name", () => {
    const engine = new CameraEngine();

    expect(() =>
      engine.create(""),
    ).toThrow(
      "Camera name must not be empty.",
    );

    expect(() =>
      engine.create("   "),
    ).toThrow(
      "Camera name must not be empty.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Validation                                                               */
  /* ------------------------------------------------------------------------ */

  it("validates a valid camera", () => {
    const engine = new CameraEngine();

    const camera = engine.create();

    const validated =
      engine.validate(camera);

    expect(validated).toEqual(camera);
    expect(validated).not.toBe(camera);
  });

  it("rejects invalid zoom", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    expect(() =>
      engine.setZoom(camera, 0),
    ).toThrow(
      "Camera zoom must be a positive finite number.",
    );

    expect(() =>
      engine.setZoom(camera, -1),
    ).toThrow(
      "Camera zoom must be a positive finite number.",
    );

    expect(() =>
      engine.setZoom(
        camera,
        Number.NaN,
      ),
    ).toThrow(
      "Camera zoom must be a positive finite number.",
    );
  });

  it("rejects invalid field of view", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    expect(() =>
      engine.setFov(camera, 0),
    ).toThrow(
      "Camera FOV must be between 0 and 180 degrees.",
    );

    expect(() =>
      engine.setFov(camera, 180),
    ).toThrow(
      "Camera FOV must be between 0 and 180 degrees.",
    );

    expect(() =>
      engine.setFov(camera, -10),
    ).toThrow(
      "Camera FOV must be between 0 and 180 degrees.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Position                                                                 */
  /* ------------------------------------------------------------------------ */

  it("sets camera position", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const moved =
      engine.setPosition(
        camera,
        {
          x: 5,
          y: 10,
          z: 20,
        },
      );

    expect(moved.position).toEqual({
      x: 5,
      y: 10,
      z: 20,
    });

    expect(camera.position).toEqual(
      DEFAULT_CAMERA_POSITION,
    );
  });

  it("moves camera by a delta", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const moved =
      engine.move(
        camera,
        {
          x: 2,
          y: -3,
          z: 4,
        },
      );

    expect(moved.position).toEqual({
      x: 2,
      y: -3,
      z: 14,
    });

    expect(camera.position).toEqual({
      x: 0,
      y: 0,
      z: 10,
    });
  });

  it("rejects non-finite position values", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    expect(() =>
      engine.setPosition(
        camera,
        {
          x: Number.NaN,
          y: 0,
          z: 10,
        },
      ),
    ).toThrow(
      "Camera position must contain finite x, y and z values.",
    );

    expect(() =>
      engine.move(
        camera,
        {
          x: 0,
          y: Number.POSITIVE_INFINITY,
          z: 0,
        },
      ),
    ).toThrow(
      "Camera movement must contain finite x, y and z values.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Look At                                                                   */
  /* ------------------------------------------------------------------------ */

  it("changes camera target with lookAt", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const result =
      engine.lookAt(
        camera,
        {
          x: 10,
          y: 20,
          z: 30,
        },
      );

    expect(result.target).toEqual({
      x: 10,
      y: 20,
      z: 30,
    });

    expect(camera.target).toEqual(
      DEFAULT_CAMERA_TARGET,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Zoom                                                                     */
  /* ------------------------------------------------------------------------ */

  it("sets zoom", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const result =
      engine.setZoom(
        camera,
        2.5,
      );

    expect(result.zoom).toBe(2.5);
    expect(camera.zoom).toBe(1);
  });

  it("changes zoom by an amount", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const result =
      engine.zoomBy(
        camera,
        0.75,
      );

    expect(result.zoom).toBe(1.75);
  });

  it("does not allow zoom below the minimum", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const result =
      engine.zoomBy(
        camera,
        -100,
      );

    expect(result.zoom).toBe(0.01);
  });

  it("rejects non-finite zoom amount", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    expect(() =>
      engine.zoomBy(
        camera,
        Number.NaN,
      ),
    ).toThrow(
      "Camera zoom amount must be finite.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Field of View                                                            */
  /* ------------------------------------------------------------------------ */

  it("sets field of view", () => {
    const engine = new CameraEngine();
    const camera = engine.create(
      "Camera",
      "perspective",
    );

    const result =
      engine.setFov(
        camera,
        60,
      );

    expect(result.fov).toBe(60);
    expect(camera.fov).toBe(45);
  });

  /* ------------------------------------------------------------------------ */
  /* Pan                                                                      */
  /* ------------------------------------------------------------------------ */

  it("pans camera position and target together", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    const result =
      engine.pan(
        camera,
        100,
        50,
      );

    expect(result.position).toEqual({
      x: 100,
      y: 50,
      z: 10,
    });

    expect(result.target).toEqual({
      x: 100,
      y: 50,
      z: 0,
    });
  });

  it("rejects non-finite pan values", () => {
    const engine = new CameraEngine();
    const camera = engine.create();

    expect(() =>
      engine.pan(
        camera,
        Number.NaN,
        0,
      ),
    ).toThrow(
      "Camera pan values must be finite.",
    );

    expect(() =>
      engine.pan(
        camera,
        0,
        Number.POSITIVE_INFINITY,
      ),
    ).toThrow(
      "Camera pan values must be finite.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Dolly                                                                    */
  /* ------------------------------------------------------------------------ */

  it("performs dolly movement toward the camera target", () => {
    const engine = new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.dolly(
        camera,
        2,
      );

    expect(result.position.x).toBeCloseTo(
      0,
    );

    expect(result.position.y).toBeCloseTo(
      0,
    );

    expect(result.position.z).toBeCloseTo(
      8,
    );

    expect(result.target).toEqual(
      camera.target,
    );
  });

  it("supports negative dolly distance", () => {
    const engine = new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.dolly(
        camera,
        -2,
      );

    expect(result.position.z).toBeCloseTo(
      12,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Follow                                                                   */
  /* ------------------------------------------------------------------------ */

  it("follows a target while preserving Z by default", () => {
    const engine = new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.follow(
        camera,
        {
          x: 20,
          y: 10,
          z: 30,
        },
        1,
      );

    expect(result.position).toEqual({
      x: 20,
      y: 10,
      z: 10,
    });

    expect(result.target).toEqual({
      x: 20,
      y: 10,
      z: 30,
    });
  });

  it("follows a target with interpolation weight", () => {
    const engine = new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.follow(
        camera,
        {
          x: 20,
          y: 10,
          z: 30,
        },
        0.5,
      );

    expect(result.position).toEqual({
      x: 10,
      y: 5,
      z: 10,
    });
  });

  it("can follow target Z when preserveZ is false", () => {
    const engine = new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.follow(
        camera,
        {
          x: 20,
          y: 10,
          z: 30,
        },
        1,
        {
          preserveZ: false,
        },
      );

    expect(result.position).toEqual({
      x: 20,
      y: 10,
      z: 30,
    });
  });

  it("clamps follow weight to the valid range", () => {
    const engine = new CameraEngine();

    const camera =
      engine.create();

    const low =
      engine.follow(
        camera,
        {
          x: 20,
          y: 10,
          z: 30,
        },
        -5,
      );

    expect(low.position).toEqual(
      camera.position,
    );

    const high =
      engine.follow(
        camera,
        {
          x: 20,
          y: 10,
          z: 30,
        },
        5,
      );

    expect(high.position).toEqual({
      x: 20,
      y: 10,
      z: 10,
    });
  });

  /* ------------------------------------------------------------------------ */
  /* Interpolation                                                            */
  /* ------------------------------------------------------------------------ */

  it("interpolates between two cameras", () => {
    const engine =
      new CameraEngine();

    const from =
      engine.create(
        "From",
        "orthographic",
      );

    const to =
      engine.setFov(
        engine.setZoom(
          engine.setPosition(
            engine.lookAt(
              from,
              {
                x: 20,
                y: 20,
                z: 0,
              },
            ),
            {
              x: 20,
              y: 10,
              z: 20,
            },
          ),
          3,
        ),
        90,
      );

    const result =
      engine.interpolate(
        from,
        to,
        0.5,
      );

    expect(result.position).toEqual({
      x: 10,
      y: 5,
      z: 15,
    });

    expect(result.target).toEqual({
      x: 10,
      y: 10,
      z: 0,
    });

    expect(result.zoom).toBe(2);
    expect(result.fov).toBe(67.5);
  });

  it("rejects interpolation between different camera types", () => {
    const engine =
      new CameraEngine();

    const orthographic =
      engine.create(
        "Ortho",
        "orthographic",
      );

    const perspective =
      engine.create(
        "Perspective",
        "perspective",
      );

    expect(() =>
      engine.interpolate(
        orthographic,
        perspective,
        0.5,
      ),
    ).toThrow(
      "Cannot interpolate cameras with different camera types.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Presets                                                                  */
  /* ------------------------------------------------------------------------ */

  it("creates a close-up camera preset", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.closeUp(
        camera,
        {
          x: 5,
          y: 6,
          z: 0,
        },
      );

    expect(result.zoom).toBe(2.2);

    expect(result.target).toEqual({
      x: 5,
      y: 6,
      z: 0,
    });
  });

  it("creates a medium-shot camera preset", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.mediumShot(
        camera,
        {
          x: 5,
          y: 6,
          z: 0,
        },
      );

    expect(result.zoom).toBe(1.35);

    expect(result.target).toEqual({
      x: 5,
      y: 6,
      z: 0,
    });
  });

  it("creates a wide camera preset", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.wide(camera);

    expect(result.zoom).toBe(0.8);
  });

  /* ------------------------------------------------------------------------ */
  /* Camera Shake                                                             */
  /* ------------------------------------------------------------------------ */

  it("produces deterministic camera shake", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const first =
      engine.shake(
        camera,
        10,
        {
          amplitude: 0.5,
          frequency: 2,
          seed: 123,
        },
      );

    const second =
      engine.shake(
        camera,
        10,
        {
          amplitude: 0.5,
          frequency: 2,
          seed: 123,
        },
      );

    expect(first).toEqual(
      second,
    );
  });

  it("changes camera position when shake amplitude is positive", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.shake(
        camera,
        10,
        {
          amplitude: 1,
          frequency: 1,
          seed: 42,
        },
      );

    expect(result.position).not.toEqual(
      camera.position,
    );
  });

  it("does not change camera position when shake amplitude is zero", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.shake(
        camera,
        10,
        {
          amplitude: 0,
          frequency: 1,
          seed: 42,
        },
      );

    expect(result.position).toEqual(
      camera.position,
    );
  });

  it("rejects invalid camera shake parameters", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    expect(() =>
      engine.shake(
        camera,
        Number.NaN,
      ),
    ).toThrow(
      "Camera shake tick must be finite.",
    );

    expect(() =>
      engine.shake(
        camera,
        10,
        {
          amplitude: -1,
        },
      ),
    ).toThrow(
      "Camera shake amplitude must be a non-negative finite number.",
    );

    expect(() =>
      engine.shake(
        camera,
        10,
        {
          frequency: -1,
        },
      ),
    ).toThrow(
      "Camera shake frequency must be a non-negative finite number.",
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Limits                                                                   */
  /* ------------------------------------------------------------------------ */

  it("applies position, zoom and FOV limits", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.setFov(
        engine.setZoom(
          engine.setPosition(
            engine.create(),
            {
              x: 100,
              y: -100,
              z: 50,
            },
          ),
          5,
        ),
        120,
      );

    const result =
      engine.applyLimits(
        camera,
        {
          minPosition: {
            x: -10,
            y: -20,
            z: 0,
          },
          maxPosition: {
            x: 10,
            y: 20,
            z: 20,
          },
          minZoom: 0.5,
          maxZoom: 2,
          minFov: 30,
          maxFov: 90,
        },
      );

    expect(result.position).toEqual({
      x: 10,
      y: -20,
      z: 20,
    });

    expect(result.zoom).toBe(2);
    expect(result.fov).toBe(90);
  });

  it("applies independent zoom and FOV limits", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.applyLimits(
        camera,
        {
          minZoom: 2,
          minFov: 60,
        },
      );

    expect(result.zoom).toBe(2);
    expect(result.fov).toBe(60);
  });

  /* ------------------------------------------------------------------------ */
  /* Evaluation                                                               */
  /* ------------------------------------------------------------------------ */

  it("evaluates a camera into a render-safe state", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const result =
      engine.evaluate(camera);

    expect(result).toEqual({
      position: camera.position,
      target: camera.target,
      zoom: camera.zoom,
      fov: camera.fov,
    });

    expect(result).not.toBe(
      camera,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Clone                                                                     */
  /* ------------------------------------------------------------------------ */

  it("deep clones a camera", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const cloned =
      engine.clone(camera);

    expect(cloned).toEqual(
      camera,
    );

    expect(cloned).not.toBe(
      camera,
    );

    expect(cloned.position).not.toBe(
      camera.position,
    );

    expect(cloned.target).not.toBe(
      camera.target,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Immutability                                                             */
  /* ------------------------------------------------------------------------ */

  it("does not mutate the original camera during transformations", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const original =
      structuredClone(camera);

    engine.setPosition(
      camera,
      {
        x: 50,
        y: 50,
        z: 50,
      },
    );

    engine.lookAt(
      camera,
      {
        x: 10,
        y: 20,
        z: 30,
      },
    );

    engine.setZoom(
      camera,
      3,
    );

    engine.setFov(
      camera,
      90,
    );

    engine.pan(
      camera,
      10,
      20,
    );

    expect(camera).toEqual(
      original,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Fingerprint                                                              */
  /* ------------------------------------------------------------------------ */

  it("produces a stable fingerprint for the same camera", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const first =
      engine.fingerprint(
        camera,
      );

    const second =
      engine.fingerprint(
        engine.clone(camera),
      );

    expect(first).toBe(
      second,
    );

    expect(first).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("changes fingerprint when camera state changes", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create();

    const first =
      engine.fingerprint(
        camera,
      );

    const changed =
      engine.setZoom(
        camera,
        2,
      );

    const second =
      engine.fingerprint(
        changed,
      );

    expect(second).not.toBe(
      first,
    );
  });

  /* ------------------------------------------------------------------------ */
  /* Contract Compatibility                                                   */
  /* ------------------------------------------------------------------------ */

  it("produces a camera compatible with the canonical contract", () => {
    const engine =
      new CameraEngine();

    const camera =
      engine.create(
        "Contract Camera",
        "perspective",
      );

    const validated =
      engine.validate(camera);

    expect(validated.id).toBe(
      camera.id,
    );

    expect(validated.type).toBe(
      "perspective",
    );

    expect(validated.position).toEqual({
      x: 0,
      y: 0,
      z: 10,
    });

    expect(validated.target).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });
});