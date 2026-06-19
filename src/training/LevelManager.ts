import { GiveWayRule } from '../rules/GiveWayRule';
import { LaneDisciplineRule } from '../rules/LaneDisciplineRule';
import { ParkingBayRule } from '../rules/ParkingBayRule';
import { RoundaboutRule } from '../rules/RoundaboutRule';
import type { DrivingContext, DrivingFault } from '../rules/RuleEngine';
import { RuleEngine } from '../rules/RuleEngine';
import { ScoringSystem } from '../rules/ScoringSystem';
import { SpeedLimitRule } from '../rules/SpeedLimitRule';
import { ZebraCrossingRule } from '../rules/ZebraCrossingRule';
import { HUD } from '../ui/HUD';
import { ResultsPanel, type ResultsPanelCallbacks } from '../ui/ResultsPanel';

export interface LevelConfig {
  readonly levelId: string;
  readonly nameZh: string;
  readonly nameEn: string;
  readonly passThreshold: number;
  readonly failThreshold: number;
}

export const LEVEL_CONFIGS: Record<string, LevelConfig> = {
  'level-1': {
    levelId: 'level-1',
    nameZh: '右舵与靠左基础',
    nameEn: 'RHD & Keep Left Basics',
    passThreshold: 80,
    failThreshold: 60,
  },
  'level-2': {
    levelId: 'level-2',
    nameZh: '住宅区限速与会车',
    nameEn: 'Residential Limits & Meeting',
    passThreshold: 75,
    failThreshold: 55,
  },
  'level-3': {
    levelId: 'level-3',
    nameZh: 'T 字路口让行与右转',
    nameEn: 'T-Junction Give Way & Right Turn',
    passThreshold: 75,
    failThreshold: 55,
  },
  'level-4': {
    levelId: 'level-4',
    nameZh: '迷你环岛出口选择',
    nameEn: 'Mini-Roundabout Exits',
    passThreshold: 70,
    failThreshold: 50,
  },
  'level-5': {
    levelId: 'level-5',
    nameZh: '学校区域与斑马线',
    nameEn: 'School Zone & Zebra Crossings',
    passThreshold: 75,
    failThreshold: 55,
  },
  'level-6': {
    levelId: 'level-6',
    nameZh: '倒车入库训练',
    nameEn: 'Reverse Bay Parking',
    passThreshold: 70,
    failThreshold: 50,
  },
};

const PRE_HINTS: Record<string, { zh: string; en: string }> = {
  L1_start: {
    zh: '准备起步。请检查后视镜，打右转向灯，在安全时并入左侧行车道。',
    en: 'Prepare to move off. Check your mirrors, signal right, and merge safely into the left lane when clear.',
  },
  L1_gentle_bend: {
    zh: '沿道路直行通过前方缓弯。保持在左侧车道中央行驶。',
    en: 'Follow the road ahead through the gentle bend. Keep centered in the left lane.',
  },
  L1_stop_box_prep: {
    zh: '即将抵达终点。请准备减速，并在左侧临时停车区内停车。',
    en: 'We are approaching the destination. Prepare to slow down and pull over on the left.',
  },
  L3_give_way_prep: {
    zh: '即将接近路口。请减速、检查后视镜并打右灯，准备让行。',
    en: 'Approaching the junction. Slow down, check mirrors, and signal right. Prepare to give way.',
  },
  L4_exit_1_prep: {
    zh: '前方环岛请从第一出口驶出。接近环岛前请打左灯。',
    en: 'At the roundabout, take the first exit. Signal left on approach.',
  },
  L5_zebra_prep: {
    zh: '前方有斑马线。请减速并观察两侧是否有行人准备过街。',
    en: 'Zebra crossing ahead. Slow down and check both sides for pedestrians.',
  },
};

const INSTANT_FAIL_RULE_IDS = new Set([
  'zebra.fail_waiting_pedestrian',
  'zebra.fail_crossing_pedestrian',
  'pedestrian.restart_too_early',
  'parking.entry_no_give_way',
  'parking.reverse_no_observation',
  'parking.outside_target_bay',
  'parking.collision',
  'lane.wrong_side_entry',
  'lane.no_entry_or_reverse_direction',
]);

export class LevelManager {
  private readonly ruleEngine = new RuleEngine();
  private readonly scoringSystem = new ScoringSystem();
  private readonly hud: HUD;
  private readonly resultsPanel: ResultsPanel;

  private activeConfig: LevelConfig | null = null;
  private isLevelActive = false;
  private lastFaultMessageTime = -9999;
  private currentCoachMessage: string | {
    messageEn?: string;
    messageZh?: string;
    severity?: string;
  } | null = null;

  constructor(uiParent: HTMLElement, callbacks: ResultsPanelCallbacks) {
    this.hud = new HUD(uiParent);
    this.resultsPanel = new ResultsPanel(uiParent, callbacks);

    this.ruleEngine.addRule(new SpeedLimitRule());
    this.ruleEngine.addRule(new LaneDisciplineRule());
    this.ruleEngine.addRule(new GiveWayRule());
    this.ruleEngine.addRule(new RoundaboutRule());
    this.ruleEngine.addRule(new ZebraCrossingRule());
    this.ruleEngine.addRule(new ParkingBayRule());
  }

