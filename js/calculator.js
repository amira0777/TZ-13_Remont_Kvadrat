/* Estimate calculations and browser UI for the renovation calculator. */
(function (root, factory) {
  var calculator = factory();
  if (typeof module === 'object' && module.exports) module.exports = calculator;
  if (root) root.KvadratCalculator = calculator;
  if (typeof document !== 'undefined') calculator.bind(document);
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RATES = { cosmetic: 4500, capital: 9000, designer: 14000 };
  var DAYS_PER_SQUARE_METRE = { cosmetic: 0.6, capital: 1.2, designer: 1.8 };
  var DEMOLITION_RATE = 700;
  var BATHROOM_PRICE = 180000;
  var MATERIAL_RATE = 0.35;
  var MIN_AREA = 10;
  var MAX_AREA = 300;

  function calculate(options) {
    options = options || {};
    var type = String(options.repair_type || options.repairType || '');
    var area = Number(options.area_m2 !== undefined ? options.area_m2 : options.area);
    if (!Object.prototype.hasOwnProperty.call(RATES, type) || !Number.isFinite(area) ||
        area < MIN_AREA || area > MAX_AREA) {
      return { valid: false, error: 'type_or_area' };
    }

    var labor = area * RATES[type];
    if (options.demolition) labor += area * DEMOLITION_RATE;
    if (options.bathroom) labor += BATHROOM_PRICE;
    var days = Math.ceil(area * DAYS_PER_SQUARE_METRE[type]) + (options.bathroom ? 10 : 0);
    return {
      valid: true,
      repair_type: type,
      area_m2: area,
      work: labor,
      materials: Math.round(labor * MATERIAL_RATE),
      total: labor + Math.round(labor * MATERIAL_RATE),
      days: days
    };
  }

  function formatRubles(value) {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
  }

  function readOptions(form) {
    function field(name) { return form.querySelector('[name="' + name + '"]'); }
    var selectedType = form.querySelector('[name="repair_type"]:checked');
    var typeField = selectedType || field('repair_type');
    var areaField = field('area_m2');
    var bathroomField = field('bathroom') || field('bathroom_turnkey');
    var demolitionField = field('demolition');
    return {
      repair_type: typeField ? typeField.value : '',
      area_m2: areaField ? areaField.value : '',
      bathroom: Boolean(bathroomField && bathroomField.checked),
      demolition: Boolean(demolitionField && demolitionField.checked)
    };
  }

  function writeResult(form, result) {
    var scope = form.closest('.calculator-layout, [data-calculator]') || form.ownerDocument;
    var outputs = {
      work: result.valid ? formatRubles(result.work) : '—',
      materials: result.valid ? formatRubles(result.materials) : '—',
      total: result.valid ? formatRubles(result.total) : '—',
      days: result.valid ? String(result.days) : '—'
    };
    Object.keys(outputs).forEach(function (name) {
      var ids = { work: 'estimate-labor', materials: 'estimate-materials', total: 'estimate-result', days: 'estimate-days' };
      var output = scope.querySelector('[data-result="' + name + '"]') ||
        scope.querySelector('#' + ids[name]);
      if (output) {
        output.textContent = outputs[name];
        if (name === 'total') output.setAttribute('aria-label', result.valid
          ? 'Ориентировочная сумма с материалами: ' + outputs[name]
          : 'Ориентировочная сумма');
      }
    });

    var summary = scope.querySelector('#estimate-summary');
    if (summary) {
      summary.textContent = result.valid
        ? 'Итого с материалами — ' + formatRubles(result.total) + '. Работы — ' + formatRubles(result.work) +
          ', материалы — около ' + formatRubles(result.materials) + ', ориентировочный срок — ' + result.days + ' дней.'
        : 'Укажите площадь от 10 до 300 м² и выберите вид ремонта.';
    }

    var transferLink = scope.querySelector('[data-calc-transfer]');
    if (transferLink && result.valid) {
      var target = new URL(transferLink.getAttribute('href') || '/contacts.html', window.location.href);
      target.searchParams.set('repair_type', result.repair_type);
      target.searchParams.set('area_m2', String(result.area_m2));
      transferLink.href = target.pathname + target.search + target.hash;
    }
  }

  function bind(documentObject) {
    var forms = documentObject.querySelectorAll('#repair-calculator, #calculator-form, [data-repair-calculator]');
    Array.prototype.forEach.call(forms, function (form) {
      var lastCalculation = '';
      var areaField = form.querySelector('[name="area_m2"]');
      if (areaField) {
        areaField.min = String(MIN_AREA);
        areaField.max = String(MAX_AREA);
        if (!areaField.type || areaField.type === 'text') areaField.inputMode = 'numeric';
      }
      var update = function () {
        var result = calculate(readOptions(form));
        writeResult(form, result);
        var signature = result.valid ? [result.repair_type, result.area_m2, result.work, result.days].join(':') : '';
        if (signature && signature !== lastCalculation && window.siteAnalytics && typeof window.siteAnalytics.track === 'function') {
          window.siteAnalytics.track('repair_calc', {
            repair_type: result.repair_type,
            area_m2: result.area_m2,
            total_price: result.work,
            days: result.days
          });
        }
        lastCalculation = signature;
      };
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        update();
      });
      update();
    });

    documentObject.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || target.name !== 'repair_type' || !target.checked && target.type === 'radio') return;
      if (target.closest && target.closest('[data-event="repair_type_select"]')) return;
      if ((!target.closest || !target.closest('[data-event="repair_type_select"]')) && window.siteAnalytics && typeof window.siteAnalytics.track === 'function') {
        window.siteAnalytics.track('repair_type_select', { repair_type: target.value });
      }
    });
  }

  return {
    calculate: calculate,
    formatRubles: formatRubles,
    bind: bind,
    rates: Object.assign({}, RATES),
    minArea: MIN_AREA,
    maxArea: MAX_AREA
  };
}));
