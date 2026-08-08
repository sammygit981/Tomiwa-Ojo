/*
 * Ecom Product Grid
 *
 * This module handles product-modal interaction, dynamic variant selection,
 * Shopify cart requests, and the required companion-product cart rule using
 * vanilla JavaScript only.
 */

(() => {
  const initProductGrid = (section) => {
    const modal = section.querySelector("[data-product-modal]");
    const triggers = section.querySelectorAll("[data-product-trigger]");
    const productDataElements = section.querySelectorAll("[data-product-data]");
    const companionElement = section.querySelector("[data-companion-product]");

    if (!modal || !triggers.length) {
      return;
    }

    const modalImage = modal.querySelector("[data-modal-image]");
    const modalTitle = modal.querySelector("[data-modal-title]");
    const modalPrice = modal.querySelector("[data-modal-price]");
    const modalDescription = modal.querySelector("[data-modal-description]");
    const modalOptions = modal.querySelector("[data-modal-options]");
    const modalStatus = modal.querySelector("[data-modal-status]");
    const productForm = modal.querySelector("[data-product-form]");
    const addButton = modal.querySelector("[data-add-to-cart]");
    const addButtonLabel = modal.querySelector("[data-add-to-cart-label]");

    const productMap = new Map();

    productDataElements.forEach((element) => {
      try {
        const product = JSON.parse(element.textContent);

        if (product && product.id) {
          productMap.set(String(product.id), product);
        }
      } catch (error) {
        console.error("Unable to parse product data.", error);
      }
    });

    let activeProduct = null;

    const companionProduct = companionElement
      ? JSON.parse(companionElement.textContent)
      : null;

    const formatMoney = (amount) => {
      const numericAmount = Number(amount);

      if (Number.isNaN(numericAmount)) {
        return "";
      }

      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD"
      }).format(numericAmount / 100);
    };

    const setStatus = (message = "", type = "") => {
      modalStatus.textContent = message;
      modalStatus.className = "ecom-product-modal__status";

      if (type) {
        modalStatus.classList.add(`is-${type}`);
      }
    };

    const getSelectedOptions = () => {
      return Array.from(
        modalOptions.querySelectorAll(
          'input[type="radio"]:checked'
        )
      ).map((input) => ({
        name: input.dataset.optionName,
        value: input.value
      }));
    };

    const findMatchingVariant = () => {
      if (!activeProduct || !activeProduct.variants) {
        return null;
      }

      const selectedOptions = getSelectedOptions();

      return (
        activeProduct.variants.find((variant) => {
          return selectedOptions.every((selectedOption) => {
            const optionIndex = activeProduct.options.findIndex(
              (option) => option === selectedOption.name
            );

            return (
              optionIndex !== -1 &&
              variant.options[optionIndex] === selectedOption.value
            );
          });
        }) || null
      );
    };

    const renderOptions = () => {
      modalOptions.innerHTML = "";

      if (
        !activeProduct.options ||
        !activeProduct.options.length
      ) {
        return;
      }

      activeProduct.options.forEach((optionName, optionIndex) => {
        const values = [
          ...new Set(
            activeProduct.variants
              .map((variant) => variant.options[optionIndex])
              .filter(Boolean)
          )
        ];

        if (!values.length) {
          return;
        }

        const fieldset = document.createElement("fieldset");
        fieldset.className = "ecom-product-modal__option";

        const legend = document.createElement("legend");
        legend.className = "ecom-product-modal__option-label";
        legend.textContent = optionName;

        const valuesContainer = document.createElement("div");
        valuesContainer.className =
          "ecom-product-modal__option-values";

        values.forEach((value, valueIndex) => {
          const wrapper = document.createElement("div");
          wrapper.className =
            "ecom-product-modal__option-value";

          const inputId =
            `${section.id}-${activeProduct.id}-${optionIndex}-${valueIndex}`;

          const input = document.createElement("input");

          input.type = "radio";
          input.id = inputId;
          input.name =
            `${section.id}-option-${optionIndex}`;
          input.value = value;
          input.dataset.optionName = optionName;
          input.checked = valueIndex === 0;

          const label = document.createElement("label");
          label.htmlFor = inputId;
          label.textContent = value;

          wrapper.append(input, label);
          valuesContainer.appendChild(wrapper);
        });

        fieldset.append(legend, valuesContainer);
        modalOptions.appendChild(fieldset);
      });
    };

    const updateVariantState = () => {
      const variant = findMatchingVariant();

      if (!variant) {
        addButton.disabled = true;
        setStatus("Please select an available variant.", "error");
        return null;
      }

      addButton.disabled = !variant.available;

      if (!variant.available) {
        setStatus("This variant is currently unavailable.", "error");
      } else {
        setStatus("");
      }

      return variant;
    };

    const openModal = (product) => {
      activeProduct = product;

      modalTitle.textContent = product.title;
      modalPrice.textContent = formatMoney(product.price);

      modalDescription.innerHTML = product.description || "";

      const imageUrl =
        product.featured_image ||
        product.images?.[0] ||
        "";

      modalImage.src = imageUrl;
      modalImage.alt = product.title;

      renderOptions();
      updateVariantState();

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("ecom-product-modal-open");

      const firstFocusable =
        modal.querySelector(".ecom-product-modal__close");

      firstFocusable?.focus();
    };

    const closeModal = () => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("ecom-product-modal-open");

      activeProduct = null;
      setStatus("");
    };

    const hasBlackAndMediumOptions = (variant) => {
      if (!activeProduct || !variant) {
        return false;
      }

      const values = variant.options.map((option) =>
        String(option).trim().toLowerCase()
      );

      return (
        values.includes("black") &&
        values.includes("medium")
      );
    };

    const addItemToCart = async (variantId) => {
      const response = await fetch(
        `${window.Shopify.routes.root}cart/add.js`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({
            items: [
              {
                id: variantId,
                quantity: 1
              }
            ]
          })
        }
      );

      if (!response.ok) {
        throw new Error("Unable to add the product to the cart.");
      }

      return response.json();
    };

    const addCompanionProduct = async () => {
      if (!companionProduct?.variants?.length) {
        return;
      }

      const availableVariant =
        companionProduct.variants.find(
          (variant) => variant.available
        );

      if (!availableVariant) {
        return;
      }

      await addItemToCart(availableVariant.id);
    };

    const handleAddToCart = async (event) => {
      event.preventDefault();

      const variant = updateVariantState();

      if (!variant || !variant.available) {
        return;
      }

      addButton.disabled = true;
      addButtonLabel.textContent = "ADDING...";

      setStatus("");

      try {
        await addItemToCart(variant.id);

        if (hasBlackAndMediumOptions(variant)) {
          await addCompanionProduct();
        }

        addButtonLabel.textContent = "ADDED";

        setStatus("Added to cart.", "success");

        /*
         * Dispatching the standard cart update event allows other theme
         * components to react to the cart change without coupling this
         * section to Horizon's internal cart implementation.
         */
        document.dispatchEvent(
          new CustomEvent("ecom:cart-updated")
        );

        window.dispatchEvent(
          new CustomEvent("cart:updated")
        );

        setTimeout(() => {
          closeModal();
          addButtonLabel.textContent = "ADD TO CART";
          addButton.disabled = false;
        }, 700);
      } catch (error) {
        console.error(error);

        addButtonLabel.textContent = "ADD TO CART";
        addButton.disabled = false;

        setStatus(
          "We couldn't add this product. Please try again.",
          "error"
        );
      }
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const card = trigger.closest("[data-product-card]");

        if (!card) {
          return;
        }

        const productId = card.dataset.productId;
        const product = productMap.get(String(productId));

        if (product) {
          openModal(product);
        }
      });
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-modal-close]")) {
        closeModal();
      }
    });

    modalOptions.addEventListener("change", () => {
      updateVariantState();
    });

    productForm.addEventListener("submit", handleAddToCart);

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        modal.classList.contains("is-open")
      ) {
        closeModal();
      }
    });
  };

  const init = () => {
    document
      .querySelectorAll(".ecom-product-grid")
      .forEach(initProductGrid);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();