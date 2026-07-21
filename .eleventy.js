export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/assets/icon.png": "icon.png" });

  eleventyConfig.addCollection("notes", (api) =>
    api.getFilteredByGlob("src/notes/*.md").sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString());

  /* frontmatter footnotes are plain text written across several lines.
     escape first, then turn the line breaks into <br> — so a note file never
     has to contain HTML and a stray < in a footnote can't break the page. */
  eleventyConfig.addFilter("nl2br", (s) => {
    if (!s) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\r?\n/g, "<br>");
  });
  eleventyConfig.addFilter("displayDate", (d) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).toLowerCase();
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
