FayeWebsocket = require('faye-websocket')

utils = require('./utils')
transport = require('./transport')

exports.app =
    websocket: (req, connection, head) ->
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

        ws = new FayeWebsocket(req, connection, head)

            # websockets possess no session_id
        transport.registerNoSession(req, @,
                                    new WebSocketReceiver(ws, connection))
        return true

    websocket_get: (req, rep) ->
        # Request via node.js normal request.
        throw {
            status: 400
            message: 'Can "Upgrade" only to "WebSocket".'
        }

class WebSocketReceiver extends transport.ConnectionReceiver
    protocol: "websocket"

    constructor: (@ws, connection) ->
        try
            connection.setKeepAlive(true, 5000)
            connection.setNoDelay(true)
        catch x
        super @ws

    setUp: ->
        @ws.addEventListener('close', @thingy_end_cb)
        super

    tearDown: ->
        @ws.removeEventListener('close', @thingy_end_cb)
        super

    didMessage: (message) ->
        if @session and message.length > 0
            @session.didMessage(message)

    doSendFrame: (payload) ->
        if @ws
            try
                @ws.send(payload)
                return true
            catch e
        return false

    didClose: ->
        super
        try
            @ws.close()
        catch x
        @ws = null
