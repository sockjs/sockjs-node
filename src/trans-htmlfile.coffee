utils = require('./utils')
transport = require('./transport')

# Opera fails with "Uncaught exception: ReferenceError: Security
# error: attempted to read protected variable: _jp". Set
# document.domain in order to work around that.
iframe_template = """
<html><head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <script>
    document.domain = document.domain;
  </script>
</head><body><h2>Don't panic!</h2>
  <script>
    function p(d){
        // Sniff!
        if (d[0] === 'c') {
            document.body.onload = null;
        }
        parent.{{ callback }}(d);
    };
    document.body.onload = function() {p('c[1006, "Html iframe connection broken"]');};
  </script>
"""
iframe_template +=  Array(512 - iframe_template.length).join('a')
iframe_template += '\r\n'


class HtmlFileReceiver extends transport.ResponseReceiver
    protocol: "htmlfile"

    doSendFrame: (payload) ->
        super( '<script>p(' + JSON.stringify(payload) + ');</script>\r\n' )

    doClose: (status, reason) ->
        @response.write( '<script>p(undefined, "close");</script>\r\n' )
        super

exports.app =
    htmlfile: (req, res) ->
        if not('c' of req.query or 'callback' of req.query)
            throw {
                status: 500
                message: '"callback" parameter required'
            }
        callback = if 'c' of req.query then req.query['c'] else req.query['callback']
        res.setHeader('Content-Type', 'text/html; charset=UTF-8')
        res.writeHead(200)
        res.write(iframe_template.replace(/{{ callback }}/g, callback));

        session = transport.Session.bySessionIdOrNew(req.session, req.sockjs_server)
        session.register( new HtmlFileReceiver(res) )
        return true
