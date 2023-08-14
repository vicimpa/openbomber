import { toCol } from "./toCol";

const regExp = /(\w)\1*/g;

export class FDate extends Date {
  get h() { return this.getHours(); }
  get m() { return this.getMinutes(); }
  get s() { return this.getSeconds(); }

  get D() { return this.getDate(); }
  get M() { return this.getMonth() + 1; }
  get Y() { return this.getFullYear(); }

  static makeFormat(format: string) {
    return this.format.bind(this, format);
  }

  static format(format: string, date: string | number | Date | FDate) {
    if (!(date instanceof this))
      date = new this(date);

    return format.replace(regExp, (source) => {
      const d: FDate = date as any;
      const [key] = source;
      if (key in d)
        return toCol((d as any)[key], source.length);

      return source;
    });
  }
}