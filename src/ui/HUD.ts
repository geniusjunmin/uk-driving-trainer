import './hud.css';
import './variables.css';

export type HUDGear = 'P' | 'R' | 'N' | 'D' | string;
export type HUDIndicator = 'off' | 'left' | 'right' | 'hazard';
export type HUDSeverity = 'normal' | 'info' | 'minor' | 'warning' | 'serious' | 'danger' | 'dangerous';

export type HUDMessage = string | {
  messageEn?: string;
  messageZh?: string;
  textEn?: string;
  textZh?: string;
  severity?: HUDSeverity | string;
};

export interface HUDWarningState {
  active?: boolean;
  blindSpotLeft?: boolean;
  blindSpotRight?: boolean;
  mirrorCheckMissing?: boolean;
  message?: HUDMessage | null;
  severity?: HUDSeverity | string;
}

export interface HUDState {
  speedMph?: number;
  gear?: HUDGear;
  indicator?: HUDIndicator;
  coach?: HUDMessage | null;
  coachMessage?: HUDMessage | null;
  mirrorWarning?: HUDMessage | HUDWarningState | null;
  blindSpotWarning?: HUDMessage | HUDWarningState | null;
  warnings?: {
    mirror?: HUDMessage | HUDWarningState | null;
    blindSpot?: HUDMessage | HUDWarningState | null;
  };
}

export interface HUDCallbacks {
  onIndicatorChange?: (indicator: HUDIndicator) => void;
  onCameraSwitch?: () => void;
}

export class HUD {
  private container: HTMLElement;
  private callbacks: HUDCallbacks;

  private hudElement!: HTMLDivElement;
  private speedValueElement!: HTMLSpanElement;
  private speedElement!: HTMLDivElement;
  private gearElement!: HTMLDivElement;
  private leftIndicatorElement!: HTMLButtonElement;
  private rightIndicatorElement!: HTMLButtonElement;
  private coachMessageElement!: HTMLDivElement;
  private coachEnElement!: HTMLDivElement;
  private coachZhElement!: HTMLDivElement;
  private mirrorWarningElement!: HTMLDivElement;

  private audioCtx: AudioContext | null = null;
  private indicatorIntervalId: number | null = null;
  private lastIndicatorState: HUDIndicator = 'off';
  private tickTockToggle = false;

  constructor(container?: HTMLElement | null, callbacks?: HUDCallbacks) {
    this.container = container || document.querySelector('#app') || document.body;
    this.callbacks = callbacks ?? {};
    
    this.initDOM();
    this.bindEvents();
  }

