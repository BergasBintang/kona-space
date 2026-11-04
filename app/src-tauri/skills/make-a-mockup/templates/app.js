// The behaviour. One file for both pages; each part runs only if its page has the part.
// Who is signed in travels in the address (?as=full), because a mockup cannot save anything.
(function () {
  function part(name) { return document.querySelector('[data-part="' + name + '"]'); }
  function text(el, s) { el.textContent = s; }
  var as = (/[?&]as=([a-z]+)/.exec(location.search) || [])[1] || "full";

  var form = part("login-form");
  if (form) {
    var email = form.elements.email, pass = form.elements.pass, error = part("login-error"), go = part("login-submit");
    var list = part("fake-accounts");
    DATA.accounts.forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "quiet";
      text(b, a.name + " (" + a.note + ")");
      b.addEventListener("click", function () { email.value = a.email; pass.value = a.pass; });
      list.appendChild(b);
    });
    email.value = DATA.accounts[0].email; pass.value = DATA.accounts[0].pass; // filled in, so the next page opens with one click
    // A mockup runs where a form cannot be sent, and the browser then never fires "submit". So the button is a plain button and Enter is handled by hand.
    function signIn() {
      error.hidden = true; go.disabled = true; text(go, "Signing in...");
      api.login(email.value, pass.value).then(
        function (r) { location.href = "dashboard.html?as=" + r.as; },
        function (err) { go.disabled = false; text(go, "Sign in"); text(error, err.message); error.hidden = false; }
      );
    }
    go.addEventListener("click", signIn);
    form.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.tagName === "INPUT" && !go.disabled) signIn(); });
  }

  var rows = part("course-list");
  if (rows) {
    var loading = part("state-loading"), empty = part("state-empty"), failed = part("state-error"), retry = part("retry");
    function load() {
      loading.hidden = false; empty.hidden = failed.hidden = true; rows.replaceChildren();
      api.courses(as).then(function (r) {
        loading.hidden = true;
        if (!r.items.length) { empty.hidden = false; return; }
        r.items.forEach(function (c) {
          var li = document.createElement("li");
          text(li, c.title + " - " + c.progress + "%");
          rows.appendChild(li);
        });
      }, function (err) { loading.hidden = true; text(part("error-text"), err.message); failed.hidden = false; });
    }
    retry.addEventListener("click", load);
    load();
  }
})();
