import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FRAME_HELD,
  FRAME_MOVE_SPEED,
  FrameController,
  INITIAL_FRAME_RECT,
} from '../../app/src/game/frameController';

const RIGHT = { ...EMPTY_FRAME_HELD, right: true };
const LEFT = { ...EMPTY_FRAME_HELD, left: true };
const DOWN = { ...EMPTY_FRAME_HELD, down: true };

function close(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
}

describe('R4c FrameController', () => {
  test('初始矩形沿用 R3.4 0.16/0.18/0.68/0.58', () => {
    const controller = new FrameController();
    assert.deepEqual(controller.rect, INITIAL_FRAME_RECT);
    assert.equal(controller.speed, FRAME_MOVE_SPEED);
  });

  test('dtMs 上限 50ms：1000ms 只推进 50ms', () => {
    const controller = new FrameController();
    controller.update(1000, RIGHT);
    close(controller.rect.x, INITIAL_FRAME_RECT.x + FRAME_MOVE_SPEED * 0.05);
    close(controller.deltaX, FRAME_MOVE_SPEED * 0.05);
  });

  test('向右/左 clamp 到 [0, 1-width]', () => {
    const controller = new FrameController();
    for (let index = 0; index < 100; index += 1) controller.update(50, RIGHT);
    close(controller.rect.x, 1 - INITIAL_FRAME_RECT.width);
    assert.equal(controller.deltaX, 0);

    for (let index = 0; index < 100; index += 1) controller.update(50, LEFT);
    close(controller.rect.x, 0);
    assert.equal(controller.deltaX, 0);
  });

  test('向下 clamp 到 [0, 1-height]', () => {
    const controller = new FrameController();
    for (let index = 0; index < 100; index += 1) controller.update(50, DOWN);
    close(controller.rect.y, 1 - INITIAL_FRAME_RECT.height);
  });

  test('暂停冻结：setActive(false) 不移动，恢复后继续', () => {
    const controller = new FrameController();
    controller.update(50, RIGHT);
    const before = controller.rect.x;
    controller.setActive(false);
    controller.update(50, RIGHT);
    close(controller.rect.x, before);
    assert.equal(controller.deltaX, 0);
    controller.setActive(true);
    controller.update(50, RIGHT);
    assert.ok(controller.rect.x > before);
  });

  test('reset 回到初始矩形', () => {
    const controller = new FrameController();
    controller.update(50, RIGHT);
    controller.reset();
    assert.deepEqual(controller.rect, INITIAL_FRAME_RECT);
    assert.equal(controller.deltaX, 0);
  });

  test('非法/非正 dt 不移动；对角线不比单轴快', () => {
    const controller = new FrameController();
    controller.update(-10, RIGHT);
    controller.update(Number.NaN, RIGHT);
    assert.deepEqual(controller.rect, INITIAL_FRAME_RECT);

    const diagonal = new FrameController();
    diagonal.update(50, { ...RIGHT, down: true });
    const dx = diagonal.rect.x - INITIAL_FRAME_RECT.x;
    const dy = diagonal.rect.y - INITIAL_FRAME_RECT.y;
    assert.ok(Math.hypot(dx, dy) <= FRAME_MOVE_SPEED * 0.05 + 1e-9);
  });
});
