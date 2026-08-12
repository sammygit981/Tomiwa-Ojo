(() => {
  const COLOR_MAP = {
    Red: '#8B2332',
    Grey: '#9E9E9E',
    Gray: '#9E9E9E',
    Blue: '#1E3A5F',
    Black: '#000000',
    White: '#FFFFFF',
    Green: '#2E5E4E',
    Orange: '#E86C3A',
    Yellow: '#E8C547',
    Navy: '#1B2A49',
    Pink: '#E8A0B0',
    Brown: '#6B4423',
    Purple: '#5C3D6E',
  };

  const getColor = (name) => COLOR_MAP[name] || '#CCCCCC';

  const formatMoney = (cents) => {
    if (window.Shopify?.formatMoney) {
      return window.Shopify.formatMoney(cents);
    }
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
  };

  const initProductGrid = (root) => {
    if (root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const modal = root.querySelector('[data-product-modal]');
    const triggers = root.querySelectorAll('[data-product-trigger]');
    const jacketData = root.querySelector('[data-soft-winter-jacket]');
    const form = root.querySelector('[data-product-form]');

    let jacketProduct = null;
    if (jacketData?.textContent.trim()) {
      try {
        jacketProduct = JSON.parse(jacketData.textContent);
      } catch (e) {
        jacketProduct = null;
      }
    }

    let activeProduct = null;
    let selectedSize = '';

    const lockScroll = () => {
      document.body.style.overflow = 'hidden';
    };

    const unlockScroll = () => {
      document.body.style.overflow = '';
    };

    const closeModal = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      unlockScroll();
      root.querySelectorAll('.ecom-product-modal__size-select.is-open').forEach((el) => {
        el.classList.remove('is-open');
        el.querySelector('[data-size-list]')?.setAttribute('hidden', '');
      });
    };

    const getSelectedOptions = () => {
      const selected = {};
      modal.querySelectorAll('[data-option-name]').forEach((group) => {
        const name = group.dataset.optionName;
        if (group.dataset.optionType === 'color') {
          const checked = group.querySelector('input[type="radio"]:checked');
          if (checked) selected[name] = checked.value;
        } else if (group.dataset.optionType === 'size') {
          if (selectedSize) selected[name] = selectedSize;
        } else if (group.dataset.optionType === 'generic') {
          const checked = group.querySelector('input[type="radio"]:checked');
          if (checked) selected[name] = checked.value;
        }
      });
      return selected;
    };

    const findVariant = (product, selections) => {
      if (!product?.variants?.length) return null;
      return (
        product.variants.find((variant) =>
          variant.options.every((opt, i) => {
            const optionName = product.options[i]?.name;
            return selections[optionName] === opt;
          })
        ) || product.variants.find((v) => v.available) || product.variants[0]
      );
    };

    const buildColorSelector = (option, index) => {
      const group = document.createElement('div');
      group.className = 'ecom-product-modal__option-group';
      group.dataset.optionName = option.name;
      group.dataset.optionType = 'color';

      const label = document.createElement('div');
      label.className = 'ecom-product-modal__option-label';
      label.textContent = option.name;
      group.appendChild(label);

      const row = document.createElement('div');
      row.className = 'ecom-product-modal__color-row';

      option.values.slice(0, 2).forEach((value, idx) => {
        const wrap = document.createElement('div');
        wrap.className = 'ecom-product-modal__color-option';
        const id = `color-opt-${index}-${idx}`;
        wrap.innerHTML = `
          <input type="radio" name="option-color-${index}" id="${id}" value="${value}" ${idx === 0 ? 'checked' : ''}>
          <label class="ecom-product-modal__color-label" for="${id}">
            <span class="ecom-product-modal__color-swatch" style="background:${getColor(value)}"></span>
            <span>${value}</span>
          </label>`;
        row.appendChild(wrap);
      });

      group.appendChild(row);
      return group;
    };

    const buildSizeDropdown = (option, index) => {
      const group = document.createElement('div');
      group.className = 'ecom-product-modal__option-group';
      group.dataset.optionName = option.name;
      group.dataset.optionType = 'size';

      const label = document.createElement('div');
      label.className = 'ecom-product-modal__option-label';
      label.textContent = option.name;
      group.appendChild(label);

      const select = document.createElement('div');
      select.className = 'ecom-product-modal__size-select';
      select.innerHTML = `
        <button type="button" class="ecom-product-modal__size-trigger" data-size-trigger>
          <span data-size-label>Choose your size</span>
          <span class="ecom-product-modal__size-chevron" aria-hidden="true"></span>
        </button>
        <ul class="ecom-product-modal__size-list" data-size-list hidden></ul>`;

      const list = select.querySelector('[data-size-list]');
      option.values.forEach((value, idx) => {
        const li = document.createElement('li');
        li.className = 'ecom-product-modal__size-option';
        li.textContent = value;
        li.dataset.value = value;
        if (idx === 0) {
          li.classList.add('is-selected');
          selectedSize = value;
          select.querySelector('[data-size-label]').textContent = value;
        }
        list.appendChild(li);
      });

      const trigger = select.querySelector('[data-size-trigger]');
      trigger.addEventListener('click', () => {
        const isOpen = select.classList.toggle('is-open');
        list.toggleAttribute('hidden', !isOpen);
      });

      list.querySelectorAll('.ecom-product-modal__size-option').forEach((item) => {
        item.addEventListener('click', () => {
          selectedSize = item.dataset.value;
          select.querySelector('[data-size-label]').textContent = selectedSize;
          list.querySelectorAll('.ecom-product-modal__size-option').forEach((el) => el.classList.remove('is-selected'));
          item.classList.add('is-selected');
          select.classList.remove('is-open');
          list.setAttribute('hidden', '');
        });
      });

      group.appendChild(select);
      return group;
    };

    const buildOptions = (product) => {
      const container = modal.querySelector('[data-modal-options]');
      container.innerHTML = '';
      selectedSize = '';

      (product.options || []).forEach((option, i) => {
        if (!option.values || option.values.length < 2) return;

        const nameLower = option.name.toLowerCase();
        if (nameLower.includes('color') || nameLower.includes('colour')) {
          container.appendChild(buildColorSelector(option, i));
        } else if (nameLower.includes('size')) {
          container.appendChild(buildSizeDropdown(option, i));
        } else {
          const group = document.createElement('div');
          group.className = 'ecom-product-modal__option-group';
          group.dataset.optionName = option.name;
          group.dataset.optionType = 'generic';
          group.innerHTML = `<div class="ecom-product-modal__option-label">${option.name}</div>`;
          const row = document.createElement('div');
          row.className = 'ecom-product-modal__color-row';
          option.values.slice(0, 2).forEach((value, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'ecom-product-modal__color-option';
            const id = `generic-opt-${i}-${idx}`;
            wrap.innerHTML = `
              <input type="radio" name="option-generic-${i}" id="${id}" value="${value}" ${idx === 0 ? 'checked' : ''}>
              <label class="ecom-product-modal__color-label" for="${id}"><span>${value}</span></label>`;
            row.appendChild(wrap);
          });
          group.appendChild(row);
          container.appendChild(group);
        }
      });
    };

    const openModal = (product) => {
      activeProduct = product;
      modal.querySelector('[data-modal-title]').textContent = product.title;
      modal.querySelector('[data-modal-price]').textContent = formatMoney(product.price);
      modal.querySelector('[data-modal-description]').innerHTML = product.description || '';
      modal.querySelector('[data-modal-image]').src = product.featured_image || '';
      modal.querySelector('[data-modal-image]').alt = product.title;
      modal.querySelector('[data-modal-status]').textContent = '';

      buildOptions(product);

      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      lockScroll();
    };

    triggers.forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('[data-product-card]');
        const dataEl = card?.querySelector('[data-product-data]');
        if (!dataEl) return;
        try {
          openModal(JSON.parse(dataEl.textContent));
        } catch (e) {
          console.error('Product data parse error', e);
        }
      });
    });

    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeProduct) return;

      const selections = getSelectedOptions();
      const variant = findVariant(activeProduct, selections);
      if (!variant) {
        modal.querySelector('[data-modal-status]').textContent = 'Please select options';
        return;
      }

      if (!variant.available) {
        modal.querySelector('[data-modal-status]').textContent = 'Variant unavailable';
        return;
      }

      const selectedValues = Object.values(selections);
      const isBlackMedium =
        selectedValues.some((v) => v.toLowerCase() === 'black') &&
        selectedValues.some((v) => v.toLowerCase() === 'medium');

      const items = [{ id: variant.id, quantity: 1 }];

      if (isBlackMedium && jacketProduct?.variants?.[0]?.id) {
        items.push({ id: jacketProduct.variants[0].id, quantity: 1 });
      }

      const status = modal.querySelector('[data-modal-status]');
      status.textContent = 'Adding...';

      try {
        const res = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });

        if (res.ok) {
          status.textContent = 'Added to cart!';
        } else {
          throw new Error('Cart add failed');
        }
      } catch {
        status.textContent = 'Error adding to cart';
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

  document.addEventListener('shopify:section:load', (e) => {
    const section = e.target.querySelector('[data-ecom-product-grid-section]');
    if (section) {
      section.dataset.initialized = 'false';
      initProductGrid(section);
    }
  });
})();
