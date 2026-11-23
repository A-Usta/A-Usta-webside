'use strict';

const KEEP_RULES = [
  '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
  '-keep class * extends androidx.work.InputMerger { <init>(); }',
];

function mergeProguardRules(contents = '') {
  const existing = new Set(contents.split(/\r?\n/).map(line => line.trim()));
  const missing = KEEP_RULES.filter(rule => !existing.has(rule));
  if (missing.length === 0) return contents;
  const separator = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
  return `${contents}${separator}${missing.join('\n')}\n`;
}

module.exports = { KEEP_RULES, mergeProguardRules };
