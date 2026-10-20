(function registerFactionOfficerRolesModule(global) {
  'use strict';

  const SLINK = global.SLINK_EXTENSION;
  if (!SLINK) throw new Error('SLINK runtime must load before Faction Officers.');

  SLINK.modules.register({
    id:'faction-officers',
    title:'Faction Officers',
    shortTitle:'Officers',
    group:'quality-of-life',
    groupTitle:'Quality of Life',
    requiredScopes:['admin.*'],
    defaultShowInTorn:true,
    matches:url => url.hostname === 'www.torn.com',
    async start(context) {
      const ui = context.ui;
      let current = null;
      let busy = false;

      ui.setModuleStyles(`
        .slink-officer-intro{margin:0 0 10px;color:var(--slink-muted)}
        .slink-officer-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:9px}
        .slink-officer-summary>div{padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control)}
        .slink-officer-summary strong,.slink-officer-summary span{display:block}.slink-officer-summary span{color:var(--slink-muted);font-size:11px}
        .slink-officer-roles{display:grid;gap:6px}.slink-officer-role{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border:1px solid var(--slink-border-soft);border-radius:7px;background:var(--slink-bg-control)}
        .slink-officer-role input{margin:0}.slink-officer-role small{color:var(--slink-muted)}
        .slink-officer-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.slink-officer-actions button{min-height:30px;padding:5px 10px;border:1px solid var(--slink-border);border-radius:6px;background:var(--slink-bg);color:var(--slink-text);font:inherit}
      `);

      function render() {
        const root = ui.getContentElement();
        if (!current) {
          root.innerHTML = '<p class="slink-officer-intro">Loading faction roles…</p>';
          return;
        }
        root.replaceChildren();
        const intro = document.createElement('p');
        intro.className = 'slink-officer-intro';
        intro.textContent = 'Select the Torn faction roles that should automatically receive SLINK faction-officer access. Changes apply when members refresh or reauthenticate their SLINK permissions.';
        root.append(intro);

        const summary = document.createElement('div');
        summary.className = 'slink-officer-summary';
        for (const [value, label] of [
          [current.factionId || '—', 'Faction'],
          [current.memberCount || 0, 'Members reviewed']
        ]) {
          const cell = document.createElement('div');
          const strong = document.createElement('strong'); strong.textContent = String(value);
          const span = document.createElement('span'); span.textContent = label;
          cell.append(strong, span); summary.append(cell);
        }
        root.append(summary);

        const list = document.createElement('div');
        list.className = 'slink-officer-roles';
        for (const role of current.roles || []) {
          const label = document.createElement('label');
          label.className = 'slink-officer-role';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = role.selected === true;
          input.dataset.officerRole = role.name;
          input.disabled = busy;
          const name = document.createElement('strong'); name.textContent = role.name;
          const count = document.createElement('small'); count.textContent = `${role.memberCount} member${role.memberCount === 1 ? '' : 's'}`;
          label.append(input, name, count); list.append(label);
        }
        root.append(list);

        const actions = document.createElement('div');
        actions.className = 'slink-officer-actions';
        const save = document.createElement('button');
        save.type = 'button'; save.textContent = busy ? 'Saving…' : 'Save officer roles'; save.disabled = busy;
        save.addEventListener('click', async () => {
          busy = true; render();
          try {
            const roles = [...root.querySelectorAll('[data-officer-role]:checked')].map(input => input.dataset.officerRole);
            current = await SLINK.core.messaging.send('faction.officer-roles.save', { roles });
            ui.setStatus('Officer role assignments saved.', 'ready');
          } catch (error) {
            ui.setStatus(SLINK.core.format.errorMessage(error), 'error');
          } finally {
            busy = false; render();
          }
        });
        const refresh = document.createElement('button');
        refresh.type = 'button'; refresh.textContent = 'Reload faction roles'; refresh.disabled = busy;
        refresh.addEventListener('click', () => void load());
        actions.append(save, refresh); root.append(actions);
      }

      async function load() {
        busy = true; render();
        try {
          current = await SLINK.core.messaging.send('faction.officer-roles.status');
          ui.setStatus('Faction roles loaded.', 'ready');
        } catch (error) {
          ui.setStatus(SLINK.core.format.errorMessage(error), 'error');
        } finally {
          busy = false; render();
        }
      }

      await load();
      return { stop() {} };
    }
  });
})(globalThis);
