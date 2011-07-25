utils = require('./utils')
transport = require('./transport')


class EventSource extends transport.ConnectionTransport
    protocol: "eventsource"

    constructor: (req, res) ->
        super
        headers = [
            'HTTP/' + req.httpVersion + ' 200 OK'
            'Content-type: text/event-stream; charset=UTF-8',
            'Cache-Control: no-store, no-cache, must-revalidate, max-age=0'
        ]
        @rawWrite(headers.concat('','').join('\r\n'))
        # opera needs to hear initial new lines.
        @rawWrite(['',''].join('\r\n'))
        @didOpen()

    send: (payload) ->
        # Beware of leading whitespace
        data = ['data: >',
                utils.escape_selected(payload, '\r\n\x00'),
                '\r\n\r\n']
        @rawWrite( data.join('') )

exports.app =
    eventsource: (req, res) ->
        new EventSource(req, res)
        return true
