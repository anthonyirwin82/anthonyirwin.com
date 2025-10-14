document.addEventListener("DOMContentLoaded", () => {
  const highlights = document.querySelectorAll(".highlight");

  highlights.forEach(highlight => {
    const code = highlight.querySelector("code");

    // Create wrapper container
    const wrapper = document.createElement("div");
    wrapper.className = "copy-wrapper";
    wrapper.style.position = "relative";
    wrapper.style.marginBottom = "1rem";

    // Create the copy button
    const button = document.createElement("button");
    button.innerText = "Copy";
    button.className = "copy-button";
    button.style.cssText = `
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
    `;

    // Copy code on click
    button.addEventListener("click", () => {
      let copied = "";

      const codeLines = code.querySelectorAll("span");

      codeLines.forEach(line => {
        const children = line.children;
        if (children.length === 2) {
          copied += children[1].textContent + "\n";
        } else {
          copied += line.textContent + "\n";
        }
      });

      navigator.clipboard.writeText(copied).then(() => {
        // Change button text on success
        button.innerText = "Copied!";
        setTimeout(() => {
          button.innerText = "Copy";
        }, 2000);
      }).catch(err => {
        console.error("Copy failed:", err);
      });
    });

    // Add the button and code block to the wrapper
    highlight.parentNode.insertBefore(wrapper, highlight);
    wrapper.appendChild(button);
    wrapper.appendChild(highlight);
  });
});
