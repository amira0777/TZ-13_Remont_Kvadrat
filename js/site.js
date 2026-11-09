/* Shared navigation and page interactions. Analytics events are sent centrally. */
(function () {
  'use strict';

  function track(name, parameters) {
    if (window.siteAnalytics && typeof window.siteAnalytics.track === 'function') {
      window.siteAnalytics.track(name, parameters);
    }
  }

  function persistFirstTouch() {
    var storage;
    try { storage = window.sessionStorage; } catch (error) { return; }
    var key = 'kvadrat:first-touch';
    try {
      var existing = JSON.parse(storage.getItem(key) || 'null');
      if (existing && typeof existing === 'object') return;
      var query = new URLSearchParams(window.location.search || '');
      var attribution = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (name) {
        var value = query.get(name) || '';
        if (/^[a-z0-9_]{1,100}$/.test(value)) attribution[name] = value;
      });
      storage.setItem(key, JSON.stringify(attribution));
    } catch (error) { /* Session storage can be disabled by browser settings. */ }
  }

  function initMenu() {
    var toggles = document.querySelectorAll('[data-menu-toggle]');
    Array.prototype.forEach.call(toggles, function (toggle) {
      var selector = toggle.getAttribute('aria-controls');
      var menu = selector ? document.getElementById(selector) : document.querySelector('[data-site-menu]');
      if (!menu) return;
      toggle.setAttribute('aria-expanded', 'false');
      var mobile = window.matchMedia && window.matchMedia('(max-width: 800px)').matches;
      menu.hidden = Boolean(mobile);
      toggle.addEventListener('click', function () {
        var expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        menu.hidden = expanded;
      });
      window.addEventListener('resize', function () {
        var isMobile = window.matchMedia && window.matchMedia('(max-width: 800px)').matches;
        if (!isMobile) menu.hidden = false;
        else if (toggle.getAttribute('aria-expanded') !== 'true') menu.hidden = true;
      });
    });
  }

  function initPortfolioFilters() {
    document.addEventListener('change', function (event) {
      var control = event.target.closest && event.target.closest('[data-portfolio-filter]');
      if (!control) return;
      var objectType = control.value || control.getAttribute('data-object-type') || 'all';
      var cards = document.querySelectorAll('[data-project-card]');
      Array.prototype.forEach.call(cards, function (card) {
        var typeMatches = objectType === 'all' || card.getAttribute('data-object-type') === objectType;
        var areaControl = document.querySelector('[data-portfolio-area]');
        var maxArea = areaControl ? Number(areaControl.value) : Infinity;
        var area = Number(card.getAttribute('data-area-m2')) || 0;
        card.hidden = !typeMatches || (Number.isFinite(maxArea) && area && area > maxArea);
      });
      if (control.getAttribute('data-event') !== 'portfolio_filter') {
        track('portfolio_filter', { object_type: objectType });
      }
    });

    document.addEventListener('input', function (event) {
      if (!event.target.matches || !event.target.matches('[data-portfolio-area]')) return;
      var selectedType = document.querySelector('[data-portfolio-filter]:checked, select[data-portfolio-filter]');
      var objectType = selectedType ? selectedType.value : 'all';
      var areaOutput = document.getElementById('area-output');
      if (areaOutput) areaOutput.textContent = event.target.value + ' м²';
      document.querySelectorAll('[data-project-card]').forEach(function (card) {
        var typeMatches = objectType === 'all' || card.getAttribute('data-object-type') === objectType;
        var maxArea = Number(event.target.value);
        var area = Number(card.getAttribute('data-area-m2')) || 0;
        card.hidden = !typeMatches || (Number.isFinite(maxArea) && area && area > maxArea);
      });
    });
  }

  function initStages() {
    document.addEventListener('toggle', function (event) {
      var stage = event.target;
      if (stage.tagName === 'DETAILS' && stage.open && stage.hasAttribute('data-stage-id')) {
        track('stage_open', { stage_id: stage.getAttribute('data-stage-id') });
      }
    }, true);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      var copied = document.execCommand('copy');
      field.remove();
      if (copied) resolve(); else reject(new Error('copy_failed'));
    });
  }

  function initPromo() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-promo-copy]');
      if (!button) return;
      var promo = button.getAttribute('data-promo-code') || button.textContent.trim() || 'SMETA24';
      copyText(promo).then(function () {
        button.setAttribute('data-copied', 'true');
        track('promo_copy', { promo_code: promo });
      }).catch(function () {
        button.setAttribute('data-copy-error', 'true');
      });
    });
  }

  function initGallery() {
    document.addEventListener('click', function (event) {
      var opener = event.target.closest && event.target.closest('[data-gallery-open]');
      if (!opener) return;
      var dialogId = opener.getAttribute('data-gallery-open');
      var dialog = dialogId ? document.getElementById(dialogId) : opener.closest('[data-gallery]');
      if (!dialog) dialog = document.querySelector('[data-gallery-dialog]');
      if (dialog && dialog.hasAttribute('data-gallery-dialog') && dialog.tagName !== 'DIALOG') {
        var configuredDialog = dialog.getAttribute('data-gallery-dialog');
        if (configuredDialog) dialog = document.getElementById(configuredDialog) || dialog;
      }
      var image = dialog && dialog.querySelector('[data-gallery-image], img');
      var imageSource = opener.getAttribute('data-image');
      if (image && imageSource) {
        image.src = imageSource;
        image.alt = opener.getAttribute('data-alt') || '';
      }
      var caption = dialog && dialog.querySelector('[data-gallery-caption]');
      if (caption && opener.getAttribute('data-alt')) caption.textContent = opener.getAttribute('data-alt');
      if (dialog && dialog.tagName === 'DIALOG' && typeof dialog.showModal === 'function') dialog.showModal();
      if (opener.getAttribute('data-event') !== 'gallery_view') {
        track('gallery_view', {
          project_id: opener.getAttribute('data-project-id') ||
            (opener.closest('[data-project-id]') && opener.closest('[data-project-id]').getAttribute('data-project-id')),
          photo_index: opener.getAttribute('data-photo-index') || '1'
        });
      }
    });

    document.addEventListener('click', function (event) {
      var close = event.target.closest && event.target.closest('[data-gallery-close]');
      if (close) {
        var dialog = close.closest('dialog');
        if (dialog) dialog.close();
      }
    });
  }

  function initVideo() {
    document.querySelectorAll('video[data-video-title]').forEach(function (video) {
      video.addEventListener('play', function () {
        if (video.dataset.playTracked) return;
        video.dataset.playTracked = 'true';
        track('video_play', { video_title: video.getAttribute('data-video-title') });
      });
    });
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('[data-video-play]');
      if (!button) return;
      var video = document.getElementById(button.getAttribute('data-video-play'));
      var status = button.nextElementSibling;
      if (status && status.hidden) status.hidden = false;
      if (!video && !button.dataset.videoTracked) {
        button.dataset.videoTracked = 'true';
        track('video_play', { video_title: button.getAttribute('data-video-title') || '' });
      }
      if (video && typeof video.play === 'function') video.play().catch(function () {});
    });
  }

  persistFirstTouch();

  document.addEventListener('DOMContentLoaded', function () {
    initMenu();
    initPortfolioFilters();
    initStages();
    initPromo();
    initGallery();
    initVideo();
    var requestId = new URLSearchParams(window.location.search).get('request_id');
    if (requestId) {
      var safeRequestId = /^REQ-[a-f0-9-]{36}$/i.test(requestId) ? requestId : '';
      document.querySelectorAll('[data-request-id]').forEach(function (output) {
        output.textContent = safeRequestId || '—';
      });
    }
  });
}());
