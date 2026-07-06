import Phaser from 'phaser';
import { JUICE } from '../config/juice';
import { VISUAL } from '../config/visual';

interface FloatingSlot {
  text: Phaser.GameObjects.Text;
  spawnX: number;
  spawnY: number;
  ageSeconds: number;
  active: boolean;
}

export class FloatingTextPool {
  private readonly slots: FloatingSlot[] = [];

  constructor(scene: Phaser.Scene) {
    const style = JUICE.floatingText;
    for (let index = 0; index < style.poolSize; index++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: 'monospace',
          fontSize: `${style.fontSizePx}px`,
          color: style.color,
          stroke: style.strokeColor,
          strokeThickness: style.strokeThicknessPx,
        })
        .setOrigin(0.5, 1)
        .setDepth(VISUAL.depths.floatingText)
        .setVisible(false);
      this.slots.push({ text, spawnX: 0, spawnY: 0, ageSeconds: 0, active: false });
    }
  }

  spawn(screenX: number, screenY: number, label: string): void {
    const slot = this.claimSlot();
    slot.active = true;
    slot.spawnX = screenX;
    slot.spawnY = screenY;
    slot.ageSeconds = 0;
    slot.text.setText(label).setPosition(screenX, screenY).setAlpha(1).setVisible(true);
  }

  update(realDeltaSeconds: number): void {
    const style = JUICE.floatingText;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      slot.ageSeconds += realDeltaSeconds;
      const progress = slot.ageSeconds / style.lifeSeconds;
      if (progress >= 1) {
        slot.active = false;
        slot.text.setVisible(false);
        continue;
      }
      slot.text.setPosition(slot.spawnX, slot.spawnY - style.risePx * progress).setAlpha(1 - progress);
    }
  }

  private claimSlot(): FloatingSlot {
    let oldest = this.slots[0];
    for (const slot of this.slots) {
      if (!slot.active) return slot;
      if (slot.ageSeconds > oldest.ageSeconds) oldest = slot;
    }
    return oldest;
  }
}
