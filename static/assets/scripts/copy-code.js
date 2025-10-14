var codeBlocks = document.querySelectorAll('figure.highlight');

codeBlocks.forEach(function (codeBlock) {
  if (codeBlock.querySelector('button.copy')) return; // Avoid duplicates

  var copyButton = document.createElement('button');
  copyButton.className = 'copy';
  copyButton.type = 'button';
  copyButton.setAttribute('aria-label', 'Copy code to clipboard');
  copyButton.innerText = 'Copy';

  codeBlock.prepend(copyButton);

  copyButton.addEventListener('click', function () {
    var code = codeBlock.querySelector('code').innerText.trim();

      navigator.clipboard.writeText(code).then(function () {
        copyButton.innerText = 'Copied';
        setTimeout(() => {
          copyButton.innerText = 'Copy';
        }, 4000);
      }).catch(function (err) {
        console.error('Copy failed:', err);
      });

  });
});
