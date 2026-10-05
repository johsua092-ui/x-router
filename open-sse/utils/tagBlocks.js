function globalCopy(re) {
  return new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
}

/**
 * Every `open ... close` block in `text`, in order, found by scanning forward once.
 * Avoids quadratic backtracking on nested or unclosed tags.
 */
export function findTagBlocks(text, openTag, closeTag) {
  if (!text || typeof text !== "string") return [];
  const open = globalCopy(openTag);
  const close = globalCopy(closeTag);
  const blocks = [];
  let position = 0;

  for (;;) {
    open.lastIndex = position;
    const opening = open.exec(text);
    if (!opening) break;
    const innerStart = opening.index + opening[0].length;
    close.lastIndex = innerStart;
    const closing = close.exec(text);
    if (!closing) break;
    const end = closing.index + closing[0].length;
    blocks.push({
      start: opening.index,
      end,
      inner: text.slice(innerStart, closing.index),
    });
    position = end;
  }
  return blocks;
}
