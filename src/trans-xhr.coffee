transport = require('./transport')
utils = require('./utils')

class XhrStreamingReceiver extends transport.ResponseReceiver
    protocol: "xhr-streaming"
    max_response_size: 128*1024

    doSendFrame: (payload) ->
        return super(payload + '\n')

class XhrPollingReceiver extends XhrStreamingReceiver
    protocol: "xhr"
    max_response_size: 1


exports.app =
    xhr_options: (req, res) ->
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

        # FF assumes that the response is XML.
        res.setHeader('Content-Type', 'text/plain')
        res.writeHead(204)
        res.end()
        return true

    xhr_cors: (req, res, content) ->
        origin = req.headers['origin'] or '*'
        res.setHeader('Access-Control-Allow-Origin', origin)
        headers = req.headers['access-control-request-headers']
        if headers
            res.setHeader('Access-Control-Allow-Headers', headers)
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        return content

    xhr_poll: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        session = transport.Session.bySessionIdOrNew(req.session,
                                                     req.sockjs_server)
        session.register( new XhrPollingReceiver(res) )
        return true

    xhr_streaming: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        # IE requires 2KB prefix:
        #  http://blogs.msdn.com/b/ieinternals/archive/2010/04/06/comet-streaming-in-internet-explorer-with-xmlhttprequest-and-xdomainrequest.aspx
        res.write(Array(2048).join('h') + '\n')

        session = transport.Session.bySessionIdOrNew(req.session,
                                                     req.sockjs_server)
        session.register( new XhrStreamingReceiver(res) )
        return true
