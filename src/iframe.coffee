# ***** BEGIN LICENSE BLOCK *****
# Copyright (c) 2011-2012 VMware, Inc.
#
# For the license see COPYING.
# ***** END LICENSE BLOCK *****

utils = require('./utils')

iframe_template = """
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <script src="{{ sockjs_url }}"></script>
  <script>
    document.domain = document.domain;
    SockJS.bootstrap_iframe();
  </script>
</head>
<body>
  <h2>Don't panic!</h2>
  <p>This is a SockJS hidden iframe. It's used for cross domain magic.</p>
</body>
</html>
"""


exports.app =
    iframe: (req, res) ->
        context =
            '{{ sockjs_url }}': @options.sockjs_url

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
        return content
