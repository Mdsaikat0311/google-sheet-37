export interface DateGroup<T> {
  key: string;
  title: string;
  subtitle?: string;
  isToday: boolean;
  isYesterday: boolean;
  sortTime: number;
  items: T[];
}

/**
 * Converts Bengali numeric digits (০-৯) to English digits (0-9)
 */
export const bnToEnDigits = (str: string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return str.replace(/[০-৯]/g, (w) => String(bnDigits.indexOf(w)));
};

/**
 * Parses any date format from sheets, inputs or timestamps into a Date object and formatted DD/MM/YYYY string
 */
export const parseAnyDateToTimestamp = (
  raw: string | undefined
): { dateObj: Date | null; cleanDateStr: string } => {
  if (!raw) return { dateObj: null, cleanDateStr: '' };
  let s = String(raw).trim();
  s = bnToEnDigits(s);

  // Check GViz Date string: Date(yyyy,m,d)
  const gvizMatch = s.match(/Date\((\d+),(\d+),(\d+)/i);
  if (gvizMatch) {
    const y = Number(gvizMatch[1]);
    const m = Number(gvizMatch[2]);
    const d = Number(gvizMatch[3]);
    const date = new Date(y, m, d);
    const dayStr = String(date.getDate()).padStart(2, '0');
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    return {
      dateObj: date,
      cleanDateStr: `${dayStr}/${monthStr}/${date.getFullYear()}`,
    };
  }

  // Extract date part before any space or 'T'
  const datePart = s.split(/[ T]/)[0];

  // Try parsing direct Date
  const directDate = new Date(s);
  if (!isNaN(directDate.getTime()) && directDate.getFullYear() > 2000) {
    const dayStr = String(directDate.getDate()).padStart(2, '0');
    const monthStr = String(directDate.getMonth() + 1).padStart(2, '0');
    return {
      dateObj: directDate,
      cleanDateStr: `${dayStr}/${monthStr}/${directDate.getFullYear()}`,
    };
  }

  // Parse segmented dates: d/m/y or y-m-d
  const segs = datePart.split(/[\/\-.]/).map(Number);
  if (segs.length === 3 && !segs.some(isNaN)) {
    let [p1, p2, p3] = segs;
    const year = p3 < 100 ? (p3 > 70 ? 1900 + p3 : 2000 + p3) : p3;
    let d: Date;
    if (p1 > 1000) {
      // YYYY-MM-DD
      d = new Date(p1, p2 - 1, p3);
    } else if (p1 > 12) {
      // DD/MM/YYYY
      d = new Date(year, p2 - 1, p1);
    } else if (p2 > 12) {
      // MM/DD/YYYY
      d = new Date(year, p1 - 1, p2);
    } else {
      // Default standard in BD / Sheets: DD/MM/YYYY
      d = new Date(year, p2 - 1, p1);
    }
    const dayStr = String(d.getDate()).padStart(2, '0');
    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
    return {
      dateObj: d,
      cleanDateStr: `${dayStr}/${monthStr}/${d.getFullYear()}`,
    };
  }

  return { dateObj: null, cleanDateStr: raw };
};

/**
 * Groups an array of items by date into "আজ (Today)", "গতকাল (Yesterday)", and specific date groups
 */
export const groupItemsByDate = <T>(
  items: T[],
  getDateField: (item: T) => string | undefined
): DateGroup<T>[] => {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const groupMap = new Map<string, DateGroup<T>>();

  for (const item of items) {
    const rawDate = getDateField(item);
    const { dateObj, cleanDateStr } = parseAnyDateToTimestamp(rawDate);

    let key = '';
    let title = '';
    let subtitle: string | undefined;
    let isToday = false;
    let isYesterday = false;
    let sortTime = 0;

    if (dateObj && !isNaN(dateObj.getTime())) {
      const itemMidnight = new Date(
        dateObj.getFullYear(),
        dateObj.getMonth(),
        dateObj.getDate()
      ).getTime();
      sortTime = itemMidnight;

      const diffDays = Math.round((todayMidnight - itemMidnight) / ONE_DAY_MS);

      if (diffDays === 0) {
        key = 'today';
        title = 'আজ (Today)';
        subtitle = cleanDateStr;
        isToday = true;
      } else if (diffDays === 1) {
        key = 'yesterday';
        title = 'গতকাল (Yesterday)';
        subtitle = cleanDateStr;
        isYesterday = true;
      } else {
        key = `date-${cleanDateStr || itemMidnight}`;
        title = cleanDateStr;
        isToday = false;
        isYesterday = false;
      }
    } else {
      key = rawDate ? `raw-${rawDate}` : 'unknown';
      title = rawDate || 'অন্যান্য তারিখ (Other)';
      sortTime = 0;
    }

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        key,
        title,
        subtitle,
        isToday,
        isYesterday,
        sortTime,
        items: [],
      });
    }

    groupMap.get(key)!.items.push(item);
  }

  // Sort groups: Today first, then Yesterday, then newer dates descending, then unknown
  return Array.from(groupMap.values()).sort((a, b) => {
    if (a.isToday) return -1;
    if (b.isToday) return 1;
    if (a.isYesterday) return -1;
    if (b.isYesterday) return 1;
    return b.sortTime - a.sortTime;
  });
};
