import { listFormatParser } from './listFormat'
import type { MatchImportParser } from './types'

/** Register new import formats here. */
export const importParsers: MatchImportParser[] = [listFormatParser]

export type { ImportResult, MatchImportParser, ParsedMatch } from './types'
