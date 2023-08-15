import { toCol } from "./toCol";

const FORMAT_RE = /(\w)\1*/g;
const PARSE_RE = /(\d+)\s*(\w?)/g;

export class FDate extends Date {
  get h() { return this.getHours(); }
  get m() { return this.getMinutes(); }
  get s() { return this.getSeconds(); }
  get ms() { return this.getMilliseconds(); }

  set h(v) { this.setHours(v); }
  set m(v) { this.setMinutes(v); }
  set s(v) { this.setSeconds(v); }
  set ms(v) { this.setMilliseconds(v); }

  get D() { return this.getDate(); }
  get M() { return this.getMonth() + 1; }
  get Y() { return this.getFullYear(); }

  set D(v) { this.setDate(v); }
  set M(v) { this.setMonth(v - 1); }
  set Y(v) { this.setFullYear(v); }

  static makeFormat(format: string) {
    return this.format.bind(this, format);
  }

  static format(format: string, date: string | number | Date | FDate) {
    if (!(date instanceof this))
      date = new this(date);

    return format.replace(FORMAT_RE, (source) => {
      const d: FDate = date as any;
      const [key] = source;
      if (key in d)
        return toCol((d as any)[key], source.length);

      return source;
    });
  }

  static from(string: string) {
    const date = new this(0);

    string.replace(PARSE_RE, (_, num, key) => {
      if (key in date) {
        (date as any)[key] += +num;
      }

      if (!key)
        date.ms += +num;

      return '';
    });

    return +date;
  }
}