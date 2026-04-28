(function (global) {
  function clampInt(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  function woundProbability(entry) {
    switch (entry) {
      case "3+":
        return 4 / 6;
      case "4+":
        return 3 / 6;
      case "5+":
        return 2 / 6;
      case "6+":
        return 1 / 6;
      case "6/4":
        return (1 / 6) * (3 / 6);
      case "6/5":
        return (1 / 6) * (2 / 6);
      case "6/6":
        return (1 / 6) * (1 / 6);
      case "-":
      default:
        return 0;
    }
  }

  function choose(n, k) {
    if (k < 0 || k > n) {
      return 0;
    }
    if (k === 0 || k === n) {
      return 1;
    }
    const effectiveK = Math.min(k, n - k);
    let result = 1;
    for (let i = 1; i <= effectiveK; i += 1) {
      result = (result * (n - effectiveK + i)) / i;
    }
    return result;
  }

  function highestDistribution(diceCount) {
    const distribution = [];
    for (let face = 1; face <= 6; face += 1) {
      distribution[face] = Math.pow(face / 6, diceCount) - Math.pow((face - 1) / 6, diceCount);
    }
    return distribution;
  }

  function rollOffWinChance(hasElvenMade, opponentHasElvenMade) {
    if (hasElvenMade && !opponentHasElvenMade) {
      return 4 / 6;
    }
    if (!hasElvenMade && opponentHasElvenMade) {
      return 2 / 6;
    }
    return 3 / 6;
  }

  function computeDuelOdds(attacker, defender) {
    const attackerMax = highestDistribution(attacker.dice);
    const defenderMax = highestDistribution(defender.dice);
    let attackerWin = 0;
    let defenderWin = 0;

    for (let attackerFace = 1; attackerFace <= 6; attackerFace += 1) {
      for (let defenderFace = 1; defenderFace <= 6; defenderFace += 1) {
        const probability = attackerMax[attackerFace] * defenderMax[defenderFace];
        if (attackerFace > defenderFace) {
          attackerWin += probability;
          continue;
        }
        if (defenderFace > attackerFace) {
          defenderWin += probability;
          continue;
        }

        if (attacker.fight > defender.fight) {
          attackerWin += probability;
        } else if (defender.fight > attacker.fight) {
          defenderWin += probability;
        } else {
          const attackerRollOff = rollOffWinChance(attacker.elvenMade, defender.elvenMade);
          attackerWin += probability * attackerRollOff;
          defenderWin += probability * (1 - attackerRollOff);
        }
      }
    }

    return {
      attackerWin,
      defenderWin
    };
  }

  function binomialDistribution(attempts, successChance) {
    const distribution = [];
    for (let wounds = 0; wounds <= attempts; wounds += 1) {
      distribution[wounds] =
        choose(attempts, wounds) *
        Math.pow(successChance, wounds) *
        Math.pow(1 - successChance, attempts - wounds);
    }
    return distribution;
  }

  function scaleDistribution(distribution, factor) {
    return distribution.map((value) => value * factor);
  }

  function convolveDistributions(left, right) {
    const combined = Array(left.length + right.length - 1).fill(0);
    for (let i = 0; i < left.length; i += 1) {
      for (let j = 0; j < right.length; j += 1) {
        combined[i + j] += left[i] * right[j];
      }
    }
    return combined;
  }

  function probabilityAtLeast(distribution, threshold) {
    let total = 0;
    for (let wounds = Math.max(0, threshold); wounds < distribution.length; wounds += 1) {
      total += distribution[wounds];
    }
    return total;
  }

  function computeSideOutcome(duelWinChance, primaryWoundDice, woundRoll, secondaryWoundDice, secondaryWoundRoll, goalWounds) {
    const singleWoundChance = woundProbability(woundRoll);
    const primaryDistribution = binomialDistribution(primaryWoundDice, singleWoundChance);
    const secondarySingleWoundChance = woundProbability(secondaryWoundRoll);
    const secondaryDistribution = binomialDistribution(secondaryWoundDice, secondarySingleWoundChance);
    const onWinDistribution = convolveDistributions(primaryDistribution, secondaryDistribution);
    const overallDistribution = scaleDistribution(onWinDistribution, duelWinChance);

    return {
      woundRoll,
      secondaryWoundRoll,
      singleWoundChance,
      secondarySingleWoundChance,
      overallDistribution,
      oneOrMoreChance: probabilityAtLeast(overallDistribution, 1),
      goalChance: probabilityAtLeast(overallDistribution, goalWounds),
      killChance: probabilityAtLeast(overallDistribution, goalWounds)
    };
  }

  function calculateBattle(input) {
    const attacker = {
      dice: clampInt(input.attackerDice, 1, 20, 1),
      fight: clampInt(input.attackerFight, 1, 10, 1),
      woundRoll: input.attackerToWound || "-",
      secondaryEnabled: Boolean(input.attackerSecondaryEnabled),
      secondaryWoundRoll: input.attackerSecondaryToWound || "-",
      secondaryDice: clampInt(input.attackerSecondaryDice, 0, 20, 0),
      elvenMade: Boolean(input.attackerElvenMade)
    };
    attacker.secondaryDice = attacker.secondaryEnabled ? Math.min(attacker.dice, attacker.secondaryDice) : 0;
    attacker.woundDice = attacker.dice - attacker.secondaryDice;

    const defender = {
      dice: clampInt(input.defenderDice, 1, 20, 1),
      fight: clampInt(input.defenderFight, 1, 10, 1),
      woundRoll: input.defenderToWound || "-",
      secondaryEnabled: Boolean(input.defenderSecondaryEnabled),
      secondaryWoundRoll: input.defenderSecondaryToWound || "-",
      secondaryDice: clampInt(input.defenderSecondaryDice, 0, 20, 0),
      elvenMade: Boolean(input.defenderElvenMade)
    };
    defender.secondaryDice = defender.secondaryEnabled ? Math.min(defender.dice, defender.secondaryDice) : 0;
    defender.woundDice = defender.dice - defender.secondaryDice;

    const duel = computeDuelOdds(attacker, defender);

    return {
      attacker,
      defender,
      duel,
      attackerOutcome: computeSideOutcome(
        duel.attackerWin,
        attacker.woundDice,
        attacker.woundRoll,
        attacker.secondaryDice,
        attacker.secondaryWoundRoll,
        1
      ),
      defenderOutcome: computeSideOutcome(
        duel.defenderWin,
        defender.woundDice,
        defender.woundRoll,
        defender.secondaryDice,
        defender.secondaryWoundRoll,
        1
      )
    };
  }

  const api = {
    calculateBattle,
    woundProbability
  };

  global.DiceDuelCalculator = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
