transport = require('./transport')
utils = require('./utils')

class XhrPollingReceiver extends transport.ResponseReceiver
    protocol: "xhr"

    doSendFrame: (payload) ->
        if @session
            @session.unregister()
        if payload isnt 'o'
            r = super(payload + '\n')
            @response.end()
            return r
        else
            # On purpose, after the first response 'o', wait a while
            # before closing a connection. This will allow sockjs to
            # detect if the browser has xhr-streaming capabilities.
            # Opera delivers XHR onreadystatechange signal 3 only once,
            # thus the need to send two zeroes.
            write = (payload) =>
                try
                    return @response.write(payload + '\n')
                catch x
                return  true
            ondrain = =>
                @response.connection.removeListener('drain', ondrain)
                utils.timeout_chain([
                    [150, => write("o")],
                    [150, => write(""); @response.end()],
                ])
            # IE requires 2KB prefix, thus waiting on ondrain
            r = write(Array(2048).join('h') + '\n')
            if r is false
                @response.connection.addListener('drain', ondrain)
            else
                ondrain()
            return true

    doKeepalive: () ->
        @doSendFrame("h")


class XhrStreamingReceiver extends transport.ResponseReceiver
    protocol: "xhr"

    constructor: ->
        @send_bytes = 0
        super

    doSendFrame: (payload) ->
        @send_bytes += payload.length + 1
        if @send_bytes > 128*1024
            if @session
                @session.unregister()
        r = super(payload + '\n')
        if @send_bytes > 128*1024
            @response.end()
        return r

    doKeepalive: () ->
        @doSendFrame("h")


exports.app =
    xhr_poll: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        session = transport.Session.bySessionIdOrNew(req.session,
                                                     req.sockjs_server)
        session.register( new XhrPollingReceiver(res) )
        return true

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

        res.writeHead(200)
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
