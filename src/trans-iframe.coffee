utils = require('./utils')

iframe_template = """
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <script>
    _sockjs_onload = function(){SockJS.bootstrap_iframe();};
  </script>
  <script src="{{ sockjs_url }}"></script>
</head>
<body>
  <h2>Don't panic!</h2>
  <p>This is a SockJS hidden iframe. It's used for cross domain magic.</p>
</body>
<html>
"""


exports.app =
    iframe: (req, res) ->
        context =
            '{{ sockjs_url }}': req.sockjs_server.options.sockjs_url

        content = iframe_template
        for k of context
            content = content.replace(k, context[k])

        quoted_md5 = '"' + utils.md5_hex(content) + '"'

        if 'if-none-match' of req.headers and
               req.headers['if-none-match'] is quoted_md5
            res.statusCode = 304
            return ''

        res.setHeader('Content-Type', 'text/html; charset=UTF-8')
        res.setHeader('ETag', quoted_md5)
        res.cache_for = 365 * 24 * 60 * 60 # one year.
        return content
