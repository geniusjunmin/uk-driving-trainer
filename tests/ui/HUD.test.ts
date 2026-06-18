import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HUD } from '../../src/ui/HUD';

describe('HUD Unit Tests', () => {
  let container: any;

  beforeEach(() => {
    const createMockElement = (tagName: string) => {
      const el: any = {
        tagName: tagName.toUpperCase(),
        style: {
          setProperty: vi.fn(),
          display: 'block',
          marginTop: '',
          fontSize: '',
          opacity: '',
          fontWeight: '',
          pointerEvents: '',
        },
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(),
        },
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        appendChild: vi.fn(),
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        textContent: '',
      };
      el.appendChild.mockImplementation((child: any) => {
        if (!el.children) el.children = [];
        el.children.push(child);
        return child;
      });
      return el;
    };

    container = createMockElement('div');

    vi.stubGlobal('document', {
      createElement: vi.fn().mockImplementation((tagName: string) => createMockElement(tagName)),
      querySelector: vi.fn().mockReturnValue(container),
      activeElement: null,
    });

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      AudioContext: vi.fn().mockImplementation(() => ({
        state: 'suspended',
        resume: vi.fn(),
        close: vi.fn(),
        createOscillator: vi.fn().mockReturnValue({
          connect: vi.fn(),
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          start: vi.fn(),
          stop: vi.fn(),
        }),
        createGain: vi.fn().mockReturnValue({
          connect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }),
        destination: {},
        currentTime: 0,
      })),
      clearInterval: vi.fn(),
      setInterval: vi.fn().mockReturnValue(123),
    });
  });

  it('should initialize elements and append them to container', () => {
    const hud = new HUD(container);
    expect(container.appendChild).toHaveBeenCalled();
    hud.dispose();
  });

  it('should update speed, needle angle, and gear', () => {
    const hud = new HUD(container);
    
    hud.update(45, 'D', 'off');
    
    const self = hud as any;
    expect(self.speedValueElement.textContent).toBe('45');
    expect(self.gearElement.textContent).toBe('D');
    
    expect(self.speedElement.style.setProperty).toHaveBeenCalledWith(
      '--speed-needle-angle',
      '-81.25deg'
    );
  });

  it('should update active indicators and blink classes', () => {
    const hud = new HUD(container);
    const self = hud as any;

    hud.update(0, 'P', 'left');
    expect(self.leftIndicatorElement.classList.add).toHaveBeenCalledWith('is-active');
    expect(self.rightIndicatorElement.classList.remove).toHaveBeenCalledWith('is-active');

    hud.update(0, 'P', 'hazard');
    expect(self.leftIndicatorElement.classList.add).toHaveBeenCalledWith('is-active');
    expect(self.rightIndicatorElement.classList.add).toHaveBeenCalledWith('is-active');
  });

  it('should parse and format bilingual coach messages', () => {
    const hud = new HUD(container);
    const self = hud as any;

    hud.update(0, 'P', 'off', 'Check mirror / 检查后视镜');
    expect(self.coachEnElement.textContent).toBe('Check mirror');
    expect(self.coachZhElement.textContent).toBe('检查后视镜');
    expect(self.coachMessageElement.removeAttribute).toHaveBeenCalledWith('hidden');

    hud.update(0, 'P', 'off', {
      messageEn: 'Speeding!',
      messageZh: '超速！',
      severity: 'warning',
    });
    expect(self.coachEnElement.textContent).toBe('Speeding!');
    expect(self.coachZhElement.textContent).toBe('超速！');
    expect(self.coachMessageElement.classList.add).toHaveBeenCalledWith('is-warning');
  });

  it('should set mirror warning', () => {
    const hud = new HUD(container);
    const self = hud as any;

    hud.update(0, 'P', 'off', null, 'Warning: vehicle in blind spot! / 警告：盲区有车！');
    expect(self.mirrorWarningElement.textContent).toBe('Warning: vehicle in blind spot! / 警告：盲区有车！');
    expect(self.mirrorWarningElement.classList.add).toHaveBeenCalledWith('is-active');
  });
});
