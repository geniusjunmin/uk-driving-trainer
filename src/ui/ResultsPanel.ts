import type { ScoreRecord } from '../rules/ScoringSystem';

export interface ResultsPanelCallbacks {
  readonly onRetry: () => void;
  readonly onNextLevel?: () => void;
  readonly onMainMenu?: () => void;
}

export class ResultsPanel {
  private element: HTMLDivElement | null = null;
  private readonly parent: HTMLElement;
  private readonly callbacks: ResultsPanelCallbacks;

  constructor(parent: HTMLElement, callbacks: ResultsPanelCallbacks) {
    this.parent = parent;
    this.callbacks = callbacks;
  }

  show(record: ScoreRecord, instantFailed = false): void {
    this.hide();

    let statusTextZh = '';
    let statusTextEn = '';
    let statusClass = '';
    let coachZh = '';
    let coachEn = '';

    if (record.isPassed) {
      statusTextZh = '评估通过';
      statusTextEn = 'PASSED';
      statusClass = 'passed';
      coachZh = '太棒了！您已成功通过本关卡。请继续保持良好的驾驶习惯。';
      coachEn = 'Well done! You have passed this level. Keep up the good habits.';
    } else {
      statusTextZh = '评估未通过';
      statusTextEn = 'FAILED';
      statusClass = 'failed';
      if (instantFailed) {
        coachZh = '触发直接失败条件。安全至上，请复习交通规则后再试。';
        coachEn = 'Instant failure triggered. Safety is priority. Review the rule and try again.';
      } else {
        coachZh = '评估未通过。您的分数低于及格线。让我们再试一次。';
        coachEn = "Assessment failed. Your score fell below the pass threshold. Let's practice again.";
      }
    }

    const totalTime = Math.max(
      0,
      Math.floor(
        record.endTimeSeconds !== undefined
          ? record.endTimeSeconds - record.startTimeSeconds
          : 0
      )
    );
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;

    const overlay = document.createElement('div');
    overlay.className = 'results-overlay';

    const panel = document.createElement('div');
    panel.className = 'results-panel';

    const headerHtml = `
      <div class="results-header">
        <div class="results-level-title">${record.levelId}</div>
        <div class="results-status ${statusClass}">
          ${statusTextZh} <span style="font-size: var(--font-size-xl); font-weight: normal; vertical-align: middle;">(${statusTextEn})</span>
        </div>
      </div>
    `;

    const summaryHtml = `
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

    const coachHtml = `
      <div class="results-coach-section">
        <div class="results-section-title">AI 教练点评 (AI Coach Review)</div>
        <div class="results-coach-text">
          <div>${coachZh}</div>
          <div class="results-coach-text__en">${coachEn}</div>
        </div>
      </div>
    `;

    let faultsHtml = `
      <div class="results-section-title">扣分明细 (Fault Log)</div>
    `;
    if (record.faults.length === 0) {
      faultsHtml += `<div class="results-no-faults">完美无瑕的驾驶！没有记录任何违规行为。 (Perfect drive! No faults recorded.)</div>`;
    } else {
      faultsHtml += `<div class="results-faults-list">`;
      for (const fault of record.faults) {
        let pointsText = '';
        if (fault.severity === 'minor') pointsText = '-3';
        else if (fault.severity === 'serious') pointsText = '-5';
        else if (fault.severity === 'dangerous') pointsText = '-10';

        faultsHtml += `
          <div class="results-fault-item">
            <div class="results-fault-info">
              <div class="results-fault-meta">
                <span class="results-severity-badge ${fault.severity}">${fault.severity}</span>
                <span class="results-fault-code">${fault.ruleId}</span>
              </div>
              <div class="results-fault-msg">${fault.message}</div>
            </div>
            <div class="results-fault-points">${pointsText}</div>
          </div>
        `;
      }
      faultsHtml += `</div>`;
    }

    const content = document.createElement('div');
    content.className = 'results-content';
    content.innerHTML = coachHtml + faultsHtml;

    const actions = document.createElement('div');
    actions.className = 'results-actions';

    if (this.callbacks.onMainMenu) {
      const menuBtn = document.createElement('button');
      menuBtn.className = 'results-btn results-btn--secondary';
      menuBtn.textContent = '返回菜单 (Main Menu)';
      menuBtn.onclick = () => this.callbacks.onMainMenu!();
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
      nextBtn.onclick = () => this.callbacks.onNextLevel!();
      actions.appendChild(nextBtn);
    }

    panel.innerHTML = headerHtml + summaryHtml;
    panel.appendChild(content);
    panel.appendChild(actions);
    overlay.appendChild(panel);

    this.parent.appendChild(overlay);
    this.element = overlay;
  }

  hide(): void {
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
    this.element = null;
  }

  getElement(): HTMLDivElement | null {
    return this.element;
  }
}
