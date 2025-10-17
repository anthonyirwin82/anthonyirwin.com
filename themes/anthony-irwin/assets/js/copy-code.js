/** Copy Hugo Highlight Code Blocks:
  * This file is a self contained javascript file that can be included into
  * your Hugo website and it will add the CSS styles inline and add a copy
  * button in the top right corner to copy the text and say copied for a few
  * seconds after it is pressed.
*/

document.addEventListener("DOMContentLoaded", () => {
  // Inject CSS
  const style = document.createElement("style");
  style.textContent = `
    .highlight {
      margin-top: 2rem;
      padding: 10px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .highlight pre {
      padding: 1rem;
      margin: 0;
      border-radius: 5px;
    }

    .copy-wrapper {
      position: relative;
      margin-bottom: 1rem;
    }

    .copy-button {
      position: absolute;
      top: -1rem;
      right: .8rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      background: #ccc;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      opacity: 0.7;
      z-index: 1;
    }

    .copy-button:hover {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // Add Copy functionality
  const highlights = document.querySelectorAll(".highlight");

  highlights.forEach(highlight => {
    const code = highlight.querySelector("code");
    if (!code) return; // guard

    const wrapper = document.createElement("div");
    wrapper.className = "copy-wrapper";

    const button = document.createElement("button");
    button.innerText = "Copy";
    button.className = "copy-button";

    button.addEventListener("click", () => {
      // Clone code to safely remove line numbers before copying
      const codeClone = code.cloneNode(true);

      // 1) Remove common class-based line-number elements if present
      codeClone.querySelectorAll(
        '.ln, .lineno, .line-number, .lnt, .lntd, td.lnt, td.lntd'
      ).forEach(el => el.remove());

      // 2) Handle inline linenos produced by Hugo (no class, first child span contains just digits)
      // Iterate over direct children of the <code> element (lines are often top-level spans)
      Array.from(codeClone.children).forEach(child => {
        // Only handle element nodes
        if (!(child instanceof HTMLElement)) return;

        const firstElem = child.firstElementChild;
        if (firstElem && firstElem.textContent) {
          // If the first element's text is just a line number (digits + optional whitespace)
          if (/^\s*\d+\s*$/.test(firstElem.textContent)) {
            firstElem.remove();
          }
        }

        // Some renderers wrap each line in a span that contains two spans:
        // the first is the line number with user-select:none; check for that too
        // (covers cases where number text includes non-digits like "1" or " 1")
        // also check inline styles that indicate user-select none as additional heuristic
        const maybeNumberSpan = child.querySelector('span');
        if (maybeNumberSpan && /^\s*\d+\s*$/.test(maybeNumberSpan.textContent)) {
          maybeNumberSpan.remove();
        }
      });

      // 3) As a final cleanup, remove any stray elements that are absolutely obviously non-code:
      // e.g. spans with user-select:none or very small text that look like linenos
      codeClone.querySelectorAll('span').forEach(sp => {
        const txt = (sp.textContent || '').trim();
        // Remove if it's purely numeric and short (line number), or has user-select none inline style
        if (/^\d{1,6}$/.test(txt) || /user-select:\s*none/.test(sp.getAttribute('style') || '')) {
          // Ensure we don't remove tokens that are numeric code (rare). Only remove if parent looks like a line wrapper:
          const parent = sp.parentElement;
          if (parent && parent.parentElement === codeClone) {
            sp.remove();
          }
        }
      });

      // Get clean text and normalize line breaks (remove duplicate blank lines)
      let text = codeClone.innerText.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();

      navigator.clipboard.writeText(text)
        .then(() => {
          button.innerText = "Copied!";
          setTimeout(() => button.innerText = "Copy", 2000);
        })
        .catch(err => console.error("Copy failed:", err));
    });

    highlight.parentNode.insertBefore(wrapper, highlight);
    wrapper.appendChild(button);
    wrapper.appendChild(highlight);
  });
});
