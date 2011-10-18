utils = require('./utils')

websocket_hixie76 = require('./trans-websocket-hixie76')
websocket_hybi10 = require('./trans-websocket-hybi10')


exports.app =
    websocket: (req, connection, head) ->
        # Request via node.js magical 'upgrade' event.
        if (req.headers.upgrade || '').toLowerCase() isnt 'websocket'
            throw {
                status: 400
                message: 'Can "Upgrade" only to "WebSocket".'
            }
        if (req.headers.connection || '').toLowerCase() isnt 'upgrade'
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
        location = (if origin and origin[0...5] is 'https' then 'wss' else 'ws')
        location += '://' + req.headers.host + req.url

        ver = req.headers['sec-websocket-version']
        if ver in ['7', '8', '13']
            new websocket_hybi10.WebHandshake8(@, req, connection, head or '', origin, location)
        else
            new websocket_hixie76.WebHandshakeHixie76(@, req, connection, head or '', origin, location)
        return true

    websocket_get: (req, rep) ->
        # Request via node.js normal request.
        throw {
            status: 400
            message: 'Can "Upgrade" only to "WebSocket".'
        }
