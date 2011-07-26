utils = require('./utils')
transport = require('./transport')


class EventSourceReceiver extends transport.ResponseReceiver
    protocol: "eventsource"

    doSend: (payload) ->
        # Beware of leading whitespace
        data = ['data: >',
                utils.escape_selected(payload, '\r\n\x00'),
                '\r\n\r\n']
        @response.connection.write( data.join(''))

    doClose: ->
        if @response then @response.connection.end()

exports.app =
    eventsource: (req, res) ->
        headers = [
            'HTTP/' + req.httpVersion + ' 200 OK'
            'Content-type: text/event-stream; charset=UTF-8',
            'Cache-Control: no-store, no-cache, must-revalidate, max-age=0'
        ]
        # opera needs to hear two more initial new lines.
        res.connection.write(headers.concat('', '', '', '').join('\r\n'))

        session = transport.Session.bySessionIdOrNew(req.session, req.sockjs_server)
        session.register( new EventSourceReceiver(res) )
        return true
