# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

utils = require('./utils')
transport = require('./transport')


class EventSourceReceiver extends transport.ResponseReceiver
    protocol: "eventsource"

    doSendFrame: (payload) ->
        # Beware of leading whitespace
        data = ['data: ',
                utils.escape_selected(payload, '\r\n\x00'),
                '\r\n\r\n']
        super(data.join(''))

exports.app =
    eventsource: (req, res) ->
        if !req.headers['origin'] or req.headers['origin'] is 'null'
            origin = '*'
        else
            origin = req.headers['origin']
            res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader('Content-Type', 'text/event-stream')
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
        headers = req.headers['access-control-request-headers']
        if headers
            res.setHeader('Access-Control-Allow-Headers', headers)

        res.writeHead(200)
        # Opera needs one more new line at the start.
        res.write('\r\n')

        transport.register(req, @, new EventSourceReceiver(req, res, @options))
        return true
