/**
 * Ecom Product Grid
 * --------------------------------------------------------------------------
 * - A hotspot on each card opens a quick-view popup
 * - Options are rendered dynamically from the product data, always in the
 *   design order: colour first, then size, then anything else
 * - Nothing is preselected (matches the untouched state in the design)
 * - Add to cart uses the AJAX Cart API and appends the bonus product when the
 *   trigger option values (e.g. Black + Medium) are selected
 * - Every user facing string, icon and URL comes from Liquid
 * Vanilla JavaScript only.
 */
(() => {
  'use strict';

  /** Element factory - keeps the builders readable and XSS-safe. */
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  /** Decorative <img> for the dropdown chevrons (paths come from Liquid). */
  const icon = (src, className) => {
    const img = el('img', className);
    img.src = src;
    img.alt = '';
    return img;
  };

  /** Colour options render before size options, everything else last. */
  const optionRank = (name) => {
    const value = name.toLowerCase();
    if (value.includes('color') || value.includes('colour')) return 0;
    if (value.includes('size')) return 1;
    return 2;
  };

  const initProductGrid = (root) => {
    if (root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const modal = root.querySelector('[data-product-modal]');
    const form = root.querySelector('[data-product-form]');
    if (!modal || !form) return;

    const ui = {
      title: modal.querySelector('[data-modal-title]'),
      price: modal.querySelector('[data-modal-price]'),
      description: modal.querySelector('[data-modal-description]'),
      image: modal.querySelector('[data-modal-image]'),
      options: modal.querySelector('[data-modal-options]'),
      status: modal.querySelector('[data-modal-status]'),
      submit: modal.querySelector('[data-add-to-cart]'),
    };

    // Copy, icons and endpoints authored in the customizer / Liquid
    const copy = modal.dataset;

    // "Black, Medium" -> ['black', 'medium']
    const bonusTriggers = (copy.bonusOptions || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    let bonusProduct = null;
    const bonusJson = root.querySelector('[data-bonus-product]');
    if (bonusJson) {
      try {
        bonusProduct = JSON.parse(bonusJson.textContent);
      } catch (error) {
        bonusProduct = null;
      }
    }

    const state = { product: null, variant: null, selections: {} };

    const setStatus = (message) => {
      ui.status.textContent = message || '';
    };

    /** Resolve the variant as soon as every option has a value. */
    const syncVariant = () => {
      const names = state.product.options.map((option) => option.name);
      const complete = names.every((name) => state.selections[name]);

      state.variant = complete
        ? state.product.variants.find((variant) =>
            variant.options.every((value, index) => state.selections[names[index]] === value)
          ) || null
        : null;

      if (state.variant) {
        ui.price.textContent = state.variant.price_formatted;
        setStatus(state.variant.available ? '' : copy.unavailable);
      }
    };

    /** Colour / generic options: equal cells inside one outlined row. */
    const buildSwatchGroup = (option, index, withSwatch) => {
      const group = el('div', 'ecom-product-modal__option-group');
      group.appendChild(el('span', 'ecom-product-modal__option-label', option.name));

      const row = el('div', 'ecom-product-modal__color-row');
      // Drives the width of the sliding indicator in CSS
      row.style.setProperty('--color-count', option.values.length);

      option.values.forEach((value, valueIndex) => {
        const id = `ecom-option-${index}-${valueIndex}`;
        const cell = el('div', 'ecom-product-modal__color-option');

        const input = el('input');
        input.type = 'radio';
        input.name = `ecom-option-${index}`;
        input.id = id;
        input.value = value;
        // No `checked`: the popup opens with nothing selected, as designed
        input.addEventListener('change', () => {
          state.selections[option.name] = value;
          // Slides the black block onto this cell (in from the left the
          // first time, sideways after that)
          row.style.setProperty('--active-index', valueIndex);
          row.classList.add('is-active');
          syncVariant();
        });

        const label = el('label', 'ecom-product-modal__color-label');
        label.setAttribute('for', id);

        if (withSwatch) {
          const swatch = el('span', 'ecom-product-modal__color-swatch');
          // CSS named colours resolve on their own, anything else keeps the CSS fallback
          if (window.CSS && CSS.supports('color', value)) swatch.style.background = value;
          label.appendChild(swatch);
        }

        label.appendChild(el('span', null, value));
        cell.append(input, label);
        row.appendChild(cell);
      });

      group.appendChild(row);
      return group;
    };

    /** Size option: custom dropdown that starts on the placeholder. */
    const buildSizeGroup = (option) => {
      const group = el('div', 'ecom-product-modal__option-group');
      group.appendChild(el('span', 'ecom-product-modal__option-label', option.name));

      const select = el('div', 'ecom-product-modal__size-select');

      const trigger = el('button', 'ecom-product-modal__size-trigger');
      trigger.type = 'button';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');

      const value = el('span', 'ecom-product-modal__size-value', copy.sizePlaceholder);

      const cell = el('span', 'ecom-product-modal__size-cell');
      cell.append(
        icon(copy.iconDown, 'ecom-product-modal__size-chevron ecom-product-modal__size-chevron--down'),
        icon(copy.iconUp, 'ecom-product-modal__size-chevron ecom-product-modal__size-chevron--up')
      );

      trigger.append(value, cell);

      const list = el('ul', 'ecom-product-modal__size-list');
      list.setAttribute('role', 'listbox');

      const toggle = (open) => {
        select.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', String(open));
      };

            /**
       * Open: click anywhere on the field (value area or down arrow).
       * Close: only the up arrow - clicking the value area again does nothing,
       */
      trigger.addEventListener('click', (event) => {
        const isOpen = select.classList.contains('is-open');
        const onArrow = Boolean(event.target.closest('.ecom-product-modal__size-cell'));

        if (isOpen) {
          if (onArrow) toggle(false);
          return;
        }

        toggle(true);
        // Glide the current choice into view instead of jumping to it
        list.querySelector('.is-selected')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });

      /** Cross-fades the trigger text so the choice feels smooth. */
      const showValue = (text) => {
        value.classList.add('is-fading');
        window.setTimeout(() => {
          value.textContent = text;
          value.classList.remove('is-fading');
        }, 150);
      };

      option.values.forEach((optionValue) => {
        const item = el('li', 'ecom-product-modal__size-option', optionValue);
        item.setAttribute('role', 'option');
        item.addEventListener('click', () => {
          state.selections[option.name] = optionValue;
          showValue(optionValue);
          list.querySelectorAll('.ecom-product-modal__size-option')
            .forEach((node) => node.classList.remove('is-selected'));
          item.classList.add('is-selected');
          toggle(false);
          syncVariant();
        });
        list.appendChild(item);
      });

      select.append(trigger, list);
      group.appendChild(select);
      return group;
    };

    const buildOptions = (product) => {
      ui.options.replaceChildren();

      // Keep the original index (used for the radio group name) while reordering
      [...(product.options || [])]
        .map((option, index) => ({ option, index }))
        .sort((a, b) => optionRank(a.option.name) - optionRank(b.option.name))
        .forEach(({ option, index }) => {
          if (!option.values || !option.values.length) return;

          // A single-value option has nothing to choose: lock it in silently
          if (option.values.length === 1) {
            state.selections[option.name] = option.values[0];
            return;
          }

          const name = option.name.toLowerCase();
          if (name.includes('color') || name.includes('colour')) {
            ui.options.appendChild(buildSwatchGroup(option, index, true));
          } else if (name.includes('size')) {
            ui.options.appendChild(buildSizeGroup(option));
          } else {
            ui.options.appendChild(buildSwatchGroup(option, index, false));
          }
        });
    };

    const closeAllDropdowns = () => {
      modal.querySelectorAll('.ecom-product-modal__size-select.is-open').forEach((select) => {
        select.classList.remove('is-open');
        select.querySelector('.ecom-product-modal__size-trigger')?.setAttribute('aria-expanded', 'false');
      });
    };

    const openModal = (product) => {
      state.product = product;
      state.variant = null;
      state.selections = {};

      ui.title.textContent = product.title;
      ui.price.textContent = product.price_formatted;
      ui.description.innerHTML = product.description || '';
      ui.image.src = product.featured_image || '';
      ui.image.alt = product.title;
      setStatus('');

      buildOptions(product);

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
      closeAllDropdowns();
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    // Hotspots
    root.querySelectorAll('[data-product-trigger]').forEach((button) => {
      button.addEventListener('click', () => {
        const data = button.closest('[data-product-card]')?.querySelector('[data-product-data]');
        if (!data) return;
        try {
          openModal(JSON.parse(data.textContent));
        } catch (error) {
          console.error('Ecom grid: invalid product data', error);
        }
      });
    });

    modal.querySelectorAll('[data-modal-close]').forEach((node) => {
      node.addEventListener('click', closeModal);
    });

        // No outside-click dismissal by design: the up arrow (or picking a value)
    // is the only way to collapse the list.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.product) return;

      if (!state.variant) {
        setStatus(copy.selectOptions);
        return;
      }

      if (!state.variant.available) {
        setStatus(copy.unavailable);
        return;
      }

      const chosen = Object.values(state.selections).map((value) => value.toLowerCase());
      const wantsBonus = bonusTriggers.length > 0 && bonusTriggers.every((t) => chosen.includes(t));

      const items = [{ id: state.variant.id, quantity: 1 }];

      if (wantsBonus && bonusProduct) {
        const bonusVariant =
          bonusProduct.variants.find((variant) => variant.available) || bonusProduct.variants[0];
        if (bonusVariant) items.push({ id: bonusVariant.id, quantity: 1 });
      }

      ui.submit.setAttribute('aria-busy', 'true');
      setStatus('');

      try {
        const response = await fetch(copy.cartAddUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) throw new Error('Cart add failed');

        setStatus(copy.added);
        // Let the theme know the cart changed so any cart UI can refresh
        document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
      } catch (error) {
        setStatus(copy.error);
      } finally {
        ui.submit.removeAttribute('aria-busy');
      }
    });
  };

  const boot = () => {
    document.querySelectorAll('[data-ecom-product-grid-section]').forEach(initProductGrid);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Re-init after a customizer reload
  document.addEventListener('shopify:section:load', (event) => {
    const section = event.target.querySelector('[data-ecom-product-grid-section]');
    if (section) {
      section.dataset.initialized = 'false';
      initProductGrid(section);
    }
  });
})();