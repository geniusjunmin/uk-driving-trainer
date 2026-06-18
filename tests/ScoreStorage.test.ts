import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ScoreStorage,
  getHighScores,
  getUnlockedLevels,
  saveRecord,
  resetStorage,
} from '../src/data/ScoreStorage';
import type { DrivingFault } from '../src/rules/RuleEngine';

// Simple localStorage mock
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

const localStorageMock = new LocalStorageMock();

describe('ScoreStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Mock global window and localStorage
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    });
    resetStorage();
  });

  it('starts with default data', () => {
    const unlocked = getUnlockedLevels();
    expect(unlocked).toEqual(['level-1']);

    const highScores = getHighScores();
    expect(highScores).toEqual({});
  });

  it('saves records and updates high scores', () => {
    const faults: DrivingFault[] = [
      {
        id: 'fault-1',
        ruleId: 'speed.limit.minor',
        severity: 'minor',
        message: 'Minor speeding',
        occurredAtSeconds: 10,
      },
    ];

    const record = saveRecord('level-1', 85, faults);

    expect(record.levelId).toBe('level-1');
    expect(record.score).toBe(85);
    expect(record.faults).toEqual(faults);

    const highScores = getHighScores();
    expect(highScores['level-1']).toBe(85);
  });

  it('unlocks next level if score is above threshold', () => {
    // Level 1 threshold is 80. Score 85 should unlock level-2.
    saveRecord('level-1', 85, []);
    expect(getUnlockedLevels()).toContain('level-2');

    // Score 70 is below Level 2 threshold (75). Should NOT unlock level-3.
    saveRecord('level-2', 70, []);
    expect(getUnlockedLevels()).not.toContain('level-3');

    // Score 76 is above Level 2 threshold (75). Should unlock level-3.
    saveRecord('level-2', 76, []);
    expect(getUnlockedLevels()).toContain('level-3');
  });

  it('detects tampering and resets storage when checksum mismatch occurs', () => {
    // Save normal record first
    saveRecord('level-1', 90, []);
    expect(getHighScores()['level-1']).toBe(90);

    // Get raw data in localStorage
    const raw = localStorageMock.getItem('uk_driving_trainer_save_data');
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    // Tamper with the score without updating checksum
    parsed.data.highScores['level-1'] = 100;
    localStorageMock.setItem('uk_driving_trainer_save_data', JSON.stringify(parsed));

    // Loading data should trigger validation check, fail, and reset storage
    const highScores = getHighScores();
    expect(highScores['level-1']).toBeUndefined(); // reset to default (empty)
    expect(getUnlockedLevels()).toEqual(['level-1']);
  });
});
