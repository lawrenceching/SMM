(function () {
  "use strict";

  // Mobile nav toggle
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  // Mark external links to open in a new tab safely
  var here = window.location.host;
  var anchors = document.querySelectorAll("a[href]");
  for (var i = 0; i < anchors.length; i++) {
    var a = anchors[i];
    var href = a.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      try {
        var u = new URL(href);
        if (u.host && u.host !== here && !a.hasAttribute("target")) {
          a.setAttribute("target", "_blank");
          var rel = (a.getAttribute("rel") || "").split(/\s+/);
          if (rel.indexOf("noopener") === -1) rel.push("noopener");
          if (rel.indexOf("noreferrer") === -1) rel.push("noreferrer");
          a.setAttribute("rel", rel.filter(Boolean).join(" "));
        }
      } catch (e) {
        /* ignore malformed URLs */
      }
    }
  }

  // Year placeholders in the footer
  var years = document.querySelectorAll("[data-year]");
  var y = String(new Date().getFullYear());
  for (var j = 0; j < years.length; j++) {
    years[j].textContent = y;
  }
})();
