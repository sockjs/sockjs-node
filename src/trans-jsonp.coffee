transport = require('./transport')

class JsonP extends transport.PollingTransport
    protocol: "jsonp"

    constructor: (req) ->
        super(req.session, req.sockjs_server)

    _register: (req) ->
        @callback = if 'c' of req.query then req.query['c'] else req.query['callback']
        super

    writeOpen: ->
        @rawWrite(@callback + "(undefined, 'open');\r\n")

    writeHeartbeat: ->
        @rawWrite(@callback + "(undefined, 'heartbeat');\r\n")

    writeClose: ->
        @rawWrite(@callback + "(undefined, 'close');\r\n")

    writeMessages: (messages) ->
        @rawWrite(@callback + "(" + JSON.stringify(messages) + ");\r\n")


exports.app =
    jsonp: (req, res, _, next_filter) ->
        if not('c' of req.query or 'callback' of req.query)
            throw {
                status: 500
                message: '"callback" parameter required'
            }

        res.setHeader('Content-type', 'application/javascript; charset=UTF-8')
        res.statusCode = 200

        jsonp = transport.Transport.bySession(req.session)
        if jsonp is null
            jsonp = new JsonP(req)
        jsonp._register(req, res)
        return true

    jsonp_send: (req, res, query) ->
        if not query
            throw {
                status: 500
                message: 'payload expected'
            }
        if not('d' of query)
            throw {
                status: 500
                message: '"d" expected'
            }
        jsonp = transport.Transport.bySession(req.session)
        if jsonp is null
            throw {status: 404}
        for message in JSON.parse(query.d)
            jsonp.didMessage(message)

        res.setHeader('Content-type', 'text/plain')
        return 'ok'