# http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-76
#
crypto = require('crypto')

utils = require('./utils')
transport = require('./transport')

validateCrypto = (req_headers, nonce) ->
    k1 = req_headers['sec-websocket-key1']
    k2 = req_headers['sec-websocket-key2']

    if not k1 or not k2
        return false

    md5 = crypto.createHash('md5')
    for k in [k1, k2]
        n = parseInt(k.replace(/[^\d]/g, ''))
        spaces = k.replace(/[^ ]/g, '').length

        if spaces is 0 or n % spaces isnt 0
            return false
        n /= spaces
        s = String.fromCharCode(
                n >> 24 & 0xFF,
                n >> 16 & 0xFF,
                n >> 8  & 0xFF,
                n       & 0xFF)
        md5.update(s)
    md5.update(nonce.toString('binary'))
    return md5.digest('binary')


class WebHandshake
    constructor: (@req, @connection, head, origin, location) ->
        @sec = ('sec-websocket-key1' of @req.headers)
        wsp = (@sec and ('sec-websocket-protocol' of @req.headers))
        prefix = if @sec then 'Sec-' else ''
        blob = [
            'HTTP/1.1 101 WebSocket Protocol Handshake',
            'Upgrade: WebSocket',
            'Connection: Upgrade'
            prefix + 'WebSocket-Origin: ' + origin,
            prefix + 'WebSocket-Location: ' + location,
        ]
        if wsp
            blob.push('Sec-WebSocket-Protocol: ' +
                    @req.headers['sec-websocket-protocol'])

        @_setup()
        try
            @connection.write(blob.concat('', '').join('\r\n'), 'utf8')
            @connection.setTimeout(0)
            @connection.setNoDelay(true)
            @connection.setEncoding('binary')
        catch e
            @didClose()
            return

        @buffer = new Buffer(0)
        @didMessage(head)
        return

    _setup: ->
        @close_cb = () => @didClose()
        @connection.addListener('close', @close_cb)
        @data_cb = (data) => @didMessage(data)
        @connection.addListener('data', @data_cb)

    _cleanup: ->
        @connection.removeListener('close', @close_cb)
        @connection.removeListener('data', @data_cb)
        @close_cb = @data_cb = undefined

    didClose: ->
        if @connection
            @_cleanup()
            try
                @connection.end()
            catch x
            @connection = undefined

    didMessage: (bin_data) ->
        @buffer = utils.buffer_concat(@buffer, bin_data)
        if @sec is false or @buffer.length >= 8
            @gotEnough()

    gotEnough: ->
        @_cleanup()
        if @sec
            nonce = @buffer.slice(0, 8)
            @buffer = @buffer.slice(8)
            reply = validateCrypto(@req.headers, nonce)
            if reply is false
                @didClose()
                return false
            try
                @connection.write(reply, 'binary')
            catch x
                @didClose()
                return false
        ws = new WebSocket(@req, @connection)



class WebSocket extends transport.Transport
    protocol: "websocket"

    constructor: (@req, @connection) ->
        super(@req.session, @req.sockjs_server)
        @_setup()
        @_recv_buffer = new Buffer(0)
        @didOpen()

    _setup: ->
        @close_cb = () => @didClose(1001, "Socket closed")
        @connection.addListener('close', @close_cb)
        @data_cb = (data) => @didMessage(data)
        @connection.addListener('data', @data_cb)

    _cleanup: ->
        @connection.removeListener('close', @close_cb)
        @connection.removeListener('data', @data_cb)
        @close_cb = @data_cb = undefined

    doSend: (payload) ->
        if typeof @connection is 'undefined'
            return false
        try
            @connection.write('\u0000', 'binary')
            @connection.write(''+payload, 'utf-8')
            @connection.write('\uffff', 'binary')
            return true
        catch e
            console.log(e.stack)
            process.nextTick(() => @didClose(1001, "Socket closed (write)"))
            return false

    doClose: ->
        @connection.end()

    didClose: (a,b)->
        if typeof @connection isnt 'undefined'
            @_cleanup()
            try
                @connection.end()
            catch x
            @connection = undefined
            super

    didMessage: (bin_data) ->
        buf = @_recv_buffer = utils.buffer_concat(@_recv_buffer, new Buffer(bin_data, 'binary'))
        # TODO: support length in framing
        if buf.length is 0
            return
        if buf[0] is 0x00
            for i in [1...buf.length]
                if buf[i] is 0xff
                    data = buf.slice(1, i).toString('utf8')
                    @_recv_buffer = buf.slice(i+1)
                    super(data)
                    return @didMessage(new Buffer(0))
            # not enough chars
            return
        else if buf[0] is 0xff and buf[1] is 0x00
                @didClose(1001, "Socket closed by the client")
        else
            @didClose(1002, "Broken framing")
        return

exports.app =
    websocket: (req, connection, head) ->
        if req.headers.upgrade isnt 'WebSocket'
            throw {
                status: 406
                message: "Can upgrade only to websockets."
            }
        origin = req.headers.origin
        if not utils.verify_origin(origin, req.sockjs_server.options.origins)
            throw {
                status: 403
                message: "Unverified origin."
            }
        location = (if origin and origin[0...5] is 'https' then 'wss' else 'ws')
        location += '://' + req.headers.host + req.url

        head or= new Buffer(0)
        ws = new WebHandshake(req, connection, head, origin, location)
        return true
