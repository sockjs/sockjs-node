utils = require('./utils')
transport = require('./transport')

# Browsers fail with "Uncaught exception: ReferenceError: Security
# error: attempted to read protected variable: _jp". Set
# document.domain in order to work around that.
iframe_template = """
<!doctype html>
<html><head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
</head><body><h2>Don't panic!</h2>
  <script>
    document.domain = document.domain;
    var c = parent.{{ callback }};
    c.start();
    function p(d) {c.message(d);};
    window.onload = function() {c.stop();};
  </script>
"""
# Safari needs at least 1024 bytes to parse the website. Relevant:
#   http://code.google.com/p/browsersec/wiki/Part2#Survey_of_content_sniffing_behaviors
iframe_template +=  Array(1024 - iframe_template.length).join(' ')
iframe_template += '\r\n\r\n'


class HtmlFileReceiver extends transport.ResponseReceiver
    protocol: "htmlfile"
    max_response_size: 128*1024

    doSendFrame: (payload) ->
        super( '<script>\np(' + JSON.stringify(payload) + ');\n</script>\r\n' )


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
