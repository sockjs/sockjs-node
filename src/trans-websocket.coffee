utils = require('./utils')

websocket_hixie76 = require('./trans-websocket-hixie76')
websocket_hybi10 = require('./trans-websocket-hybi10')


exports.app =
    websocket: (req, connection, head) ->
        if (req.headers.upgrade || '').toLowerCase() isnt 'websocket'
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


        ver = req.headers['sec-websocket-version']
        if  ver is '8' or ver is '7'
            new websocket_hybi10.WebHandshake8(req, connection, head or '', origin, location)
        else
            new websocket_hixie76.WebHandshakeHixie76(req, connection, head or '', origin, location)
        return true

