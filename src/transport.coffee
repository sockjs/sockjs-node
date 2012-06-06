# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

stream = require('stream')
events = require('events')
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

class Timeout
    constructor: (callback, @delay) ->
        @missed = 0
        @doTimeout = =>
            @missed += 1
            # 1. reschedule
            if @delay
                @tref = setTimeout(@doTimeout, @delay)
            # 2. call
            if callback
                callback(@missed)

    start: () ->
        @missed = 0
        if @tref
            clearTimeout(@tref)
        if @delay
            @tref = setTimeout(@doTimeout, @delay)

    stop: () ->
        if @tref
            clearTimeout(@tref)
            @tref = null

    poke: () ->
        @stop()
        @start()


class SessionTimer extends events.EventEmitter
    constructor: (session, disconnect_delay, send_delay, recv_delay) ->
        doPollTimeout = (m) =>
            session.doPollTimeout(m)
        doSendTimeout = (m) =>
            session.doSendTimeout(m)
        doRecvTimeout = (m) =>
            session.doRecvTimeout(m)
        @no_poll_tref = new Timeout(doPollTimeout, disconnect_delay)
        @send_tref    = new Timeout(doSendTimeout, send_delay)
        @recv_tref    = new Timeout(doRecvTimeout, recv_delay)
        @no_poll_tref.start()
        @recv_tref.start()

    poll_start: () ->
        @no_poll_tref.stop()
        @send_tref.start()
        @recv_tref.poke()

    poll_end: () ->
        @no_poll_tref.start()
        @send_tref.stop()

    send: () ->
        @send_tref.poke()

    recv: () ->
        @recv_tref.poke()

    close: () ->
        @no_poll_tref.stop()
        @send_tref.stop()
        @recv_tref.stop()


class Session
    constructor: (@session_id, server) ->
        @client_heartbeat_reply = server.options.client_heartbeat_reply
        @prefix = server.options.prefix
        @send_buffer = []
        @is_closing = false
        @readyState = Transport.CONNECTING
        if @session_id
            MAP[@session_id] = @
        if server.options.client_heartbeat_reply
            # We want the 'h' frame to fire just before the empty data
            # "a[]" frame - to save bandwidth. After "h", "a[]" is
            # spurious.
            recv_delay = server.options.server_heartbeat_interval - 2
        @timer = new SessionTimer(@,
                                  server.options.disconnect_delay,
                                  server.options.server_heartbeat_interval,
                                  recv_delay)
        @connection = new SockJSConnection(@)
        @emit_open = =>
            @emit_open = null
            server.emit('connection', @connection)

    register: (req, recv) ->
        if @recv
            recv.doSendFrame(closeFrame(2010, "Another connection still open"))
            recv.didClose()
            return
        @connection.emit('poll')
        @timer.poll_start()
        if @readyState is Transport.CLOSING
            recv.doSendFrame(@close_frame)
            recv.didClose()
            @timer.poll_end()
            return

        # Registering. From now on 'unregister' is responsible for
        # calling poll_end.
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
        @recv = @recv.session = null
        @timer.poll_end()

    tryFlush: ->
        if @send_buffer.length > 0
            [sb, @send_buffer] = [@send_buffer, []]
            @recv.doSendBulk(sb)
            @timer.send()
        return

    doSendTimeout: ->
        @sendEmptyFrame()

    doRecvTimeout: (missed) ->
        if not @client_heartbeat_reply
            return
        if missed is 1
            @sendHeartbeat()
        else if missed is 2
            console.log("Heartbeat missed")
            @close(1006, "Heartbeat missed")

    sendHeartbeat: ->
        if not @recv
            return false
        @recv.doSendFrame("h")
        @timer.send()
        return true

    sendEmptyFrame: ->
        if not @recv
            return false
        @recv.doSendFrame("a[]")
        @timer.send()
        return true

    doPollTimeout: ->
        if @readyState isnt Transport.CONNECTING and
           @readyState isnt Transport.OPEN and
           @readyState isnt Transport.CLOSING
            throw Error('INVALID_STATE_ERR')
        if @recv
            throw Error('RECV_STILL_THERE')
        @timer.close()
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
            @timer.recv()
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
            session.doPollTimeout()

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
