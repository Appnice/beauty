// English texts: shared components (src/lib/ui) and the error page. Same keys as ../pl/common.ts.
import type { common as pl } from '../pl/common.ts';

export const common: typeof pl = {
  close: 'Close',
  back: 'Back',
  digit: (n: number) => `Digit ${n}`,
  stepOf: (step: number, total: number) => `${step} of ${total}`,
  from: 'From',
  to: 'To',
  closed: 'Closed',
  yourPhone: 'Your phone',
  home: 'Home page',
  noPage: 'There is no such page.'
};
