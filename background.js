chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("x.com") || tab.url.includes("twitter.com")) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: captureAndBuildPDF,
      world: "MAIN"
    });
  } else {
    alert("Please navigate to an X (Twitter) thread first.");
  }
});

async function captureAndBuildPDF() {
  const statusDiv = document.createElement("div");
  statusDiv.style.position = "fixed";
  statusDiv.style.top = "20px";
  statusDiv.style.right = "20px";
  statusDiv.style.padding = "15px 20px";
  statusDiv.style.backgroundColor = "#1d9bf0";
  statusDiv.style.color = "#ffffff";
  statusDiv.style.zIndex = "9999999";
  statusDiv.style.borderRadius = "8px";
  statusDiv.style.fontFamily = "sans-serif";
  statusDiv.style.fontSize = "14px";
  statusDiv.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
  statusDiv.innerText = "Scrolling & capturing posts... Please wait.";
  document.body.appendChild(statusDiv);

  // Harvest visible posts directly from DOM during scrolling
  function harvestDOM() {
    window.__X_CAPTURED_POSTS = window.__X_CAPTURED_POSTS || new Map();
    const articles = document.querySelectorAll('article[data-testid="tweet"]');

    articles.forEach((art) => {
      try {
        const textEl = art.querySelector('[data-testid="tweetText"]');
        const userEl = art.querySelector('[data-testid="User-Name"]');
        const timeEl = art.querySelector('time');
        const avatarImg = art.querySelector('img[src*="profile_images"]');

        if (userEl && textEl) {
          const userText = userEl.innerText.split('\n');
          const name = userText[0] || 'Unknown';
          const handle = (userText.find(t => t.startsWith('@')) || '').replace('@', '');
          const text = textEl.innerText;
          const time = timeEl ? timeEl.getAttribute('datetime') : new Date().toISOString();
          const avatar = avatarImg ? avatarImg.src : '';

          const key = handle + '_' + text.slice(0, 30);

          if (!window.__X_CAPTURED_POSTS.has(key)) {
            window.__X_CAPTURED_POSTS.set(key, {
              id: key,
              name: name,
              handle: handle,
              avatar: avatar,
              text: text,
              created_at: new Date(time).toLocaleString()
            });
          }
        }
      } catch (e) {}
    });
  }

  let lastHeight = document.body.scrollHeight;
  let sameHeightCount = 0;

  // Auto-scroll loop
  await new Promise((resolve) => {
    const timer = setInterval(() => {
      harvestDOM();
      window.scrollTo(0, document.body.scrollHeight);
      let newHeight = document.body.scrollHeight;

      if (newHeight === lastHeight) {
        sameHeightCount++;
      } else {
        sameHeightCount = 0;
        lastHeight = newHeight;
      }

      if (sameHeightCount >= 4) {
        harvestDOM();
        clearInterval(timer);
        resolve();
      }
    }, 1200);
  });

  statusDiv.style.backgroundColor = "#00ba7c";
  statusDiv.innerText = "Opening PDF print dialog...";

  const posts = window.__X_CAPTURED_POSTS ? Array.from(window.__X_CAPTURED_POSTS.values()) : [];

  if (!posts || posts.length === 0) {
    statusDiv.remove();
    alert("No posts captured. Make sure you are on an open thread page and try again.");
    return;
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Inject print styles to isolate thread element during print
  const styleEl = document.createElement('style');
  styleEl.id = 'x-pdf-print-styles';
  styleEl.textContent = `
    @media print {
      body > *:not(#x-pdf-print-container) {
        display: none !important;
      }
      #x-pdf-print-container {
        display: block !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        background: #ffffff !important;
        color: #0f1419 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        padding: 20px !important;
        box-sizing: border-box !important;
      }
      .x-pdf-post {
        border: 1px solid #cfd9de !important;
        border-radius: 12px !important;
        padding: 16px !important;
        margin-bottom: 12px !important;
        page-break-inside: avoid !important;
      }
      .x-pdf-header {
        display: flex !important;
        align-items: center !important;
        margin-bottom: 8px !important;
      }
      .x-pdf-avatar {
        width: 40px !important;
        height: 40px !important;
        border-radius: 50% !important;
        margin-right: 12px !important;
      }
      .x-pdf-name {
        font-weight: bold !important;
        font-size: 15px !important;
      }
      .x-pdf-handle {
        color: #536471 !important;
        font-size: 14px !important;
        margin-left: 6px !important;
      }
      .x-pdf-text {
        font-size: 15px !important;
        line-height: 1.5 !important;
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }
      .x-pdf-date {
        color: #536471 !important;
        font-size: 12px !important;
        margin-top: 8px !important;
      }
    }
    @media screen {
      #x-pdf-print-container {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Build the print overlay container directly in the current document
  const printContainer = document.createElement('div');
  printContainer.id = 'x-pdf-print-container';
  printContainer.innerHTML = `
    <h1 style="font-size: 20px; border-bottom: 2px solid #eff3f4; padding-bottom: 10px; margin-bottom: 16px;">
      Exported X Thread (${posts.length} posts captured)
    </h1>
    ${posts.map(p => `
      <div class="x-pdf-post">
        <div class="x-pdf-header">
          ${p.avatar ? `<img class="x-pdf-avatar" src="${p.avatar}" />` : ''}
          <div>
            <span class="x-pdf-name">${escapeHtml(p.name)}</span>
            <span class="x-pdf-handle">@${escapeHtml(p.handle)}</span>
          </div>
        </div>
        <div class="x-pdf-text">${escapeHtml(p.text)}</div>
        <div class="x-pdf-date">${p.created_at}</div>
      </div>
    `).join('')}
  `;
  document.body.appendChild(printContainer);

  statusDiv.remove();

  // Trigger system print dialog directly
  window.print();

  // Clean up print DOM elements after print dialog closes
  setTimeout(() => {
    printContainer.remove();
    styleEl.remove();
  }, 1000);
}