  startLevel(levelId: string, startTimeSeconds: number): void {
    const config = LEVEL_CONFIGS[levelId] ?? LEVEL_CONFIGS['level-1'];
    this.activeConfig = config;

    this.scoringSystem.startLevel(config.levelId, startTimeSeconds);
    this.resultsPanel.hide();

    this.isLevelActive = true;
    this.lastFaultMessageTime = -9999;
    this.currentCoachMessage = null;

    this.setCoachMessage(
      `欢迎来到${config.nameZh}。请注意路况，按照提示安全驾驶。`,
      `Welcome to ${config.nameEn}. Keep your eyes on the road and drive safely.`,
      'normal',
    );
  }

  update(context: DrivingContext): void {
    if (!this.isLevelActive || !this.activeConfig) return;

    const candidates = this.ruleEngine.update(context);
    const newFaults = this.scoringSystem.processFaults(candidates, context.timeSeconds);

    if (newFaults.length > 0) {
      const priorityFault = this.getHighestSeverityFault(newFaults);
      this.lastFaultMessageTime = context.timeSeconds;
      this.currentCoachMessage = toCoachMessage(priorityFault);

      if (INSTANT_FAIL_RULE_IDS.has(priorityFault.ruleId)) {
        this.completeLevel(context.timeSeconds, 1);
        return;
      }
    } else {
      this.updateCoachHints(context);
    }

    this.hud.updateHUD({
      speedMph: context.speedMph,
      gear: context.gear,
      indicator: context.indicator,
      coachMessage: this.currentCoachMessage,
      mirrorWarning: this.getObservationWarning(context),
    });

    const record = this.scoringSystem.getCurrentRecord();
    if (record) {
      const dangerousCount = record.faults.filter((fault) => fault.severity === 'dangerous').length;
      if (dangerousCount >= 2 || record.score < this.activeConfig.failThreshold) {
        this.completeLevel(context.timeSeconds, dangerousCount >= 2 ? 1 : 0);
      }
    }
  }

  completeLevel(timeSeconds: number, instantFailCount = 0): void {
    if (!this.isLevelActive || !this.activeConfig) return;

    this.isLevelActive = false;
    const record = this.scoringSystem.getCurrentRecord();
    if (!record) return;

    record.endTimeSeconds = timeSeconds;
    this.scoringSystem.evaluatePassFail(
      this.activeConfig.passThreshold,
      this.activeConfig.failThreshold,
      instantFailCount,
    );
    this.resultsPanel.show(record, instantFailCount > 0);
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

  private updateCoachHints(context: DrivingContext): void {
    const faultDisplayDuration = context.timeSeconds - this.lastFaultMessageTime;
    if (this.lastFaultMessageTime !== -9999 && faultDisplayDuration < 5.0) {
      return;
    }

    const hint = context.activeTriggerZones
      ?.map((zone) => PRE_HINTS[zone.id] ?? (zone.label ? PRE_HINTS[zone.label] : undefined))
      .find(Boolean);

    if (hint) {
      this.setCoachMessage(hint.zh, hint.en, 'normal');
      return;
    }

    const score = this.scoringSystem.getCurrentRecord()?.score ?? 100;
    if (score < 60) {
      this.setCoachMessage(
        '分数正在降低。请把注意力放回车道位置、速度和观察。',
        'Score is dropping. Focus on lane position, speed, and observation.',
        'warning',
      );
      return;
    }

    if (this.lastFaultMessageTime !== -9999) {
      this.currentCoachMessage = null;
      this.lastFaultMessageTime = -9999;
    }
  }

  private getObservationWarning(context: DrivingContext) {
    if (context.speedMph < 1) {
      return null;
    }

    if (!context.observation?.checkedInteriorMirror) {
      return {
        active: true,
        mirrorCheckMissing: true,
        severity: 'info',
        message: {
          messageEn: 'Check interior mirror',
          messageZh: '检查内后视镜',
          severity: 'info',
        },
      };
    }

    return null;
  }

  private getHighestSeverityFault(faults: readonly DrivingFault[]): DrivingFault {
    return [...faults].sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
  }

  private setCoachMessage(zh: string, en: string, severity: 'normal' | 'warning' | 'danger'): void {
    this.currentCoachMessage = {
      messageZh: zh,
      messageEn: en,
      severity,
    };
  }
}

function toCoachMessage(fault: DrivingFault): { messageEn: string; messageZh: string; severity: string } {
  const match = fault.message.match(/\(([^)]+)\)/);
  const english = match?.[1] ?? fault.message;
  const chinese = fault.message.replace(/\s*\([^)]*\)\s*/g, '').trim();

  return {
    messageEn: english,
    messageZh: chinese || english,
    severity: fault.severity,
  };
}

function severityRank(severity: string): number {
  if (severity === 'dangerous') return 3;
  if (severity === 'serious') return 2;
  if (severity === 'minor') return 1;
  return 0;
}
