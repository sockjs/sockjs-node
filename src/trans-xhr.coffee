transport = require('./transport')

class XhrReceiver extends transport.ResponseReceiver
    protocol: "xhr"

    doSendFrame: (payload) ->
        if @session
            @session.unregister()
        r = super(payload)
        @response.end()
        return r

    doKeepalive: () ->
        @doSendFrame("")


exports.app =
    xhr_poll: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        session = transport.Session.bySessionIdOrNew(req.session,
                                                     req.sockjs_server)
        session.register( new XhrReceiver(res) )
        return true

    xhr_options: (req, res) ->
        res.cache_for = 365 * 24 * 60 * 60 # one year.
        res.statusCode = 204    # No content
        res.setHeader('Allow', 'OPTIONS, POST')
        res.setHeader('Access-Control-Max-Age', res.cache_for)
        return ''

    xhr_send: (req, res, data) ->
        if not data
            throw {
                status: 500
                message: 'payload expected'
            }
        d = JSON.parse(data)
        if not d or d.__proto__.constructor isnt Array
            throw {
                status: 500
                message: 'payload expected'
            }
        jsonp = transport.Session.bySessionId(req.session)
        if not jsonp
            throw {status: 404}
        for message in d
            jsonp.didMessage(message)

        res.writeHead(200)
        res.end()
        return true

    'xhr_cors': (req, res, content) ->
        origin = req.headers['origin'] or '*'
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        return content