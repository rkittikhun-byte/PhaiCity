/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOOL_CATEGORIES, TOOL_GROUP_LABELS, categoryForTool } from '../src/toolDock.js';
import { activateToolChoice, TOOL_CHOICE_EVENT } from '../src/toolLevels.js';
import { hasKey } from '../src/i18n/index.js';
import { toolIconUrl } from '../src/toolShortcuts.js';

describe('category, family and actual-tool navigation', () => {
  it('retains every original tool exactly once and puts power, water and waste together in Services', () => {
    const html = readFileSync(resolve('index.html'),'utf8');
    const originalButtons = html.match(/<div id="buttons">([\s\S]*?)<\/div>/)![1];
    const original = [...originalButtons.matchAll(/data-tool="([a-z_]+)"/g)].map(match => match[1]);
    const grouped = TOOL_CATEGORIES.flatMap(category => [...category.tools]);
    expect(original).toHaveLength(22); expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...original].sort());
    expect(categoryForTool('coal')?.id).toBe('services');
    expect(categoryForTool('waterworks')?.id).toBe('services');
    expect(categoryForTool('landfill')?.id).toBe('services');
    expect(categoryForTool('ruler_house')?.id).toBe('city');
  });
  it('has translated labels and existing local illustrations for every category and family', () => {
    for (const category of TOOL_CATEGORIES) {
      expect(hasKey(`dock.category.${category.id}`)).toBe(true);
      expect(existsSync(resolve(toolIconUrl(category.icon)))).toBe(true);
    }
    for (const group of TOOL_GROUP_LABELS) expect(hasKey(`dock.group.${group}`)).toBe(true);
  });
  function input() {
    const events: string[] = [];
    let armed = false, clicks = 0;
    const button = { dataset: { tool: 'port', size: '4', colour: 'blue' } as Record<string,string>,
      classList: { contains: () => armed }, click: () => { clicks++; armed = !armed; } } as unknown as HTMLElement;
    const doc = { dispatchEvent: (event: CustomEvent<string>) => {
      expect(event.type).toBe(TOOL_CHOICE_EVENT); events.push(event.detail);
    } } as unknown as Document;
    return { button,doc,events,clicks: () => clicks,armed: () => armed };
  }
  it('arms the actual choice once, keeps repeated choices in hand, and uses the actual footprint', () => {
    const f = input();
    activateToolChoice(f.button,{tool:'airport',available:true,size:6,colour:'violet'},f.doc);
    expect(f.clicks()).toBe(1); expect(f.armed()).toBe(true);
    expect(f.button.dataset).toMatchObject({activeTool:'airport',size:'6',colour:'violet',ownSize:'4'});
    activateToolChoice(f.button,{tool:'airport',available:true,size:6,colour:'violet'},f.doc);
    expect(f.clicks()).toBe(1); expect(f.armed()).toBe(true);
    activateToolChoice(f.button,{tool:'port',available:true},f.doc);
    expect(f.button.dataset.size).toBe('4'); expect(f.events).toEqual(['airport','airport','port']);
    expect(f.button.dataset.choiceActivating).toBeUndefined();
  });
  it('never arms locked choices and lets action cards open the original city windows', () => {
    const f = input(), action = jest.fn();
    activateToolChoice(f.button,{tool:'airport',available:false},f.doc);
    expect(f.clicks()).toBe(0); expect(f.events).toHaveLength(0);
    activateToolChoice(f.button,{tool:'ruler_house_wings',available:true,action},f.doc);
    expect(action).toHaveBeenCalledTimes(1); expect(f.clicks()).toBe(0); expect(f.events).toHaveLength(0);
  });
});
