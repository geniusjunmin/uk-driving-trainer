import type { DrivingFault } from '../rules/RuleEngine';

export interface LevelRecord {
  readonly timestamp: number;
  readonly levelId: string;
  readonly score: number;
  readonly faults: readonly DrivingFault[];
}

export interface ScoreStorageData {
  readonly records: LevelRecord[];
  readonly highScores: Record<string, number>;
  readonly unlockedLevels: string[];
}

const STORAGE_KEY = 'uk_driving_trainer_save_data';

const DEFAULT_DATA: ScoreStorageData = {
  records: [],
  highScores: {},
  unlockedLevels: ['level-1'],
};

const PASS_THRESHOLDS: Record<string, number> = {
  'level-1': 80,
  'level-2': 75,
  'level-3': 75,
  'level-4': 70,
  'level-5': 75,
  'level-6': 70,
};

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class ScoreStorage {
  static loadData(): ScoreStorageData {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_DATA };
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.saveData(DEFAULT_DATA);
      return { ...DEFAULT_DATA };
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.checksum !== 'string') {
        this.saveData(DEFAULT_DATA);
        return { ...DEFAULT_DATA };
      }

      // Check integrity
      const dataStr = JSON.stringify(parsed.data);
      const computed = fnv1a(dataStr);
      if (computed !== parsed.checksum) {
        console.warn('ScoreStorage: Save data checksum mismatch, data corrupted or tampered. Resetting storage.');
        this.saveData(DEFAULT_DATA);
        return { ...DEFAULT_DATA };
      }

      // Validate data structure basic fields
      const data = parsed.data as ScoreStorageData;
      if (!Array.isArray(data.records) || !data.highScores || !Array.isArray(data.unlockedLevels)) {
        this.saveData(DEFAULT_DATA);
        return { ...DEFAULT_DATA };
      }

      return data;
    } catch (e) {
      console.error('ScoreStorage: Error parsing save data.', e);
      this.saveData(DEFAULT_DATA);
      return { ...DEFAULT_DATA };
    }
  }

  static saveData(data: ScoreStorageData): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const dataStr = JSON.stringify(data);
      const checksum = fnv1a(dataStr);
      const payload = JSON.stringify({ data, checksum });
      window.localStorage.setItem(STORAGE_KEY, payload);
    } catch (e) {
      console.error('ScoreStorage: Failed to save data to localStorage.', e);
    }
  }

  static saveRecord(levelId: string, score: number, faults: readonly DrivingFault[]): LevelRecord {
    const data = this.loadData();

    // Create a new record
    const record: LevelRecord = {
      timestamp: Date.now(),
      levelId,
      score,
      faults,
    };

    // Append record
    const records = [...data.records, record];

    // Update high scores
    const highScores = { ...data.highScores };
    const currentHigh = highScores[levelId] ?? 0;
    if (score > currentHigh) {
      highScores[levelId] = score;
    }

    // Handle unlocking next level if passed
    const unlockedLevels = [...data.unlockedLevels];
    const threshold = PASS_THRESHOLDS[levelId] ?? 70; // fallback default
    if (score >= threshold) {
      const match = levelId.match(/^level-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num < 6) {
          const nextLevelId = `level-${num + 1}`;
          if (!unlockedLevels.includes(nextLevelId)) {
            unlockedLevels.push(nextLevelId);
          }
        }
      }
    }

    const updatedData: ScoreStorageData = {
      records,
      highScores,
      unlockedLevels,
    };

    this.saveData(updatedData);
    return record;
  }

  static getHighScores(): Record<string, number> {
    const data = this.loadData();
    return data.highScores;
  }

  static getUnlockedLevels(): string[] {
    const data = this.loadData();
    return data.unlockedLevels;
  }

  static getRecords(): LevelRecord[] {
    const data = this.loadData();
    return data.records;
  }

  static resetStorage(): void {
    this.saveData(DEFAULT_DATA);
  }
}

// Also export standalone functions for easier imports
export function saveRecord(levelId: string, score: number, faults: readonly DrivingFault[]): LevelRecord {
  return ScoreStorage.saveRecord(levelId, score, faults);
}

export function getHighScores(): Record<string, number> {
  return ScoreStorage.getHighScores();
}

export function getUnlockedLevels(): string[] {
  return ScoreStorage.getUnlockedLevels();
}

export function resetStorage(): void {
  ScoreStorage.resetStorage();
}
