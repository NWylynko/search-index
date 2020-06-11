import { TFIDF, numericField } from './scorers.js'
import { getAvailableFields, getRange } from './indexUtils.js'

export default function (fii) {
  const DICTIONARY = q => new Promise((resolve) => {
    const flatten = arr => [].concat.apply([], arr)
    // if query is string convert to object
    // if no query, make empty query
    q = Object.assign(
      { gte: '', lte: '￮' },
      (typeof q === 'string') ? { gte: q, lte: q + '￮' } : q
    )

    // options, defaults
    q.options = Object.assign({
      withFieldName: false
    }, q.options || {})

    return resolve(
      new Promise(resolve => resolve(q.fields || getAvailableFields(fii)))
        .then(fields => Promise.all(
          fields.map(field => getRange(fii, {
            gte: field + ':' + q.gte,
            lte: field + ':' + q.lte + '￮'
          }))
        ))
        .then(flatten)
      //        .then(res => {console.log(res); return res})
        .then(tokens => tokens.map(t => (
          q.options.withFieldName
            ? t.split('#').shift()
            : t.split(':').pop().split('#').shift()
        )))
        .then(tokens => tokens.sort())
        .then(tokens => [...new Set(tokens)])
    )
  })

  const DOCUMENTS = requestedDocs => Promise.all(
    requestedDocs.map(
      doc => fii.STORE.get('￮DOC_RAW￮' + doc._id + '￮').catch(
        e => ({ _id: doc._id })
      )
    )
  )

  const SEARCH = (...q) => fii.AND(...q)
    .then(resultSet => TFIDF({
      fii: fii,
      resultSet: resultSet,
      offset: 0,
      limit: 10
    }))

  const DISTINCT = term => fii.DISTINCT(term).then(result => [
    ...result.reduce((acc, cur) => {
      cur.value = cur.value.split('#')[0]
      acc.add(JSON.stringify(cur))
      return acc
    }, new Set())
  ].map(JSON.parse))

  // This function reads queries in a JSON format and then translates them to
  // Promises
  const parseJsonQuery = (...q) => {
    // needs to be called with "command" and result from previous "thenable"
    console.log(q)
    var promisifyQuery = (command, resultFromPreceding) => {
      if (typeof command === 'string') return fii.GET(command)
      if (command.ALL) {
        return Promise.all(
        // TODO: why cant this be "command.ALL.map(promisifyQuery)"?
          command.ALL.map(item => promisifyQuery(item))
        )
      }
      if (command.AND) return fii.AND(...command.AND.map(promisifyQuery))
      if (command.BUCKETFILTER) {
        if (command.BUCKETFILTER.BUCKETS.DISTINCT) {
          return fii.BUCKETFILTER(
            DISTINCT(command.BUCKETFILTER.BUCKETS.DISTINCT)
              .then(bkts => bkts.map(fii.BUCKET)),
            promisifyQuery(command.BUCKETFILTER.FILTER)
          )
        } else {
          return fii.BUCKETFILTER(
            command.BUCKETFILTER.BUCKETS.map(fii.BUCKET),
            promisifyQuery(command.BUCKETFILTER.FILTER)
          )
        }
      }
      // feed in preceding results if present (ie if not first promise)
      if (command.BUCKET) return fii.BUCKET(resultFromPreceding || command.BUCKET)
      if (command.DICTIONARY) return DICTIONARY(command.DICTIONARY)
      if (command.DISTINCT) return DISTINCT(command.DISTINCT)
      // feed in preceding results if present (ie if not first promise)
      if (command.DOCUMENTS) return DOCUMENTS(resultFromPreceding || command.DOCUMENTS)
      if (command.GET) return fii.GET(command.GET)
      if (command.OR) return fii.OR(...command.OR.map(promisifyQuery))
      if (command.NOT) {
        return fii.SET_SUBTRACTION(
          promisifyQuery(command.NOT.INCLUDE),
          promisifyQuery(command.NOT.EXCLUDE)
        )
      }
      if (command.SEARCH) return SEARCH(...command.SEARCH.map(promisifyQuery))
    }
    // Turn the array of commands into a chain of promises
    return q.reduce((acc, cur) => acc.then(
      result => promisifyQuery(cur, result)
    ), promisifyQuery(q.shift())) // <- Separate the first promise in the chain
    //                                  to be used as the start point in .reduce
  }

  return {
    AND: fii.AND,
    BUCKET: fii.BUCKET,
    BUCKETFILTER: fii.BUCKETFILTER,
    DICTIONARY: DICTIONARY,
    DISTINCT: DISTINCT,
    DOCUMENTS: DOCUMENTS,
    GET: fii.GET,
    OR: fii.OR,
    SCORENUMERIC: numericField,
    SCORETFIDF: TFIDF,
    SEARCH: SEARCH,
    SET_SUBTRACTION: fii.SET_SUBTRACTION,
    parseJsonQuery: parseJsonQuery
  }
}
