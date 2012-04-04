crypto = require('crypto')

try
    rbytes = require('rbytes')
catch x
    null

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

exports.sha1_base64 = (data) ->
    return crypto.createHash('sha1')
            .update(data)
            .digest('base64')

exports.timeout_chain = (arr) ->
    arr = arr.slice(0)
    if not arr.length then return
    [timeout, user_fun] = arr.shift()
    fun = =>
        user_fun()
        exports.timeout_chain(arr)
    setTimeout(fun, timeout)


exports.objectExtend = (dst, src) ->
    for k of src
        if src.hasOwnProperty(k)
            dst[k] = src[k]
    return dst

exports.overshadowListeners = (ee, event, handler) ->
    # listeners() returns a reference to the internal array of EventEmitter.
    # Make a copy, because we're about the replace the actual listeners.
    old_listeners = ee.listeners(event).slice(0)

    ee.removeAllListeners(event)
    new_handler = () ->
        if handler.apply(this, arguments) isnt true
            for listener in old_listeners
                listener.apply(this, arguments)
            return false
        return true
    ee.addListener(event, new_handler)


escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g

unroll_lookup = (escapable) ->
    unrolled = {}
    c = for i in [0...65536]
            String.fromCharCode(i)
    escapable.lastIndex = 0
    c.join('').replace escapable, (a) ->
        unrolled[ a ] = '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4)
    return unrolled

lookup = unroll_lookup(escapable)

exports.quote = (string) ->
    quoted = JSON.stringify(string)

    # In most cases normal json encoding fast and enough
    escapable.lastIndex = 0
    if not escapable.test(quoted)
        return quoted

    return quoted.replace escapable, (a) ->
                return lookup[a]

exports.parseCookie = (cookie_header) ->
    cookies = {}
    if cookie_header
        for cookie in cookie_header.split(';')
            parts = cookie.split('=')
            cookies[ parts[0].trim() ] = ( parts[1] || '' ).trim()
    return cookies

exports.random32 = () ->
    if rbytes
        x = rbytes.randomBytes(4)
        v = [x[0], x[1], x[2], x[3]]
    else
        foo = -> Math.floor(Math.random()*256)
        v = [foo(), foo(), foo(), foo()]

    x =  v[0] + (v[1]*256 ) + (v[2]*256*256) + (v[3]*256*256*256)
    return x
