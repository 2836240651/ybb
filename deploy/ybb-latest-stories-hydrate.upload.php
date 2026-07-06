<?php
/**
 * Plugin Name: YBB Latest Stories Hydrate
 * Description: Runtime hydrate for static homepage Latest Stories carousel (browser-configured).
 * Version: 1.2.0
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/latest-stories-hydrate.js', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_latest_stories_hydrate_js',
    ]);
});

function ybb_latest_stories_hydrate_js(): void
{
    if (!function_exists('ybb_home_latest_stories_public')) {
        register_rest_route('ybb/v1', '/latest-stories', [
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => function () {
                return rest_ensure_response(['enabled' => false, 'articles' => []]);
            },
        ]);
    }

    $api = esc_url_raw(rest_url('ybb/v1/latest-stories'));
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    echo '(function () {' . "\n";
    echo '  var API = ' . wp_json_encode($api) . ";\n";
    echo <<<'JS'
  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    } catch (e) { return iso; }
  }
  function applyStory(card, story) {
    if (!card || !story) return;
    var link = card.querySelector('a[href]') || card;
    if (link && story.href) link.href = story.href;
    var img = card.querySelector('img');
    if (img && story.image) {
      var url = story.image;
      url += (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
      img.src = url;
      img.alt = story.title || img.alt || '';
      img.removeAttribute('srcset');
      img.loading = 'eager';
    }
    var time = card.querySelector('time');
    if (time && story.publishedAt) {
      time.dateTime = story.publishedAt;
      time.textContent = formatDate(story.publishedAt);
    }
    var title = card.querySelector('h3');
    if (title && story.title) title.textContent = story.title;
    var excerpt = card.querySelector('p');
    if (excerpt && story.excerpt) excerpt.textContent = story.excerpt;
    card.style.display = '';
  }
  function cloneCard(template) {
    return template.cloneNode(true);
  }
  function enforceCount(track, stories) {
    var cards = Array.prototype.slice.call(track.querySelectorAll(':scope > article'));
    if (!cards.length) return;
    var template = cards[0];
    stories.forEach(function (story, index) {
      var card = cards[index];
      if (!card && template) {
        card = cloneCard(template);
        track.appendChild(card);
        cards.push(card);
      }
      applyStory(card, story);
    });
    for (var i = stories.length; i < cards.length; i++) {
      if (cards[i] && cards[i].parentNode) {
        cards[i].parentNode.removeChild(cards[i]);
      }
    }
    window.dispatchEvent(new Event('resize'));
  }
  function hydrate() {
    var section = document.querySelector('[aria-labelledby="latest-stories-heading"]');
    if (!section) return;
    fetch(API + (API.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now(), { credentials: 'same-origin', cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !data.enabled || !data.articles || !data.articles.length) return;
        var track = section.querySelector('.flex.touch-pan-y');
        if (!track) return;
        enforceCount(track, data.articles);
        track.__ybbStories = data.articles;
        if (!track.__ybbStoriesObserver) {
          track.__ybbStoriesObserver = new MutationObserver(function () {
            if (track.__ybbEnforcing || !track.__ybbStories) return;
            track.__ybbEnforcing = true;
            enforceCount(track, track.__ybbStories);
            track.__ybbEnforcing = false;
          });
          track.__ybbStoriesObserver.observe(track, { childList: true });
        }
      })
      .catch(function () {});
  }
  function scheduleHydrate() {
    hydrate();
    setTimeout(hydrate, 600);
    setTimeout(hydrate, 1800);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHydrate);
  } else {
    scheduleHydrate();
  }
  window.addEventListener('load', scheduleHydrate);
})();
JS;
    exit;
}
