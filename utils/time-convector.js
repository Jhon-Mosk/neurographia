'use strict';

/**
 * Преобразует время из миллисекунд в строку с указанием единицы измерения
 * @param {number} ms - время в миллисекундах
 * @param {string | null} [targetUnit=null] - целевая единица: 'ms', 's', 'min', 'h'
 * @param {number} [precision=1] - количество знаков после запятой
 * @returns {string}
 */
const fromMs = (ms, targetUnit = null, precision = 1) => {
  const units = {
    ms: 1,
    s: 1000,
    min: 1000 * 60,
    h: 1000 * 60 * 60,
  };

  const unitKeys = ['h', 'min', 's', 'ms'];

  // Если указана целевая единица — используем её
  if (targetUnit) {
    if (!(targetUnit in units)) {
      throw new Error(
        `Unknown unit: ${targetUnit}. Supported: ${Object.keys(units).join(
          ', ',
        )}`,
      );
    }

    const value = ms / units[targetUnit];
    return `${value.toFixed(precision)}${targetUnit}`;
  }

  // Автовыбор наибольшей подходящей единицы
  for (const unit of unitKeys) {
    if (ms >= units[unit]) {
      const value = ms / units[unit];
      return `${value.toFixed(precision)}${unit}`;
    }
  }

  return `${ms.toFixed(precision)}ms`;
};

module.exports = {
  fromMs,
};
