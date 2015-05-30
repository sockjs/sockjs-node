# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

transport = require('./transport')
utils = require('./utils')

class XhrStreamingReceiver extends transport.ResponseReceiver
    protocol: "xhr-streaming"

    doSendFrame: (payload) ->
        return super(payload + '\n')

class XhrPollingReceiver extends XhrStreamingReceiver
    protocol: "xhr-polling"
    max_response_size: 1


exports.app =
    xhr_options: (req, res) ->
        res.statusCode = 204    # No content
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST')
        res.setHeader('Access-Control-Max-Age', res.cache_for)
        return ''

    xhr_send: (req, res, data) ->
        if not data
            throw {
                status: 500
                message: 'Payload expected.'
            }
        try
            d = JSON.parse(data)
        catch x
            throw {
                status: 500
                message: 'Broken JSON encoding.'
            }

        if not d or d.__proto__.constructor isnt Array
            throw {
                status: 500
                message: 'Payload expected.'
            }
        jsonp = transport.Session.bySessionId(req.session)
        if not jsonp
            throw {status: 404}
        for message in d
            jsonp.didMessage(message)

        # FF assumes that the response is XML.
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
        res.writeHead(204)
        res.end()
        return true

    xhr_cors: (req, res, content) ->
        if !req.headers['origin']
            origin = '*'
        else
            origin = req.headers['origin']
            res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
        headers = req.headers['access-control-request-headers']
        if headers
            res.setHeader('Access-Control-Allow-Headers', headers)
        return content

    xhr_poll: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        transport.register(req, @, new XhrPollingReceiver(req, res, @options))
        return true

    xhr_streaming: (req, res, _, next_filter) ->
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        # IE requires 2KB prefix:
        #  http://blogs.msdn.com/b/ieinternals/archive/2010/04/06/comet-streaming-in-internet-explorer-with-xmlhttprequest-and-xdomainrequest.aspx
        res.write(Array(2049).join('h') + '\n')

        transport.register(req, @, new XhrStreamingReceiver(req, res, @options) )
        return true
