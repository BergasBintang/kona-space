---
title: The journey of the product
kind: journey
---
# The journey of the product

The path a person takes through the product. Kona draws this note on the Journey page of the Brain. Change the block, not a copy of it.

```journey
{
  "title": "The journey of the product",
  "lanes": [
    { "id": "person", "name": "Person", "actor": "person" },
    { "id": "app", "name": "App", "actor": "system" },
    { "id": "server", "name": "Server", "actor": "system" }
  ],
  "users": [
    { "id": "visitor", "name": "Visitor" }
  ],
  "steps": [
    { "id": "open-the-site", "name": "Open the site", "lane": "person", "start": true, "access": ["visitor"],
      "next": [{ "to": "home" }], "status": "not-built" },
    { "id": "home", "name": "Home page", "lane": "app", "kind": "screen", "access": ["visitor"],
      "fields": [],
      "buttons": [{ "label": "Start", "to": "done" }],
      "errors": [],
      "status": "not-built", "mockup": "the-mockup-folder/home.html" },
    { "id": "done", "name": "The person has what they came for", "lane": "person", "end": true, "status": "not-built" }
  ]
}
```