  private initDOM(): void {
    // Top level container
    this.hudElement = document.createElement('div');
    this.hudElement.className = 'hud';

    // Mirror warning
    this.mirrorWarningElement = document.createElement('div');
    this.mirrorWarningElement.className = 'hud-panel hud-mirror-warning';
    this.mirrorWarningElement.id = 'hud-mirror-warning';
    
    // Coach message
    this.coachMessageElement = document.createElement('div');
    this.coachMessageElement.className = 'hud-panel hud-coach-message';
    this.coachMessageElement.id = 'hud-coach-message';
    this.coachMessageElement.setAttribute('hidden', '');

    this.coachEnElement = document.createElement('div');
    this.coachEnElement.className = 'hud-coach-message__en';
    this.coachEnElement.style.fontWeight = 'var(--font-weight-semibold)';

    this.coachZhElement = document.createElement('div');
    this.coachZhElement.className = 'hud-coach-message__zh';
    this.coachZhElement.style.marginTop = 'var(--space-1)';
    this.coachZhElement.style.fontSize = 'var(--font-size-sm)';
    this.coachZhElement.style.opacity = '0.9';

    this.coachMessageElement.appendChild(this.coachEnElement);
    this.coachMessageElement.appendChild(this.coachZhElement);

    // Cluster (speed + gear)
    const cluster = document.createElement('div');
    cluster.className = 'hud-cluster';

    // Speed panel
    this.speedElement = document.createElement('div');
    this.speedElement.className = 'hud-panel hud-speed';

    this.speedValueElement = document.createElement('span');
    this.speedValueElement.className = 'hud-speed__value';
    this.speedValueElement.textContent = '0';

    const speedUnit = document.createElement('span');
    speedUnit.className = 'hud-speed__unit';
    speedUnit.textContent = 'mph';

    this.speedElement.appendChild(this.speedValueElement);
    this.speedElement.appendChild(speedUnit);

    // Gear panel
    this.gearElement = document.createElement('div');
    this.gearElement.className = 'hud-panel hud-gear';
    this.gearElement.textContent = 'P';

    cluster.appendChild(this.speedElement);
    cluster.appendChild(this.gearElement);

    // Status (indicators)
    const status = document.createElement('div');
    status.className = 'hud-status';

    const indicators = document.createElement('div');
    indicators.className = 'hud-indicators';

    this.leftIndicatorElement = document.createElement('button');
    this.leftIndicatorElement.className = 'hud-indicator hud-indicator--left';
    this.leftIndicatorElement.setAttribute('aria-label', 'Left Indicator');
    this.leftIndicatorElement.setAttribute('aria-pressed', 'false');
    this.leftIndicatorElement.style.pointerEvents = 'auto'; // ensure clickability

    this.rightIndicatorElement = document.createElement('button');
    this.rightIndicatorElement.className = 'hud-indicator hud-indicator--right';
    this.rightIndicatorElement.setAttribute('aria-label', 'Right Indicator');
    this.rightIndicatorElement.setAttribute('aria-pressed', 'false');
    this.rightIndicatorElement.style.pointerEvents = 'auto'; // ensure clickability

    indicators.appendChild(this.leftIndicatorElement);
    indicators.appendChild(this.rightIndicatorElement);
    status.appendChild(indicators);

    // Append all parts to the top level HUD element
    this.hudElement.appendChild(this.mirrorWarningElement);
    this.hudElement.appendChild(this.coachMessageElement);
    this.hudElement.appendChild(cluster);
    this.hudElement.appendChild(status);

    // Append to container
    this.container.appendChild(this.hudElement);
  }

