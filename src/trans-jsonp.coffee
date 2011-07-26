transport = require('./transport')

class JsonpReceiver extends transport.ResponseReceiver
    protocol: "jsonp"

    constructor: (res, @callback) ->
        super (res)

    doSendBulk: (messages) ->
        @doSend(JSON.stringify(messages))

    doSend: (p) ->
        @session.unregister()
        super(@callback + "(" + p + ");\r\n")
        @response.end()

    sendOpen: (payload) ->
        @doSend('undefined, "open"')

    doClose: (s, r) ->
        @doSend(JSON.stringify({status:s, reason:r})+ ', "close"')
        super


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

        jsonp = new JsonpReceiver(res, callback)

        session = transport.Session.bySessionId(req.session)
        if not session
            session = transport.Session.bySessionIdOrNew(req.session, req.sockjs_server)
            jsonp.sendOpen()
        else
            session.register( jsonp )
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

        res.setHeader('Content-type', 'text/plain')
        return 'ok'
