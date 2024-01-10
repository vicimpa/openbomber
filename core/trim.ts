import { min } from "./math";

const RegExp = /\S/;

export const trim = (template: TemplateStringsArray, ...args: any[]) => {
  const string = template.reduce((acc, e, i) => (
    acc + e + (args[i] ?? '')
  ), '');
  const rows = string.split('\n');
  const mins = min(
    ...rows.map(e => (
      RegExp.exec(e)?.index ?? Infinity
    ))
  );

  if (isFinite(mins)) {
    rows.forEach((e, i, d) => {
      d[i] = e.slice(mins);
    });
  }

  return rows.join('\n').trim();
};