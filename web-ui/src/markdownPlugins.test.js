import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { markdownRehypePlugins } from './markdownPlugins.js';

function render(markdown) {
  return renderToStaticMarkup(createElement(ReactMarkdown, {
    remarkPlugins: [remarkGfm],
    rehypePlugins: markdownRehypePlugins,
  }, markdown));
}

test('inline color is plain HTML inside a mixed Markdown table cell', () => {
  const html = render('| **Capability** | Value |\n|---|---|\n| **Reports** | <span style="color: red">Build paths</span>; Platform reports |');
  assert.match(html, /<th><strong>Capability<\/strong><\/th>/);
  assert.match(html, /<td><span style="color:red">Build paths<\/span>; Platform reports<\/td>/);
  assert.doesNotMatch(html, /<a\b/);
});

test('named, hex and RGB colors are retained', () => {
  for (const color of ['red', 'blue', '#b91c1c', '#f00', '#f008', '#ff000080', 'rgb(255, 0, 0)', 'rgba(255, 0, 0, 0.5)']) {
    assert.ok(render(`<span style="color: ${color};">Text</span>`).includes(`style="color:${color}"`), color);
  }
});

test('trusted HTML retains multiple CSS declarations and nested markup', () => {
  const html = render('<div class="note" style="color: red; background-color: white; border: 1px solid black"><span style="font-weight: bold"><em>Text</em></span></div>');
  assert.equal(html, '<div class="note" style="color:red;background-color:white;border:1px solid black"><span style="font-weight:bold"><em>Text</em></span></div>');
});

test('HTML fragments render consistently in text and Markdown table cells', () => {
  const fragment = '<span style="color: rgb(255, 0, 0); font-weight: bold"><em>Build paths</em></span>';
  const renderedFragment = '<span style="color:rgb(255, 0, 0);font-weight:bold"><em>Build paths</em></span>';
  for (const markdown of [fragment, `| Capability | Value |\n|---|---|\n| Reports | ${fragment} |`]) {
    const html = render(markdown);
    assert.ok(html.includes(renderedFragment));
    assert.doesNotMatch(html, /<a\b/);
  }
});

test('links have no special color-marker behavior', () => {
  const html = render('[Fragment](#external) [Source](https://example.com "External to framework")');
  assert.match(html, /<a href="#external">Fragment<\/a>/);
  assert.match(html, /<a href="https:\/\/example.com" title="External to framework">Source<\/a>/);
  assert.doesNotMatch(html, /style=|<span\b|external-capability/);
});

test('Markdown headings, code, emphasis and GFM task lists survive', () => {
  const html = render('# Heading\n\n**Bold** and `code`\n\n- [x] Done');
  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>Bold<\/strong> and <code>code<\/code>/);
  assert.match(html, /<input[^>]*type="checkbox"/);
  assert.match(html, /checked=""/);
});
