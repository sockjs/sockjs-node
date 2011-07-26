crypto = require('crypto')

exports.array_intersection = array_intersection = (arr_a, arr_b) ->
    r = []
    for a in arr_a
        if arr_b.indexOf(a) isnt -1
            r.push(a)
    return r

# exports.array_contains = (arr, element) ->
#     return (arr.indexOf(element) !== -1)

exports.verify_origin = (origin, list_of_origins) ->
    if list_of_origins.indexOf('*:*') isnt -1
        return true
    if not origin
        return false
    try
        parts = url.parse(origin)
        origins = [parts.host + ':' + parts.port,
                   parts.host + ':*',
                   '*:' + parts.port]
        if array_intersection(origins, list_of_origins).length > 0
            return true
    catch x
        null
    return false

exports.escape_selected = (str, chars) ->
    map = {}
    chars = '%'+chars
    for c in chars
        map[c] = escape(c)
    r = new RegExp('(['+chars+'])')
    parts = str.split(r)
    for i in [0...parts.length]
        v = parts[i]
        if v.length is 1 and v of map
            parts[i] = map[v]
    return parts.join('')

# exports.random_string = (letters, max) ->
#     chars = 'abcdefghijklmnopqrstuvwxyz0123456789_'
#     max or= chars.length
#     ret = for i in [0...letters]
#             chars[Math.floor(Math.random() * max)]
#     return ret.join('')

exports.buffer_concat = (buf_a, buf_b) ->
    dst = new Buffer(buf_a.length + buf_b.length)
    buf_a.copy(dst)
    buf_b.copy(dst, buf_a.length)
    return dst

exports.md5_hex = (data) ->
    return crypto.createHash('md5')
            .update(data)
            .digest('hex')
