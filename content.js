window.__X_CAPTURED_POSTS = window.__X_CAPTURED_POSTS || new Map();

function processPayload(textData) {
  if (!textData || typeof textData !== 'string') return;
  try {
    const data = JSON.parse(textData);
    traverseAndExtract(data);
  } catch (e) {
    // Not JSON or partial chunk
  }
}

function traverseAndExtract(obj) {
  if (!obj || typeof obj !== 'object') return;

  if (obj.__typename === 'Tweet' || obj.rest_id) {
    const legacy = obj.legacy || obj.tweet?.legacy;
    const core = obj.core || obj.tweet?.core;

    if (legacy && core) {
      const user = core.user_results?.result?.legacy;
      const id = obj.rest_id || legacy.id_str;

      if (id && user && !window.__X_CAPTURED_POSTS.has(id)) {
        window.__X_CAPTURED_POSTS.set(id, {
          id: id,
          name: user.name,
          handle: user.screen_name,
          avatar: user.profile_image_url_https,
          text: legacy.full_text || legacy.text,
          created_at: new Date(legacy.created_at).toLocaleString()
        });
      }
    }
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === 'object') {
      traverseAndExtract(obj[key]);
    }
  }
}

// Intercept window.fetch
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

  if (url.includes('TweetDetail') || url.includes('graphql')) {
    try {
      const clone = response.clone();
      clone.text().then(text => processPayload(text)).catch(() => {});
    } catch (e) {}
  }
  return response;
};

// Intercept XMLHttpRequest (XHR)
const originalXHR = window.XMLHttpRequest.prototype.open;
window.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  this.addEventListener('load', function () {
    if (typeof url === 'string' && (url.includes('TweetDetail') || url.includes('graphql'))) {
      processPayload(this.responseText);
    }
  });
  return originalXHR.apply(this, [method, url, ...rest]);
};