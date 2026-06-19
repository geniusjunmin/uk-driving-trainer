import type { ScoreRecord } from '../rules/ScoringSystem';
import './results.css';

export interface ResultsPanelCallbacks {
  readonly onRetry: () => void;
  readonly onNextLevel?: () => void;
  readonly onMainMenu?: () => void;
}

export class ResultsPanel {
  private element: HTMLDivElement | null = null;

  constructor(
    private readonly parent: HTMLElement,
    private readonly callbacks: ResultsPanelCallbacks,
  ) {}

  show(record: ScoreRecord, instantFailed = false): void {
    this.hide();

    const overlay = document.createElement('div');
    overlay.className = 'results-overlay';

    const panel = document.createElement('div');
    panel.className = 'results-panel';

    const passed = Boolean(record.isPassed);
    const statusClass = passed ? 'passed' : 'failed';
    const statusTextZh = passed ? '评估通过' : '评估未通过';
    const statusTextEn = passed ? 'PASSED' : 'FAILED';
    const coaching = this.getCoachSummary(record, instantFailed);

    panel.innerHTML = `
      <div class="results-header">
        <div class="results-level-title">${escapeHtml(record.levelId)}</div>
        <div class="results-status ${statusClass}">
          ${statusTextZh} <span style="font-size: var(--font-size-xl); font-weight: normal; vertical-align: middle;">(${statusTextEn})</span>
        </div>
      </div>
      ${this.renderSummary(record)}
    `;

    const content = document.createElement('div');
    content.className = 'results-content';
    content.innerHTML = `
      <div class="results-coach-section">
        <div class="results-section-title">AI 教练点评 (AI Coach Review)</div>
        <div class="results-coach-text">
          <div>${escapeHtml(coaching.zh)}</div>
          <div class="results-coach-text__en">${escapeHtml(coaching.en)}</div>
        </div>
      </div>
      ${this.renderFaults(record)}
    `;

    const actions = this.createActions(record);
    panel.appendChild(content);
    panel.appendChild(actions);
    overlay.appendChild(panel);

    this.parent.appendChild(overlay);
    this.element = overlay;
  }

  hide(): void {
    this.element?.remove();
    this.element = null;
  }

  getElement(): HTMLDivElement | null {
    return this.element;
  }

  private renderSummary(record: ScoreRecord): string {
    const totalTime = Math.max(
      0,
      Math.floor(
        record.endTimeSeconds !== undefined
          ? record.endTimeSeconds - record.startTimeSeconds
          : 0,
      ),
    );
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;

    return `
      <div class="results-summary-row">
        <div class="results-stat">
          <div class="results-stat__label">得分 (Score)</div>
          <div class="results-stat__value ${record.isPassed ? 'score-passed' : 'score-failed'}">${record.score}</div>
        </div>
        <div class="results-stat">
          <div class="results-stat__label">行驶时间 (Time)</div>
          <div class="results-stat__value">${timeString}</div>
        </div>
        <div class="results-stat">
          <div class="results-stat__label">违规次数 (Faults)</div>
          <div class="results-stat__value">${record.faults.length}</div>
        </div>
      </div>
    `;
  }

  private renderFaults(record: ScoreRecord): string {
    if (record.faults.length === 0) {
      return `
        <div class="results-section-title">扣分明细 (Fault Log)</div>
        <div class="results-no-faults">完美驾驶！没有记录任何违规行为。 (Perfect drive! No faults recorded.)</div>
      `;
    }

    const items = record.faults.map((fault) => {
      const pointsText = fault.severity === 'minor'
        ? '-3'
        : fault.severity === 'serious'
          ? '-5'
          : '-10';

      return `
        <div class="results-fault-item">
          <div class="results-fault-info">
            <div class="results-fault-meta">
              <span class="results-severity-badge ${fault.severity}">${fault.severity}</span>
              <span class="results-fault-code">${escapeHtml(fault.ruleId)}</span>
            </div>
            <div class="results-fault-msg">${escapeHtml(fault.message)}</div>
          </div>
          <div class="results-fault-points">${pointsText}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="results-section-title">扣分明细 (Fault Log)</div>
      <div class="results-faults-list">${items}</div>
    `;
  }

  private createActions(record: ScoreRecord): HTMLDivElement {
    const actions = document.createElement('div');
    actions.className = 'results-actions';

    if (this.callbacks.onMainMenu) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'results-btn results-btn--secondary';
      menuBtn.textContent = '返回菜单 (Main Menu)';
      menuBtn.onclick = () => this.callbacks.onMainMenu?.();
      actions.appendChild(menuBtn);
    }

    const retryBtn = document.createElement('button');
    retryBtn.className = 'results-btn results-btn--secondary';
    retryBtn.textContent = '重新开始 (Retry)';
    retryBtn.onclick = () => this.callbacks.onRetry();
    actions.appendChild(retryBtn);

    if (record.isPassed && this.callbacks.onNextLevel) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'results-btn results-btn--primary';
      nextBtn.textContent = '下一关 (Next Level)';
      nextBtn.onclick = () => this.callbacks.onNextLevel?.();
      actions.appendChild(nextBtn);
    }

    return actions;
  }

  private getCoachSummary(record: ScoreRecord, instantFailed: boolean): { zh: string; en: string } {
    if (record.isPassed) {
      return {
        zh: '做得很好！你已经通过本关。继续保持安全观察、平稳控制和守法驾驶。',
        en: 'Well done! You passed this level. Keep the safe observation and smooth control habits.',
      };
    }

    if (instantFailed) {
      return {
        zh: '触发直接失败条件。安全优先，请复习对应规则后再试一次。',
        en: 'Instant failure triggered. Safety is priority. Review the rule and try again.',
      };
    }

    const highestSeverityFault = [...record.faults].sort(
      (a, b) => severityRank(b.severity) - severityRank(a.severity),
    )[0];

    if (highestSeverityFault) {
      return {
        zh: `本次主要问题是 ${highestSeverityFault.ruleId}。下一次先放慢节奏，提前观察，再执行动作。`,
        en: `Main issue: ${highestSeverityFault.ruleId}. Next time, slow down early, observe, then act.`,
      };
    }

    return {
      zh: '评估未通过。你的分数低于合格线，我们再练一次。',
      en: "Assessment failed. Your score fell below the pass threshold. Let's practice again.",
    };
  }
}

function severityRank(severity: string): number {
  if (severity === 'dangerous') return 3;
  if (severity === 'serious') return 2;
  if (severity === 'minor') return 1;
  return 0;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
