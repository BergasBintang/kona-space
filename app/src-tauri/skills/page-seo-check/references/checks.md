# Checks

**Crawling and indexing**
- Answers with status 200. Redirects are few and permanent (301).
- `robots.txt` does not block it.
- No `noindex` in the page or the headers.
- Canonical points to the right address, and there is one version only (https, with or without www).
- In the sitemap, if the site has one.
- The main text is in the page when it first arrives, or can be rendered. Look at the raw answer, not only the browser view.

**The page's own signals**
- One title, under about 60 characters, unique on the site, with the main words near the start.
- A description under about 155 characters, written to make people click.
- One `h1` that fits the title; headings in order.
- Clean, readable address.
- Pictures have useful alt text and sensible sizes.
- `lang` is set; `hreflang` is right if there are several languages.

**Content**
- Answers the question near the top.
- Original, and has something other pages do not.
- Says who wrote it and when, if that matters to trust.
- No two pages compete for the same words.

**Rich results**
- Structured data (JSON-LD) only for what is really on the page, and valid.

**Speed and phones**
- Works and reads well on a narrow screen.
- Largest content appears within about 2.5 seconds; nothing jumps as it loads.
- Pictures compressed, few heavy scripts.

**Links**
- Other pages link to it with words that describe it.
- No broken links.

**AI search**
- Clear questions and direct answers; facts in plain text rather than in pictures.
- Check `robots.txt` to see which AI crawlers are allowed. That is the owner's decision.
