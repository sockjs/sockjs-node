events = require('events')
uuid = require('node-uuid')

class Transport

Transport.CONNECTING = 0
Transport.OPEN = 1
Transport.CLOSING = 2
Transport.CLOSED = 3


class MockSession
    unregister: ->
    didClose: ->
    didMessage: ->


MAP = {}

class Session extends events.EventEmitter
    constructor: (@session_id, server) ->
        @id  = uuid()
        @send_buffer = []
        @is_closing = false
        @readyState = Transport.OPEN
        if @session_id
            MAP[@session_id] = @
        @timeout_cb = => @didClose(1001, "Timeouted")
        @to_tref = setTimeout(@timeout_cb, 5000)
        server.emit('open', @)

    register: (recv) ->
        if @recv or @readyState isnt Transport.OPEN
            recv.doClose(2010, "Other connection still open")
            return
        if @to_tref
            clearTimeout(@to_tref)
            @to_tref = undefined
        @recv = recv
        @recv.session = @
        @tryFlush()

    unregister: ->
        @recv.session = new MockSession()
        @recv = undefined
        @to_tref = setTimeout(@timeout_cb, 5000)

    didClose: (status, reason) ->
        if @readyState isnt Transport.OPEN and
           @readyState isnt Transport.CLOSING
            throw 'INVALID_STATE_ERR'
        if @recv
            throw 'RECV_STILL_THERE'
        @readyState = Transport.CLOSED
        if @to_tref
            clearTimeout(@to_tref)
            @to_tref = undefined
        if status is 1001 and @close_data
            @emit('close', @close_data)
        else
            @emit('close', {status:status, reason:reason})
        if @session_id
            delete MAP[@session_id]
            @session_id = undefined

    didMessage: (payload) ->
        if @readyState is Transport.OPEN
            @emit('message', {data: payload})
        return

    send: (payload) ->
        if @readyState isnt Transport.OPEN
            throw 'INVALID_STATE_ERR'
        @send_buffer.push( payload )
        if @recv
            @tryFlush()

    tryFlush: ->
        if @send_buffer.length > 0
            sb = @send_buffer
            @send_buffer = []
            @recv.doSendBulk(sb)
        return

    close: (status=1000, reason="Normal closure") ->
        if @readyState isnt Transport.OPEN
            return false
        @readyState = Transport.CLOSING
        @close_reason = {status:status, reason:reason}
        if @recv
            @recv.doClose()

    toString: ->
        r = ['#'+@id]
        if @session_id
            r.push( @session_id )
        if @recv
            r.push( @recv.protocol )
        return r.join('/')


Session.bySessionId = (session_id) ->
    return MAP[session_id] or null

Session.bySessionIdOrNew = (session_id, server) ->
    session = Session.bySessionId(session_id)
    if not session
        session = new Session(session_id, server)
    return session


class GenericReceiver
    constructor: (@thingy) ->
        @session = new MockSession()
        @setUp(@thingy)

    setUp: ->
        @thingy_end_cb = () => @didClose(1001, "Socket closed")
        @thingy.addListener('end', @thingy_end_cb)

    tearDown: ->
        @thingy.removeListener('end', @thingy_end_cb)
        @thingy_end_cb = undefined

    didClose: (status, reason) ->
        if @thingy
            @tearDown(@thingy)
            try
                @thingy.end()
            catch x
            @thingy = undefined
        @session.unregister(status, reason)

    doSendBulk: (messages) ->
        for msg in messages
            @doSend(msg)


class ConnectionReceiver extends GenericReceiver
    constructor: (@connection) ->
        try
            @connection.setKeepAlive(true, 5000)
        catch x
        super @connection

    doSend: (payload, encoding='utf-8') ->
        if not @connection
            return false
        try
            @connection.write(payload, encoding)
            return true
        catch e
            process.nextTick(() => @didClose(1001, "Socket closed (write)"))
            return false

    didClose: ->
        super
        @connection = undefined

    doClose: ->
        if @connection then @connection.end()


class ResponseReceiver extends GenericReceiver
    constructor: (@response) ->
        super (@response)

    doSend: (payload) ->
        try
            @response.write(payload)
        catch x

    didClose: ->
        @response = undefined
        super

    doClose: ->
        if @response then @response.end()


exports.Transport = Transport
exports.Session = Session
exports.ConnectionReceiver = ConnectionReceiver
exports.ResponseReceiver = ResponseReceiver
