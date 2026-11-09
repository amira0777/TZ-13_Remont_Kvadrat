# GA4 event catalog

The specification defines 20 events: six automatic Enhanced Measurement events and 14 code-driven events. The two optional events are included. Parameter names below use GA4 `snake_case`; examples are illustrative and contain no visitor personal data.

## Events

| # | Event | Type | Trigger | Parameters (example values) | Source / status |
|---:|---|---|---|---|---|
| 1 | `page_view` | Automatic | A page is opened. | `page_location` = `https://remont-kvadrat.vercel.app/index.html`; `page_title` = document title | GA4 Enhanced Measurement; stream configuration pending verification. |
| 2 | `scroll` | Automatic | The visitor scrolls to 90% of a page. | `percent_scrolled` = `90` | GA4 Enhanced Measurement; stream configuration pending verification. |
| 3 | `click` | Automatic | The visitor follows a link to an external site. | `link_url` = destination URL; `outbound` = `true` | GA4 Enhanced Measurement; stream configuration pending verification. |
| 4 | `file_download` | Automatic | The visitor downloads a PDF from the site. | `file_name` = downloaded PDF name; `file_extension` = `pdf` | GA4 Enhanced Measurement; stream configuration pending verification. |
| 5 | `form_start` | Automatic | The visitor first interacts with the lead form. | `form_id` = actual form ID | GA4 Enhanced Measurement; stream configuration pending verification. |
| 6 | `form_submit` | Automatic | The visitor submits the lead form. | `form_id` = actual form ID | GA4 Enhanced Measurement; stream configuration pending verification. |
| 7 | `generate_lead` | Code-driven; key event; required | The lead receiver responds with `{"ok": true}`. Do not send it before success. | `lead_repair_type` = `capital`; `area_m2` = `40`; `lead_source` = `instagram` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 8 | `cta_click` | Code-driven; required | The visitor clicks any lead-request button. | `button_name` = `hero_trial`; `page_section` = `hero` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 9 | `repair_type_select` | Code-driven; required | The visitor clicks a repair type. | `repair_type` = `capital` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 10 | `repair_calc` | Code-driven; required | The calculator displays a calculation. | `repair_type` = `capital`; `area_m2` = `40`; `total_price` = `388000`; `days` = `48` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 11 | `portfolio_filter` | Code-driven; required | The visitor changes the project filter. | `object_type` = `new_build` or `secondary` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 12 | `project_view` | Code-driven; required | The visitor clicks a project card. | `project_id` = project identifier; `repair_type` = `capital` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 13 | `stage_open` | Code-driven; required | The visitor expands a work-stage disclosure. | `stage_id` = stage identifier | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 14 | `promo_copy` | Code-driven; required | The visitor copies a promo code. | `promo_code` = displayed promo code | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 15 | `contact_click` | Code-driven; key event; required | The visitor clicks a phone or email link. | `contact_type` = `phone` or `email` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 16 | `messenger_click` | Code-driven; key event; required | The visitor clicks the Telegram or WhatsApp button. | `messenger` = `telegram` or `whatsapp` | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 17 | `social_click` | Code-driven; required | The visitor clicks a social-network icon in the footer or on `thanks.html`. | `network` = social network; `page_section` = page section | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 18 | `form_error` | Code-driven; required | A field error prevents form submission, or the receiver returns an error. A receiver error uses `error_type` = `server`. | `field_name` = field name; `error_type` = error type (use `server` for receiver errors) | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 19 | `video_play` | Code-driven; optional | The visitor starts a video. | `video_title` = actual video title | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |
| 20 | `gallery_view` | Code-driven; optional | The visitor opens an object photo. | `project_id` = project identifier; `photo_index` = photo index | Event emission: `js/analytics.js`; trigger source is a page `data-event` hook or the named behavior script. |

## Seven custom dimensions (event scope)

Register these seven parameters in GA4 Admin → Custom definitions as event-scoped dimensions. Register only these listed parameters for the required reports.

| Parameter | Event(s) | Report question |
|---|---|---|
| `button_name` | `cta_click` | Which lead-request button was clicked? |
| `page_section` | `cta_click`, `social_click` | In which page section did the click happen? |
| `repair_type` | `repair_type_select`, `repair_calc` | Which repair type is of interest? |
| `area_m2` | `repair_calc` | What area is being calculated? |
| `object_type` | `portfolio_filter` | Was the selected property a new build or secondary housing? |
| `lead_repair_type` | `generate_lead` | What repair type was included in the lead? |
| `messenger` | `messenger_click` | Which messenger was selected? |

## Implementation verification

All custom GA4 event emission is centralized in `js/analytics.js`. Page interactions are delegated from `js/site.js`, `js/calculator.js`, and `js/form.js`; HTML declares applicable `data-event` values. The live GA4 stream settings and DebugView evidence remain pending external account setup. Visitor names, phone numbers, and email addresses are excluded from GA4 parameters and page-location URLs.
