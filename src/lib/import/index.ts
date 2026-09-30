import { pipeFormatParser } from './pipeFormat'
import type { MatchImportParser } from './types'

/** Register new import formats here. */
export const importParsers: MatchImportParser[] = [pipeFormatParser]

export type { ImportResult, MatchImportParser, ParsedMatch } from './types'
