# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

stream = require('stream')
uuid = require('node-uuid')
utils = require('./utils')

class Transport

Transport.CONNECTING = 0
Transport.OPEN = 1
Transport.CLOSING = 2
Transport.CLOSED = 3

closeFrame = (status, reason) ->
    return 'c' + JSON.stringify([status, reason])


class SockJSConnection extends stream.Stream
    constructor: (@_session) ->
        @id  = uuid()
        @headers = {}
        @prefix = @_session.prefix

    toString: ->
        return '<SockJSConnection ' + @id + '>'

    write: (string) ->
        return @_session.send('' + string)

    sendHeartbeat: () ->
        return @_session.sendHeartbeat()

    end: (string) ->
        if string
            @write(string)
        @close()
        return null

    close: (code, reason) ->
        @_session.close(code, reason)

    destroy: () ->
        @removeAllListeners()
        @end()

    destroySoon: () ->
        @destroy()

SockJSConnection.prototype.__defineGetter__ 'readable', ->
    @_session.readyState is Transport.OPEN
SockJSConnection.prototype.__defineGetter__ 'writable', ->
    @_session.readyState is Transport.OPEN
SockJSConnection.prototype.__defineGetter__ 'readyState', ->
    @_session.readyState


MAP = {}

class Session
    constructor: (@session_id, server) ->
        @server_heartbeat_interval = server.options.server_heartbeat_interval
        @client_heartbeat_reply    = server.options.client_heartbeat_reply
        @client_heartbeat_count    = false
        @disconnect_delay = server.options.disconnect_delay
        @prefix = server.options.prefix
        @send_buffer = []
        @is_closing = false
        @readyState = Transport.CONNECTING
        if @session_id
            MAP[@session_id] = @
        @timeout_cb = =>
            @didTimeout()
        @heartbeat_cb = =>
            @doHeartbeat()
        @to_tref = setTimeout(@timeout_cb, @disconnect_delay)
        @connection = new SockJSConnection(@)
        @emit_open = =>
            @emit_open = null
            server.emit('connection', @connection)

    register: (req, recv) ->
        if @recv
            recv.doSendFrame(closeFrame(2010, "Another connection still open"))
            recv.didClose()
            return
        if @to_tref
            clearTimeout(@to_tref)
            @to_tref = null
        if @readyState is Transport.CLOSING
            recv.doSendFrame(@close_frame)
            recv.didClose()
            @to_tref = setTimeout(@timeout_cb, @disconnect_delay)
            return

        @client_heartbeat_count = 0
        @connection.emit('poll')
        # Registering. From now on 'unregister' is responsible for
        # setting the timer.
        @recv = recv
        @recv.session = @

        # Save parameters from request
        @decorateConnection(req)

        # first, send the open frame
        if @readyState is Transport.CONNECTING
            @recv.doSendFrame('o')
            @readyState = Transport.OPEN
            # Emit the open event, but not right now
            process.nextTick @emit_open

        # At this point the transport might have gotten away (jsonp).
        if not @recv
            return
        @tryFlush()
        return

    decorateConnection: (req) ->
        # Store the last known address.
        unless socket = @recv.connection
            socket = @recv.response.connection
        @connection.remoteAddress = socket.remoteAddress
        @connection.remotePort = socket.remotePort
        try
            @connection.address = socket.address()
        catch e
            @connection.address = {}

        @connection.url = req.url
        @connection.pathname = req.pathname
        @connection.protocol = @recv.protocol

        headers = {}
        for key in ['referer', 'x-client-ip', 'x-forwarded-for', \
                    'x-cluster-client-ip', 'via', 'x-real-ip']
            headers[key] = req.headers[key] if req.headers[key]
        if headers
            @connection.headers = headers

    unregister: ->
        @recv.session = null
        @recv = null
        if @to_tref
            clearTimeout(@to_tref)
        @to_tref = setTimeout(@timeout_cb, @disconnect_delay)

    tryFlush: ->
        if @send_buffer.length > 0
            [sb, @send_buffer] = [@send_buffer, []]
            @recv.doSendBulk(sb)

        if @to_tref
            clearTimeout(@to_tref)
        @to_tref = setTimeout(@heartbeat_cb, @server_heartbeat_interval)
        return

    doHeartbeat: ->
        @client_heartbeat_count += 1
        console.log('heartbeat', @client_heartbeat_count)
        if @client_heartbeat_reply and @client_heartbeat_count is 2
            console.log("Heartbeat missed")
            @close(1006, "Heartbeat missed")
        else if @sendHeartbeat()
            @to_tref = setTimeout(@heartbeat_cb, @server_heartbeat_interval)

    sendHeartbeat: ->
        if not @recv
            return false
        @recv.doSendFrame("h")
        return true


    didTimeout: ->
        if @to_tref
            clearTimeout(@to_tref)
            @to_tref = null
        if @readyState isnt Transport.CONNECTING and
           @readyState isnt Transport.OPEN and
           @readyState isnt Transport.CLOSING
            throw Error('INVALID_STATE_ERR')
        if @recv
            throw Error('RECV_STILL_THERE')
        @readyState = Transport.CLOSED
        # Node streaming API is broken. Reader defines 'close' and 'end'
        # but Writer defines only 'close'. 'End' isn't optional though.
        #   http://nodejs.org/docs/v0.5.8/api/streams.html#event_close_
        @connection.emit('end')
        @connection.emit('close')
        @connection = null
        if @session_id
            delete MAP[@session_id]
            @session_id = null

    didMessages: (messages) ->
        if @readyState is Transport.OPEN
            if messages.length > 0
                for msg in messages
                    @connection.emit('data', msg)
            else
                @connection.emit('heartbeat')
                @client_heartbeat_count = 0
        return

    send: (payload) ->
        if @readyState isnt Transport.OPEN
            return false
        @send_buffer.push('' + payload)
        if @recv
            @tryFlush()
        return true

    close: (status=1000, reason="Normal closure") ->
        if @readyState isnt Transport.OPEN
            return false
        @readyState = Transport.CLOSING
        @close_frame = closeFrame(status, reason)
        if @recv
            # Go away.
            @recv.doSendFrame(@close_frame)
            @recv.didClose()
            if @recv
                @unregister()
        return true



