import { RuleEngine } from '../rules/RuleEngine';
import { SpeedLimitRule } from '../rules/SpeedLimitRule';
import { LaneDisciplineRule } from '../rules/LaneDisciplineRule';
import { GiveWayRule } from '../rules/GiveWayRule';
import { RoundaboutRule } from '../rules/RoundaboutRule';
import { ScoringSystem } from '../rules/ScoringSystem';
import { HUD } from '../ui/HUD';
import { ResultsPanel, ResultsPanelCallbacks } from '../ui/ResultsPanel';
import type { DrivingContext } from '../rules/RuleEngine';

export interface LevelConfig {
  readonly levelId: string;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly passThreshold: number;
  readonly failThreshold: number;
}

export const LEVEL_CONFIGS: Record<string, LevelConfig> = {
  'level-1': { levelId: 'level-1', nameZh: '右舵与靠左基础', nameEn: 'RHD & Keep Left Basics', passThreshold: 80, failThreshold: 60 },
  'level-2': { levelId: 'level-2', nameZh: '住宅区限速与会车', nameEn: 'Residential Limits & Meeting', passThreshold: 75, failThreshold: 55 },
  'level-3': { levelId: 'level-3', nameZh: 'T字路口让行与右转', nameEn: 'T-Junction Give Way & Right Turn', passThreshold: 75, failThreshold: 55 },
  'level-4': { levelId: 'level-4', nameZh: '环岛出口选择', nameEn: 'Mini-Roundabout Exits', passThreshold: 70, failThreshold: 50 },
  'level-5': { levelId: 'level-5', nameZh: '学校区域与斑马线', nameEn: 'School Zone & Zebra Crossings', passThreshold: 75, failThreshold: 55 },
  'level-6': { levelId: 'level-6', nameZh: '倒车入库训练', nameEn: 'Reverse Bay Parking', passThreshold: 70, failThreshold: 50 },
};

const PRE_HINTS: Record<string, { zh: string; en: string }> = {
  'L1_start': {
    zh: '准备起步。请检查后视镜，打右转向灯，在安全时并入左侧行车道。',
    en: 'Prepare to move off. Check your mirrors, signal right, and merge safely into the left lane when clear.'
  },
  'L1_gentle_bend': {
    zh: '沿道路直行通过前方缓弯。保持在左侧车道中央行驶。',
    en: 'Follow the road ahead through the gentle bend. Keep centered in the left lane.'
  },
  'L1_stop_box_prep': {
    zh: '即将抵达终点。请准备减速，并在左侧临时停车区内停车。',
    en: 'We are approaching the destination. Prepare to slow down and pull over on the left.'
  },
  'L3_give_way_prep': {
    zh: '即将接近路口。请减速、检查后视镜并打右灯，准备让行。',
    en: 'Approaching the junction. Slow down, check mirrors, and signal right. Prepare to give way.'
  },
  'L4_exit_1_prep': {
    zh: '在前方环岛，从第一出口驶出（左转）。接近环岛前请打左灯。',
    en: 'At the roundabout, take the first exit (turning left). Signal left on approach.'
  },
  'L5_zebra_prep': {
    zh: '前方有斑马线。请减速并仔细观察斑马线两侧是否有行人准备过街。',
    en: 'Zebra crossing ahead. Slow down and check both sides of the crossing for pedestrians.'
  },
};

export class LevelManager {
  private readonly ruleEngine = new RuleEngine();
  private readonly scoringSystem = new ScoringSystem();
  private readonly hud: HUD;
  private readonly resultsPanel: ResultsPanel;
  
  private activeConfig: LevelConfig | null = null;
  private isLevelActive = false;
  private lastFaultMessageTime = -9999;
  private currentCoachMessage: string | { messageEn?: string; messageZh?: string; severity?: string } | null = null;

  constructor(uiParent: HTMLElement, callbacks: ResultsPanelCallbacks) {
    this.hud = new HUD(uiParent);
    this.resultsPanel = new ResultsPanel(uiParent, callbacks);

    // Register driving rules
    this.ruleEngine.addRule(new SpeedLimitRule());
    this.ruleEngine.addRule(new LaneDisciplineRule());
    this.ruleEngine.addRule(new GiveWayRule());
    this.ruleEngine.addRule(new RoundaboutRule());
  }

