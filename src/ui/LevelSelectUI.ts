import '../ui/town.css';

export interface LevelCardData {
  readonly levelId: string;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly isUnlocked: boolean;
  readonly bestScore?: number;
  readonly isPassed?: boolean;
}

export class LevelSelectUI {
  private container: HTMLElement | null = null;

  constructor(
    private readonly parent: HTMLElement,
    private readonly onStartLevel: (levelId: string) => void,
  ) {}

  show(levels: readonly LevelCardData[]): void {
    this.hide();

    const overlay = document.createElement('div');
    overlay.className = 'level-select-overlay';

    const title = document.createElement('h1');
    title.className = 'level-select-title';
    title.textContent = 'UK Driving Trainer';
    overlay.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.className = 'level-select-subtitle';
    subtitle.textContent = '英国右舵驾驶训练模拟器';
    overlay.appendChild(subtitle);

    const grid = document.createElement('div');
    grid.className = 'level-select-grid';

    for (const level of levels) {
      grid.appendChild(this.createCard(level));
    }

    overlay.appendChild(grid);
    this.parent.appendChild(overlay);
    this.container = overlay;
  }

  hide(): void {
    this.container?.remove();
    this.container = null;
  }

  dispose(): void {
    this.hide();
  }

  private createCard(level: LevelCardData): HTMLElement {
    const card = document.createElement('div');
    card.className = `level-card${level.isUnlocked ? '' : ' level-card-locked'}`;

    const badge = document.createElement('div');
    badge.className = 'level-card-badge';
    badge.textContent = level.levelId.replace('level-', '');
    card.appendChild(badge);

    const nameZh = document.createElement('div');
    nameZh.className = 'level-card-name-zh';
    nameZh.textContent = level.nameZh;
    card.appendChild(nameZh);

    const nameEn = document.createElement('div');
    nameEn.className = 'level-card-name-en';
    nameEn.textContent = level.nameEn;
    card.appendChild(nameEn);

    if (!level.isUnlocked) {
      const lock = document.createElement('div');
      lock.className = 'level-card-lock-icon';
      lock.textContent = 'Locked';
      card.appendChild(lock);
      return card;
    }

    if (level.bestScore !== undefined) {
      const barWrap = document.createElement('div');
      barWrap.className = 'level-score-bar';

      const fill = document.createElement('div');
      fill.className =
        `level-score-bar-fill ${level.isPassed ? 'level-score-bar-fill--pass' : 'level-score-bar-fill--partial'}`;
      fill.style.width = `${Math.max(0, Math.min(100, level.bestScore))}%`;
      barWrap.appendChild(fill);
      card.appendChild(barWrap);

      const scoreText = document.createElement('div');
      scoreText.className = 'level-score-text';
      scoreText.textContent = `Best: ${level.bestScore}/100${level.isPassed ? ' Passed' : ''}`;
      card.appendChild(scoreText);
    }

    const button = document.createElement('button');
    button.className = 'level-start-btn';
    button.textContent = 'Start 开始';
    button.addEventListener('click', () => {
      this.onStartLevel(level.levelId);
      this.hide();
    });
    card.appendChild(button);

    return card;
  }
}
