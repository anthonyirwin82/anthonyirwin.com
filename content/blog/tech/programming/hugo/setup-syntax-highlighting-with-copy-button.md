+++
date = '2025-10-17'
title = 'How to setup Syntax Highlighting with Copy Button using Hugo'
description = "In this post, I’ll show you how to add syntax highlighting and a ‘Copy’ button to your Hugo code blocks using a single self-contained JavaScript file. You’ll be able to highlight code in multiple languages, optionally show line numbers, and let users copy snippets with one click."
tags = ['Tech', 'Programming', 'Hugo']
bannerId = 'web-dev'
draft = false
+++
In this post, I’ll show you how to add syntax highlighting and a ‘Copy’ button to your Hugo code blocks using a single self-contained JavaScript file.
You’ll be able to highlight code in multiple languages, optionally show line numbers, and let users copy snippets with one click.

## Configure Hugo Syntax Highlighting

First setup the defaults for the syntax highlighting in your **hugo.toml** config file.
```toml
[markup.highlight]
    lineNoStart = 1
    lineNos = false
    lineNumbersInTable = false
    # Highlight Styles: https://gohugo.io/quick-reference/syntax-highlighting-styles/
    style = 'dracula'
```

I personally disable line numbers by default as I find if you are showing shell commands the line numbers don't make sense. Really the only time I want the line numbers is when I am discussing code and you can enable it on the code blocks you want the line numbers on.

## Create the copy-code.js file

Next you want to create the **assets/js/copy-code.js** file.
```js
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
```

I have made this file self contained with inline css styles to make the copy button appear and the padding on the code box etc.

This makes using the **copy-code.js** really easy as it's the only file you need to get everything working.

## Include the copy-code.js file you your Hugo website

Now we need to add the **copy-code.js** file so that is included at the end of the body tag.

I personally add it to the **/layouts/_partials/head/** directory even though it's included just before the closing body tag. The reason I do this is I have a **css.html** and an **seo.html** and other files in there so it's easy to add one extra file rather then rename the directory or create an new directory for this one file. You can structure it however you like.

This example will add it to **/layouts/_partials/head/js.html** but if you have your own theme you could use **/themes/theme-name/layouts/_partials/head/js.html**
```text
your-hugo-site/
├── assets/
│   └── js/
│       └── copy-code.js
├── layouts/
│   └── _partials/
│       └── head
│           └── js.html
```

**layouts/_partials/head/js.html**
```go-html-template
{{- $js := resources.Get "js/copy-code.js" -}}

{{- if hugo.IsProduction -}}
  {{- $js = $js | minify | fingerprint -}}
  <script src="{{ $js.RelPermalink }}" integrity="{{ $js.Data.Integrity }}"></script>
{{- else -}}
  <script src="{{ $js.RelPermalink }}"></script>
{{- end -}}
```
The above example is the most basic example and in a production site you will probably want to combine and minify your js files into a single **bundle.min.js**.

Now you need to include the partial in your **baseof.html** or other file depending on your configuration so the javascript is included just before the closing body tag.

```go-html-template
{{ partial "head/js.html" . }}
```

Now that you have the hugo site setup you can test it with some markdown files in your **/content** directory.

## Example Usage
The following example will show you the basic default usage using markdown:
````markdown
```bash
mkdir -p src/js
nvim src/js/beer-bottles.js
```
````

The following example will show you how to enable line numbers, highlight lines and change the style on specific code blocks.

This can be done in your markdown file by doing the following:
````js { linenos="inline", hl_lines="3 5 11-13", style="solarized-light" }
```js { linenos="inline", hl_lines="3 5 11-13", style="solarized-light" }
const output = document.getElementById("output");
    let bottles = 10;

    function singVerse() {
      if (bottles > 1) {
        output.textContent += `${bottles} bottles of beer on the wall, ${bottles} bottles of beer.\n`;
        bottles--;
        output.textContent += `One falls down, now there are ${bottles} bottles of beer on the wall.\n\n`;
      } else if (bottles === 1) {
        output.textContent += `1 bottle of beer on the wall, 1 bottle of beer.\n`;
        output.textContent += `One falls down, now there are no more bottles of beer on the wall!\n`;
        clearInterval(interval);
      }
    }

    const interval = setInterval(singVerse, 1000);
```
````

You can see a list of the supported langauges at [https://gohugo.io/content-management/syntax-highlighting/#languages](https://gohugo.io/content-management/syntax-highlighting/#languages)

You can see a list of the highlighting styles at [https://gohugo.io/quick-reference/syntax-highlighting-styles/](https://gohugo.io/quick-reference/syntax-highlighting-styles/)

## Conclusion
If you have followed the steps correctly you should now have your Hugo website setup with code syntax highlighting and a copy button. This makes your content much nicer to look at and easy for users to copy code snippets when reading your posts.