  startLevel(levelId: string, startTimeSeconds: number): void {
    const config = LEVEL_CONFIGS[levelId] ?? LEVEL_CONFIGS['level-1'];
    this.activeConfig = config;
    
    this.scoringSystem.startLevel(config.levelId, startTimeSeconds);
    this.resultsPanel.hide();
    
    this.isLevelActive = true;
    this.lastFaultMessageTime = -9999;
    this.currentCoachMessage = null;

    // Show level start coaching hint
    this.setCoachMessage(
      '欢迎来到英国右舵驾驶训练。请注意路况，按照导航安全驾驶。',
      'Welcome. Keep your eyes on the road, follow the navigation, and drive safely.',
      'normal'
    );
  }

  update(context: DrivingContext): void {
    if (!this.isLevelActive || !this.activeConfig) return;

    // 1. Evaluate rules and scoring
    const candidates = this.ruleEngine.update(context);
    const newFaults = this.scoringSystem.processFaults(candidates, context.timeSeconds);

    // 2. Select coach message priority:
    // Priority A: Newly triggered driving faults take absolute priority and override current hints for 5.0 seconds
    if (newFaults.length > 0) {
      // Sort to find the most severe fault
      const priorityFault = [...newFaults].sort((a, b) => {
        const severities = { minor: 1, serious: 2, dangerous: 3 };
        return severities[b.severity] - severities[a.severity];
      })[0];

      this.lastFaultMessageTime = context.timeSeconds;
      this.currentCoachMessage = {
        messageEn: priorityFault.message.match(/\(([^)]+)\)/)?.[1] || priorityFault.message,
        messageZh: priorityFault.message.replace(/\s*\([^)]*\)\s*/g, ''),
        severity: priorityFault.severity,
      };
    } else {
      // Priority B: If no active fault warning is showing (or it expired after 5.0 seconds)
      const faultDisplayDuration = context.timeSeconds - this.lastFaultMessageTime;
      if (this.lastFaultMessageTime === -9999 || faultDisplayDuration >= 5.0) {
        let activePreHint = false;

        // Check if player is inside an active trigger zone that has a pre-hint
        if (context.activeTriggerZones && context.activeTriggerZones.length > 0) {
          for (const zone of context.activeTriggerZones) {
            const hint = PRE_HINTS[zone.id] || (zone.label ? PRE_HINTS[zone.label] : null);
            if (hint) {
              this.setCoachMessage(hint.zh, hint.en, 'normal');
              activePreHint = true;
              break;
            }
          }
        }

        // If no trigger zone pre-hints, check for critical score low warnings
        if (!activePreHint) {
          const score = this.scoringSystem.getCurrentRecord()?.score ?? 100;
          if (score < 60) {
            this.setCoachMessage(
              '分数正在降低。请注意维持车道居中并留意限速。',
              'Score is dropping. Focus on your lane positioning and speed limits.',
              'warning'
            );
          } else {
            // Revert to welcome/idle status when clear
            if (this.lastFaultMessageTime !== -9999) {
              this.currentCoachMessage = null;
              this.lastFaultMessageTime = -9999;
            }
          }
        }
      }
    }

    // 3. Update HUD UI elements
    this.hud.update(
      context.speedMph,
      context.gear,
      context.indicator,
      this.currentCoachMessage,
      context.observation?.checkedLeftMirror || context.observation?.checkedRightMirror ? null : undefined
    );

    // 4. Instant fail check on dangerous count
    const record = this.scoringSystem.getCurrentRecord();
    if (record) {
      const dangerousCount = record.faults.filter(f => f.severity === 'dangerous').length;
      if (dangerousCount >= 2 || record.score < this.activeConfig.failThreshold) {
        this.completeLevel(context.timeSeconds);
      }
    }
  }

  completeLevel(timeSeconds: number, instantFailCount = 0): void {
    if (!this.isLevelActive || !this.activeConfig) return;

    this.isLevelActive = false;
    const record = this.scoringSystem.getCurrentRecord();
    if (record) {
      record.endTimeSeconds = timeSeconds;
      this.scoringSystem.evaluatePassFail(
        this.activeConfig.passThreshold,
        this.activeConfig.failThreshold,
        instantFailCount
      );

      // Render the Results Panel modal overlay
      this.resultsPanel.show(record, instantFailCount > 0);
    }
  }

  getScoringSystem(): ScoringSystem {
    return this.scoringSystem;
  }

  getResultsPanel(): ResultsPanel {
    return this.resultsPanel;
  }

  getHUD(): HUD {
    return this.hud;
  }

  dispose(): void {
    this.hud.dispose();
    this.resultsPanel.hide();
  }

  private setCoachMessage(zh: string, en: string, severity: 'normal' | 'warning' | 'danger'): void {
    this.currentCoachMessage = {
      messageZh: zh,
      messageEn: en,
      severity,
    };
  }
}
