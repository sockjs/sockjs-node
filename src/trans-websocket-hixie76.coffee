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


class WebHandshakeHixie76
    constructor: (@req, @connection, head, origin, location) ->
        @sec = ('sec-websocket-key1' of @req.headers)
        wsp = (@sec and ('sec-websocket-protocol' of @req.headers))
        prefix = if @sec then 'Sec-' else ''
        blob = [
            'HTTP/1.1 101 WebSocket Protocol Handshake',
            'Upgrade: WebSocket',
            'Connection: Upgrade',
            prefix + 'WebSocket-Origin: ' + origin,
            prefix + 'WebSocket-Location: ' + location,
        ]
        if wsp
            blob.push('Sec-WebSocket-Protocol: ' +
                    @req.headers['sec-websocket-protocol'].split(',')[0])

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
        @connection.addListener('end', @close_cb)
        @data_cb = (data) => @didMessage(data)
        @connection.addListener('data', @data_cb)

    _cleanup: ->
        @connection.removeListener('end', @close_cb)
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
        @buffer = utils.buffer_concat(@buffer, new Buffer(bin_data, 'binary'))
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

        # websockets possess no session_id
        session = transport.Session.bySessionIdOrNew(undefined, @req.sockjs_server)
        session.register( new WebSocketReceiver(@connection) )


class WebSocketReceiver extends transport.ConnectionReceiver
    protocol: "websocket"

    constructor:  ->
        @recv_buffer = new Buffer(0)
        super

    setUp: ->
        @data_cb = (data) => @didMessage(data)
        @connection.addListener('data', @data_cb)
        super

    tearDown: ->
        @connection.removeListener('data', @data_cb)
        @data_cb = undefined
        super

    didMessage: (bin_data) ->
        if bin_data
            @recv_buffer = utils.buffer_concat(@recv_buffer, new Buffer(bin_data, 'binary'))
        buf = @recv_buffer
        # TODO: support length in framing
        if buf.length is 0
            return
        if buf[0] is 0x00
            for i in [1...buf.length]
                if buf[i] is 0xff
                    payload = buf.slice(1, i).toString('utf8')
                    @recv_buffer = buf.slice(i+1)
                    if @session and payload.length > 0
                        try
                            message = JSON.parse(payload)
                        catch x
                            return @didClose(1002, 'Broken framing.')
                        @session.didMessage(message)
                    return @didMessage()
            # wait for more data
            return
        else if buf[0] is 0xff and buf[1] is 0x00
            @didClose(1001, "Socket closed by the client")
        else
            @didClose(1002, "Broken framing")
        return

    doSendFrame: (payload) ->
        # 6 bytes for every char shall be enough for utf8
        a = new Buffer((payload.length+2)*6)
        l  = 0
        l += a.write('\u0000', l, 'binary')
        l += a.write('' + payload, l, 'utf-8')
        l += a.write('\uffff', l, 'binary')
        super(a.slice(0, l), 'binary')

exports.WebHandshakeHixie76 = WebHandshakeHixie76