  private bindEvents(): void {
    // Key listeners
    window.addEventListener('keydown', this.handleKeyDown);

    // Click listeners for manual override or interaction
    this.leftIndicatorElement.addEventListener('click', () => {
      const nextState = this.lastIndicatorState === 'left' ? 'off' : 'left';
      this.triggerIndicatorChange(nextState);
    });

    this.rightIndicatorElement.addEventListener('click', () => {
      const nextState = this.lastIndicatorState === 'right' ? 'off' : 'right';
      this.triggerIndicatorChange(nextState);
    });
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    
    // Skip if user is typing in a form input or textarea
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'q') {
      const nextState = this.lastIndicatorState === 'left' ? 'off' : 'left';
      this.triggerIndicatorChange(nextState);
    } else if (key === 'e') {
      const nextState = this.lastIndicatorState === 'right' ? 'off' : 'right';
      this.triggerIndicatorChange(nextState);
    } else if (key === 'c') {
      this.triggerCameraSwitch();
    }
  };

  private triggerIndicatorChange(state: HUDIndicator): void {
    this.updateIndicatorSound(state);
    
    if (this.callbacks.onIndicatorChange) {
      this.callbacks.onIndicatorChange(state);
    }
    
    // Dispatch custom event for standard DOM integrations
    this.hudElement.dispatchEvent(new CustomEvent('indicator-change', {
      bubbles: true,
      detail: { indicator: state }
    }));
  }

  private triggerCameraSwitch(): void {
    if (this.callbacks.onCameraSwitch) {
      this.callbacks.onCameraSwitch();
    }

    // Dispatch custom event
    this.hudElement.dispatchEvent(new CustomEvent('camera-switch', {
      bubbles: true
    }));
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      } catch (e) {
        console.warn('Web Audio API not supported in this browser.', e);
      }
    }
    return this.audioCtx;
  }

  private playIndicatorSound(isTick: boolean): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Higher pitch for tick, slightly lower for tock
      const freq = isTick ? 850 : 550;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      // Audio might fail due to browser autoplay policies
    }
  }

  private updateIndicatorSound(state: HUDIndicator): void {
    if (state === this.lastIndicatorState) {
      return;
    }

    this.lastIndicatorState = state;

    if (this.indicatorIntervalId !== null) {
      window.clearInterval(this.indicatorIntervalId);
      this.indicatorIntervalId = null;
    }

    if (state !== 'off') {
      this.tickTockToggle = true;
      this.playIndicatorSound(true); // play tick immediately

      // Blink animation has an 860ms period. Tick/Tock plays twice a period (430ms)
      this.indicatorIntervalId = window.setInterval(() => {
        this.tickTockToggle = !this.tickTockToggle;
        this.playIndicatorSound(this.tickTockToggle);
      }, 430);
    }
  }

  /**
   * Update the HUD displays from a structured state object.
   */
  public updateHUD(state: HUDState): void {
    const speed = state.speedMph ?? 0;
    const gear = state.gear ?? 'P';
    const indicator = state.indicator ?? 'off';
    const coachMessage = state.coachMessage ?? state.coach ?? null;
    const mirrorWarning =
      state.blindSpotWarning ??
      state.warnings?.blindSpot ??
      state.mirrorWarning ??
      state.warnings?.mirror ??
      null;

    // 1. Update speed
    const roundedSpeed = Math.round(Math.max(0, speed));
    this.speedValueElement.textContent = String(roundedSpeed);

    // Speed Needle rotation
    // Calculate angle for speedometer dial
    // 0 mph -> -160deg
    // 80 mph -> -20deg (span of 140deg)
    const MAX_SPEED_MPH = 80;
    const MIN_SPEED_ANGLE = -160;
    const MAX_SPEED_ANGLE = -20;
    const percent = Math.min(1, Math.max(0, speed / MAX_SPEED_MPH));
    const needleAngle = MIN_SPEED_ANGLE + percent * (MAX_SPEED_ANGLE - MIN_SPEED_ANGLE);
    this.speedElement.style.setProperty('--speed-needle-angle', `${needleAngle}deg`);

    // 2. Update gear
    this.gearElement.textContent = String(gear).toUpperCase().charAt(0) || 'P';

    // 3. Update indicator sound and visual state classes
    this.updateIndicatorSound(indicator);

    // Visual indicators blinking classes
    const leftActive = indicator === 'left' || indicator === 'hazard';
    const rightActive = indicator === 'right' || indicator === 'hazard';

    if (leftActive) {
      this.leftIndicatorElement.classList.add('is-active');
      this.leftIndicatorElement.setAttribute('aria-pressed', 'true');
    } else {
      this.leftIndicatorElement.classList.remove('is-active');
      this.leftIndicatorElement.setAttribute('aria-pressed', 'false');
    }

    if (rightActive) {
      this.rightIndicatorElement.classList.add('is-active');
      this.rightIndicatorElement.setAttribute('aria-pressed', 'true');
    } else {
      this.rightIndicatorElement.classList.remove('is-active');
      this.rightIndicatorElement.setAttribute('aria-pressed', 'false');
    }

    // 4. Update Coach Message
    if (coachMessage) {
      const { en, zh, severity } = this.normalizeMessage(coachMessage);

      this.coachEnElement.textContent = en;
      this.coachZhElement.textContent = zh;

      // Toggle display of language fields based on content
      this.coachEnElement.style.display = en ? 'block' : 'none';
      this.coachZhElement.style.display = zh ? 'block' : 'none';

      // Set severity classes
      this.coachMessageElement.classList.remove('is-info', 'is-warning', 'is-danger');
      if (severity === 'info') {
        this.coachMessageElement.classList.add('is-info');
      } else if (severity === 'warning' || severity === 'minor') {
        this.coachMessageElement.classList.add('is-warning');
      } else if (severity === 'danger' || severity === 'serious' || severity === 'dangerous') {
        this.coachMessageElement.classList.add('is-danger');
      }

      this.coachMessageElement.removeAttribute('hidden');
    } else {
      this.coachMessageElement.setAttribute('hidden', '');
      this.coachEnElement.textContent = '';
      this.coachZhElement.textContent = '';
    }

    // 5. Update Mirror Warning
    if (mirrorWarning) {
      const warning = this.normalizeWarning(mirrorWarning);

      this.mirrorWarningElement.textContent = warning.text;
      
      this.mirrorWarningElement.classList.remove(
        'is-active',
        'is-info',
        'is-warning',
        'is-danger',
        'is-left',
        'is-right'
      );
      if (warning.blindSpotLeft) {
        this.mirrorWarningElement.classList.add('is-left');
      }
      if (warning.blindSpotRight) {
        this.mirrorWarningElement.classList.add('is-right');
      }
      if (warning.severity === 'info') {
        this.mirrorWarningElement.classList.add('is-info');
      } else if (warning.severity === 'warning' || warning.severity === 'minor') {
        this.mirrorWarningElement.classList.add('is-warning');
      } else if (
        warning.severity === 'danger' ||
        warning.severity === 'serious' ||
        warning.severity === 'dangerous'
      ) {
        this.mirrorWarningElement.classList.add('is-danger');
      } else {
        this.mirrorWarningElement.classList.add('is-active');
      }
    } else {
      this.mirrorWarningElement.classList.remove(
        'is-active',
        'is-info',
        'is-warning',
        'is-danger',
        'is-left',
        'is-right'
      );
      this.mirrorWarningElement.textContent = '';
    }
  }

  /**
   * Backwards-compatible positional update API used by current integrations.
   */
  public update(
    speed: number,
    gear: HUDGear,
    indicator: HUDIndicator,
    message?: HUDMessage | null,
    mirrorWarning?: HUDMessage | HUDWarningState | null
  ): void {
    this.updateHUD({
      speedMph: speed,
      gear,
      indicator,
      coachMessage: message,
      mirrorWarning,
    });
  }

  /**
   * Cleanup event listeners and timers.
   */
  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    if (this.indicatorIntervalId !== null) {
      window.clearInterval(this.indicatorIntervalId);
    }
    if (this.audioCtx) {
      this.audioCtx.close();
    }
    this.hudElement.remove();
  }

  private normalizeMessage(message: HUDMessage): {
    en: string;
    zh: string;
    severity: string;
  } {
    if (typeof message !== 'string') {
      return {
        en: message.messageEn || message.textEn || '',
        zh: message.messageZh || message.textZh || '',
        severity: message.severity || 'normal',
      };
    }

    if (message.includes(' / ')) {
      const [en, zh] = message.split(' / ', 2);
      return { en: en.trim(), zh: zh.trim(), severity: 'normal' };
    }

    if (message.includes(' | ')) {
      const [en, zh] = message.split(' | ', 2);
      return { en: en.trim(), zh: zh.trim(), severity: 'normal' };
    }

    const hasChinese = /[\u4e00-\u9fa5]/.test(message);
    return {
      en: hasChinese ? '' : message,
      zh: hasChinese ? message : '',
      severity: 'normal',
    };
  }

  private normalizeWarning(warning: HUDMessage | HUDWarningState): {
    text: string;
    severity: string;
    blindSpotLeft: boolean;
    blindSpotRight: boolean;
  } {
    if (typeof warning === 'string' || this.isMessageObject(warning)) {
      const { en, zh, severity } = this.normalizeMessage(warning);
      return {
        text: en && zh ? `${en} / ${zh}` : en || zh,
        severity,
        blindSpotLeft: false,
        blindSpotRight: false,
      };
    }

    const message = warning.message;
    const normalized = message ? this.normalizeMessage(message) : null;
    const text = normalized
      ? normalized.en && normalized.zh
        ? `${normalized.en} / ${normalized.zh}`
        : normalized.en || normalized.zh
      : this.defaultWarningText(warning);

    return {
      text,
      severity: warning.severity || normalized?.severity || 'normal',
      blindSpotLeft: Boolean(warning.blindSpotLeft),
      blindSpotRight: Boolean(warning.blindSpotRight),
    };
  }

  private defaultWarningText(warning: HUDWarningState): string {
    if (warning.blindSpotLeft && warning.blindSpotRight) {
      return 'Blind spots occupied / 左右盲区有车';
    }
    if (warning.blindSpotLeft) {
      return 'Left blind spot / 左侧盲区';
    }
    if (warning.blindSpotRight) {
      return 'Right blind spot / 右侧盲区';
    }
    if (warning.mirrorCheckMissing) {
      return 'Check mirrors / 检查后视镜';
    }
    return warning.active ? 'Observation warning / 观察警告' : '';
  }

  private isMessageObject(value: HUDMessage | HUDWarningState): value is Exclude<HUDMessage, string> {
    if (typeof value === 'string') {
      return false;
    }

    return 'messageEn' in value || 'messageZh' in value || 'textEn' in value || 'textZh' in value;
  }
}
