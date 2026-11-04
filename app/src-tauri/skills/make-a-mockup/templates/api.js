// A fake of the project's API. Give the functions the same names and the same answer shapes as the real client,
// so that the page can later swap this file for the real one. Nothing is saved; every run starts clean.
function later(fn) {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      try { resolve(fn()); } catch (e) { reject(e); }
    }, 400); // a short wait, so the loading state can be seen
  });
}

var api = {
  login: function (email, pass) {
    return later(function () {
      var a = DATA.accounts.filter(function (x) { return x.email === email; })[0];
      if (!a || a.pass !== pass) throw { status: 401, message: "Wrong email or password." };
      return { user: { name: a.name, email: a.email }, as: a.id };
    });
  },
  courses: function (as) {
    return later(function () {
      if (as === "fail") throw { status: 500, message: "Something went wrong on our side. Try again." };
      return { items: as === "full" ? DATA.courses : [] };
    });
  }
};
