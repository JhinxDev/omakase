/* Fixed illustrative picks. This module never reads inputs or calls a provider. */
(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const study = document.querySelector(".menu-study");
    if (!study) return;
    const choices = study.querySelector(".menu-study__choices");
    const buttons = [...study.querySelectorAll("[data-example-pick]")];
    const cards = [...study.querySelectorAll("[data-example-card]")];
    const marks = [...study.closest("figure").querySelectorAll(".sample-room__mark")];
    if (buttons.length !== 5 || cards.length !== 5 || marks.length !== 5) return;
    let selected = 0;
    function update() {
      buttons.forEach((button, index) => button.setAttribute("aria-pressed", String(index === selected)));
      cards.forEach((card, index) => { card.hidden = index !== selected; });
      marks.forEach((mark, index) => { mark.hidden = !study.open || index !== selected; });
    }
    buttons.forEach((button, index) => button.addEventListener("click", () => {
      selected = index;
      update();
    }));
    study.addEventListener("toggle", update);
    update();
    choices.hidden = false;
  });
})();
