(function () {
  const calculator = window.DiceDuelCalculator;
  const form = document.querySelector("#calculator-form");
  const attackerSummary = document.querySelector("#attacker-summary");
  const defenderSummary = document.querySelector("#defender-summary");
  const attackerDistribution = document.querySelector("#attacker-distribution");
  const defenderDistribution = document.querySelector("#defender-distribution");
  const duelNote = document.querySelector("#duel-note");
  const woundNote = document.querySelector("#wound-note");
  const splitRows = document.querySelectorAll("[data-split-row]");
  const rangeSelects = document.querySelectorAll("select[data-range-start]");

  function percent(value) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function collectFormData() {
    const formData = new FormData(form);
    return {
      attackerDice: formData.get("attackerDice"),
      attackerFight: formData.get("attackerFight"),
      attackerToWound: formData.get("attackerToWound"),
      attackerSecondaryEnabled: formData.get("attackerSecondaryEnabled") === "on",
      attackerSecondaryToWound: formData.get("attackerSecondaryToWound"),
      attackerSecondaryDice: formData.get("attackerSecondaryDice"),
      attackerTrapped: formData.get("attackerTrapped") === "on",
      attackerElvenMade: formData.get("attackerElvenMade") === "on",
      defenderDice: formData.get("defenderDice"),
      defenderFight: formData.get("defenderFight"),
      defenderToWound: formData.get("defenderToWound"),
      defenderSecondaryEnabled: formData.get("defenderSecondaryEnabled") === "on",
      defenderSecondaryToWound: formData.get("defenderSecondaryToWound"),
      defenderSecondaryDice: formData.get("defenderSecondaryDice"),
      defenderTrapped: formData.get("defenderTrapped") === "on",
      defenderElvenMade: formData.get("defenderElvenMade") === "on"
    };
  }

  function populateRangeSelects() {
    rangeSelects.forEach((select) => {
      const start = Number.parseInt(select.dataset.rangeStart, 10);
      const end = Number.parseInt(select.dataset.rangeEnd, 10);
      const placeholder = select.dataset.placeholder || "Choose";
      select.innerHTML = `<option value="" selected disabled>${placeholder}</option>`;
      for (let value = start; value <= end; value += 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        select.appendChild(option);
      }
    });
  }

  function syncSplitRows() {
    splitRows.forEach((row) => {
      const prefix = row.dataset.splitRow;
      const enabled = form.elements[`${prefix}SecondaryEnabled`].checked;
      row.classList.toggle("is-disabled", !enabled);
      row.querySelectorAll("input, select").forEach((field) => {
        field.disabled = !enabled;
      });
    });
  }

  function renderSummary(container, lines) {
    container.innerHTML = lines
      .map(
        ({ label, value }) =>
          `<dt>${label}</dt><dd>${value}</dd>`
      )
      .join("");
  }

  function hasWoundRoll(resultSide) {
    return resultSide.woundRoll && resultSide.woundRoll !== "-";
  }

  function renderDistribution(container, distribution, maxDice) {
    container.innerHTML = "";
    for (let wounds = 0; wounds <= maxDice; wounds += 1) {
      if (distribution[wounds] < 0.01) {
        continue;
      }
      const item = document.createElement("div");
      item.className = "distribution-item";
      item.innerHTML = `
        <span>${wounds} wounds</span>
        <div class="bar"><span style="width: ${Math.max(distribution[wounds] * 100, 0)}%"></span></div>
        <strong>${percent(distribution[wounds])}</strong>
      `;
      container.appendChild(item);
    }
  }

  function tieNote(result) {
    const attacker = result.attacker;
    const defender = result.defender;

    if (attacker.fight !== defender.fight) {
      return `Tied highest dice go to the side with higher Fight: ${attacker.fight > defender.fight ? "attacker" : "defender"}.`;
    }
    if (attacker.elvenMade !== defender.elvenMade) {
      return `Fight values are tied, so tied duels go to a roll-off. The side with the Elven-made weapon wins that roll-off on 3-6.`;
    }
    return "";
  }

  function woundNoteText(result) {
    return `Main To wound uses duel dice by default. Trapped doubles that side's wound dice before any split to a second wound roll.`;
  }

  function update() {
    syncSplitRows();
    const result = calculator.calculateBattle(collectFormData());
    const attackerHasWound = hasWoundRoll(result.attacker);
    const defenderHasWound = hasWoundRoll(result.defender);

    renderSummary(attackerSummary, [
      { label: "Win duel", value: percent(result.duel.attackerWin) },
      ...(attackerHasWound ? [{ label: "One wound", value: percent(result.attackerOutcome.oneOrMoreChance) }] : [])
    ]);

    renderSummary(defenderSummary, [
      { label: "Win duel", value: percent(result.duel.defenderWin) },
      ...(defenderHasWound ? [{ label: "One wound", value: percent(result.defenderOutcome.oneOrMoreChance) }] : [])
    ]);

    if (attackerHasWound) {
      renderDistribution(
        attackerDistribution,
        result.attackerOutcome.overallDistribution,
        result.attacker.woundDice + result.attacker.secondaryDice
      );
    } else {
      attackerDistribution.innerHTML = "";
    }

    if (defenderHasWound) {
      renderDistribution(
        defenderDistribution,
        result.defenderOutcome.overallDistribution,
        result.defender.woundDice + result.defender.secondaryDice
      );
    } else {
      defenderDistribution.innerHTML = "";
    }
    duelNote.textContent = tieNote(result);
    woundNote.textContent = woundNoteText(result);
  }

  populateRangeSelects();
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
})();