Session.bySessionId = (session_id) ->
    return MAP[session_id] or null

register = (req, server, session_id, receiver) ->
    session = Session.bySessionId(session_id)
    if not session
        session = new Session(session_id, server)
    session.register(req, receiver)
    return session

exports.register = (req, server, receiver) ->
    register(req, server, req.session, receiver)
exports.registerNoSession = (req, server, receiver) ->
    register(req, server, undefined, receiver)



class GenericReceiver
    constructor: (@thingy) ->
        @setUp(@thingy)

    setUp: ->
        @thingy_end_cb = () => @didAbort(1006, "Connection closed")
        @thingy.addListener('close', @thingy_end_cb)
        @thingy.addListener('end', @thingy_end_cb)

    tearDown: ->
        @thingy.removeListener('close', @thingy_end_cb)
        @thingy.removeListener('end', @thingy_end_cb)
        @thingy_end_cb = null

    didAbort: (status, reason) ->
        session = @session
        @didClose(status, reason)
        if session
            session.didTimeout()

    didClose: (status, reason) ->
        if @thingy
            @tearDown(@thingy)
            @thingy = null
        if @session
            @session.unregister(status, reason)

    doSendBulk: (messages) ->
        q_msgs = for m in messages
                utils.quote(m)
        @doSendFrame('a' + '[' + q_msgs.join(',') + ']')


# Write stuff to response, using chunked encoding if possible.
class ResponseReceiver extends GenericReceiver
    max_response_size: undefined

    constructor: (@response, @options) ->
        @curr_response_size = 0
        try
            @response.connection.setKeepAlive(true, 5000)
        catch x
        super (@response.connection)
        if @max_response_size is undefined
            @max_response_size = @options.response_limit

    doSendFrame: (payload) ->
        @curr_response_size += payload.length
        r = false
        try
            @response.write(payload)
            r = true
        catch x
        if @max_response_size and @curr_response_size >= @max_response_size
            @didClose()
        return r

    didClose: ->
        super
        try
            @response.end()
        catch x
        @response = null


exports.GenericReceiver = GenericReceiver
exports.Transport = Transport
exports.Session = Session
exports.ResponseReceiver = ResponseReceiver
exports.SockJSConnection = SockJSConnection
