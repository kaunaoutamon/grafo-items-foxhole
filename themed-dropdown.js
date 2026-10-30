(function (root) {
  const controllers = new WeakMap();
  let nextDropdownId = 0;

  function enhance(select) {
    if (controllers.has(select)) return controllers.get(select);

    const parent = select.parentNode;
    const dropdownId = select.id || `themed-dropdown-${nextDropdownId++}`;
    const wrapper = document.createElement('div');
    wrapper.className = 'themed-dropdown';
    wrapper.dataset.dropdownId = dropdownId;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'form-control select-control themed-dropdown-trigger';
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${dropdownId}-options`);
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || 'Seleccionar una opción');
    if (select.required) trigger.setAttribute('aria-required', 'true');
    if (select.dataset.recipeOutput) trigger.dataset.recipeOutput = select.dataset.recipeOutput;

    const options = document.createElement('div');
    options.id = `${dropdownId}-options`;
    options.className = 'themed-dropdown-menu';
    options.setAttribute('role', 'listbox');
    options.setAttribute('aria-label', select.getAttribute('aria-label') || 'Opciones');
    options.hidden = true;

    parent.insertBefore(wrapper, select);
    wrapper.append(trigger, options, select);
    select.classList.add('themed-native-select');
    select.setAttribute('aria-hidden', 'true');
    select.tabIndex = -1;

    let activeIndex = -1;

    function syncTrigger() {
      const selected = select.options[select.selectedIndex];
      trigger.textContent = selected?.textContent.trim() || 'Seleccionar...';
      trigger.disabled = select.disabled;
    }

    function renderOptions() {
      options.replaceChildren();
      [...select.options].forEach((option, index) => {
        const row = document.createElement('div');
        row.id = `${dropdownId}-option-${index}`;
        row.className = 'themed-dropdown-option';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(index === select.selectedIndex));
        if (option.disabled) row.setAttribute('aria-disabled', 'true');
        row.dataset.optionIndex = String(index);
        row.textContent = option.textContent.trim();
        options.appendChild(row);
      });
    }

    function close() {
      options.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      activeIndex = -1;
    }

    function setActive(index) {
      const enabled = [...select.options]
        .map((option, optionIndex) => option.disabled ? -1 : optionIndex)
        .filter(optionIndex => optionIndex >= 0);
      if (enabled.length === 0) return;
      activeIndex = enabled.reduce((closest, optionIndex) =>
        Math.abs(optionIndex - index) < Math.abs(closest - index) ? optionIndex : closest
      , enabled[0]);

      options.querySelectorAll('[role="option"]').forEach(row => {
        const active = Number(row.dataset.optionIndex) === activeIndex;
        row.setAttribute('aria-selected', String(active));
        if (active) {
          trigger.setAttribute('aria-activedescendant', row.id);
          row.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function open() {
      if (select.disabled) return;
      renderOptions();
      options.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      const selectedIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
      setActive(selectedIndex);
    }

    function choose(index) {
      const option = select.options[index];
      if (!option || option.disabled) return;
      const changed = select.value !== option.value;
      select.value = option.value;
      syncTrigger();
      close();
      if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    trigger.addEventListener('click', () => {
      if (options.hidden) open();
      else close();
    });

    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (options.hidden) open();
        else setActive(activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (options.hidden) open();
        else setActive(activeIndex - 1);
      } else if (event.key === 'Home' && !options.hidden) {
        event.preventDefault();
        setActive(0);
      } else if (event.key === 'End' && !options.hidden) {
        event.preventDefault();
        setActive(select.options.length - 1);
      } else if ((event.key === 'Enter' || event.key === ' ') && options.hidden) {
        event.preventDefault();
        open();
      } else if ((event.key === 'Enter' || event.key === ' ') && activeIndex >= 0) {
        event.preventDefault();
        choose(activeIndex);
      } else if (event.key === 'Escape' && !options.hidden) {
        event.preventDefault();
        close();
      }
    });

    options.addEventListener('pointerdown', event => {
      if (event.target instanceof Element && event.target.closest('[role="option"]')) {
        event.preventDefault();
      }
    });

    options.addEventListener('click', event => {
      const row = event.target instanceof Element ? event.target.closest('[role="option"]') : null;
      if (row) choose(Number(row.dataset.optionIndex));
    });

    trigger.addEventListener('blur', close);
    select.addEventListener('change', syncTrigger);

    const controller = {
      close,
      focus: () => trigger.focus(),
      refresh: () => {
        syncTrigger();
        if (!options.hidden) renderOptions();
      },
      trigger
    };
    controllers.set(select, controller);
    syncTrigger();
    return controller;
  }

  function refresh(select) {
    controllers.get(select)?.refresh();
  }

  function focus(select) {
    controllers.get(select)?.focus();
  }

  root.ThemedDropdown = { enhance, focus, refresh };
})(globalThis);
