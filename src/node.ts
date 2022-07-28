import si from './main'
import { ClassicLevel } from 'classic-level'
import type { SearchIndex, SearchIndexOptions } from "./types"

const node = (ops: SearchIndexOptions): Promise<SearchIndex> =>
  si(
    Object.assign(
      {
        db: ClassicLevel
      },
      ops
    )
  )

export default node