// Made-up people and lists. Never a real person. Plain script that sets one variable (a mockup cannot fetch files).
var DATA = {
  accounts: [
    { id: "full", name: "Mira Example", email: "mira@example.test", pass: "example-1", note: "Has data" },
    { id: "empty", name: "Noor Example", email: "noor@example.test", pass: "example-2", note: "Nothing yet" },
    { id: "fail", name: "Dev Example", email: "dev@example.test", pass: "example-3", note: "Requests fail" }
  ],
  // long enough to break a layout: a very long title, and forty rows
  courses: (function () {
    var rows = [];
    for (var i = 1; i <= 40; i++) rows.push({ id: i, title: i === 7 ? "An unusually long course title that goes on and on to see where the line breaks" : "Course " + i, progress: (i * 7) % 101 });
    return rows;
  })()
};
