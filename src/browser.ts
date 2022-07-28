import si from './main'
import { BrowserLevel } from 'browser-level'
import type { SearchIndex, SearchIndexOptions } from "./types"

const browser = (ops: SearchIndexOptions): Promise<SearchIndex> =>
  si(
    Object.assign(
      {
        db: BrowserLevel
      },
      ops
    )
  )

export default browser