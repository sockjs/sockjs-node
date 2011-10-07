utils = require('./utils')
transport = require('./transport')


computeAcceptKey = (key) ->
    data = key.match(/\S+/)[0] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
    return utils.sha1_base64(data)

class WebHandshake8
    constructor: (@server, @req, @connection, head, origin, location) ->
        key_accept = computeAcceptKey(@req.headers['sec-websocket-key'])
        blob = [
            'HTTP/1.1 101 Switching Protocols',
            'Upgrade: WebSocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Accept: ' + key_accept,
        ]
        if @req.headers['sec-websocket-protocol']
            blob.push('Sec-WebSocket-Protocol: ' +
                    @req.headers['sec-websocket-protocol'].split(',')[0])
        try
            @connection.write(blob.concat('', '').join('\r\n'), 'utf8')
            @connection.setTimeout(0)
            @connection.setNoDelay(true)
            @connection.setEncoding('binary')
        catch e
            try
                @connection.end()
            catch x
            return

        # websockets possess no session_id
        session = transport.Session.bySessionIdOrNew(undefined, @server)
        session.register( new WebSocket8Receiver(@connection) )


class WebSocket8Receiver extends transport.ConnectionReceiver
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
        if buf.length < 2
            return
        if (buf[0] & 128) isnt 128
            console.error('fin flag not set')
            @didClose(1002, "Fin flag not set")
            return
        opcode = buf[0] & 0xF
        if opcode isnt 1 and opcode isnt 8
            console.error('not a text nor close frame', buf[0] & 0xF)
            @didClose(1002, "not a text nor close frame")
            return
        if opcode is 8 and not ((buf[1] & 0x7F) < 126)
            console.error('wrong length for close frame')
            @didClose(1002, 'wrong length for close frame')
            return
        masking = not(not(buf[1] & 128))
        if (buf[1] & 0x7F) < 126
            length = (buf[1] & 0x7F)
            l = 2
        else if (buf[1] & 0x7F) is 126
            if buf.length < 4 then return
            length = (buf[2] << 8) | (buf[3] << 0)
            l = 4
        else if (buf[1] & 0x7F) is 127
            if buf.length < 10 then return
            length = (buf[2] << 56) | (buf[3] << 48) |
                     (buf[4] << 40) | (buf[5] << 32) |
                     (buf[6] << 24) | (buf[7] << 16) |
                     (buf[8] <<  8) | (buf[9] <<  0)
            l = 10
        if masking
            if buf.length < l+4 then return
            key = new Buffer(4)
            key[0] = buf[l+0]
            key[1] = buf[l+1]
            key[2] = buf[l+2]
            key[3] = buf[l+3]
            l += 4
        if buf.length < l + length
            return
        payload = buf.slice(l, l+length)
        if masking
            for i in [0...length]
                payload[i] = payload[i] ^ key[i % 4]
        @recv_buffer = buf.slice(l + length)
        #console.log('ok', masking, length)
        if opcode is 1
            payload_str = payload.toString('utf-8')
            if @session and payload_str.length > 0
                try
                    message = JSON.parse(payload_str)
                catch e
                    return @didClose(1002, 'Broken framing.')
                @session.didMessage(message)
            if @recv_buffer
                return @didMessage()
        else if opcode is 8
            if payload.length >= 2
                status = (payload[0] << 8) | (payload[1] << 0)
            else
                status = 1002
            if payload.length > 2
                reason = payload.slice(2).toString('utf-8')
            else
                reason = "Connection closed by user"
            @didClose(status, reason)
        return

    doSendFrame: (payload) ->
        payload = new Buffer(payload, 'utf-8')
        pl = payload.length
        # 6 bytes for every char shall be enough for utf8
        a = new Buffer(pl+14)
        a[0] = 128 + 1
        a[1] = 128
        l = 2
        if pl < 126
            a[1] |= pl
        else if pl < 65536
            a[1] |= 126
            a[l+0] = (pl >> 8) & 0xff
            a[l+1] = (pl >> 0) & 0xff
            l += 2
        else
            pl2 = pl
            a[1] |= 127
            for i in [7...-1]
                a[l+i] = pl2 & 0xff
                pl2 = pl2 >> 8
            l += 8
        key = new Buffer(4)
        a[l+0] = key[0] = Math.floor(Math.random()*256)
        a[l+1] = key[1] = Math.floor(Math.random()*256)
        a[l+2] = key[2] = Math.floor(Math.random()*256)
        a[l+3] = key[3] = Math.floor(Math.random()*256)
        l += 4
        for i in [0...pl]
            a[l+i] = payload[i] ^ key[i % 4]
        l += pl
        super(a.slice(0, l), 'binary')


exports.WebHandshake8 = WebHandshake8