# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

FayeWebsocket = require('faye-websocket')

utils = require('./utils')
transport = require('./transport')


exports.app =
    _websocket_check: (req, connection, head) ->
        # Request via node.js magical 'upgrade' event.
        if (req.headers.upgrade || '').toLowerCase() isnt 'websocket'
            throw {
                status: 400
                message: 'Can "Upgrade" only to "WebSocket".'
            }
        conn = (req.headers.connection || '').toLowerCase()

        if (conn.split(/, */)).indexOf('upgrade') is -1
            throw {
                status: 400
                message: '"Connection" must be "Upgrade".'
            }
        origin = req.headers.origin
        if not utils.verify_origin(origin, @options.origins)
            throw {
                status: 400
                message: 'Unverified origin.'
            }

    sockjs_websocket: (req, connection, head) ->
        @_websocket_check(req, connection, head)
        ws = new FayeWebsocket(req, connection, head)
        ws.onopen = =>
            # websockets possess no session_id
            transport.registerNoSession(req, @,
                                        new WebSocketReceiver(ws, connection))
        return true

    raw_websocket: (req, connection, head) ->
        @_websocket_check(req, connection, head)
        ver = req.headers['sec-websocket-version'] or ''
        if ['8', '13'].indexOf(ver) is -1
            throw {
                status: 400
                message: 'Only supported WebSocket protocol is RFC 6455.'
            }
        ws = new FayeWebsocket(req, connection, head)
        ws.onopen = =>
            new RawWebsocketSessionReceiver(req, connection, @, ws)
        return true


class WebSocketReceiver extends transport.GenericReceiver
    protocol: "websocket"

    constructor: (@ws, @connection) ->
        try
            @connection.setKeepAlive(true, 5000)
            @connection.setNoDelay(true)
        catch x
        @ws.addEventListener('message', (m) => @didMessage(m.data))
        super @connection

    setUp: ->
        super
        @ws.addEventListener('close', @thingy_end_cb)

    tearDown: ->
        @ws.removeEventListener('close', @thingy_end_cb)
        super

    didMessage: (payload) ->
        if @ws and @session and payload.length > 0
            try
                message = JSON.parse(payload)
            catch x
                return @didClose(1002, 'Broken framing.')
            if payload[0] is '['
                for msg in message
                    @session.didMessage(msg)
            else
                @session.didMessage(message)

    doSendFrame: (payload) ->
        if @ws
            try
                @ws.send(payload)
                return true
            catch x
        return false

    didClose: ->
        super
        try
            @ws.close()
        catch x
        @ws = null
        @connection = null



Transport = transport.Transport

# Inheritance only for decorateConnection.
class RawWebsocketSessionReceiver extends transport.Session
    constructor: (req, conn, server, @ws) ->
        @prefix = server.options.prefix
        @readyState = Transport.OPEN
        @recv = {connection: conn}

        @connection = new transport.SockJSConnection(@)
        @decorateConnection(req)
        server.emit('connection', @connection)
        @_end_cb = => @didClose()
        @ws.addEventListener('close', @_end_cb)
        @_message_cb = (m) => @didMessage(m)
        @ws.addEventListener('message', @_message_cb)

    didMessage: (m) ->
        if @readyState is Transport.OPEN
            @connection.emit('data', m.data)
        return

    send: (payload) ->
        if @readyState isnt Transport.OPEN
            return false
        @ws.send(payload)
        return true

    close: (status=1000, reason="Normal closure") ->
        if @readyState isnt Transport.OPEN
            return false
        @readyState = Transport.CLOSING
        @ws.close(status, reason)
        return true

    didClose: ->
        if not @ws
            return
        @ws.removeEventListener('message', @_message_cb)
        @ws.removeEventListener('close', @_end_cb)
        try
            @ws.close()
        catch x
        @ws = null

        @readyState = Transport.CLOSED
        @connection.emit('end')
        @connection.emit('close')
        @connection = null
