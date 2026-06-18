import { describe, expect, it, vi } from 'vitest';
import { ResultsPanel } from '../../src/ui/ResultsPanel';
import type { ScoreRecord } from '../../src/rules/ScoringSystem';

describe('ResultsPanel UI Tests', () => {
  it('should render results details correctly and handle action buttons', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const onRetry = vi.fn();
    const onNextLevel = vi.fn();
    const onMainMenu = vi.fn();

    const panel = new ResultsPanel(container, {
      onRetry,
      onNextLevel,
      onMainMenu,
    });

    const record: ScoreRecord = {
      levelId: 'Level 1: RHD Basics',
      score: 88,
      startTimeSeconds: 10.0,
      endTimeSeconds: 75.0, // 65 seconds total -> 01:05
      isPassed: true,
      faults: [
        {
          id: 'f1',
          ruleId: 'speed.limit.minor',
          severity: 'minor',
          message: '超速警告 (Speeding minor)',
          occurredAtSeconds: 20.0,
        },
      ],
    };

    // 1. Show the panel
    panel.show(record);

    const overlay = container.querySelector('.results-overlay');
    expect(overlay).not.toBeNull();

    const statusEl = container.querySelector('.results-status.passed');
    expect(statusEl).not.toBeNull();
    expect(statusEl?.textContent).toContain('评估通过');
    expect(statusEl?.textContent).toContain('PASSED');

    const scoreEl = container.querySelector('.results-stat__value.score-passed');
    expect(scoreEl?.textContent).toBe('88');

    // Time text should display formatted time "01:05"
    const stats = container.querySelectorAll('.results-stat__value');
    expect(stats[1].textContent).toBe('01:05'); // time
    expect(stats[2].textContent).toBe('1'); // faults count

    const faultItem = container.querySelector('.results-fault-item');
    expect(faultItem).not.toBeNull();
    expect(faultItem?.querySelector('.results-severity-badge')?.textContent).toBe('minor');
    expect(faultItem?.querySelector('.results-fault-code')?.textContent).toBe('speed.limit.minor');
    expect(faultItem?.querySelector('.results-fault-msg')?.textContent).toBe('超速警告 (Speeding minor)');
    expect(faultItem?.querySelector('.results-fault-points')?.textContent).toBe('-3');

    // 2. Test click actions
    const buttons = container.querySelectorAll('.results-btn');
    // buttons: 0 = Main Menu, 1 = Retry, 2 = Next Level
    expect(buttons.length).toBe(3);

    (buttons[0] as HTMLButtonElement).click();
    expect(onMainMenu).toHaveBeenCalledTimes(1);

    (buttons[1] as HTMLButtonElement).click();
    expect(onRetry).toHaveBeenCalledTimes(1);

    (buttons[2] as HTMLButtonElement).click();
    expect(onNextLevel).toHaveBeenCalledTimes(1);

    // 3. Hide panel
    panel.hide();
    expect(container.querySelector('.results-overlay')).toBeNull();

    document.body.removeChild(container);
  });

  it('should render failed status and show failed coach comments', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const panel = new ResultsPanel(container, {
      onRetry: vi.fn(),
    });

    const record: ScoreRecord = {
      levelId: 'Level 1: RHD Basics',
      score: 50,
      startTimeSeconds: 0,
      endTimeSeconds: 30,
      isPassed: false,
      faults: [],
    };

    panel.show(record, true); // instant failed

    const statusEl = container.querySelector('.results-status.failed');
    expect(statusEl).not.toBeNull();
    expect(statusEl?.textContent).toContain('评估未通过');
    expect(statusEl?.textContent).toContain('FAILED');

    const coachText = container.querySelector('.results-coach-text');
    expect(coachText?.textContent).toContain('触发直接失败条件');

    panel.hide();
    document.body.removeChild(container);
  });
});
