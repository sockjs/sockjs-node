events = require('events')
utils = require('./utils')

MAP = {}

class Transport extends events.EventEmitter
    constructor: (@session, @server) ->
        @readyState = Transport.CONNECTING
        if @session of MAP
            @session = undefined
            @close(2001, "Session is not unique")
        else
            MAP[@session] = @

    didOpen: ->
        if @readyState isnt Transport.CONNECTING
            throw 'INVALID_STATE_ERR'
        @readyState = Transport.OPEN
        @server.emit('open', @)

    didClose: (status, reason) ->
        if @readyState isnt Transport.CONNECTING and
           @readyState isnt Transport.OPEN and
           @readyState isnt Transport.CLOSING
            throw 'INVALID_STATE_ERR'
        @readyState = Transport.CLOSED
        if status is 1001 and @_close_status
            @emit('close', {status:@_close_status, reason:@_close_reason})
        else
            @emit('close', {status:status, reason:reason})
        if @session
            delete MAP[@session]
            @session = undefined

    didMessage: (message) ->
        if @readyState isnt Transport.OPEN
            return false
        @emit('message', {data: message})

    close: (status=1000, reason="Normal closure") ->
        if @readyState isnt Transport.CONNECTING and
           @readyState isnt Transport.OPEN
            return false
        @readyState = Transport.CLOSING
        @_close_status = status
        @_close_reason = reason
        @doClose()
        return true

    send: (payload) ->
        @doSend(payload)


Transport.CONNECTING = 0
Transport.OPEN = 1
Transport.CLOSING = 2
Transport.CLOSED = 3

Transport.bySession = (session) ->
    return MAP[session] or null


class ConnectionTransport extends Transport
    constructor: (req, res) ->
        @connection = req.connection
        @connection.setTimeout(0)
        @connection.setNoDelay(true)
        @connection.setEncoding('utf-8')
        @connection.addListener('close', => @didClose(1001, "Socket closed"))
        @response = res
        super(req.session, req.sockjs_server)


    rawWrite: (payload) ->
        if typeof @connection isnt 'undefined'
            try
                @connection.write(payload, 'utf8')
                return true
            catch e
                process.nextTick( => @didClose(1001, "Socket closed"))
        return false

    didClose: ->
        # Protect against being triggered multiple times.
        if typeof @connection isnt 'undefined'
            try
                @connection.end()
            catch x
            try
                # According to docs 'response.end' must be called once
                # http://nodejs.org/docs/v0.4.9/api/all.html#response.end
                @response.end()
            catch x
            @connection = @response = undefined
            super

class PollingTransport extends Transport
    timeout_ms: 15000

    constructor: ->
        @buffer = []
        super
        @close_cb = () => @didClose(1001, "Browser isn't polling")
        @timeout_cb = () => @didTimeout()
        @is_closing = false
        @_unregister()

    _register: (req, res) ->
        if @req
            # Previous request wasn't done yet, closing the previous socket.
            @writeClose()
        @req = req
        @res = res
        @req.addListener('close', @close_cb)
        if @tref
            clearTimeout(@tref)
        @tref = setTimeout(@timeout_cb, @timeout_ms)
        @_flush()

    _unregister: ->
        if @tref
            clearTimeout(@tref)
        if @req
            @req.removeListener('close', @close_cb)
        @req = @res = @tref = undefined
        @tref = setTimeout(@close_cb, @timeout_ms / 2)
        return true

    rawWrite: (payload) ->
        if not @res
            throw "NO_REQUEST_WAITING_ERR"
        @res.write(payload)
        @res.end()
        @_unregister()
        return true

    didTimeout: ->
        @tref = undefined
        @writeHeartbeat()

    didClose: (a,b) ->
        if @tref
            @_unregister()
            clearTimeout(@tref)
            @tref = undefined
            super

    doSend: (payload) ->
        @buffer.push( payload )
        @_flush()

    _flush: ->
        if @req
            if @is_closing
                @writeClose()
                process.nextTick(=>@didClose(1001, "Socket closed"))
             else
                if @readyState is Transport.CONNECTING
                    @writeOpen()
                    @didOpen()
                else
                    if @buffer.length > 0
                        @writeMessages(@buffer)
                        @buffer = []
    doClose: ->
        @is_closing = true
        @_flush()

exports.Transport = Transport
exports.ConnectionTransport = ConnectionTransport
exports.PollingTransport = PollingTransport
