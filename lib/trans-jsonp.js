# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

transport = require('./transport')

class JsonpReceiver extends transport.ResponseReceiver
    protocol: "jsonp-polling"
    max_response_size: 1

    constructor: (req, res, options, @callback) ->
        super(req, res, options)

    doSendFrame: (payload) ->
        # Yes, JSONed twice, there isn't a a better way, we must pass
        # a string back, and the script, will be evaled() by the
        # browser.
        # prepend comment to avoid SWF exploit #163
        super("/**/" + @callback + "(" + JSON.stringify(payload) + ");\r\n")


exports.app =
    jsonp: (req, res, _, next_filter) ->
        if not('c' of req.query or 'callback' of req.query)
            throw {
                status: 500
                message: '"callback" parameter required'
            }

        callback = if 'c' of req.query then req.query['c'] else req.query['callback']
        if /[^a-zA-Z0-9-_.]/.test(callback) or callback.length > 32
            throw {
                status: 500
                message: 'invalid "callback" parameter'
            }

        # protect against SWF JSONP exploit - #163
        res.setHeader('X-Content-Type-Options', 'nosniff')
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8')
        res.writeHead(200)

        transport.register(req, @, new JsonpReceiver(req, res, @options, callback))
        return true

    jsonp_send: (req, res, query) ->
        if not query
            throw {
                status: 500
                message: 'Payload expected.'
            }
        if typeof query is 'string'
            try
                d = JSON.parse(query)
            catch x
                throw {
                    status: 500
                    message: 'Broken JSON encoding.'
                }
        else
            d = query.d
        if typeof d is 'string' and d
            try
                d = JSON.parse(d)
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
        if jsonp is null
            throw {status: 404}
        for message in d
            jsonp.didMessage(message)

        res.setHeader('Content-Length', '2')
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
        res.writeHead(200)
        res.end('ok')
        return true
