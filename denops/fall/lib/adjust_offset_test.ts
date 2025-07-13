import { assertEquals } from "@std/assert";
import { adjustOffset } from "./adjust_offset.ts";

Deno.test("adjustOffset", async (t) => {
  const count = 10;
  const viewSize = 5;
  const scrollOffset = 2;
  /**
   * ```
   * ┌v────────┐
   * │0 1 2 3 4│5 6 7 8 9
   * └^────────┘
   * ┌──v──────┐
   * │0 1 2 3 4│5 6 7 8 9
   * └──^──────┘
   * ┌────v────┐
   * │0 1 2 3 4│5 6 7 8 9
   * └────^────┘
   * ┌──────v──┐
   * │0 1 2 3 4│5 6 7 8 9
   * └──────^──┘
   *   ┌──────v──┐
   *  0│1 2 3 4 5│6 7 8 9
   *   └──────^──┘
   *     ┌──────v──┐
   *  0 1│2 3 4 5 6│7 8 9
   *     └──────^──┘
   *       ┌──────v──┐
   *  0 1 2│3 4 5 6 7│8 9
   *       └──────^──┘
   *         ┌──────v──┐
   *  0 1 2 3│4 5 6 7 8│9
   *         └──────^──┘
   *           ┌──────v──┐
   *  0 1 2 3 4│5 6 7 8 9│
   *           └──────^──┘
   *           ┌────────v┐
   *  0 1 2 3 4│5 6 7 8 9│
   *           └────────^┘
   * ```
   */
  await t.step("scrolling to right", () => {
    assertEquals(adjustOffset(0, 0, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 1, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 2, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 3, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 4, count, viewSize, scrollOffset), 1);
    assertEquals(adjustOffset(1, 5, count, viewSize, scrollOffset), 2);
    assertEquals(adjustOffset(2, 6, count, viewSize, scrollOffset), 3);
    assertEquals(adjustOffset(3, 7, count, viewSize, scrollOffset), 4);
    assertEquals(adjustOffset(4, 8, count, viewSize, scrollOffset), 5);
    assertEquals(adjustOffset(5, 9, count, viewSize, scrollOffset), 5);
  });

  /**
   * ```
   *           ┌────────v┐
   *  0 1 2 3 4│5 6 7 8 9│
   *           └────────^┘
   *           ┌──────v──┐
   *  0 1 2 3 4│5 6 7 8 9│
   *           └──────^──┘
   *           ┌────v────┐
   *  0 1 2 3 4│5 6 7 8 9│
   *           └────^────┘
   *           ┌──v──────┐
   *  0 1 2 3 4│5 6 7 8 9│
   *           └──^──────┘
   *         ┌──v──────┐
   *  0 1 2 3│4 5 6 7 8│9
   *         └──^──────┘
   *       ┌──v──────┐
   *  0 1 2│3 4 5 6 7│8 9
   *       └──^──────┘
   *     ┌──v──────┐
   *  0 1│2 3 4 5 6│7 8 9
   *     └──^──────┘
   *   ┌──v──────┐
   *  0│1 2 3 4 5│6 7 8 9
   *   └──^──────┘
   * ┌──v──────┐
   * │0 1 2 3 4│5 6 7 8 9
   * └──^──────┘
   * ┌v────────┐
   * │0 1 2 3 4│5 6 7 8 9
   * └^────────┘
   * ```
   */
  await t.step("scrolling to left", () => {
    assertEquals(adjustOffset(5, 9, count, viewSize, scrollOffset), 5);
    assertEquals(adjustOffset(5, 8, count, viewSize, scrollOffset), 5);
    assertEquals(adjustOffset(5, 7, count, viewSize, scrollOffset), 5);
    assertEquals(adjustOffset(5, 6, count, viewSize, scrollOffset), 5);
    assertEquals(adjustOffset(5, 5, count, viewSize, scrollOffset), 4);
    assertEquals(adjustOffset(5, 4, count, viewSize, scrollOffset), 3);
    assertEquals(adjustOffset(5, 3, count, viewSize, scrollOffset), 2);
    assertEquals(adjustOffset(5, 2, count, viewSize, scrollOffset), 1);
    assertEquals(adjustOffset(5, 1, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(5, 0, count, viewSize, scrollOffset), 0);
  });

  /**
   * ```
   * ┌v────────┐
   * │0 1 2 3  │
   * └^────────┘
   * ┌──v──────┐
   * │0 1 2 3  │
   * └──^──────┘
   * ┌────v────┐
   * │0 1 2 3  │
   * └────^────┘
   * ┌──────v──┐
   * │0 1 2 3  │
   * └──────^──┘
   * ```
   */
  await t.step("scrolling to right (count < win)", () => {
    const count = 4;
    const viewSize = 5;
    const scrollOffset = 5;
    assertEquals(adjustOffset(0, 0, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 1, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 2, count, viewSize, scrollOffset), 0);
    assertEquals(adjustOffset(0, 3, count, viewSize, scrollOffset), 0);
  });

  /**
   * ```
   * ┌──v──────┐
   * │* 0 1 2 3│4 5 6 7 8 9
   * └──^──────┘
   *   ┌v────────┐
   *   │0 1 2 3 4│5 6 7 8 9
   *   └^────────┘
   * ```
   */
  await t.step("invalid offset (too small)", () => {
    const count = 10;
    const viewSize = 5;
    const scrollOffset = 2;
    assertEquals(adjustOffset(-1, 0, count, viewSize, scrollOffset), 0);
  });

  /**
   * ```
   *            ┌──────v──┐
   * 0 1 2 3 4 5│6 7 8 9 *│
   *            └──────^──┘
   *          ┌────────v┐
   * 0 1 2 3 4│5 6 7 8 9│
   *          └────────^┘
   * ```
   */
  await t.step("invalid offset (too large)", () => {
    const count = 10;
    const viewSize = 5;
    const scrollOffset = 2;
    assertEquals(adjustOffset(6, 9, count, viewSize, scrollOffset), 5);
  });
  /**
   * ```
   *                   v┌─────────┐
   * 0 1 2 3 4 5 6 7 8 9│*        │
   *                   ^└─────────┘
   *          ┌────────v┐
   * 0 1 2 3 4│5 6 7 8 9│
   *          └────────^┘
   * ```
   */
  await t.step("invalid offset (too large)", () => {
    const count = 10;
    const viewSize = 5;
    const scrollOffset = 2;
    assertEquals(adjustOffset(10, 9, count, viewSize, scrollOffset), 5);
  });
});
