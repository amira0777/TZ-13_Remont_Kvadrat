/* Shared, privacy-conscious GA4 instrumentation for the static site. */
(function () {
  'use strict';

  var EVENT_PARAMETERS = {
    generate_lead: ['lead_repair_type', 'area_m2', 'lead_source'],
    cta_click: ['button_name', 'page_section'],
    repair_type_select: ['repair_type'],
    repair_calc: ['repair_type', 'area_m2', 'total_price', 'days'],
    portfolio_filter: ['object_type'],
    project_view: ['project_id', 'repair_type'],
    stage_open: ['stage_id'],
    promo_copy: ['promo_code'],
    contact_click: ['contact_type'],
    messenger_click: ['messenger'],
    social_click: ['network', 'page_section'],
    form_error: ['field_name', 'error_type'],
    video_play: ['video_title'],
    gallery_view: ['project_id', 'photo_index']
  };

  var NUMBER_PARAMETERS = ['area_m2', 'total_price', 'days', 'photo_index'];
  var ALLOWED_REPAIR_TYPES = ['cosmetic', 'capital', 'designer', 'bathroom'];
  var ALLOWED_OBJECT_TYPES = ['new_build', 'secondary'];

  function configuredMeasurementId() {
    var script = document.currentScript;
    var taggedScript = document.querySelector('script[data-measurement-id]');
    var id = (script && script.getAttribute('data-measurement-id')) ||
      (taggedScript && taggedScript.getAttribute('data-measurement-id')) || '';
    return /^G-[A-Z0-9]{10}$/.test(id) && !/^G-(.)\1{9}$/.test(id) ? id : '';
  }

  function privacySafePageLocation() {
    var current = new URL(window.location.href);
    var allowedQuery = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'repair_type', 'area_m2'];
    var safe = new URL(current.origin + current.pathname);
    allowedQuery.forEach(function (name) {
      var value = current.searchParams.get(name);
      if (value && value.length <= 100 && !looksLikePersonalData(value)) safe.searchParams.set(name, value);
    });
    return safe.href;
  }

  function looksLikePersonalData(value) {
    var text = String(value);
    return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(text) || /(?:\+?\d[\s().-]*){10,}/.test(text);
  }

  function initializeTag() {
    var measurementId = configuredMeasurementId();
    if (!measurementId) return false;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { page_location: privacySafePageLocation() });

    var tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(tag);
    return true;
  }

  var enabled = initializeTag();

  function cleanParameters(eventName, parameters) {
    var allowed = EVENT_PARAMETERS[eventName];
    var clean = {};
    if (!allowed || !parameters || typeof parameters !== 'object') return clean;

    allowed.forEach(function (name) {
      var value = parameters[name];
      if (value === undefined || value === null || value === '') return;
      if (NUMBER_PARAMETERS.indexOf(name) !== -1) {
        var number = Number(value);
        var limits = {
          area_m2: [10, 300],
          total_price: [0, 10000000],
          days: [1, 1000],
          photo_index: [0, 1000]
        }[name];
        if (Number.isFinite(number) && number >= limits[0] && number <= limits[1]) clean[name] = number;
        return;
      }
      if (name === 'repair_type' || name === 'lead_repair_type') {
        if (ALLOWED_REPAIR_TYPES.indexOf(String(value)) !== -1) clean[name] = String(value);
        return;
      }
      if (name === 'object_type' && ALLOWED_OBJECT_TYPES.indexOf(String(value)) === -1) return;
      if (name === 'error_type' && String(value) !== 'server') {
        clean[name] = 'field';
        return;
      }
      var text = String(value).trim();
      if (text && text.length <= 100 && !looksLikePersonalData(text)) clean[name] = text;
    });
    return clean;
  }

  function track(eventName, parameters) {
    if (!Object.prototype.hasOwnProperty.call(EVENT_PARAMETERS, eventName)) return false;
    if (eventName === 'generate_lead') return false;
    if (eventName === 'portfolio_filter' && ALLOWED_OBJECT_TYPES.indexOf(String(parameters && parameters.object_type)) === -1) return false;
    var clean = cleanParameters(eventName, parameters);
    if (enabled && typeof window.gtag === 'function') window.gtag('event', eventName, clean);
    return true;
  }

  function trackLeadSuccess(lead, response) {
    if (!response || response.ok !== true || !lead) return false;
    var clean = cleanParameters('generate_lead', {
      lead_repair_type: lead.repair_type,
      area_m2: lead.area_m2,
      lead_source: lead.utm_source
    });
    if (enabled && typeof window.gtag === 'function') window.gtag('event', 'generate_lead', clean);
    return true;
  }

  function valuesFromElement(element) {
    var parameters = {};
    Object.keys(element.dataset).forEach(function (key) {
      var parameterName = key.replace(/[A-Z]/g, function (letter) {
        return '_' + letter.toLowerCase();
      });
      parameters[parameterName] = element.dataset[key];
    });
    return parameters;
  }

  function trackClick(element) {
    var eventName = element.getAttribute('data-event');
    if (!eventName || ['promo_copy', 'portfolio_filter', 'stage_open'].indexOf(eventName) !== -1) return;
    if (eventName === 'repair_type_select' && /^(SELECT|INPUT)$/.test(element.tagName)) return;
    track(eventName, valuesFromElement(element));
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-event]') : null;
    if (target) trackClick(target);

    var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('data-event')) return;
    var href = link.getAttribute('href') || '';
    if (/^tel:/i.test(href)) track('contact_click', { contact_type: 'phone' });
    if (/^mailto:/i.test(href)) track('contact_click', { contact_type: 'email' });
    var messenger = link.getAttribute('data-messenger');
    if (!messenger && /(?:t\.me|telegram\.me)/i.test(href)) messenger = 'telegram';
    if (!messenger && /(?:wa\.me|whatsapp\.com)/i.test(href)) messenger = 'whatsapp';
    if (messenger) track('messenger_click', { messenger: messenger });

    var network = link.getAttribute('data-network');
    if (network && (link.closest('footer') || /thanks\.html/i.test(window.location.pathname))) {
      track('social_click', {
        network: network,
        page_section: link.getAttribute('data-page-section') ||
          (link.closest('footer') ? 'footer' : 'thanks')
      });
    }
  });

  document.addEventListener('change', function (event) {
    var control = event.target && event.target.closest ? event.target.closest('[data-event]') : null;
    if (!control) return;
    var eventName = control.getAttribute('data-event');
    if (eventName === 'repair_type_select') {
      var typeControl = control;
      if (typeControl.type === 'radio' && !typeControl.checked) return;
      track(eventName, valuesFromElement(control));
    } else if (eventName === 'portfolio_filter') {
      var parameters = valuesFromElement(control);
      if (!parameters.object_type && control.value) parameters.object_type = control.value;
      track(eventName, parameters);
    }
  });

  window.siteAnalytics = {
    track: track,
    trackLeadSuccess: trackLeadSuccess,
    isEnabled: function () { return enabled; }
  };
}());
