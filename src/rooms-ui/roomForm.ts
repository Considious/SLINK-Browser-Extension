// Adapted from Torn Rooms by Manuel [3747263], https://github.com/manuelcecchetto/torn-rooms
// Upstream 6dd9f46fa422f4a5da12dfe34465dd87242722e3; MIT license in vendor/torn-rooms/LICENSE.
// SLINK adaptation: existing SLINK transport, permissions and persistence only.
// Create / edit a room: Torn's room settings form (name, icon, description, access control).
const LIMITS={roomName:60,description:300};
type PostPolicy='everyone'|'admins';
type Visibility='faction'|'selected'|'leaders';
import { h, roomIcon, ROOM_ICON_NAMES, roomIconTheme, text } from './dom';

export const ROOM_THEME_LABELS:Record<string,string>={
 'slinky-pursuit':'Slinky Pursuit','slinky-underglow':'Slinky Underglow','slinky-black-chrome':'Slinky Black Chrome',
 'halloween-2026':'Halloween 2026','slink-naughty-list':'Naughty List','slink-candy-cartel':'Candy Cartel'
};

import { backView, checkbox, setting, tabList, textInput, tornBtn } from './forms';

export interface RoomFormValues {
  name: string;
  description: string;
  icon: string;
  color: string;
  theme?: string;
  visibility: Visibility;
  postPolicy: PostPolicy;
  showFactionTags: boolean;
}

export function roomForm(opts: {
  backTitle: string;
  personal?: boolean;
  christmasIcons?: boolean;
  roomThemes?: string[];
  themeEditable?: boolean;
  onChange?: (v: RoomFormValues) => void;
  submitTitle: string;
  initial?: RoomFormValues;
  onBack: () => void;
  onSubmit: (v: RoomFormValues) => Promise<void>;
}): HTMLElement {
  const v: RoomFormValues = opts.initial ? { ...opts.initial } : { name: '', description: '', icon: '', color: '', visibility: 'selected', postPolicy: 'everyone', showFactionTags: false };
  const host = h('div', { style: 'display: contents;' });
  const themes=(opts.roomThemes||[]).filter(id=>Object.hasOwn(ROOM_THEME_LABELS,id));

  const changed=()=>opts.onChange?.({...v});
  const main = () => {
    const submit = tornBtn(opts.submitTitle, () => {}, { cls: 'actionButton___ucXZJ', submit: true });
    const error = text('error', '', { style: 'margin: 10px 10px 0; display: none;' });
    const valid = () => {
      submit.disabled = !v.name.trim();
    };
    const name = textInput({ value: v.name, maxLength: LIMITS.roomName, onInput: (x) => ((v.name = x), changed(), valid()) });
    const desc = textInput({ value: v.description, maxLength: LIMITS.description, onInput: (x) => ((v.description = x),changed()) });
    name.input.setAttribute('aria-label','Room name');desc.input.setAttribute('aria-label','Room description');
    const iconBtn = h(
      'button',
      { type: 'button', c: 'root___Z_Afv iconWrapper___N1Bnd iconButton___URo_b', on: { click: () => picker() } },
      h('div', { c: 'iconWrapper___N1Bnd' }, roomIcon(v.icon, 'icon___eo4eO')),
    );
    const accessOptions: { value: Visibility; title: string; icon: 'accessPrivate' | 'accessPublic' }[] = [{value:'selected',title:'Selected members',icon:'accessPrivate'},{value:'faction',title:'All members',icon:'accessPublic'},{value:'leaders',title:'Leaders only',icon:'accessPrivate'}];
    const currentTheme=v.theme||'';
    const themeSelect=h('select',{'aria-label':'Room theme',on:{change:(e:Event)=>{v.theme=(e.target as HTMLSelectElement).value;changed();}}},
      h('option',{value:''},'Torn default'),
      ...themes.map(id=>h('option',{value:id},ROOM_THEME_LABELS[id])),
      ...(currentTheme&&!themes.includes(currentTheme)?[h('option',{value:currentTheme,disabled:true},ROOM_THEME_LABELS[currentTheme]||'Saved theme')]:[])) as HTMLSelectElement;
    themeSelect.value=currentTheme;

    const form = h(
      'form',
      {
        on: {
          submit: async (e: Event) => {
            e.preventDefault();
            submit.disabled = true;
            error.style.display = 'none';
            try {
              await opts.onSubmit({ ...v, name: v.name.trim(), description: v.description.trim() });
            } catch (err) {
              error.textContent = (err as Error).message;
              error.style.display = '';
              submit.disabled = false;
            }
          },
        },
      },
      backView(opts.backTitle, opts.onBack, 'tr-scroll', [
        h(
          'div',
          { style: 'display: flex; flex-direction: row;' },
          setting('Room name', [name.root], { cls: 'roomNameSetting___S2obB' }),
          setting('Icon', [iconBtn]),
        ),
        setting('Room description', [h('div', { c: 'row___gZZ09' }, desc.root)]),
        setting('Color', [colorPicker(v.color, (c) => ((v.color = c),changed()))]),
        opts.themeEditable===true&&setting('Room theme',[themeSelect,h('small',{},'Everyone in this room sees the selected theme.')]),
        !opts.personal && setting('Access control', [tabList(accessOptions, v.visibility, (x) => ((v.visibility = x),changed()))]),
        /* SLINK write/moderation grants remain in its member management controls. */
        false && setting('Who can write', [
          tabList(
            [
              { value: 'everyone' as PostPolicy, title: 'Everyone', icon: 'accessPublic' as const },
              { value: 'admins' as PostPolicy, title: 'Admins only', icon: 'accessExclusive' as const },
            ],
            v.postPolicy,
            (x) => (v.postPolicy = x),
          ),
        ]),
        false && setting('Names', [checkbox('Show [faction tag] before names', v.showFactionTags, (x) => (v.showFactionTags = x)).label]),
        error,
        submit,
      ]),
    );
    valid();
    host.replaceChildren(form);
    name.input.focus();
  };

  // oS: the icon picker.
  const picker = () => {
    const grid = h('div', { c: 'collection___MXn9U' });
    const draw = (q: string) =>
      grid.replaceChildren(
        ...['', ...ROOM_ICON_NAMES]
          .filter(n=>{const theme=roomIconTheme(n);return !theme||themes.includes(theme)||(theme==='slink-naughty-list'&&opts.christmasIcons===true);})
          .filter((n) => !q || n.includes(q.toLowerCase()))
          .map((n) =>
            h('div', { role: 'button', tabindex:'0', 'aria-label':'Use '+(n||'default')+' icon', title: n || 'default', on: { click: () => ((v.icon = n), changed(), main()), keydown:(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();v.icon=n;changed();main();}} } }, roomIcon(n, '', n || 'default')),
          ),
      );
    const search = textInput({ placeholder: 'Search icons', icon: 'search', cls: 'input___dQlNS', onInput: draw });
    draw('');
    host.replaceChildren(backView('Back to settings', main, 'root___SvMxo', [search.root, grid]));
    search.input.focus();
  };

  main();
  return host;
}

