transport = require('./transport')

class JsonpReceiver extends transport.ResponseReceiver
    protocol: "jsonp"

    constructor: (res, @callback) ->
        super (res)

    doSendFrame: (payload) ->
        # Yes, JSONed twice, there isn't a a better way, we must pass
        # a string back, and the script, will be evaled() by the
        # browser.
        if @session
            @session.unregister()
        r = super(@callback + "(" + JSON.stringify(payload) + ");\r\n")
        @response.end()
        return r

    doKeepalive: () ->
        @doSendFrame("")


exports.app =
    jsonp: (req, res, _, next_filter) ->
        if not('c' of req.query or 'callback' of req.query)
            throw {
                status: 500
                message: '"callback" parameter required'
            }

        callback = if 'c' of req.query then req.query['c'] else req.query['callback']
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        session = transport.Session.bySessionIdOrNew(req.session, req.sockjs_server)
        session.register( new JsonpReceiver(res, callback) )
        return true

    jsonp_send: (req, res, query) ->
        if not query
            throw {
                status: 500
                message: 'payload expected'
            }
        if typeof query is 'string'
            d = JSON.parse(query)
        else
            d = query.d
        if typeof d is 'string'
            d = JSON.parse(d)
        if not d or d.__proto__.constructor isnt Array
            throw {
                status: 500
                message: 'payload expected'
            }
        jsonp = transport.Session.bySessionId(req.session)
        if jsonp is null
            throw {status: 404}
        for message in d
            jsonp.didMessage(message)

        res.setHeader('Content-Length', '2')
        res.writeHead(200)
        res.end('ok')
        return true
