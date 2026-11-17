// Loads the Meta Pixel from pixel-config.js and wires the page's tracked actions.
// Events sent: PageView (load), ViewContent (ad video played), Lead (form sent),
// Contact (WhatsApp click), InitiateCheckout (subscribe button click).
(function () {
  var cfg = window.PAGERGO_CONFIG || {};
  var id = String(cfg.PIXEL_ID || '').trim();
  var enabled = /^\d{10,20}$/.test(id);

  if (enabled) {
    /* Official Meta Pixel base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', id);
    fbq('track', 'PageView');
  } else {
    if (id) console.warn('[pixel] PIXEL_ID looks invalid (digits only):', id);
    console.info('[pixel] No Pixel ID set — events are logged here only.');
  }

  window.trackEvent = function (name, params) {
    if (enabled && window.fbq) fbq('track', name, params || {});
    else console.info('[pixel] would track:', name, params || {});
  };

  document.addEventListener('DOMContentLoaded', function () {
    var video = document.getElementById('ad');
    if (video) {
      var sent = false;
      video.addEventListener('play', function () {
        if (sent) return;
        sent = true;
        trackEvent('ViewContent', {content_name: 'Pager Go ad video'});
      });
    }

    document.querySelectorAll('[data-signup]').forEach(function (a) {
      a.href = cfg.SIGNUP_URL || '#';
      a.addEventListener('click', function () {
        trackEvent('InitiateCheckout', {content_name: a.dataset.signup});
      });
    });

    var wa = document.getElementById('whatsapp');
    if (wa) {
      var num = String(cfg.WHATSAPP || '').replace(/\D/g, '');
      if (num) {
        wa.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('مرحبا، أريد أعرف أكثر عن بيجر گو');
        wa.hidden = false;
        wa.addEventListener('click', function () { trackEvent('Contact', {method: 'whatsapp'}); });
      }
    }

    var form = document.getElementById('lead-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!form.reportValidity()) return;
        trackEvent('Lead', {content_name: 'Pager Go demo request'});
        var data = new FormData(form);
        var num = String(cfg.WHATSAPP || '').replace(/\D/g, '');
        document.getElementById('form-done').hidden = false;
        form.hidden = true;
        if (num) {
          var msg = 'طلب تجربة بيجر گو\nالاسم: ' + data.get('name') + '\nالمطعم: ' + data.get('restaurant') + '\nالهاتف: ' + data.get('phone');
          window.location.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
        }
      });
    }
  });
})();