// Torn-toned presets; '' keeps Torn's grey. The last swatch opens the system color picker.
const PRESETS = ['', '#b22222', '#c2571a', '#b8860b', '#2e7d32', '#00838f', '#1565c0', '#6a1b9a', '#ad1457'];

function colorPicker(initial: string, onChange: (c: string) => void): HTMLElement {
  let current = initial;
  const custom = h('input', {
    type: 'color',
    title: 'Custom color',
    value: initial && !PRESETS.includes(initial) ? initial : '#888888',
    on: { input: (e: Event) => pick((e.target as HTMLInputElement).value) },
  });
  const customSwatch = h('label', { c: 'tr-swatch tr-swatch-custom', title: 'Custom color' }, custom);
  const swatches = PRESETS.map((c) =>
    h('button', {
      type: 'button',
      title: c || 'Default',
      c: `tr-swatch ${c ? '' : 'tr-swatch-default'}`,
      style: c ? `--tr-room: ${c}` : undefined,
      on: { click: () => pick(c) },
    }),
  );
  // Only toggle classes: rebuilding would close the system color picker while it is open.
  const draw = () => {
    swatches.forEach((el, i) => el.classList.toggle('tr-swatch-on', PRESETS[i] === current));
    const isCustom = !!current && !PRESETS.includes(current);
    customSwatch.classList.toggle('tr-swatch-on', isCustom);
    if (isCustom) customSwatch.style.setProperty('--tr-room', current);
  };
  const pick = (c: string) => {
    current = c;
    onChange(c);
    draw();
  };
  draw();
  return h('div', { c: 'tr-swatches' }, ...swatches, customSwatch);
}

