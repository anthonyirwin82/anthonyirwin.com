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
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .copy-wrapper {
      position: relative;
      margin-bottom: 1rem;
    }

    .copy-button {
      position: absolute;
      top: -1.6rem;
      right: 0;
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

  // Highlight copy functionality
  const highlights = document.querySelectorAll(".highlight");

  highlights.forEach(highlight => {
    const code = highlight.querySelector("code");

    const wrapper = document.createElement("div");
    wrapper.className = "copy-wrapper";

    const button = document.createElement("button");
    button.innerText = "Copy";
    button.className = "copy-button";

    button.addEventListener("click", () => {
      let text = code.innerText.replace(/\n{2,}/g, "\n").trim();
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
