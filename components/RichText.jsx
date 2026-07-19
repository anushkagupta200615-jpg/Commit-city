"use client";

import { useMemo } from "react";

// Lightweight markdown-ish renderer for AI output.
// Handles: ## headings, - / * bullets, 1. numbered lists, **bold**.

export default function RichText({ text }) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return blocks.map((b, i) => {
    if (b.type === "h") {
      return (
        <h4 key={i} className="rich-h">
          <Inline text={b.text} />
        </h4>
      );
    }
    if (b.type === "list") {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag key={i} className="rich-list">
          {b.items.map((item, k) => (
            <li key={k}>
              <Inline text={item} />
            </li>
          ))}
        </Tag>
      );
    }
    return (
      <p key={i}>
        <Inline text={b.text} />
      </p>
    );
  });
}

function parseBlocks(text) {
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) {
      blocks.push(list);
      list = null;
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ type: "h", text: h[1] });
    } else if (bullet) {
      if (!list || list.ordered) {
        flush();
        list = { type: "list", ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (num) {
      if (!list || !list.ordered) {
        flush();
        list = { type: "list", ordered: true, items: [] };
      }
      list.items.push(num[1]);
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  }
  flush();
  return blocks;
}

function Inline({ text }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : p));
}
