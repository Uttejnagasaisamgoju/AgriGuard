import { LanguageCode, TranslationSchema } from '../types/i18n';
import { en } from './en';
import { te } from './te';
import { ta } from './ta';
import { kn } from './kn';
import { ml } from './ml';
import { mr } from './mr';
import { hi } from './hi';
import { tcy } from './tcy';
import { kok } from './kok';
import { kfa } from './kfa';
import { bgy } from './bgy';
import { bfq } from './bfq';

export const translations: Record<LanguageCode, TranslationSchema> = {
  en,
  te,
  ta,
  kn,
  ml,
  mr,
  hi,
  tcy,
  kok,
  kfa,
  bgy,
  bfq,
};

export { en, te, ta, kn, ml, mr, hi, tcy, kok, kfa, bgy, bfq };
