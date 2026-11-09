/* Lead form validation, first-touch UTM storage, and configured receiver submission. */
(function (root, factory) {
  var formTools = factory();
  if (typeof module === 'object' && module.exports) module.exports = formTools;
  if (root) root.KvadratLeadForm = formTools;
  if (typeof document !== 'undefined') formTools.bind(document);
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'kvadrat:first-touch';
  var UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var UTM_DEFAULTS = {
    utm_source: 'direct',
    utm_medium: 'none',
    utm_campaign: 'not_set',
    utm_content: 'not_set'
  };
  var REPAIR_TYPES = ['cosmetic', 'capital', 'designer', 'bathroom'];
  var OBJECT_TYPES = ['new_build', 'secondary'];

  function trackError(fieldName, errorType) {
    if (window.siteAnalytics && typeof window.siteAnalytics.track === 'function') {
      window.siteAnalytics.track('form_error', { field_name: fieldName, error_type: errorType || 'field' });
    }
  }

  function normalizePhone(value) {
    return String(value || '').replace(/[\s()-]/g, '');
  }

  function validate(values) {
    var errors = {};
    var name = String(values.name || '').trim();
    var phone = normalizePhone(values.phone);
    var email = String(values.email || '').trim();
    var repairType = String(values.repair_type || '').trim();
    var objectType = String(values.object_type || '').trim();
    var area = Number(values.area_m2);

    if (name.length < 2 || name.length > 60) errors.name = 'Введите имя от 2 до 60 символов.';
    if (!/^\+7\d{10}$/.test(phone)) errors.phone = 'Укажите номер в формате +7 и 10 цифр.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Проверьте адрес электронной почты.';
    if (REPAIR_TYPES.indexOf(repairType) === -1) errors.repair_type = 'Выберите вид ремонта.';
    if (!Number.isFinite(area) || area < 10 || area > 300) errors.area_m2 = 'Укажите площадь от 10 до 300 м².';
    if (OBJECT_TYPES.indexOf(objectType) === -1) errors.object_type = 'Выберите тип жилья.';
    if (!values.consent) errors.consent = 'Нужно согласие на обработку данных.';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  function readFirstTouch(locationObject, storage) {
    var saved = null;
    try { saved = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); } catch (error) { saved = null; }
    if (!saved || typeof saved !== 'object') {
      saved = {};
      var search = new URLSearchParams(locationObject.search || '');
      UTM_FIELDS.forEach(function (field) {
        var value = search.get(field);
        if (value && /^[a-z0-9_]{1,100}$/.test(value)) saved[field] = value;
      });
      try { storage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (error) { /* Storage may be disabled. */ }
    }
    var result = {};
    UTM_FIELDS.forEach(function (field) {
      result[field] = /^[a-z0-9_]{1,100}$/.test(saved[field] || '') ? saved[field] : UTM_DEFAULTS[field];
    });
    return result;
  }

  function requestId() {
    var uuid;
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      uuid = window.crypto.randomUUID();
    } else {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
      uuid = hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
        hex.slice(16, 20) + '-' + hex.slice(20);
    }
    return 'REQ-' + uuid;
  }

  function getEndpoint(form) {
    var script = document.currentScript;
    var configuredScript = document.querySelector('script[data-receiver-url]');
    var endpoint = form.getAttribute('data-endpoint') ||
      (script && script.getAttribute('data-receiver-url')) ||
      (configuredScript && configuredScript.getAttribute('data-receiver-url')) || '';
    if (!endpoint) return '';
    try {
      var url = new URL(endpoint, window.location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (error) { return ''; }
  }

  function setFieldError(form, name, message) {
    var control = form.querySelector('[name="' + name + '"]');
    if (!control) return;
    control.setAttribute('aria-invalid', 'true');
    var error = form.querySelector('[data-error-for="' + name + '"]');
    if (!error) {
      error = document.createElement('span');
      error.className = 'field-error';
      error.setAttribute('data-error-for', name);
      error.setAttribute('role', 'alert');
      control.insertAdjacentElement('afterend', error);
    }
    if (!error.id) error.id = (form.id || 'lead-form') + '-' + name + '-error';
    var describedBy = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
    if (describedBy.indexOf(error.id) === -1) describedBy.push(error.id);
    control.setAttribute('aria-describedby', describedBy.join(' '));
    error.textContent = message;
    trackError(name, 'field');
  }

  function clearErrors(form) {
    form.querySelectorAll('[aria-invalid="true"]').forEach(function (control) {
      control.removeAttribute('aria-invalid');
      var error = control.name && form.querySelector('[data-error-for="' + control.name + '"]');
      if (error && error.id) {
        var describedBy = (control.getAttribute('aria-describedby') || '').split(/\s+/)
          .filter(function (id) { return id && id !== error.id; });
        if (describedBy.length) control.setAttribute('aria-describedby', describedBy.join(' '));
        else control.removeAttribute('aria-describedby');
      }
    });
    form.querySelectorAll('[data-error-for]').forEach(function (error) { error.remove(); });
    var summary = form.querySelector('[data-form-status]');
    if (summary) summary.textContent = '';
  }

  function setStatus(form, message, isError) {
    var status = form.querySelector('[data-form-status]');
    if (!status) {
      status = document.createElement('p');
      status.setAttribute('data-form-status', '');
      status.setAttribute('role', 'status');
      form.appendChild(status);
    }
    status.textContent = message;
    status.setAttribute('data-state', isError ? 'error' : 'success');
  }

  function value(form, name) {
    var selected = form.querySelector('[name="' + name + '"]:checked');
    if (selected) return selected.value.trim();
    var field = form.querySelector('[name="' + name + '"]');
    if (field && (field.type === 'radio' || field.type === 'checkbox')) return '';
    return field ? field.value.trim() : '';
  }

  function safeStorage() {
    try {
      var storage = window.sessionStorage;
      var key = STORAGE_KEY + ':probe';
      storage.setItem(key, '1');
      storage.removeItem(key);
      return storage;
    } catch (error) {
      return {
        getItem: function () { return null; },
        setItem: function () {},
        removeItem: function () {}
      };
    }
  }

  function populate(form, attribution) {
    UTM_FIELDS.forEach(function (field) {
      var input = form.querySelector('[name="' + field + '"]');
      if (input) input.value = attribution[field];
    });
    var idInput = form.querySelector('[name="request_id"]');
    if (idInput && !idInput.value) idInput.value = requestId();

    var query = new URLSearchParams(window.location.search);
    ['repair_type', 'area_m2', 'object_type'].forEach(function (field) {
      var input = form.querySelector('[name="' + field + '"]');
      var parameter = query.get(field);
      if (input && parameter && input.type !== 'radio') input.value = parameter;
      if (input && parameter && input.type === 'radio') {
        var matching = Array.prototype.find.call(form.querySelectorAll('[name="' + field + '"]'), function (option) {
          return option.value === parameter;
        });
        if (matching) matching.checked = true;
      }
    });
  }

  function payloadFor(form, attribution, id) {
    return {
      request_id: id,
      name: value(form, 'name'),
      phone: normalizePhone(value(form, 'phone')),
      email: value(form, 'email'),
      repair_type: value(form, 'repair_type') || (form.querySelector('[name="repair_type"]:checked') || {}).value || '',
      area_m2: Number(value(form, 'area_m2')),
      object_type: value(form, 'object_type') || (form.querySelector('[name="object_type"]:checked') || {}).value || '',
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content
    };
  }

  function bind(documentObject) {
    documentObject.querySelectorAll('#lead-form, [data-lead-form]').forEach(function (form) {
      form.noValidate = true;
      var isSubmitting = false;
      var attribution = readFirstTouch(window.location, safeStorage());
      populate(form, attribution);
      form.addEventListener('input', function (event) {
        var field = event.target;
        if (field && field.name && field.getAttribute('aria-invalid') === 'true') {
          field.removeAttribute('aria-invalid');
          var error = form.querySelector('[data-error-for="' + field.name + '"]');
          if (error) error.remove();
        }
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (isSubmitting) return;
        clearErrors(form);

        var fields = {
          name: value(form, 'name'),
          phone: value(form, 'phone'),
          email: value(form, 'email'),
          repair_type: value(form, 'repair_type') || (form.querySelector('[name="repair_type"]:checked') || {}).value || '',
          area_m2: value(form, 'area_m2'),
          object_type: value(form, 'object_type') || (form.querySelector('[name="object_type"]:checked') || {}).value || '',
          consent: Boolean((form.querySelector('[name="consent"]') || form.querySelector('[name="privacy_consent"]') || {}).checked)
        };
        var validation = validate(fields);
        if (!validation.valid) {
          Object.keys(validation.errors).forEach(function (field) {
            setFieldError(form, field, validation.errors[field]);
          });
          var firstError = form.querySelector('[aria-invalid="true"]');
          if (firstError && typeof firstError.focus === 'function') firstError.focus();
          return;
        }

        var endpoint = getEndpoint(form);
        if (!endpoint) {
          setStatus(form, 'Приём заявок пока не настроен. Попробуйте связаться с нами по телефону.', true);
          trackError('form', 'server');
          return;
        }

        var idInput = form.querySelector('[name="request_id"]');
        var id = idInput && idInput.value ? idInput.value : requestId();
        if (idInput) idInput.value = id;
        var submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        isSubmitting = true;
        setStatus(form, 'Отправляем заявку…', false);

        var payload = payloadFor(form, attribution, id);
        window.fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).then(function (response) {
          return response.json().then(function (body) { return { response: response, body: body }; });
        }).then(function (result) {
          if (!result.response.ok || !result.body || result.body.ok !== true) {
            throw new Error('receiver_rejected');
          }
          if (window.siteAnalytics && typeof window.siteAnalytics.trackLeadSuccess === 'function') {
            window.siteAnalytics.trackLeadSuccess(payload, result.body);
          }
          var thanks = new URL(form.getAttribute('data-success-url') || '/thanks.html', window.location.href);
          thanks.searchParams.set('request_id', id);
          window.location.assign(thanks.href);
        }).catch(function () {
          setStatus(form, 'Не удалось отправить заявку. Проверьте подключение и попробуйте ещё раз.', true);
          trackError('form', 'server');
        }).finally(function () {
          isSubmitting = false;
          if (submitButton) submitButton.disabled = false;
        });
      });
    });
  }

  return {
    validate: validate,
    normalizePhone: normalizePhone,
    readFirstTouch: readFirstTouch,
    bind: bind,
    repairTypes: REPAIR_TYPES.slice(),
    objectTypes: OBJECT_TYPES.slice()
  };
}));
