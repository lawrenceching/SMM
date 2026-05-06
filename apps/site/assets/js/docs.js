(function () {
  "use strict";

  // Highlight current article in sidebar based on pathname
  var sidebar = document.querySelector("[data-docs-sidebar]");
  if (sidebar) {
    var path = window.location.pathname.replace(/\/index\.html$/, "/");
    var links = sidebar.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var hrefAttr = link.getAttribute("href") || "";
      try {
        var resolved = new URL(hrefAttr, window.location.href);
        var resolvedPath = resolved.pathname.replace(/\/index\.html$/, "/");
        if (resolvedPath === path) {
          link.setAttribute("aria-current", "page");
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  // Mobile sidebar collapse
  var btn = document.querySelector("[data-docs-toggle]");
  var sb = document.querySelector("[data-docs-sidebar]");
  if (btn && sb) {
    btn.addEventListener("click", function () {
      var isOpen = sb.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(isOpen));
    });
  }
})();
